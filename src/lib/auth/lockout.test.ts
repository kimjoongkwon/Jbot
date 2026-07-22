import { describe, expect, it } from 'vitest'
import {
  applyFailedLogin,
  isCurrentlyLocked,
  type LockoutState,
  MAX_FAILED_LOGIN_ATTEMPTS,
  remainingLockoutMinutes,
  resetLockoutState,
} from './lockout'

describe('applyFailedLogin', () => {
  it(`${MAX_FAILED_LOGIN_ATTEMPTS}회 미만 실패에서는 잠기지 않는다`, () => {
    let state: LockoutState = { failedLoginCount: 0, lockedUntil: null }
    for (let i = 0; i < MAX_FAILED_LOGIN_ATTEMPTS - 1; i++) {
      state = applyFailedLogin(state)
    }
    expect(state.failedLoginCount).toBe(MAX_FAILED_LOGIN_ATTEMPTS - 1)
    expect(state.lockedUntil).toBeNull()
  })

  it(`${MAX_FAILED_LOGIN_ATTEMPTS}회째 실패에서 15분간 잠긴다`, () => {
    let state: LockoutState = { failedLoginCount: 0, lockedUntil: null }
    const now = new Date('2026-01-01T00:00:00Z')
    for (let i = 0; i < MAX_FAILED_LOGIN_ATTEMPTS; i++) {
      state = applyFailedLogin(state, now)
    }
    expect(state.failedLoginCount).toBe(MAX_FAILED_LOGIN_ATTEMPTS)
    expect(state.lockedUntil).toEqual(new Date('2026-01-01T00:15:00Z'))
  })
})

describe('isCurrentlyLocked', () => {
  it('lockedUntil이 미래면 잠긴 상태다', () => {
    const now = new Date('2026-01-01T00:00:00Z')
    expect(isCurrentlyLocked({ failedLoginCount: 5, lockedUntil: new Date('2026-01-01T00:10:00Z') }, now)).toBe(true)
  })

  it('lockedUntil이 과거면 잠기지 않은 상태다', () => {
    const now = new Date('2026-01-01T00:20:00Z')
    expect(isCurrentlyLocked({ failedLoginCount: 5, lockedUntil: new Date('2026-01-01T00:10:00Z') }, now)).toBe(false)
  })

  it('lockedUntil이 없으면 잠기지 않은 상태다', () => {
    expect(isCurrentlyLocked({ failedLoginCount: 0, lockedUntil: null })).toBe(false)
  })
})

describe('resetLockoutState', () => {
  it('실패 횟수와 잠금을 초기화한다', () => {
    expect(resetLockoutState()).toEqual({ failedLoginCount: 0, lockedUntil: null })
  })
})

describe('remainingLockoutMinutes', () => {
  it('남은 시간을 분 단위로 올림 계산한다', () => {
    const now = new Date('2026-01-01T00:00:00Z')
    const lockedUntil = new Date('2026-01-01T00:04:30Z')
    expect(remainingLockoutMinutes(lockedUntil, now)).toBe(5)
  })

  it('최소 1분을 반환한다', () => {
    const now = new Date('2026-01-01T00:14:59Z')
    const lockedUntil = new Date('2026-01-01T00:15:00Z')
    expect(remainingLockoutMinutes(lockedUntil, now)).toBe(1)
  })
})
