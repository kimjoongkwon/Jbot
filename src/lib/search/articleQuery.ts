export interface ArticleQuery {
  lawNameHint: string | null
  articleNumber: string | null
}

// "도시정비법 제39조", "제35조", "도시 및 주거환경정비법 제1조의2" 형태를 인식한다.
const ARTICLE_QUERY_RE = /([가-힣A-Za-z0-9· ]{0,30}?)\s*제\s*(\d+)\s*조(?:\s*의\s*(\d+))?/

/**
 * 사용자 질문에서 조문 참조("제35조", "도시정비법 제39조")를 추출한다.
 * 검출되면 정확 조문 검색을 키워드/벡터 검색보다 우선한다 (요구사항 §8).
 */
export function extractArticleQuery(question: string): ArticleQuery {
  const match = ARTICLE_QUERY_RE.exec(question)
  if (!match) return { lawNameHint: null, articleNumber: null }

  const [, lawNameRaw, num, subNum] = match
  const articleNumber = subNum ? `${num}의${subNum}` : num
  const lawNameHint = lawNameRaw?.trim() || null

  return { lawNameHint, articleNumber }
}
