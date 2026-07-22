import { describe, expect, it } from 'vitest'
import type { LegalAnswer } from './answerSchema'
import { validateCitations } from './citationValidation'

function makeAnswer(overrides: Partial<LegalAnswer> = {}): LegalAnswer {
  return {
    conclusion: '결론',
    summary: '요약',
    legalBasis: [{ citationId: 'C1', documentTitle: '문서', article: '제1조', explanation: '설명' }],
    analysis: [{ issue: '쟁점', reasoning: '이유', citationIds: ['C1'] }],
    exceptions: [],
    factsToConfirm: [],
    conflictsOrLimitations: [],
    confidence: 'HIGH',
    confidenceReason: '근거 명확',
    referenceDate: '2026-07-22',
    disclaimer: '면책 문구',
    ...overrides,
  }
}

describe('validateCitations', () => {
  it('유효한 citationId만 있으면 그대로 통과한다', () => {
    const result = validateCitations(makeAnswer(), new Set(['C1']))
    expect(result.hadCoreInvalidCitation).toBe(false)
    expect(result.removedCitationIds).toEqual([])
    expect(result.sanitizedAnswer.legalBasis).toHaveLength(1)
  })

  it('존재하지 않는 citationId는 legalBasis에서 제거되고 허위 인용으로 표시된다', () => {
    const answer = makeAnswer({
      legalBasis: [
        { citationId: 'C1', documentTitle: '문서', article: '제1조', explanation: '설명' },
        { citationId: 'C99', documentTitle: '존재하지 않는 문서', article: '제99조', explanation: '가짜 근거' },
      ],
    })
    const result = validateCitations(answer, new Set(['C1']))
    expect(result.sanitizedAnswer.legalBasis).toHaveLength(1)
    expect(result.sanitizedAnswer.legalBasis[0].citationId).toBe('C1')
    expect(result.hadCoreInvalidCitation).toBe(true)
    expect(result.removedCitationIds).toContain('C99')
  })

  it('analysis의 citationIds 중 허위 인용만 제거하고 유효한 것은 남긴다', () => {
    const answer = makeAnswer({
      analysis: [{ issue: '쟁점', reasoning: '이유', citationIds: ['C1', 'C99'] }],
    })
    const result = validateCitations(answer, new Set(['C1']))
    expect(result.sanitizedAnswer.analysis[0].citationIds).toEqual(['C1'])
    expect(result.removedCitationIds).toContain('C99')
  })

  it('검증된 citationId 집합이 비어 있으면 모든 인용이 제거된다', () => {
    const result = validateCitations(makeAnswer(), new Set())
    expect(result.sanitizedAnswer.legalBasis).toEqual([])
    expect(result.hadCoreInvalidCitation).toBe(true)
  })
})
