import { randomUUID } from 'node:crypto'
import type { BusinessType, ChunkType, DocumentStatus, DocumentType, JurisdictionType } from '@prisma/client'
import { prisma } from '@/lib/db'
import { buildSearchText } from '@/lib/search/tokenize'

export async function createTestDocument(overrides: {
  title?: string
  documentType?: DocumentType
  jurisdictionType?: JurisdictionType
  jurisdictionName?: string
  status?: DocumentStatus
  businessTypes?: BusinessType[]
} = {}) {
  return prisma.legalDocument.create({
    data: {
      title: overrides.title ?? `[TEST] 문서 ${randomUUID()}`,
      documentType: overrides.documentType ?? 'LAW',
      jurisdictionType: overrides.jurisdictionType ?? 'NATIONAL',
      jurisdictionName: overrides.jurisdictionName ?? '전국',
      businessTypes: overrides.businessTypes ?? [],
      status: overrides.status ?? 'ACTIVE',
    },
  })
}

export async function createTestVersion(
  legalDocumentId: string,
  overrides: {
    versionLabel?: string
    isCurrent?: boolean
    effectiveFrom?: Date | null
    effectiveTo?: Date | null
    parsingStatus?: 'SUCCESS' | 'PENDING' | 'FAILED' | 'NO_TEXT_EXTRACTED'
  } = {},
) {
  return prisma.documentVersion.create({
    data: {
      legalDocumentId,
      versionLabel: overrides.versionLabel ?? 'v1',
      originalFilename: 'test.txt',
      mimeType: 'text/plain',
      storagePath: 'storage/uploads/test',
      contentHash: randomUUID(),
      parsingStatus: overrides.parsingStatus ?? 'SUCCESS',
      isCurrent: overrides.isCurrent ?? true,
      effectiveFrom: overrides.effectiveFrom ?? null,
      effectiveTo: overrides.effectiveTo ?? null,
    },
  })
}

export async function createTestChunk(
  documentVersionId: string,
  overrides: {
    chunkType?: ChunkType
    articleNumber?: string | null
    hierarchyPath?: string
    content?: string
    sequence?: number
  } = {},
) {
  const content = overrides.content ?? '테스트 조문 내용입니다.'
  return prisma.legalChunk.create({
    data: {
      documentVersionId,
      chunkType: overrides.chunkType ?? 'ARTICLE',
      articleNumber: overrides.articleNumber ?? null,
      hierarchyPath: overrides.hierarchyPath ?? '테스트 문서 > 제1조',
      content,
      normalizedContent: content,
      searchText: buildSearchText(content),
      tokenCount: content.length,
      sequence: overrides.sequence ?? 0,
    },
  })
}

export async function cleanupTestDocuments(ids: string[]) {
  if (ids.length === 0) return
  await prisma.legalDocument.deleteMany({ where: { id: { in: ids } } })
}
