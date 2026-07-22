import type { DocumentType } from '@prisma/client'

// 숫자가 낮을수록 법적 위계가 높다 (요구사항 §2 법령 위계 구분).
const HIERARCHY_RANK: Record<DocumentType, number> = {
  LAW: 1,
  PRESIDENTIAL_DECREE: 2,
  MINISTERIAL_ORDINANCE: 3,
  LOCAL_ORDINANCE: 4,
  LOCAL_RULE: 5,
  ADMINISTRATIVE_RULE: 6,
  OFFICIAL_INTERPRETATION: 7,
  COURT_CASE: 8,
  ADMINISTRATIVE_APPEAL: 8,
  INTERNAL_MEMO: 9,
  OTHER: 10,
}

export function legalHierarchyRank(documentType: DocumentType): number {
  return HIERARCHY_RANK[documentType]
}

const MAX_RANK = 10

/**
 * 위계 순위를 0~1 사이의 가산점으로 변환한다(법률=1.0, 내부자료=낮음, 기타=0).
 * 검색 점수 합산 시 동일 조건에서 상위 법령을 약간 우대하는 용도로만 쓰고,
 * 키워드/벡터 관련도 점수를 뒤집지 않도록 작은 가중치로만 사용해야 한다.
 */
export function legalHierarchyBoost(documentType: DocumentType): number {
  const rank = legalHierarchyRank(documentType)
  return (MAX_RANK - rank) / (MAX_RANK - 1)
}

const HIERARCHY_LABELS: Record<DocumentType, string> = {
  LAW: '법률',
  PRESIDENTIAL_DECREE: '대통령령',
  MINISTERIAL_ORDINANCE: '부령',
  LOCAL_ORDINANCE: '조례',
  LOCAL_RULE: '조례 시행규칙',
  ADMINISTRATIVE_RULE: '행정규칙·고시',
  OFFICIAL_INTERPRETATION: '법령해석·유권해석',
  COURT_CASE: '판례',
  ADMINISTRATIVE_APPEAL: '행정심판',
  INTERNAL_MEMO: '내부 검토자료',
  OTHER: '기타',
}

export function legalHierarchyLabel(documentType: DocumentType): string {
  return HIERARCHY_LABELS[documentType]
}
