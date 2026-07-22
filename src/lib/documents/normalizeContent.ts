/**
 * 청크 본문의 공백을 정리한다. 원본 content는 그대로 보존하고,
 * normalizedContent/검색용 텍스트 생성에만 사용한다.
 */
export function normalizeContent(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
