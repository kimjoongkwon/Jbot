import type { ParsedNode } from './parseLegalStructure'

export type DraftChunkType = 'ARTICLE' | 'PARAGRAPH' | 'APPENDIX' | 'GENERAL_TEXT'

export interface LegalChunkDraft {
  chunkType: DraftChunkType
  articleNumber: string | null
  articleTitle: string | null
  paragraphNumber: string | null
  itemNumber: string | null
  subItemNumber: string | null
  hierarchyPath: string
  content: string
  sequence: number
}

const DEFAULT_MAX_ARTICLE_CHARS = 1200
const CIRCLED_DIGIT_OFFSET = '①'.codePointAt(0)! - 1

function numberToCircled(n: number): string {
  if (n < 1 || n > 20) return `(${n})`
  return String.fromCodePoint(CIRCLED_DIGIT_OFFSET + n)
}

function contextSegments(node: ParsedNode): string[] {
  const segments: string[] = []
  if (node.chapterNumber) {
    segments.push(`제${node.chapterNumber}장${node.chapterTitle ? ` ${node.chapterTitle}` : ''}`)
  }
  if (node.sectionNumber) {
    segments.push(`제${node.sectionNumber}절${node.sectionTitle ? ` ${node.sectionTitle}` : ''}`)
  }
  if (node.isAddenda) segments.push('부칙')
  return segments
}

function articleSegment(node: ParsedNode): string | null {
  if (!node.articleNumber) return null
  return `제${node.articleNumber}조${node.articleTitle ? ` ${node.articleTitle}` : ''}`
}

function buildHierarchyPath(documentTitle: string, node: ParsedNode, extra: string[] = []): string {
  const segments = [documentTitle, ...contextSegments(node)]
  const artSegment = articleSegment(node)
  if (artSegment) segments.push(artSegment)
  segments.push(...extra)
  return segments.join(' > ')
}

function renderNodeGroupText(nodes: ParsedNode[]): string {
  const lines: string[] = []
  for (const node of nodes) {
    if (node.type === 'PARAGRAPH') {
      lines.push(`${numberToCircled(Number(node.paragraphNumber))}${node.text}`)
    } else if (node.type === 'ITEM') {
      lines.push(`  ${node.itemNumber}. ${node.text}`)
    } else if (node.type === 'SUB_ITEM') {
      lines.push(`    ${node.subItemNumber}. ${node.text}`)
    }
  }
  return lines.join('\n')
}

function renderArticleText(group: ParsedNode[]): string {
  const [articleNode, ...rest] = group
  const leading = articleNode.text.trim()
  const body = renderNodeGroupText(rest)
  if (leading && body) return `${leading}\n${body}`
  return leading || body
}

function splitByParagraph(nodes: ParsedNode[]): ParsedNode[][] {
  const groups: ParsedNode[][] = []
  let current: ParsedNode[] = []
  for (const node of nodes) {
    if (node.type === 'PARAGRAPH') {
      if (current.length > 0) groups.push(current)
      current = [node]
    } else {
      current.push(node)
    }
  }
  if (current.length > 0) groups.push(current)
  return groups
}

/**
 * parseLegalStructure의 결과를 저장 가능한 LegalChunk 초안으로 변환한다.
 * 기본은 조문(article) 단위 청크이며, 본문이 maxArticleChars를 넘으면
 * 항(paragraph) 단위로 추가 분할한다. 호·목은 상위 청크의 본문 텍스트에
 * 포함되며 별도 청크로 분리하지 않는다.
 */
export function buildLegalChunks(
  documentTitle: string,
  nodes: ParsedNode[],
  options: { maxArticleChars?: number } = {},
): LegalChunkDraft[] {
  const maxArticleChars = options.maxArticleChars ?? DEFAULT_MAX_ARTICLE_CHARS
  const chunks: LegalChunkDraft[] = []
  let sequence = 0

  let i = 0
  while (i < nodes.length) {
    const node = nodes[i]

    if (node.type === 'CHAPTER' || node.type === 'SECTION') {
      i++
      continue
    }

    if (node.type === 'APPENDIX') {
      chunks.push({
        chunkType: 'APPENDIX',
        articleNumber: null,
        articleTitle: node.articleTitle,
        paragraphNumber: null,
        itemNumber: null,
        subItemNumber: null,
        hierarchyPath: buildHierarchyPath(documentTitle, node, node.articleTitle ? [node.articleTitle] : []),
        content: node.text,
        sequence: sequence++,
      })
      i++
      continue
    }

    if (node.type === 'ARTICLE') {
      const groupStart = i
      let j = i + 1
      while (
        j < nodes.length &&
        (nodes[j].type === 'PARAGRAPH' || nodes[j].type === 'ITEM' || nodes[j].type === 'SUB_ITEM')
      ) {
        j++
      }
      const group = nodes.slice(groupStart, j)
      const fullText = renderArticleText(group)
      const hasParagraphs = group.some((n) => n.type === 'PARAGRAPH')

      if (fullText.length <= maxArticleChars || !hasParagraphs) {
        chunks.push({
          chunkType: 'ARTICLE',
          articleNumber: node.articleNumber,
          articleTitle: node.articleTitle,
          paragraphNumber: null,
          itemNumber: null,
          subItemNumber: null,
          hierarchyPath: buildHierarchyPath(documentTitle, node),
          content: fullText,
          sequence: sequence++,
        })
      } else {
        const leading = node.text.trim()
        const paragraphGroups = splitByParagraph(group.slice(1))
        paragraphGroups.forEach((pg, idx) => {
          const paragraphNumber = pg[0]?.type === 'PARAGRAPH' ? pg[0].paragraphNumber : null
          const text = renderNodeGroupText(pg)
          const content = idx === 0 && leading.length > 0 ? `${leading}\n${text}` : text
          chunks.push({
            chunkType: 'PARAGRAPH',
            articleNumber: node.articleNumber,
            articleTitle: node.articleTitle,
            paragraphNumber,
            itemNumber: null,
            subItemNumber: null,
            hierarchyPath: buildHierarchyPath(
              documentTitle,
              node,
              paragraphNumber ? [`제${paragraphNumber}항`] : [],
            ),
            content,
            sequence: sequence++,
          })
        })
      }

      i = j
      continue
    }

    // GENERAL_TEXT(전문·부칙 표제 등) 또는 상위 조문 없이 등장한 항/호/목(비정상 입력)
    if (node.text.trim().length > 0) {
      const extra: string[] = []
      if (node.paragraphNumber) extra.push(`제${node.paragraphNumber}항`)
      chunks.push({
        chunkType: 'GENERAL_TEXT',
        articleNumber: node.articleNumber,
        articleTitle: node.articleTitle,
        paragraphNumber: node.paragraphNumber,
        itemNumber: node.itemNumber,
        subItemNumber: node.subItemNumber,
        hierarchyPath: buildHierarchyPath(documentTitle, node, extra),
        content: node.text,
        sequence: sequence++,
      })
    }
    i++
  }

  return chunks
}
