export const DOCUMENT_TYPE_OPTIONS = [
  { value: 'LAW', label: '법률' },
  { value: 'PRESIDENTIAL_DECREE', label: '시행령(대통령령)' },
  { value: 'MINISTERIAL_ORDINANCE', label: '시행규칙(부령)' },
  { value: 'LOCAL_ORDINANCE', label: '지방자치단체 조례' },
  { value: 'LOCAL_RULE', label: '조례 시행규칙' },
  { value: 'ADMINISTRATIVE_RULE', label: '국토교통부 고시 및 지침' },
  { value: 'OFFICIAL_INTERPRETATION', label: '법령해석·유권해석' },
  { value: 'COURT_CASE', label: '판례' },
  { value: 'ADMINISTRATIVE_APPEAL', label: '행정심판 사례' },
  { value: 'INTERNAL_MEMO', label: '회사 내부 검토자료' },
  { value: 'OTHER', label: '기타' },
] as const

export const JURISDICTION_TYPE_OPTIONS = [
  { value: 'NATIONAL', label: '전국 공통' },
  { value: 'METROPOLITAN', label: '광역자치단체' },
  { value: 'BASIC', label: '기초자치단체' },
] as const

export const DOCUMENT_STATUS_OPTIONS = [
  { value: 'DRAFT', label: '등록 대기' },
  { value: 'PROCESSING', label: '처리 중' },
  { value: 'ACTIVE', label: '활성' },
  { value: 'INACTIVE', label: '비활성' },
  { value: 'ERROR', label: '오류' },
] as const

export const BUSINESS_TYPE_OPTIONS = [
  { value: 'REDEVELOPMENT', label: '재개발사업' },
  { value: 'RECONSTRUCTION', label: '재건축사업' },
  { value: 'STREET_HOUSING', label: '가로주택정비사업' },
  { value: 'SMALL_RECONSTRUCTION', label: '소규모재건축사업' },
  { value: 'SMALL_REDEVELOPMENT', label: '소규모재개발사업' },
  { value: 'SELF_HOUSING', label: '자율주택정비사업' },
  { value: 'MOATOWN', label: '모아타운' },
  { value: 'OTHER', label: '기타' },
] as const

export const PROCEDURE_STAGE_OPTIONS = [
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
] as const

export const REVIEW_STATUS_OPTIONS = [
  { value: 'PENDING', label: '대기' },
  { value: 'REVIEWED', label: '검토완료' },
  { value: 'NEEDS_CORRECTION', label: '수정필요' },
  { value: 'APPROVED', label: '승인' },
] as const

export const FEEDBACK_REASON_OPTIONS = [
  { value: 'HELPFUL', label: '도움이 됨' },
  { value: 'INCORRECT', label: '답변이 부정확함' },
  { value: 'MISSING_CITATION', label: '근거가 부족함' },
  { value: 'OUTDATED_SOURCE', label: '오래된 자료임' },
  { value: 'WRONG_REGION', label: '지역이 잘못 적용됨' },
  { value: 'OTHER', label: '의견 입력' },
] as const

function toLabelMap(options: ReadonlyArray<{ value: string; label: string }>): Record<string, string> {
  return Object.fromEntries(options.map((o) => [o.value, o.label]))
}

export const documentTypeLabel = toLabelMap(DOCUMENT_TYPE_OPTIONS)
export const documentStatusLabel = toLabelMap(DOCUMENT_STATUS_OPTIONS)
export const businessTypeLabel = toLabelMap(BUSINESS_TYPE_OPTIONS)
export const procedureStageLabel = toLabelMap(PROCEDURE_STAGE_OPTIONS)
export const reviewStatusLabel = toLabelMap(REVIEW_STATUS_OPTIONS)
