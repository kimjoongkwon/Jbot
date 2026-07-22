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

export { BUSINESS_TYPE_OPTIONS, PROCEDURE_STAGE_OPTIONS, FEEDBACK_REASON_OPTIONS } from '@/lib/labels'

export const REGION_OPTIONS = ['전국', '서울특별시', '부산광역시', '경기도']
