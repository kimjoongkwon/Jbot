import { describe, expect, it } from 'vitest'
import { LegalAnswerSchema } from './answerSchema'

const validAnswer = {
  conclusion: '창립총회 이후에도 조합설립인가 신청 전이라면 부족한 동의서를 추가로 받을 수 있습니다.',
  summary: '조합설립인가 신청 시점까지 동의율 요건을 충족하면 됩니다.',
  legalBasis: [
    {
      citationId: 'C1',
      documentTitle: '가상 정비사업 테스트법',
      article: '제35조',
      explanation: '조합설립인가 신청 시 동의서 제출 요건을 규정합니다.',
    },
  ],
  analysis: [
    {
      issue: '동의서 추가 징구 가능 시점',
      reasoning: '법령이 정한 시점은 창립총회가 아니라 조합설립인가 신청 시점입니다.',
      citationIds: ['C1'],
    },
  ],
  exceptions: [],
  factsToConfirm: ['현재 확보된 동의율이 몇 %인지 확인 필요'],
  conflictsOrLimitations: [],
  confidence: 'MEDIUM',
  confidenceReason: '참고자료가 일반 조항만 다루고 있어 구체적 사실관계 확인이 필요합니다.',
  referenceDate: '2026-07-22',
  disclaimer:
    '본 답변은 등록된 자료를 기반으로 한 정보 제공용 검토 결과이며, 구체적인 사건에 대한 법률 자문이나 관할 행정청의 공식 판단을 대체하지 않습니다.',
}

describe('LegalAnswerSchema', () => {
  it('올바른 형식의 응답을 통과시킨다', () => {
    const result = LegalAnswerSchema.safeParse(validAnswer)
    expect(result.success).toBe(true)
  })

  it('필수 필드가 없으면 실패한다', () => {
    const { conclusion: _conclusion, ...rest } = validAnswer
    const result = LegalAnswerSchema.safeParse(rest)
    expect(result.success).toBe(false)
  })

  it('confidence가 허용된 값이 아니면 실패한다', () => {
    const result = LegalAnswerSchema.safeParse({ ...validAnswer, confidence: 'VERY_HIGH' })
    expect(result.success).toBe(false)
  })

  it('legalBasis 항목에 citationId가 없으면 실패한다', () => {
    const result = LegalAnswerSchema.safeParse({
      ...validAnswer,
      legalBasis: [{ documentTitle: '문서', article: null, explanation: '설명' }],
    })
    expect(result.success).toBe(false)
  })

  it('article은 null을 허용한다', () => {
    const result = LegalAnswerSchema.safeParse({
      ...validAnswer,
      legalBasis: [{ citationId: 'C1', documentTitle: '문서', article: null, explanation: '설명' }],
    })
    expect(result.success).toBe(true)
  })

  it('exceptions/factsToConfirm/conflictsOrLimitations는 빈 배열을 허용한다', () => {
    const result = LegalAnswerSchema.safeParse({
      ...validAnswer,
      exceptions: [],
      factsToConfirm: [],
      conflictsOrLimitations: [],
    })
    expect(result.success).toBe(true)
  })
})
