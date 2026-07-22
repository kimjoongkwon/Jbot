export interface LegalBasisItem {
  citationId: string
  documentTitle: string
  article: string | null
  explanation: string
}

export interface AnalysisItem {
  issue: string
  reasoning: string
  citationIds: string[]
}

export interface LegalAnswer {
  conclusion: string
  summary: string
  legalBasis: LegalBasisItem[]
  analysis: AnalysisItem[]
  exceptions: string[]
  factsToConfirm: string[]
  conflictsOrLimitations: string[]
  confidence: 'HIGH' | 'MEDIUM' | 'LOW'
  confidenceReason: string
  referenceDate: string
  disclaimer: string
}

export interface DisplaySource {
  citationId: string
  legalChunkId: string
  documentTitle: string
  documentTypeLabel: string
  jurisdictionName: string
  hierarchyPath: string
  quotedText: string
  effectiveFrom: string | null
  isCurrent: boolean
  relevanceScore: number | null
  detailUrl: string
}

export interface ChatTurn {
  id: string
  question: string
  aiConfigured: boolean
  notice?: string
  answer: LegalAnswer | null
  sources: DisplaySource[]
  messageId: string | null
  error?: string
}

export const REGION_OPTIONS = ['전국', '서울특별시', '부산광역시', '경기도']
export const BUSINESS_TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: 'REDEVELOPMENT', label: '재개발사업' },
  { value: 'RECONSTRUCTION', label: '재건축사업' },
  { value: 'STREET_HOUSING', label: '가로주택정비사업' },
  { value: 'SMALL_RECONSTRUCTION', label: '소규모재건축사업' },
  { value: 'SMALL_REDEVELOPMENT', label: '소규모재개발사업' },
  { value: 'SELF_HOUSING', label: '자율주택정비사업' },
  { value: 'MOATOWN', label: '모아타운' },
  { value: 'OTHER', label: '기타' },
]
export const PROCEDURE_STAGE_OPTIONS: { value: string; label: string }[] = [
  { value: 'DISTRICT_DESIGNATION', label: '정비구역 지정' },
  { value: 'PROMOTION_COMMITTEE', label: '추진위원회' },
  { value: 'ASSOCIATION_ESTABLISHMENT', label: '조합설립' },
  { value: 'PROJECT_IMPLEMENTATION_PLAN', label: '사업시행계획' },
  { value: 'MANAGEMENT_DISPOSITION_PLAN', label: '관리처분계획' },
  { value: 'CONTRACTOR_SELECTION', label: '시공사 선정' },
  { value: 'RELOCATION_DEMOLITION', label: '이주 및 철거' },
  { value: 'CONSTRUCTION_COMPLETION', label: '착공 및 준공' },
  { value: 'LIQUIDATION', label: '청산' },
  { value: 'OTHER', label: '기타' },
]

export const FEEDBACK_REASON_OPTIONS: { value: string; label: string }[] = [
  { value: 'HELPFUL', label: '도움이 됨' },
  { value: 'INCORRECT', label: '답변이 부정확함' },
  { value: 'MISSING_CITATION', label: '근거가 부족함' },
  { value: 'OUTDATED_SOURCE', label: '오래된 자료임' },
  { value: 'WRONG_REGION', label: '지역이 잘못 적용됨' },
  { value: 'OTHER', label: '의견 입력' },
]
