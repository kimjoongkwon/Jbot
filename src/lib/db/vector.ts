import { prisma } from '../db'

// prisma/schema.prisma의 LegalChunk.embedding은 vector(1536)으로 고정되어 있다
// (OpenAI text-embedding-3-small 기준). 다른 차원의 임베딩 모델(Voyage 일부
// 모델 등)을 쓰려면 스키마 마이그레이션으로 차원을 맞춰야 한다.
export const EXPECTED_VECTOR_DIMENSIONS = 1536

function toVectorLiteral(embedding: number[]): string {
  return `[${embedding.join(',')}]`
}

export async function setChunkEmbedding(chunkId: string, embedding: number[]): Promise<void> {
  if (embedding.length !== EXPECTED_VECTOR_DIMENSIONS) {
    throw new Error(
      `임베딩 차원이 일치하지 않습니다 (기대값 ${EXPECTED_VECTOR_DIMENSIONS}, 실제 ${embedding.length}). ` +
        'DB 스키마(vector(1536))와 임베딩 모델의 차원이 다릅니다.',
    )
  }
  const vectorLiteral = toVectorLiteral(embedding)
  await prisma.$executeRaw`UPDATE "LegalChunk" SET embedding = ${vectorLiteral}::vector WHERE id = ${chunkId}`
}

export interface VectorSearchRow {
  id: string
  distance: number
}

/**
 * 후보 chunk id 목록 내에서 코사인 거리 기준 최근접 항목을 반환한다.
 * 하이브리드 검색에서 1차로 좁힌 후보군에 대해서만 벡터 재정렬을 수행한다.
 */
export async function searchByVector(
  embedding: number[],
  candidateChunkIds: string[],
  limit: number,
): Promise<VectorSearchRow[]> {
  if (candidateChunkIds.length === 0) return []
  const vectorLiteral = toVectorLiteral(embedding)
  return prisma.$queryRaw<VectorSearchRow[]>`
    SELECT id, (embedding <=> ${vectorLiteral}::vector) AS distance
    FROM "LegalChunk"
    WHERE id = ANY(${candidateChunkIds}) AND embedding IS NOT NULL
    ORDER BY distance ASC
    LIMIT ${limit}
  `
}
