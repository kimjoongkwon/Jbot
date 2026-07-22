import { describe, expect, it } from 'vitest'
import { isEffectiveAt, pickApplicableVersion } from './effectiveDate'

describe('isEffectiveAt', () => {
  it('effectiveFrom 이전 기준일은 유효하지 않다', () => {
    const version = { effectiveFrom: new Date('2023-01-01'), effectiveTo: null }
    expect(isEffectiveAt(version, new Date('2022-12-31'))).toBe(false)
  })

  it('effectiveFrom과 effectiveTo 사이는 유효하다', () => {
    const version = { effectiveFrom: new Date('2023-01-01'), effectiveTo: new Date('2024-01-01') }
    expect(isEffectiveAt(version, new Date('2023-06-01'))).toBe(true)
  })

  it('effectiveTo 이후 기준일은 유효하지 않다', () => {
    const version = { effectiveFrom: new Date('2023-01-01'), effectiveTo: new Date('2024-01-01') }
    expect(isEffectiveAt(version, new Date('2024-06-01'))).toBe(false)
  })

  it('effectiveFrom/effectiveTo가 없으면 항상 유효하다', () => {
    expect(isEffectiveAt({ effectiveFrom: null, effectiveTo: null }, new Date('2020-01-01'))).toBe(true)
  })
})

describe('pickApplicableVersion', () => {
  it('기준일에 유효한 버전이 없으면 null을 반환한다', () => {
    const versions = [{ effectiveFrom: new Date('2023-01-01'), effectiveTo: new Date('2023-12-31') }]
    expect(pickApplicableVersion(versions, new Date('2024-06-01'))).toBeNull()
  })

  it('개정 전/후 버전 중 기준일에 맞는 최신 버전을 선택한다', () => {
    const old = { effectiveFrom: new Date('2020-01-01'), effectiveTo: new Date('2023-12-31'), label: 'old' }
    const current = { effectiveFrom: new Date('2024-01-01'), effectiveTo: null, label: 'current' }
    expect(pickApplicableVersion([old, current], new Date('2022-06-01'))?.label).toBe('old')
    expect(pickApplicableVersion([old, current], new Date('2024-06-01'))?.label).toBe('current')
  })
})
