import { describe, expect, it } from 'vitest'
import type { DocumentChunk } from './chunking'
import { buildBm25Index, searchBm25 } from './bm25'

function makeChunk(id: string, text: string): DocumentChunk {
  return { id, docId: 'doc1', docName: '규정.txt', order: 0, text }
}

describe('bm25', () => {
  it('청크가 없으면 빈 결과를 반환한다', () => {
    const index = buildBm25Index([])
    expect(searchBm25(index, '재개발 분담금')).toEqual([])
  })

  it('질의어가 비어 있으면 빈 결과를 반환한다', () => {
    const index = buildBm25Index([makeChunk('c1', '재개발 사업의 분담금 산정 기준')])
    expect(searchBm25(index, '')).toEqual([])
  })

  it('질의어와 겹치는 청크만 결과에 포함한다', () => {
    const chunks = [
      makeChunk('c1', '재개발 사업의 분담금 산정 기준에 대한 설명이다.'),
      makeChunk('c2', '오늘 점심 메뉴는 김치찌개였다.'),
    ]
    const index = buildBm25Index(chunks)
    const results = searchBm25(index, '분담금 산정')
    expect(results).toHaveLength(1)
    expect(results[0].chunk.id).toBe('c1')
  })

  it('관련성이 높은 청크가 먼저 나온다', () => {
    const chunks = [
      makeChunk('c1', '분담금은 조합원별 권리가액과 비례율로 산정한다. 분담금 산정 방식.'),
      makeChunk('c2', '분담금이라는 용어가 문서 어딘가에 한 번 등장한다.'),
    ]
    const index = buildBm25Index(chunks)
    const results = searchBm25(index, '분담금 산정')
    expect(results[0].chunk.id).toBe('c1')
  })

  it('topK로 결과 개수를 제한한다', () => {
    const chunks = Array.from({ length: 10 }, (_, i) => makeChunk(`c${i}`, `재개발 사업 문서 ${i}`))
    const index = buildBm25Index(chunks)
    const results = searchBm25(index, '재개발 사업', 3)
    expect(results).toHaveLength(3)
  })

  it('모든 점수가 정렬되어 반환된다', () => {
    const chunks = [
      makeChunk('c1', '재건축 조합원 총회 의결 정족수'),
      makeChunk('c2', '재건축 재건축 재건축 조합원 총회'),
    ]
    const index = buildBm25Index(chunks)
    const results = searchBm25(index, '재건축 총회')
    expect(results.map((r) => r.chunk.id)).toEqual(['c2', 'c1'])
    expect(results[0].score).toBeGreaterThan(results[1].score)
  })
})
