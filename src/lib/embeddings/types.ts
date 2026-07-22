export interface EmbeddingProvider {
  readonly name: 'none' | 'openai' | 'voyage'
  readonly dimensions: number
  embed(texts: string[]): Promise<number[][]>
}
