export interface DocumentChunk {
  id: string
  docId: string
  docName: string
  order: number
  text: string
}

export interface ChunkOptions {
  maxChars?: number
  overlapChars?: number
}

const DEFAULT_MAX_CHARS = 800
const DEFAULT_OVERLAP_CHARS = 100

/**
 * 문서 원문을 문단 단위로 묶어 청크로 분할한다.
 * 문단이 maxChars보다 길면 overlapChars만큼 겹치며 강제 분할한다.
 */
export function chunkDocument(
  docId: string,
  docName: string,
  text: string,
  options: ChunkOptions = {},
): DocumentChunk[] {
  const maxChars = options.maxChars ?? DEFAULT_MAX_CHARS
  const overlapChars = options.overlapChars ?? DEFAULT_OVERLAP_CHARS

  const normalized = text.replace(/\r\n/g, '\n').trim()
  if (normalized.length === 0) return []

  const paragraphs = normalized
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0)

  const chunkTexts: string[] = []
  let current = ''

  for (const paragraph of paragraphs) {
    if (paragraph.length > maxChars) {
      if (current.length > 0) {
        chunkTexts.push(current)
        current = ''
      }
      chunkTexts.push(...splitLongParagraph(paragraph, maxChars, overlapChars))
      continue
    }

    const candidate = current.length > 0 ? `${current}\n\n${paragraph}` : paragraph
    if (candidate.length > maxChars) {
      chunkTexts.push(current)
      current = paragraph
    } else {
      current = candidate
    }
  }

  if (current.length > 0) chunkTexts.push(current)

  return chunkTexts.map((chunkText, index) => ({
    id: `${docId}-${index}`,
    docId,
    docName,
    order: index,
    text: chunkText,
  }))
}

function splitLongParagraph(paragraph: string, maxChars: number, overlapChars: number): string[] {
  // overlapChars가 maxChars 이상이면 슬라이딩 윈도우가 앞으로 전진하지 못해
  // 무한 루프에 빠지므로, 매 반복 최소 1자는 전진하도록 값을 clamp한다.
  const safeOverlap = Math.min(Math.max(overlapChars, 0), maxChars - 1)

  const parts: string[] = []
  let start = 0
  while (start < paragraph.length) {
    const end = Math.min(start + maxChars, paragraph.length)
    parts.push(paragraph.slice(start, end))
    if (end === paragraph.length) break
    start = end - safeOverlap
  }
  return parts
}
