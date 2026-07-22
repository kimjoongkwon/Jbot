import type { JurisdictionType } from '@prisma/client'

export interface JurisdictionDoc {
  jurisdictionType: JurisdictionType
  jurisdictionName: string
}

/**
 * 전국 공통 법령은 항상 매칭되고, 지역 조례/자료는 선택된 지역과 일치하는
 * 경우에만 매칭한다. 서울특별시 조례가 부산광역시 질문에 자동 적용되지
 * 않도록 하는 핵심 로직이다 (요구사항 §2 지역 구분).
 *
 * selectedRegion이 없거나 "전국"이면 전국 공통 법령만 매칭한다(사용자가
 * 특정 지역을 선택하지 않았으므로 지역 조례를 임의로 끌어오지 않는다).
 */
export function isJurisdictionMatch(selectedRegion: string | null | undefined, doc: JurisdictionDoc): boolean {
  if (doc.jurisdictionType === 'NATIONAL') return true

  if (!selectedRegion || selectedRegion === '전국') return false

  const region = selectedRegion.trim()
  const docRegion = doc.jurisdictionName.trim()
  if (region.length === 0 || docRegion.length === 0) return false

  return docRegion === region || docRegion.includes(region) || region.includes(docRegion)
}
