import { describe, expect, it } from 'vitest'
import {
  generateTemporaryPassword,
  hashPassword,
  MIN_PASSWORD_LENGTH,
  validatePasswordPolicy,
  verifyPassword,
} from './password'

describe('validatePasswordPolicy', () => {
  it(`최소 길이(${MIN_PASSWORD_LENGTH}자) 미만이면 거부한다`, () => {
    const result = validatePasswordPolicy('short1')
    expect(result.valid).toBe(false)
  })

  it('최소 길이를 만족하면 통과한다', () => {
    const result = validatePasswordPolicy('a'.repeat(MIN_PASSWORD_LENGTH))
    expect(result.valid).toBe(true)
  })
})

describe('hashPassword / verifyPassword', () => {
  it('올바른 비밀번호는 검증을 통과한다', async () => {
    const hash = await hashPassword('correct-horse-battery-staple')
    expect(await verifyPassword(hash, 'correct-horse-battery-staple')).toBe(true)
  })

  it('틀린 비밀번호는 검증에 실패한다', async () => {
    const hash = await hashPassword('correct-horse-battery-staple')
    expect(await verifyPassword(hash, 'wrong-password')).toBe(false)
  })

  it('같은 비밀번호라도 매번 다른 해시를 생성한다 (salt 포함)', async () => {
    const hash1 = await hashPassword('same-password-1234')
    const hash2 = await hashPassword('same-password-1234')
    expect(hash1).not.toBe(hash2)
  })

  it('손상된 해시 문자열은 예외 없이 false를 반환한다', async () => {
    expect(await verifyPassword('not-a-valid-hash', 'anything')).toBe(false)
  })

  it('생성된 해시는 argon2id 형식이다', async () => {
    const hash = await hashPassword('test-password-value')
    expect(hash.startsWith('$argon2id$')).toBe(true)
  })
})

describe('generateTemporaryPassword', () => {
  it('정책을 만족하는 길이의 비밀번호를 생성한다', () => {
    const password = generateTemporaryPassword()
    expect(validatePasswordPolicy(password).valid).toBe(true)
  })

  it('혼동되는 문자(0/O, 1/l/I)를 포함하지 않는다', () => {
    const password = generateTemporaryPassword()
    expect(password).not.toMatch(/[0OIl1]/)
  })

  it('호출할 때마다 다른 값을 생성한다', () => {
    const a = generateTemporaryPassword()
    const b = generateTemporaryPassword()
    expect(a).not.toBe(b)
  })
})
