import type { EmbeddingProvider } from './types'

interface OpenAiEmbeddingResponse {
  data: Array<{ embedding: number[]; index: number }>
  error?: { message: string }
}

export class OpenAiEmbeddingProvider implements EmbeddingProvider {
  readonly name = 'openai' as const
  readonly dimensions = 1536

  constructor(
    private readonly apiKey: string,
    private readonly model: string,
  ) {}

  async embed(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return []

    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({ model: this.model, input: texts }),
    })

    const body = (await response.json().catch(() => null)) as OpenAiEmbeddingResponse | null

    if (!response.ok || !body) {
      throw new Error(body?.error?.message ?? `OpenAI 임베딩 API 오류 (status ${response.status})`)
    }

    return [...body.data].sort((a, b) => a.index - b.index).map((item) => item.embedding)
  }
}
