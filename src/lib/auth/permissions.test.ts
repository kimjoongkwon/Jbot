import { describe, expect, it } from 'vitest'
import { canViewInternalMemo, requiresPasswordChange } from './permissions'

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

describe('requiresPasswordChange', () => {
  it('mustChangePassword가 true면 true를 반환한다', () => {
    expect(requiresPasswordChange({ mustChangePassword: true })).toBe(true)
  })

  it('mustChangePassword가 false면 false를 반환한다', () => {
    expect(requiresPasswordChange({ mustChangePassword: false })).toBe(false)
  })
})
