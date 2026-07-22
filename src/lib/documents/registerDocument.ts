import path from 'node:path'
import type { BusinessType, DocumentType, JurisdictionType } from '@prisma/client'
import { recordAuditLog } from '../audit/auditLog'
import { prisma } from '../db'
import { getEnv } from '../env'
import { getFileStorageProvider } from '../storage'
import { DuplicateFileError, ValidationError } from './errors'
import { computeContentHash } from './hashing'
import { runIngestionPipeline } from './ingestionPipeline'
import { extractText } from './textExtraction'
import { validateUploadFile } from './fileValidation'

export interface UploadedFileInput {
  buffer: Buffer
  filename: string
  mimeType: string
}

export interface DocumentMetaInput {
  title: string
  shortTitle?: string | null
  documentType: DocumentType
  jurisdictionType: JurisdictionType
  jurisdictionName: string
  businessTypes: BusinessType[]
  issuingAuthority?: string | null
  sourceUrl?: string | null
  description?: string | null
}

export interface VersionMetaInput {
  versionLabel: string
  promulgationDate?: Date | null
  effectiveFrom?: Date | null
  effectiveTo?: Date | null
  isCurrent: boolean
}

async function ingestUploadedFile(file: UploadedFileInput) {
  const env = getEnv()
  const validation = validateUploadFile({
    filename: file.filename,
    mimeType: file.mimeType,
    sizeBytes: file.buffer.length,
    maxSizeMb: env.MAX_UPLOAD_SIZE_MB,
  })
  if (!validation.valid) {
    throw new ValidationError(validation.errorMessage ?? '파일 검증에 실패했습니다.')
  }

  const contentHash = computeContentHash(file.buffer)
  const existing = await prisma.documentVersion.findUnique({ where: { contentHash } })
  if (existing) {
    throw new DuplicateFileError()
  }

  // path.basename으로 경로 조작 가능성을 제거한 뒤 contentHash를 붙여 키 충돌을 막는다.
  const safeFilename = path.basename(file.filename)
  const storageKey = `${contentHash}-${safeFilename}`
  const stored = await getFileStorageProvider().put({
    key: storageKey,
    buffer: file.buffer,
    contentType: file.mimeType,
  })
  const extraction = await extractText(file.buffer, file.filename)

  return { contentHash, storagePath: stored.key, extraction }
}

function parsingStatusFromExtraction(status: 'SUCCESS' | 'NO_TEXT_EXTRACTED' | 'FAILED') {
  if (status === 'SUCCESS') return 'PENDING' as const
  return status
}

/** 새 LegalDocument를 생성하고 최초 버전을 등록·수집한다. */
export async function registerLegalDocument(
  meta: DocumentMetaInput,
  version: VersionMetaInput,
  file: UploadedFileInput,
  actorUserId: string | null,
) {
  const { contentHash, storagePath, extraction } = await ingestUploadedFile(file)

  const legalDocument = await prisma.legalDocument.create({
    data: {
      title: meta.title,
      shortTitle: meta.shortTitle ?? null,
      documentType: meta.documentType,
      jurisdictionType: meta.jurisdictionType,
      jurisdictionName: meta.jurisdictionName,
      businessTypes: meta.businessTypes,
      issuingAuthority: meta.issuingAuthority ?? null,
      sourceUrl: meta.sourceUrl ?? null,
      description: meta.description ?? null,
      status: 'PROCESSING',
    },
  })

  const documentVersion = await prisma.documentVersion.create({
    data: {
      legalDocumentId: legalDocument.id,
      versionLabel: version.versionLabel,
      promulgationDate: version.promulgationDate ?? null,
      effectiveFrom: version.effectiveFrom ?? null,
      effectiveTo: version.effectiveTo ?? null,
      isCurrent: version.isCurrent,
      originalFilename: file.filename,
      mimeType: file.mimeType,
      storagePath,
      contentHash,
      rawText: extraction.status === 'SUCCESS' ? extraction.text : null,
      parsingStatus: parsingStatusFromExtraction(extraction.status),
    },
  })

  await recordAuditLog({
    userId: actorUserId,
    action: 'DOCUMENT_CREATED',
    targetType: 'LegalDocument',
    targetId: legalDocument.id,
    legalDocumentId: legalDocument.id,
    metadata: {
      versionId: documentVersion.id,
      originalFilename: file.filename,
      extractionStatus: extraction.status,
    },
  })

  if (extraction.status === 'SUCCESS') {
    try {
      await runIngestionPipeline(documentVersion.id)
    } catch {
      // 상태(ERROR/FAILED)는 runIngestionPipeline 내부에서 이미 기록됨
    }
  } else {
    await prisma.legalDocument.update({ where: { id: legalDocument.id }, data: { status: 'ERROR' } })
  }

  return { legalDocument, documentVersion, extraction }
}

/** 기존 LegalDocument에 새 버전을 등록한다. 기존 버전은 덮어쓰지 않는다. */
export async function registerDocumentVersion(
  legalDocumentId: string,
  version: VersionMetaInput,
  file: UploadedFileInput,
  actorUserId: string | null,
) {
  await prisma.legalDocument.findUniqueOrThrow({ where: { id: legalDocumentId } })
  const { contentHash, storagePath, extraction } = await ingestUploadedFile(file)

  // 새 버전의 텍스트 추출이 실패하면(스캔 문서 등) 이 버전은 현행으로 승격하지 않는다.
  // 그렇지 않으면 정상 동작하던 현행 버전이 깨진 버전으로 교체되어 문서 전체가
  // 검색 불가 상태(ERROR)로 빠지는 사고가 발생한다(요구사항 §12 "기존 버전 보존").
  const shouldBecomeCurrent = version.isCurrent && extraction.status === 'SUCCESS'

  const documentVersion = await prisma.$transaction(async (tx) => {
    if (shouldBecomeCurrent) {
      await tx.documentVersion.updateMany({
        where: { legalDocumentId, isCurrent: true },
        data: { isCurrent: false },
      })
    }

    return tx.documentVersion.create({
      data: {
        legalDocumentId,
        versionLabel: version.versionLabel,
        promulgationDate: version.promulgationDate ?? null,
        effectiveFrom: version.effectiveFrom ?? null,
        effectiveTo: version.effectiveTo ?? null,
        isCurrent: shouldBecomeCurrent,
        originalFilename: file.filename,
        mimeType: file.mimeType,
        storagePath,
        contentHash,
        rawText: extraction.status === 'SUCCESS' ? extraction.text : null,
        parsingStatus: parsingStatusFromExtraction(extraction.status),
      },
    })
  })

  await recordAuditLog({
    userId: actorUserId,
    action: 'DOCUMENT_VERSION_ADDED',
    targetType: 'DocumentVersion',
    targetId: documentVersion.id,
    legalDocumentId,
    metadata: { originalFilename: file.filename, extractionStatus: extraction.status },
  })

  if (extraction.status === 'SUCCESS') {
    // 새 버전이 현행으로 승격될 때만 문서 상태를 처리 중으로 표시한다. 현행이 아닌
    // 과거 버전을 추가하는 경우(기준일 검색을 위해 청크는 생성하되) 기존 활성
    // 문서의 상태에는 영향을 주지 않는다(affectDocumentStatus: false).
    if (shouldBecomeCurrent) {
      await prisma.legalDocument.update({ where: { id: legalDocumentId }, data: { status: 'PROCESSING' } })
    }
    try {
      await runIngestionPipeline(documentVersion.id, { affectDocumentStatus: shouldBecomeCurrent })
    } catch {
      // 상태는 runIngestionPipeline 내부에서 이미 기록됨(affectDocumentStatus인 경우만)
    }
  }
  // 추출 실패 시에는 이 실패한 버전만 기록하고, 기존에 활성 상태였던 문서의
  // status(ACTIVE 등)는 건드리지 않는다 — 실패한 업로드 한 번으로 기존에
  // 정상 동작하던 문서가 검색 불가 상태(ERROR)가 되지 않도록 한다.

  return { documentVersion, extraction }
}
