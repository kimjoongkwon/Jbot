import type { EmbeddingProvider } from './types'

interface VoyageEmbeddingResponse {
  data: Array<{ embedding: number[]; index: number }>
  error?: { message: string }
  detail?: string
}

export class VoyageEmbeddingProvider implements EmbeddingProvider {
  readonly name = 'voyage' as const
  // Voyage 모델별 임베딩 차원은 모델마다 다르며(예: voyage-3-lite는 512차원),
  // 이 값은 참고용일 뿐 DB 저장 전 실제 응답 벡터 길이를 반드시 검증해야 한다
  // (src/lib/db/vector.ts의 차원 검증 참고). 정확한 차원 수는 Voyage 공식 문서를
  // 확인해 VOYAGE_EMBEDDING_MODEL에 맞는 값을 사용한다.
  readonly dimensions = 0

  constructor(
    private readonly apiKey: string,
    private readonly model: string,
  ) {}

  async embed(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return []
    if (!this.model) {
      throw new Error('VOYAGE_EMBEDDING_MODEL이 설정되지 않았습니다.')
    }

    const response = await fetch('https://api.voyageai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({ model: this.model, input: texts }),
    })

    const body = (await response.json().catch(() => null)) as VoyageEmbeddingResponse | null

    if (!response.ok || !body) {
      throw new Error(body?.error?.message ?? body?.detail ?? `Voyage 임베딩 API 오류 (status ${response.status})`)
    }

    return [...body.data].sort((a, b) => a.index - b.index).map((item) => item.embedding)
  }
}
