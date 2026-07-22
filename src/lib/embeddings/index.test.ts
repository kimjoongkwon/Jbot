import { describe, expect, it } from 'vitest'
import type { Env } from '../env'
import { createEmbeddingProvider } from './index'
import { NoopEmbeddingProvider } from './noopProvider'
import { OpenAiEmbeddingProvider } from './openaiProvider'
import { VoyageEmbeddingProvider } from './voyageProvider'

const BASE_ENV: Env = {
  DATABASE_URL: 'postgresql://test',
  ANTHROPIC_API_KEY: '',
  ANTHROPIC_MODEL: '',
  EMBEDDING_PROVIDER: 'none',
  OPENAI_API_KEY: '',
  OPENAI_EMBEDDING_MODEL: 'text-embedding-3-small',
  VOYAGE_API_KEY: '',
  VOYAGE_EMBEDDING_MODEL: '',
  NEXT_PUBLIC_APP_NAME: '정비사업 법령 AI',
  MAX_UPLOAD_SIZE_MB: 20,
  SESSION_SECRET: 'test-secret',
}

function makeEnv(overrides: Partial<Env>): Env {
  return { ...BASE_ENV, ...overrides }
}

describe('createEmbeddingProvider', () => {
  it('EMBEDDING_PROVIDER가 none이면 NoopEmbeddingProvider를 반환한다', () => {
    const provider = createEmbeddingProvider(makeEnv({ EMBEDDING_PROVIDER: 'none' }))
    expect(provider).toBeInstanceOf(NoopEmbeddingProvider)
  })

  it('openai가 선택되어도 API 키가 없으면 NoopEmbeddingProvider로 폴백한다', () => {
    const provider = createEmbeddingProvider(makeEnv({ EMBEDDING_PROVIDER: 'openai', OPENAI_API_KEY: '' }))
    expect(provider).toBeInstanceOf(NoopEmbeddingProvider)
  })

  it('openai + API 키가 있으면 OpenAiEmbeddingProvider를 반환한다', () => {
    const provider = createEmbeddingProvider(
      makeEnv({ EMBEDDING_PROVIDER: 'openai', OPENAI_API_KEY: 'sk-test', OPENAI_EMBEDDING_MODEL: 'text-embedding-3-small' }),
    )
    expect(provider).toBeInstanceOf(OpenAiEmbeddingProvider)
  })

  it('voyage + API 키가 있으면 VoyageEmbeddingProvider를 반환한다', () => {
    const provider = createEmbeddingProvider(
      makeEnv({ EMBEDDING_PROVIDER: 'voyage', VOYAGE_API_KEY: 'vk-test', VOYAGE_EMBEDDING_MODEL: 'voyage-3' }),
    )
    expect(provider).toBeInstanceOf(VoyageEmbeddingProvider)
  })
})

describe('NoopEmbeddingProvider', () => {
  it('입력 개수만큼 빈 배열을 반환한다', async () => {
    const provider = new NoopEmbeddingProvider()
    const result = await provider.embed(['a', 'b', 'c'])
    expect(result).toEqual([[], [], []])
  })
})
