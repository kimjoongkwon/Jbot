import { describe, expect, it } from 'vitest'
import { legalHierarchyBoost, legalHierarchyRank } from './legalHierarchy'

describe('legalHierarchyRank', () => {
  it('법률이 조례보다 상위(낮은 숫자)이다', () => {
    expect(legalHierarchyRank('LAW')).toBeLessThan(legalHierarchyRank('LOCAL_ORDINANCE'))
  })

  it('조례가 조례 시행규칙보다 상위이다', () => {
    expect(legalHierarchyRank('LOCAL_ORDINANCE')).toBeLessThan(legalHierarchyRank('LOCAL_RULE'))
  })

  it('행정규칙·고시가 유권해석보다 상위이다', () => {
    expect(legalHierarchyRank('ADMINISTRATIVE_RULE')).toBeLessThan(legalHierarchyRank('OFFICIAL_INTERPRETATION'))
  })

  it('내부 검토자료가 가장 낮은 축에 속한다(OTHER 제외)', () => {
    expect(legalHierarchyRank('INTERNAL_MEMO')).toBeGreaterThan(legalHierarchyRank('COURT_CASE'))
    expect(legalHierarchyRank('INTERNAL_MEMO')).toBeLessThan(legalHierarchyRank('OTHER'))
  })
})

describe('legalHierarchyBoost', () => {
  it('법률의 가산점이 가장 높다', () => {
    expect(legalHierarchyBoost('LAW')).toBe(1)
  })

  it('상위 법령일수록 가산점이 높다', () => {
    expect(legalHierarchyBoost('LAW')).toBeGreaterThan(legalHierarchyBoost('LOCAL_ORDINANCE'))
    expect(legalHierarchyBoost('LOCAL_ORDINANCE')).toBeGreaterThan(legalHierarchyBoost('INTERNAL_MEMO'))
  })
})
