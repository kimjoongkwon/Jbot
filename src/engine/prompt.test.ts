import { describe, expect, it } from 'vitest'
import type { Bm25Result } from './bm25'
import { buildRagPrompt, RAG_SYSTEM_PROMPT } from './prompt'

function makeResult(docName: string, text: string, score: number): Bm25Result {
  return {
    score,
    chunk: { id: `${docName}-0`, docId: docName, docName, order: 0, text },
  }
}

describe('buildRagPrompt', () => {
  it('항상 동일한 시스템 프롬프트를 사용한다', () => {
    expect(buildRagPrompt('질문', []).system).toBe(RAG_SYSTEM_PROMPT)
  })

  it('검색 결과가 없으면 근거 없음을 명시한다', () => {
    const result = buildRagPrompt('분담금은 어떻게 계산하나요?', [])
    expect(result.userMessage).toContain('참고 문서를 찾지 못했습니다')
    expect(result.userMessage).toContain('분담금은 어떻게 계산하나요?')
  })

  it('검색 결과를 문서명과 함께 순서대로 포함한다', () => {
    const sources = [
      makeResult('규정A.txt', '분담금은 권리가액 기준으로 산정한다.', 3.2),
      makeResult('규정B.txt', '비례율은 종후자산에서 종전자산을 나눈 값이다.', 1.1),
    ]
    const result = buildRagPrompt('분담금 산정 기준은?', sources)

    expect(result.userMessage).toContain('[문서 1: 규정A.txt]')
    expect(result.userMessage).toContain('분담금은 권리가액 기준으로 산정한다.')
    expect(result.userMessage).toContain('[문서 2: 규정B.txt]')
    expect(result.userMessage).toContain('비례율은 종후자산에서 종전자산을 나눈 값이다.')
    expect(result.userMessage).toContain('질문: 분담금 산정 기준은?')
  })
})
