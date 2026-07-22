import { describe, expect, it } from 'vitest'
import { canViewInternalMemo } from './permissions'

describe('canViewInternalMemo', () => {
  it('ADMIN은 내부 검토자료를 볼 수 있다', () => {
    expect(canViewInternalMemo('ADMIN')).toBe(true)
  })

  it('REVIEWER는 내부 검토자료를 볼 수 있다', () => {
    expect(canViewInternalMemo('REVIEWER')).toBe(true)
  })

  it('USER는 내부 검토자료를 볼 수 없다', () => {
    expect(canViewInternalMemo('USER')).toBe(false)
  })
})
