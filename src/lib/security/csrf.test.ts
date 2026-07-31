import { describe, expect, it } from 'vitest'
import { generateCsrfToken, verifyCsrfToken } from './csrf'

describe('generateCsrfToken', () => {
  it('매번 다른 토큰을 생성한다', () => {
    expect(generateCsrfToken()).not.toBe(generateCsrfToken())
  })

  it('충분히 긴 무작위 문자열을 생성한다', () => {
    expect(generateCsrfToken().length).toBeGreaterThanOrEqual(32)
  })
})

describe('verifyCsrfToken', () => {
  it('쿠키 값과 제출된 값이 같으면 통과한다', () => {
    const token = generateCsrfToken()
    expect(verifyCsrfToken(token, token)).toBe(true)
  })

  it('쿠키 값과 제출된 값이 다르면 실패한다', () => {
    expect(verifyCsrfToken(generateCsrfToken(), generateCsrfToken())).toBe(false)
  })

  it('쿠키 값이 없으면 실패한다', () => {
    expect(verifyCsrfToken(undefined, generateCsrfToken())).toBe(false)
    expect(verifyCsrfToken(null, generateCsrfToken())).toBe(false)
  })

  it('제출된 값이 없으면 실패한다', () => {
    expect(verifyCsrfToken(generateCsrfToken(), undefined)).toBe(false)
  })

  it('길이가 다른 값은 안전하게 실패 처리한다 (예외를 던지지 않음)', () => {
    expect(() => verifyCsrfToken('short', 'a-much-longer-value-than-short')).not.toThrow()
    expect(verifyCsrfToken('short', 'a-much-longer-value-than-short')).toBe(false)
  })
})
