import { describe, expect, it } from 'vitest'
import { isJurisdictionMatch } from './jurisdictionFilter'

describe('isJurisdictionMatch', () => {
  it('전국 공통 법령은 지역 선택과 무관하게 항상 매칭된다', () => {
    expect(isJurisdictionMatch('서울특별시', { jurisdictionType: 'NATIONAL', jurisdictionName: '전국' })).toBe(true)
    expect(isJurisdictionMatch(null, { jurisdictionType: 'NATIONAL', jurisdictionName: '전국' })).toBe(true)
  })

  it('지역을 선택하지 않으면 지역 조례는 매칭되지 않는다', () => {
    expect(
      isJurisdictionMatch(null, { jurisdictionType: 'METROPOLITAN', jurisdictionName: '서울특별시' }),
    ).toBe(false)
    expect(
      isJurisdictionMatch('전국', { jurisdictionType: 'METROPOLITAN', jurisdictionName: '서울특별시' }),
    ).toBe(false)
  })

  it('서울특별시 조례는 부산광역시 선택 시 매칭되지 않는다', () => {
    expect(
      isJurisdictionMatch('부산광역시', { jurisdictionType: 'METROPOLITAN', jurisdictionName: '서울특별시' }),
    ).toBe(false)
  })

  it('선택한 지역과 일치하는 조례는 매칭된다', () => {
    expect(
      isJurisdictionMatch('서울특별시', { jurisdictionType: 'METROPOLITAN', jurisdictionName: '서울특별시' }),
    ).toBe(true)
  })

  it('기초자치단체 조례는 상위 광역 선택과 부분 일치로 매칭된다', () => {
    expect(
      isJurisdictionMatch('서울특별시', { jurisdictionType: 'BASIC', jurisdictionName: '서울특별시 강남구' }),
    ).toBe(true)
  })
})
