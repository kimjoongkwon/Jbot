import { describe, expect, it } from 'vitest'
import { chunkDocument } from './chunking'

describe('chunkDocument', () => {
  it('빈 문자열은 빈 배열을 반환한다', () => {
    expect(chunkDocument('doc1', '규정.txt', '')).toEqual([])
    expect(chunkDocument('doc1', '규정.txt', '   \n\n  ')).toEqual([])
  })

  it('짧은 텍스트는 하나의 청크가 된다', () => {
    const chunks = chunkDocument('doc1', '규정.txt', '재개발 사업의 정의는 다음과 같다.')
    expect(chunks).toHaveLength(1)
    expect(chunks[0]).toMatchObject({
      id: 'doc1-0',
      docId: 'doc1',
      docName: '규정.txt',
      order: 0,
      text: '재개발 사업의 정의는 다음과 같다.',
    })
  })

  it('짧은 문단들은 maxChars 안에서 하나의 청크로 병합된다', () => {
    const text = '첫 번째 문단.\n\n두 번째 문단.\n\n세 번째 문단.'
    const chunks = chunkDocument('doc1', '규정.txt', text, { maxChars: 1000 })
    expect(chunks).toHaveLength(1)
    expect(chunks[0].text).toBe(text)
  })

  it('maxChars를 넘으면 새 청크로 나뉜다', () => {
    const paragraphs = Array.from({ length: 5 }, (_, i) => `문단 ${i}: ` + 'a'.repeat(50))
    const text = paragraphs.join('\n\n')
    const chunks = chunkDocument('doc1', '규정.txt', text, { maxChars: 120, overlapChars: 10 })
    expect(chunks.length).toBeGreaterThan(1)
    for (const chunk of chunks) {
      expect(chunk.text.length).toBeLessThanOrEqual(120 + 20)
    }
  })

  it('하나의 문단이 maxChars보다 길면 overlap을 두고 강제 분할한다', () => {
    const longParagraph = 'a'.repeat(250)
    const chunks = chunkDocument('doc1', '규정.txt', longParagraph, {
      maxChars: 100,
      overlapChars: 20,
    })
    expect(chunks.length).toBe(3)
    expect(chunks[0].text).toHaveLength(100)
    // 두 번째 청크는 첫 번째 청크의 끝부분과 20자 겹친다
    expect(chunks[1].text.slice(0, 20)).toBe(chunks[0].text.slice(-20))
  })

  it('order와 id가 순서대로 증가한다', () => {
    const paragraphs = Array.from({ length: 3 }, (_, i) => `문단${i}: ` + 'b'.repeat(50))
    const chunks = chunkDocument('doc9', '문서.md', paragraphs.join('\n\n'), { maxChars: 30 })
    chunks.forEach((chunk, index) => {
      expect(chunk.order).toBe(index)
      expect(chunk.id).toBe(`doc9-${index}`)
      expect(chunk.docName).toBe('문서.md')
    })
  })
})
