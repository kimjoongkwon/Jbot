import type { BusinessType, DocumentType } from '@prisma/client'
import { prisma } from '../db'
import { searchByVector } from '../db/vector'
import { createEmbeddingProvider } from '../embeddings'
import { pickApplicableVersion } from '../dates/effectiveDate'
import { extractArticleQuery } from './articleQuery'
import { isJurisdictionMatch } from './jurisdictionFilter'
import { legalHierarchyBoost } from './legalHierarchy'
import { tokenize } from './tokenize'

export interface HybridSearchInput {
  question: string
  region?: string | null
  businessType?: BusinessType | null
  documentType?: DocumentType | null
  referenceDate?: Date | null
  maxResults?: number
  includeInternalMemo?: boolean
}

export type MatchReason = 'EXACT_ARTICLE' | 'KEYWORD' | 'VECTOR'

export interface HybridSearchResultItem {
  chunkId: string
  score: number
  matchReason: MatchReason
}

const DEFAULT_MAX_RESULTS = 10
const MAX_PER_ARTICLE = 2

function escapeTsQueryToken(token: string): string {
  return token.replace(/'/g, "''")
}

/**
 * 정확 조문 검색 > 키워드/FTS 검색 > 벡터 검색 순으로 후보를 모으고,
 * 지역·사업유형·기준일·활성 상태로 걸러진 후보군 내에서만 검색한다.
 * 최종 결과는 8~12개(기본 10개) 이내로 제한하고, 동일 조문의 중복을
 * 과도하게 포함하지 않는다 (요구사항 §8).
 */
export async function hybridSearch(input: HybridSearchInput): Promise<HybridSearchResultItem[]> {
  const maxResults = input.maxResults ?? DEFAULT_MAX_RESULTS
  const referenceDate = input.referenceDate ?? new Date()

  const documents = await prisma.legalDocument.findMany({
    where: {
      status: 'ACTIVE',
      businessTypes: input.businessType ? { has: input.businessType } : undefined,
      AND: [
        input.documentType ? { documentType: input.documentType } : {},
        input.includeInternalMemo === false ? { documentType: { not: 'INTERNAL_MEMO' as const } } : {},
      ],
    },
    include: {
      versions: {
        where: { parsingStatus: 'SUCCESS' },
        select: { id: true, effectiveFrom: true, effectiveTo: true, isCurrent: true },
      },
    },
  })

  const candidateVersionIds: string[] = []
  for (const doc of documents) {
    if (!isJurisdictionMatch(input.region, doc)) continue
    const applicable = input.referenceDate
      ? pickApplicableVersion(doc.versions, referenceDate)
      : (doc.versions.find((v) => v.isCurrent) ?? null)
    if (applicable) candidateVersionIds.push(applicable.id)
  }

  if (candidateVersionIds.length === 0) return []

  const candidateChunks = await prisma.legalChunk.findMany({
    where: { documentVersionId: { in: candidateVersionIds } },
    select: { id: true, articleNumber: true, documentVersionId: true, documentVersion: { select: { legalDocument: { select: { title: true, shortTitle: true, documentType: true } } } } },
  })
  if (candidateChunks.length === 0) return []

  const candidateChunkIds = candidateChunks.map((c) => c.id)
  const scoreByChunk = new Map<string, { score: number; reason: MatchReason }>()

  function applyScore(chunkId: string, score: number, reason: MatchReason) {
    const existing = scoreByChunk.get(chunkId)
    if (!existing || score > existing.score) {
      scoreByChunk.set(chunkId, { score, reason })
    }
  }

  // 1) 정확 조문 검색
  const articleQuery = extractArticleQuery(input.question)
  if (articleQuery.articleNumber) {
    for (const chunk of candidateChunks) {
      if (chunk.articleNumber !== articleQuery.articleNumber) continue
      const doc = chunk.documentVersion.legalDocument
      const lawNameMatches =
        !articleQuery.lawNameHint ||
        doc.title.includes(articleQuery.lawNameHint) ||
        (doc.shortTitle?.includes(articleQuery.lawNameHint) ?? false)
      const boost = legalHierarchyBoost(doc.documentType)
      applyScore(chunk.id, (lawNameMatches ? 1000 : 500) + boost, 'EXACT_ARTICLE')
    }
  }

  // 2) 키워드/FTS 검색 (searchText는 한국어 2-gram으로 사전 토큰화되어 저장됨)
  const queryTokens = tokenize(input.question)
  if (queryTokens.length > 0) {
    const tsQuery = queryTokens.map((t) => `'${escapeTsQueryToken(t)}'`).join(' | ')
    const ftsRows = await prisma.$queryRaw<Array<{ id: string; rank: number }>>`
      SELECT id, ts_rank("searchVector", to_tsquery('simple', ${tsQuery})) AS rank
      FROM "LegalChunk"
      WHERE id = ANY(${candidateChunkIds}) AND "searchVector" @@ to_tsquery('simple', ${tsQuery})
      ORDER BY rank DESC
      LIMIT ${Math.max(maxResults * 3, 30)}
    `
    const docTypeByChunk = new Map(candidateChunks.map((c) => [c.id, c.documentVersion.legalDocument.documentType]))
    for (const row of ftsRows) {
      const docType = docTypeByChunk.get(row.id)
      const boost = docType ? legalHierarchyBoost(docType) * 0.1 : 0
      applyScore(row.id, Number(row.rank) + boost, 'KEYWORD')
    }
  }

  // 3) 벡터 검색 (임베딩 공급자가 설정된 경우에만)
  const embeddingProvider = createEmbeddingProvider()
  if (embeddingProvider.name !== 'none') {
    const [questionEmbedding] = await embeddingProvider.embed([input.question])
    if (questionEmbedding && questionEmbedding.length > 0) {
      const vectorRows = await searchByVector(questionEmbedding, candidateChunkIds, Math.max(maxResults * 3, 30))
      const docTypeByChunk = new Map(candidateChunks.map((c) => [c.id, c.documentVersion.legalDocument.documentType]))
      for (const row of vectorRows) {
        const similarity = 1 - row.distance
        const docType = docTypeByChunk.get(row.id)
        const boost = docType ? legalHierarchyBoost(docType) * 0.1 : 0
        applyScore(row.id, similarity + boost, 'VECTOR')
      }
    }
  }

  // 4) 동일 조문 중복 억제: (documentVersionId, articleNumber) 그룹당 최대 2개
  const chunkMeta = new Map(candidateChunks.map((c) => [c.id, c]))
  const groupCounts = new Map<string, number>()

  const ranked = [...scoreByChunk.entries()]
    .map(([chunkId, value]) => ({ chunkId, ...value }))
    .sort((a, b) => b.score - a.score)

  const results: HybridSearchResultItem[] = []
  for (const item of ranked) {
    const meta = chunkMeta.get(item.chunkId)
    const groupKey = meta ? `${meta.documentVersionId}:${meta.articleNumber ?? item.chunkId}` : item.chunkId
    const count = groupCounts.get(groupKey) ?? 0
    if (count >= MAX_PER_ARTICLE) continue
    groupCounts.set(groupKey, count + 1)
    results.push({ chunkId: item.chunkId, score: item.score, matchReason: item.reason })
    if (results.length >= maxResults) break
  }

  return results
}
