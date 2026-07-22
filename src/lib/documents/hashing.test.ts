import { describe, expect, it } from 'vitest'
import { computeContentHash, isDuplicateHash } from './hashing'

describe('computeContentHash', () => {
  it('동일한 내용은 동일한 해시를 생성한다', () => {
    const a = computeContentHash(Buffer.from('법령 원문 텍스트'))
    const b = computeContentHash(Buffer.from('법령 원문 텍스트'))
    expect(a).toBe(b)
  })

  it('다른 내용은 다른 해시를 생성한다', () => {
    const a = computeContentHash(Buffer.from('법령 원문 텍스트 A'))
    const b = computeContentHash(Buffer.from('법령 원문 텍스트 B'))
    expect(a).not.toBe(b)
  })

  it('SHA-256 16진수 64자 문자열을 반환한다', () => {
    const hash = computeContentHash(Buffer.from('테스트'))
    expect(hash).toMatch(/^[0-9a-f]{64}$/)
  })
})

describe('isDuplicateHash', () => {
  it('목록에 존재하는 해시는 중복으로 판단한다', () => {
    expect(isDuplicateHash(['abc', 'def'], 'abc')).toBe(true)
  })

  it('목록에 없는 해시는 중복이 아니다', () => {
    expect(isDuplicateHash(['abc', 'def'], 'xyz')).toBe(false)
  })

  it('빈 목록에서는 항상 중복이 아니다', () => {
    expect(isDuplicateHash([], 'abc')).toBe(false)
  })
})
