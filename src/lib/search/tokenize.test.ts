import { describe, expect, it } from 'vitest'
import { buildSearchText, tokenize } from './tokenize'

describe('tokenize', () => {
  it('한글은 2-gram으로 분할한다', () => {
    expect(tokenize('재개발사업')).toEqual(['재개', '개발', '발사', '사업'])
  })

  it('영문/숫자는 단어 단위로 토큰화한다', () => {
    expect(tokenize('제35조 2024')).toEqual(['제', '35', '조', '2024'])
  })

  it('빈 문자열은 빈 배열을 반환한다', () => {
    expect(tokenize('')).toEqual([])
  })
})

describe('buildSearchText', () => {
  it('토큰을 공백으로 이어붙인 문자열을 반환한다', () => {
    expect(buildSearchText('조합설립')).toBe('조합 합설 설립')
  })
})
