import { type Env, getEnv, isEmbeddingConfigured } from '../env'
import { NoopEmbeddingProvider } from './noopProvider'
import { OpenAiEmbeddingProvider } from './openaiProvider'
import type { EmbeddingProvider } from './types'
import { VoyageEmbeddingProvider } from './voyageProvider'

export type { EmbeddingProvider } from './types'

/**
 * 환경변수 설정에 따라 임베딩 공급자를 선택한다. 키가 없으면 NoopEmbeddingProvider를
 * 반환해 임베딩 없이도(키워드/FTS 검색만으로) 앱이 동작하도록 한다.
 */
export function createEmbeddingProvider(env: Env = getEnv()): EmbeddingProvider {
  if (!isEmbeddingConfigured(env)) return new NoopEmbeddingProvider()

  if (env.EMBEDDING_PROVIDER === 'openai') {
    return new OpenAiEmbeddingProvider(env.OPENAI_API_KEY, env.OPENAI_EMBEDDING_MODEL)
  }
  if (env.EMBEDDING_PROVIDER === 'voyage') {
    return new VoyageEmbeddingProvider(env.VOYAGE_API_KEY, env.VOYAGE_EMBEDDING_MODEL)
  }
  return new NoopEmbeddingProvider()
}
