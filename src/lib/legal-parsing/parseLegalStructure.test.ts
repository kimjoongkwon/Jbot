import { describe, expect, it } from 'vitest'
import { parseLegalStructure } from './parseLegalStructure'

// 아래 텍스트는 파서 동작 검증을 위한 합성 예시이며 실제 법령 원문이 아니다.

describe('parseLegalStructure', () => {
  it('제N조를 인식하고 괄호 제목을 분리한다', () => {
    const nodes = parseLegalStructure('제35조(조합설립인가 등) 조합을 설립하려는 경우 다음 각 호의 동의를 받아야 한다.')
    const article = nodes.find((n) => n.type === 'ARTICLE')
    expect(article).toBeTruthy()
    expect(article?.articleNumber).toBe('35')
    expect(article?.articleTitle).toBe('조합설립인가 등')
    expect(article?.text).toBe('조합을 설립하려는 경우 다음 각 호의 동의를 받아야 한다.')
  })

  it('제N조의M(가지번호) 형식을 인식한다', () => {
    const nodes = parseLegalStructure('제1조의2(정의) 이 법에서 사용하는 용어의 뜻은 다음과 같다.')
    const article = nodes.find((n) => n.type === 'ARTICLE')
    expect(article?.articleNumber).toBe('1의2')
    expect(article?.articleTitle).toBe('정의')
  })

  it('괄호 제목이 없는 조문도 인식한다', () => {
    const nodes = parseLegalStructure('제1조 이 법은 정비사업의 원활한 추진을 목적으로 한다.')
    const article = nodes.find((n) => n.type === 'ARTICLE')
    expect(article?.articleNumber).toBe('1')
    expect(article?.articleTitle).toBeNull()
    expect(article?.text).toBe('이 법은 정비사업의 원활한 추진을 목적으로 한다.')
  })

  it('항(①~⑳)을 숫자로 변환한다', () => {
    const nodes = parseLegalStructure(
      ['제5조(동의서 제출) 다음과 같다.', '①토지등소유자는 동의서를 제출한다.', '②동의는 서면으로 한다.'].join('\n'),
    )
    const paragraphs = nodes.filter((n) => n.type === 'PARAGRAPH')
    expect(paragraphs).toHaveLength(2)
    expect(paragraphs[0].paragraphNumber).toBe('1')
    expect(paragraphs[0].text).toBe('토지등소유자는 동의서를 제출한다.')
    expect(paragraphs[1].paragraphNumber).toBe('2')
  })

  it('호(1. 2. ...)와 목(가. 나. ...)을 인식하고 상위 문맥을 함께 기록한다', () => {
    const nodes = parseLegalStructure(
      [
        '제5조(동의서 제출) 다음과 같다.',
        '①토지등소유자는 다음 각 호의 서류를 제출한다.',
        '1. 동의서',
        '가. 인감증명서',
        '나. 신분증 사본',
        '2. 위임장',
      ].join('\n'),
    )
    const item1 = nodes.find((n) => n.type === 'ITEM' && n.itemNumber === '1')
    expect(item1?.text).toBe('동의서')
    expect(item1?.articleNumber).toBe('5')
    expect(item1?.paragraphNumber).toBe('1')

    const subItems = nodes.filter((n) => n.type === 'SUB_ITEM')
    expect(subItems.map((s) => s.subItemNumber)).toEqual(['가', '나'])
    expect(subItems[0].text).toBe('인감증명서')
    expect(subItems[0].itemNumber).toBe('1')

    const item2 = nodes.find((n) => n.type === 'ITEM' && n.itemNumber === '2')
    expect(item2?.text).toBe('위임장')
  })

  it('장·절 문맥이 이후 조문에 이어서 기록된다', () => {
    const nodes = parseLegalStructure(
      ['제3장 조합 및 조합설립인가', '제1절 조합의 설립', '제35조(조합설립인가 등) 본문 내용.'].join('\n'),
    )
    const article = nodes.find((n) => n.type === 'ARTICLE')
    expect(article?.chapterNumber).toBe('3')
    expect(article?.chapterTitle).toBe('조합 및 조합설립인가')
    expect(article?.sectionNumber).toBe('1')
    expect(article?.sectionTitle).toBe('조합의 설립')
  })

  it('여러 줄에 걸친 본문을 직전 노드에 이어붙인다', () => {
    const nodes = parseLegalStructure(
      ['제1조(목적) 이 법은', '정비사업의 원활한 추진을 목적으로 한다.'].join('\n'),
    )
    const article = nodes.find((n) => n.type === 'ARTICLE')
    expect(article?.text).toBe('이 법은\n정비사업의 원활한 추진을 목적으로 한다.')
  })

  it('별표를 인식한다', () => {
    const nodes = parseLegalStructure('별표 1 동의서 서식')
    const appendix = nodes.find((n) => n.type === 'APPENDIX')
    expect(appendix?.articleTitle).toBe('별표 1')
    expect(appendix?.text).toBe('동의서 서식')
  })

  it('부칙 이후 조문 번호가 부칙 전용 문맥으로 리셋되고 isAddenda가 true가 된다', () => {
    const nodes = parseLegalStructure(
      ['제2조(적용범위) 본문.', '부칙 <제1234호, 2020.1.1.>', '제1조(시행일) 이 법은 공포한 날부터 시행한다.'].join('\n'),
    )
    const mainArticle = nodes.find((n) => n.type === 'ARTICLE' && n.articleNumber === '2')
    expect(mainArticle?.isAddenda).toBe(false)

    const addendaArticle = nodes.find((n) => n.type === 'ARTICLE' && n.articleNumber === '1' && n.isAddenda)
    expect(addendaArticle).toBeTruthy()
    expect(addendaArticle?.articleTitle).toBe('시행일')
    expect(addendaArticle?.chapterNumber).toBeNull()
  })

  it('빈 문자열은 빈 배열을 반환한다', () => {
    expect(parseLegalStructure('')).toEqual([])
    expect(parseLegalStructure('   \n\n  ')).toEqual([])
  })
})
