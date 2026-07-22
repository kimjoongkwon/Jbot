import { describe, expect, it } from 'vitest'
import { tokenize } from './tokenize'

describe('tokenize', () => {
  it('빈 문자열은 빈 배열을 반환한다', () => {
    expect(tokenize('')).toEqual([])
  })

  it('영문/숫자는 단어 단위로 토큰화한다', () => {
    expect(tokenize('PPA V2 2024')).toEqual(['ppa', 'v2', '2024'])
  })

  it('한글 2글자는 그대로 하나의 토큰이 된다', () => {
    expect(tokenize('재개발')).toEqual(['재개', '개발'])
  })

  it('한글 1글자는 단일 토큰이 된다', () => {
    expect(tokenize('가')).toEqual(['가'])
  })

  it('한글 텍스트를 연속 2-gram으로 분할한다', () => {
    expect(tokenize('재건축사업')).toEqual(['재건', '건축', '축사', '사업'])
  })

  it('한글과 영문이 섞인 텍스트를 각각의 방식으로 토큰화한다', () => {
    expect(tokenize('재개발 API 연동')).toEqual(['재개', '개발', 'api', '연동'])
  })

  it('구두점과 공백은 토큰 경계로 취급하고 결과에 포함하지 않는다', () => {
    expect(tokenize('분담금, 조합원비용!')).toEqual(['분담', '담금', '조합', '합원', '원비', '비용'])
  })
})
