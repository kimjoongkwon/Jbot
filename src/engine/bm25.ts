import type { DocumentChunk } from './chunking'
import { tokenize } from './tokenize'

export interface Bm25Index {
  chunks: DocumentChunk[]
  tokenizedChunks: string[][]
  docLengths: number[]
  avgDocLength: number
  documentFrequency: Map<string, number>
  chunkCount: number
}

export interface Bm25Result {
  chunk: DocumentChunk
  score: number
}

const K1 = 1.5
const B = 0.75

export function buildBm25Index(chunks: DocumentChunk[]): Bm25Index {
  const tokenizedChunks = chunks.map((chunk) => tokenize(chunk.text))
  const docLengths = tokenizedChunks.map((tokens) => tokens.length)
  const chunkCount = chunks.length
  const avgDocLength =
    chunkCount === 0 ? 0 : docLengths.reduce((sum, len) => sum + len, 0) / chunkCount

  const documentFrequency = new Map<string, number>()
  for (const tokens of tokenizedChunks) {
    for (const term of new Set(tokens)) {
      documentFrequency.set(term, (documentFrequency.get(term) ?? 0) + 1)
    }
  }

  return { chunks, tokenizedChunks, docLengths, avgDocLength, documentFrequency, chunkCount }
}

/**
 * BM25 점수로 질의와 관련된 청크를 상위 topK개 반환한다.
 * 질의 용어가 전혀 등장하지 않는 청크(score 0)는 결과에서 제외한다.
 */
export function searchBm25(index: Bm25Index, query: string, topK = 5): Bm25Result[] {
  const queryTerms = tokenize(query)
  if (queryTerms.length === 0 || index.chunkCount === 0) return []

  const results: Bm25Result[] = index.chunks.map((chunk, docIndex) => {
    const tokens = index.tokenizedChunks[docIndex]
    const termFreq = new Map<string, number>()
    for (const term of tokens) {
      termFreq.set(term, (termFreq.get(term) ?? 0) + 1)
    }

    const docLength = index.docLengths[docIndex]
    let score = 0
    for (const term of queryTerms) {
      const freq = termFreq.get(term)
      if (!freq) continue

      const docFreq = index.documentFrequency.get(term) ?? 0
      const idf = Math.log(1 + (index.chunkCount - docFreq + 0.5) / (docFreq + 0.5))
      const denom = freq + K1 * (1 - B + (B * docLength) / (index.avgDocLength || 1))
      score += idf * ((freq * (K1 + 1)) / denom)
    }

    return { chunk, score }
  })

  return results
    .filter((result) => result.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
}
