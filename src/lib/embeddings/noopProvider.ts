import type { EmbeddingProvider } from './types'

/**
 * 임베딩 API 키가 없을 때 사용하는 기본 구현체. 임베딩을 생성하지 않으므로
 * 검색은 정확 조문 검색·키워드/FTS 검색만으로 동작한다 (요구사항 §8, §15).
 */
export class NoopEmbeddingProvider implements EmbeddingProvider {
  readonly name = 'none' as const
  readonly dimensions = 0

  async embed(texts: string[]): Promise<number[][]> {
    return texts.map(() => [])
  }
}
