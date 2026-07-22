import type { LegalAnswer } from './answerSchema'

export interface CitationValidationResult {
  sanitizedAnswer: LegalAnswer
  removedCitationIds: string[]
  hadCoreInvalidCitation: boolean
}

/**
 * AI가 반환한 citationId가 실제 검색된 참고자료(validCitationIds)에 존재하는지
 * 서버에서 검증한다. 존재하지 않는 citationId(허위 인용)는 결과에서 제거하며,
 * legalBasis(핵심 법적 근거)에 허위 인용이 있었다면 hadCoreInvalidCitation을
 * true로 표시해 호출부에서 신뢰도를 하향 조정하거나 답변 실패 처리할 수 있게
 * 한다 (요구사항 §9).
 */
export function validateCitations(
  answer: LegalAnswer,
  validCitationIds: ReadonlySet<string>,
): CitationValidationResult {
  const removed = new Set<string>()

  const legalBasis = answer.legalBasis.filter((item) => {
    const ok = validCitationIds.has(item.citationId)
    if (!ok) removed.add(item.citationId)
    return ok
  })
  const hadCoreInvalidCitation = legalBasis.length < answer.legalBasis.length

  const analysis = answer.analysis.map((item) => ({
    ...item,
    citationIds: item.citationIds.filter((id) => {
      const ok = validCitationIds.has(id)
      if (!ok) removed.add(id)
      return ok
    }),
  }))

  return {
    sanitizedAnswer: { ...answer, legalBasis, analysis },
    removedCitationIds: [...removed],
    hadCoreInvalidCitation,
  }
}
