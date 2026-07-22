import type { BusinessType, DocumentType, JurisdictionType } from '@prisma/client'
import { recordAuditLog } from '../audit/auditLog'
import { prisma } from '../db'
import { getEnv } from '../env'
import { DuplicateFileError, ValidationError } from './errors'
import { computeContentHash } from './hashing'
import { runIngestionPipeline } from './ingestionPipeline'
import { saveUploadedFile } from './storage'
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

  const storagePath = await saveUploadedFile(file.buffer, contentHash, file.filename)
  const extraction = await extractText(file.buffer, file.filename)

  return { contentHash, storagePath, extraction }
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

  if (version.isCurrent) {
    await prisma.documentVersion.updateMany({
      where: { legalDocumentId, isCurrent: true },
      data: { isCurrent: false },
    })
  }

  const documentVersion = await prisma.documentVersion.create({
    data: {
      legalDocumentId,
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
    action: 'DOCUMENT_VERSION_ADDED',
    targetType: 'DocumentVersion',
    targetId: documentVersion.id,
    legalDocumentId,
    metadata: { originalFilename: file.filename, extractionStatus: extraction.status },
  })

  await prisma.legalDocument.update({ where: { id: legalDocumentId }, data: { status: 'PROCESSING' } })

  if (extraction.status === 'SUCCESS') {
    try {
      await runIngestionPipeline(documentVersion.id)
    } catch {
      // 상태는 runIngestionPipeline 내부에서 이미 기록됨
    }
  } else {
    await prisma.legalDocument.update({ where: { id: legalDocumentId }, data: { status: 'ERROR' } })
  }

  return { documentVersion, extraction }
}
