export type ParsedNodeType =
  | 'CHAPTER'
  | 'SECTION'
  | 'ARTICLE'
  | 'PARAGRAPH'
  | 'ITEM'
  | 'SUB_ITEM'
  | 'APPENDIX'
  | 'GENERAL_TEXT'

export interface ParsedNode {
  type: ParsedNodeType
  chapterNumber: string | null
  chapterTitle: string | null
  sectionNumber: string | null
  sectionTitle: string | null
  articleNumber: string | null
  articleTitle: string | null
  paragraphNumber: string | null
  itemNumber: string | null
  subItemNumber: string | null
  isAddenda: boolean
  text: string
}

const CHAPTER_RE = /^제\s*(\d+)\s*장\s*(.*)$/
const SECTION_RE = /^제\s*(\d+)\s*절\s*(.*)$/
// 제35조(조합설립인가 등) / 제1조의2(정의) / 제1조 목적
const ARTICLE_RE = /^제\s*(\d+)\s*조(?:\s*의\s*(\d+))?\s*(?:\(([^)]*)\))?\s*(.*)$/
const PARAGRAPH_RE = /^([①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳])\s*(.*)$/
const ITEM_RE = /^(\d{1,3})\.\s*(.*)$/
const SUB_ITEM_LETTERS = '가나다라마바사아자차카타파하'
const SUB_ITEM_RE = new RegExp(`^([${SUB_ITEM_LETTERS}])(?:\\s*의\\s*(\\d+))?\\s*\\.\\s*(.*)$`)
const APPENDIX_RE = /^별\s*표\s*(\d+)?\s*(.*)$/
const ADDENDA_RE = /^부\s*칙\s*(.*)$/

const CIRCLED_DIGIT_OFFSET = '①'.codePointAt(0)! - 1

function circledToNumber(circled: string): string {
  const code = circled.codePointAt(0)!
  return String(code - CIRCLED_DIGIT_OFFSET)
}

interface ParserState {
  chapterNumber: string | null
  chapterTitle: string | null
  sectionNumber: string | null
  sectionTitle: string | null
  articleNumber: string | null
  articleTitle: string | null
  paragraphNumber: string | null
  itemNumber: string | null
  isAddenda: boolean
}

function baseFields(state: ParserState) {
  return {
    chapterNumber: state.chapterNumber,
    chapterTitle: state.chapterTitle,
    sectionNumber: state.sectionNumber,
    sectionTitle: state.sectionTitle,
    isAddenda: state.isAddenda,
  }
}

/**
 * 한국 법령/조례 텍스트를 장·절·조·항·호·목·별표·부칙 구조로 파싱한다.
 * 줄 단위로 스캔하며, 구조 마커가 없는 줄은 직전 노드의 본문에 이어붙인다.
 */
export function parseLegalStructure(rawText: string): ParsedNode[] {
  const lines = rawText
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)

  const nodes: ParsedNode[] = []
  const state: ParserState = {
    chapterNumber: null,
    chapterTitle: null,
    sectionNumber: null,
    sectionTitle: null,
    articleNumber: null,
    articleTitle: null,
    paragraphNumber: null,
    itemNumber: null,
    isAddenda: false,
  }

  function pushNode(node: Omit<ParsedNode, keyof ReturnType<typeof baseFields>> & Partial<ReturnType<typeof baseFields>>) {
    nodes.push({ ...baseFields(state), ...node } as ParsedNode)
  }

  function appendToLast(text: string) {
    const last = nodes[nodes.length - 1]
    if (!last) {
      pushNode({
        type: 'GENERAL_TEXT',
        articleNumber: null,
        articleTitle: null,
        paragraphNumber: null,
        itemNumber: null,
        subItemNumber: null,
        text,
      })
      return
    }
    last.text = last.text.length > 0 ? `${last.text}\n${text}` : text
  }

  for (const line of lines) {
    const addendaMatch = ADDENDA_RE.exec(line)
    if (addendaMatch) {
      state.isAddenda = true
      state.chapterNumber = null
      state.chapterTitle = null
      state.sectionNumber = null
      state.sectionTitle = null
      state.articleNumber = null
      state.articleTitle = null
      state.paragraphNumber = null
      state.itemNumber = null
      pushNode({
        type: 'GENERAL_TEXT',
        articleNumber: null,
        articleTitle: null,
        paragraphNumber: null,
        itemNumber: null,
        subItemNumber: null,
        text: line,
      })
      continue
    }

    const appendixMatch = APPENDIX_RE.exec(line)
    if (appendixMatch) {
      const [, num, rest] = appendixMatch
      pushNode({
        type: 'APPENDIX',
        articleNumber: null,
        articleTitle: num ? `별표 ${num}` : '별표',
        paragraphNumber: null,
        itemNumber: null,
        subItemNumber: null,
        text: rest ?? '',
      })
      continue
    }

    const chapterMatch = CHAPTER_RE.exec(line)
    if (chapterMatch) {
      const [, num, title] = chapterMatch
      state.chapterNumber = num
      state.chapterTitle = title || null
      state.sectionNumber = null
      state.sectionTitle = null
      state.articleNumber = null
      state.articleTitle = null
      state.paragraphNumber = null
      state.itemNumber = null
      pushNode({
        type: 'CHAPTER',
        articleNumber: null,
        articleTitle: null,
        paragraphNumber: null,
        itemNumber: null,
        subItemNumber: null,
        text: title || '',
      })
      continue
    }

    const sectionMatch = SECTION_RE.exec(line)
    if (sectionMatch) {
      const [, num, title] = sectionMatch
      state.sectionNumber = num
      state.sectionTitle = title || null
      state.articleNumber = null
      state.articleTitle = null
      state.paragraphNumber = null
      state.itemNumber = null
      pushNode({
        type: 'SECTION',
        articleNumber: null,
        articleTitle: null,
        paragraphNumber: null,
        itemNumber: null,
        subItemNumber: null,
        text: title || '',
      })
      continue
    }

    const articleMatch = ARTICLE_RE.exec(line)
    if (articleMatch) {
      const [, num, subNum, parenTitle, rest] = articleMatch
      const articleNumber = subNum ? `${num}의${subNum}` : num
      state.articleNumber = articleNumber
      state.articleTitle = parenTitle || null
      state.paragraphNumber = null
      state.itemNumber = null
      pushNode({
        type: 'ARTICLE',
        articleNumber,
        articleTitle: parenTitle || null,
        paragraphNumber: null,
        itemNumber: null,
        subItemNumber: null,
        text: rest ?? '',
      })
      continue
    }

    const paragraphMatch = PARAGRAPH_RE.exec(line)
    if (paragraphMatch) {
      const [, circled, rest] = paragraphMatch
      const paragraphNumber = circledToNumber(circled)
      state.paragraphNumber = paragraphNumber
      state.itemNumber = null
      pushNode({
        type: 'PARAGRAPH',
        articleNumber: state.articleNumber,
        articleTitle: state.articleTitle,
        paragraphNumber,
        itemNumber: null,
        subItemNumber: null,
        text: rest,
      })
      continue
    }

    const itemMatch = ITEM_RE.exec(line)
    if (itemMatch) {
      const [, num, rest] = itemMatch
      state.itemNumber = num
      pushNode({
        type: 'ITEM',
        articleNumber: state.articleNumber,
        articleTitle: state.articleTitle,
        paragraphNumber: state.paragraphNumber,
        itemNumber: num,
        subItemNumber: null,
        text: rest,
      })
      continue
    }

    const subItemMatch = SUB_ITEM_RE.exec(line)
    if (subItemMatch) {
      const [, letter, subNum, rest] = subItemMatch
      const subItemNumber = subNum ? `${letter}의${subNum}` : letter
      pushNode({
        type: 'SUB_ITEM',
        articleNumber: state.articleNumber,
        articleTitle: state.articleTitle,
        paragraphNumber: state.paragraphNumber,
        itemNumber: state.itemNumber,
        subItemNumber,
        text: rest,
      })
      continue
    }

    appendToLast(line)
  }

  return nodes
}
