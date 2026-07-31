export const MAX_FAILED_LOGIN_ATTEMPTS = 5
export const LOCKOUT_DURATION_MS = 15 * 60 * 1000 // 15분

export interface LockoutState {
  failedLoginCount: number
  lockedUntil: Date | null
}

/** 계정이 현재 잠금 상태인지 판단한다. */
export function isCurrentlyLocked(state: LockoutState, now: Date = new Date()): boolean {
  return !!state.lockedUntil && state.lockedUntil.getTime() > now.getTime()
}

/**
 * 로그인 실패 후 다음 잠금 상태를 계산한다. 실패 횟수가 임계값에 도달하면
 * 15분간 잠근다. 순수 함수로 만들어 실제 정책(임계값·잠금 시간)을 DB 없이
 * 검증할 수 있게 한다.
 */
export function applyFailedLogin(state: LockoutState, now: Date = new Date()): LockoutState {
  const nextCount = state.failedLoginCount + 1
  if (nextCount >= MAX_FAILED_LOGIN_ATTEMPTS) {
    return { failedLoginCount: nextCount, lockedUntil: new Date(now.getTime() + LOCKOUT_DURATION_MS) }
  }
  return { failedLoginCount: nextCount, lockedUntil: state.lockedUntil }
}

/** 로그인 성공 시 실패 횟수·잠금 상태를 초기화한다. */
export function resetLockoutState(): LockoutState {
  return { failedLoginCount: 0, lockedUntil: null }
}

export function remainingLockoutMinutes(lockedUntil: Date, now: Date = new Date()): number {
  return Math.max(1, Math.ceil((lockedUntil.getTime() - now.getTime()) / 60_000))
}
