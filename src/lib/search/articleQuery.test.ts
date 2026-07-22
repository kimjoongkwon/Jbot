import { describe, expect, it } from 'vitest'
import { extractArticleQuery } from './articleQuery'

describe('extractArticleQuery', () => {
  it('법령명 없이 조문 번호만 있는 경우를 인식한다', () => {
    expect(extractArticleQuery('제35조는 무슨 내용인가요?')).toEqual({
      lawNameHint: null,
      articleNumber: '35',
    })
  })

  it('법령명과 조문 번호를 함께 인식한다', () => {
    const result = extractArticleQuery('도시정비법 제39조의 요건이 궁금합니다.')
    expect(result.articleNumber).toBe('39')
    expect(result.lawNameHint).toContain('도시정비법')
  })

  it('조의N 형식을 인식한다', () => {
    expect(extractArticleQuery('제1조의2에 따르면')).toEqual({
      lawNameHint: null,
      articleNumber: '1의2',
    })
  })

  it('조문 참조가 없으면 null을 반환한다', () => {
    expect(extractArticleQuery('가로주택정비사업 동의율이 어떻게 되나요?')).toEqual({
      lawNameHint: null,
      articleNumber: null,
    })
  })
})
