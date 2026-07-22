import { describe, expect, it } from 'vitest'
import { parseLegalStructure } from './parseLegalStructure'
import { buildLegalChunks } from './buildLegalChunks'

// 아래 텍스트는 청크 분할 로직 검증을 위한 합성 예시이며 실제 법령 원문이 아니다.
const DOC_TITLE = '가상 정비사업 테스트법'

describe('buildLegalChunks', () => {
  it('짧은 조문은 하나의 ARTICLE 청크로 병합된다', () => {
    const nodes = parseLegalStructure('제1조(목적) 이 법은 정비사업의 원활한 추진을 목적으로 한다.')
    const chunks = buildLegalChunks(DOC_TITLE, nodes)
    expect(chunks).toHaveLength(1)
    expect(chunks[0].chunkType).toBe('ARTICLE')
    expect(chunks[0].articleNumber).toBe('1')
    expect(chunks[0].content).toBe('이 법은 정비사업의 원활한 추진을 목적으로 한다.')
    expect(chunks[0].hierarchyPath).toBe(`${DOC_TITLE} > 제1조 목적`)
  })

  it('항이 있어도 길이가 짧으면 하나의 ARTICLE 청크로 병합된다', () => {
    const text = ['제5조(동의) 다음과 같다.', '①서면으로 동의한다.', '②철회할 수 있다.'].join('\n')
    const nodes = parseLegalStructure(text)
    const chunks = buildLegalChunks(DOC_TITLE, nodes)
    expect(chunks).toHaveLength(1)
    expect(chunks[0].chunkType).toBe('ARTICLE')
    expect(chunks[0].content).toContain('①서면으로 동의한다.')
    expect(chunks[0].content).toContain('②철회할 수 있다.')
  })

  it('maxArticleChars를 넘으면 항 단위 청크로 분할된다', () => {
    const text = [
      '제3장 조합 및 조합설립인가',
      '제35조(조합설립인가 등) 다음과 같다.',
      `①${'가'.repeat(50)}`,
      `②${'나'.repeat(50)}`,
      '1. 세부사항',
    ].join('\n')
    const nodes = parseLegalStructure(text)
    const chunks = buildLegalChunks(DOC_TITLE, nodes, { maxArticleChars: 30 })

    expect(chunks.every((c) => c.chunkType === 'PARAGRAPH')).toBe(true)
    expect(chunks).toHaveLength(2)
    expect(chunks[0].paragraphNumber).toBe('1')
    expect(chunks[0].content).toContain('①' + '가'.repeat(50))
    expect(chunks[1].paragraphNumber).toBe('2')
    expect(chunks[1].content).toContain('②' + '나'.repeat(50))
    expect(chunks[1].content).toContain('1. 세부사항')
  })

  it('분할된 청크의 hierarchyPath는 장·조·항을 모두 포함한다', () => {
    const text = [
      '제3장 조합 및 조합설립인가',
      '제35조(조합설립인가 등) 다음과 같다.',
      `①${'가'.repeat(50)}`,
      `②${'나'.repeat(50)}`,
    ].join('\n')
    const nodes = parseLegalStructure(text)
    const chunks = buildLegalChunks(DOC_TITLE, nodes, { maxArticleChars: 30 })

    expect(chunks[0].hierarchyPath).toBe(`${DOC_TITLE} > 제3장 조합 및 조합설립인가 > 제35조 조합설립인가 등 > 제1항`)
    expect(chunks[1].hierarchyPath).toBe(`${DOC_TITLE} > 제3장 조합 및 조합설립인가 > 제35조 조합설립인가 등 > 제2항`)
  })

  it('별표는 APPENDIX 청크로 별도 생성된다', () => {
    const nodes = parseLegalStructure('별표 1 동의서 서식')
    const chunks = buildLegalChunks(DOC_TITLE, nodes)
    expect(chunks).toHaveLength(1)
    expect(chunks[0].chunkType).toBe('APPENDIX')
    expect(chunks[0].hierarchyPath).toBe(`${DOC_TITLE} > 별표 1`)
  })

  it('부칙 조문은 hierarchyPath에 부칙이 표시된다', () => {
    const text = ['부칙 <제1234호, 2020.1.1.>', '제1조(시행일) 이 법은 공포한 날부터 시행한다.'].join('\n')
    const nodes = parseLegalStructure(text)
    const chunks = buildLegalChunks(DOC_TITLE, nodes)
    const article = chunks.find((c) => c.chunkType === 'ARTICLE')
    expect(article?.hierarchyPath).toBe(`${DOC_TITLE} > 부칙 > 제1조 시행일`)
  })

  it('빈 파싱 결과는 빈 청크 배열을 반환한다', () => {
    expect(buildLegalChunks(DOC_TITLE, [])).toEqual([])
  })
})
