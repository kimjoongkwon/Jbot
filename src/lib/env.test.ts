import { describe, expect, it } from 'vitest'
import type { Env } from './env'
import { isClaudeConfigured, isDatabaseConfigured, isEmbeddingConfigured, isPreviewReadOnlyMode } from './env'

const BASE_ENV: Env = {
  DATABASE_URL: '',
  ANTHROPIC_API_KEY: '',
  ANTHROPIC_MODEL: '',
  EMBEDDING_PROVIDER: 'none',
  OPENAI_API_KEY: '',
  OPENAI_EMBEDDING_MODEL: 'text-embedding-3-small',
  VOYAGE_API_KEY: '',
  VOYAGE_EMBEDDING_MODEL: '',
  NEXT_PUBLIC_APP_NAME: '정비사업 법령 AI',
  MAX_UPLOAD_SIZE_MB: 20,
  BOOTSTRAP_ADMIN_EMAIL: '',
  BOOTSTRAP_ADMIN_PASSWORD: '',
  BOOTSTRAP_ADMIN_NAME: '',
  DEV_AUTH_BYPASS: false,
  STORAGE_PROVIDER: 'local',
  STORAGE_LOCAL_ROOT: 'storage/uploads',
  STORAGE_S3_BUCKET: '',
  STORAGE_S3_REGION: 'us-east-1',
  STORAGE_S3_ENDPOINT: '',
  STORAGE_S3_FORCE_PATH_STYLE: false,
  STORAGE_S3_ACCESS_KEY_ID: '',
  STORAGE_S3_SECRET_ACCESS_KEY: '',
  PREVIEW_READ_ONLY_MODE: false,
}

describe('isDatabaseConfigured', () => {
  it('DATABASE_URL이 비어 있으면 false다 (build 시점에 빌드 자체를 막지 않기 위한 분리)', () => {
    expect(isDatabaseConfigured({ ...BASE_ENV, DATABASE_URL: '' })).toBe(false)
  })

  it('DATABASE_URL이 채워져 있으면 true다', () => {
    expect(isDatabaseConfigured({ ...BASE_ENV, DATABASE_URL: 'postgresql://x' })).toBe(true)
  })
})

describe('isPreviewReadOnlyMode', () => {
  it('기본값(false)이면 업로드가 허용된다는 뜻으로 false를 반환한다', () => {
    expect(isPreviewReadOnlyMode({ ...BASE_ENV, PREVIEW_READ_ONLY_MODE: false })).toBe(false)
  })

  it('true면 그대로 true를 반환한다(Preview 읽기 전용 모드)', () => {
    expect(isPreviewReadOnlyMode({ ...BASE_ENV, PREVIEW_READ_ONLY_MODE: true })).toBe(true)
  })
})

describe('isClaudeConfigured / isEmbeddingConfigured (회귀 확인)', () => {
  it('ANTHROPIC 키/모델이 모두 있어야 Claude가 설정된 것으로 본다', () => {
    expect(isClaudeConfigured({ ...BASE_ENV, ANTHROPIC_API_KEY: 'k', ANTHROPIC_MODEL: 'm' })).toBe(true)
    expect(isClaudeConfigured({ ...BASE_ENV, ANTHROPIC_API_KEY: '', ANTHROPIC_MODEL: 'm' })).toBe(false)
  })

  it('EMBEDDING_PROVIDER가 none이면 항상 false다', () => {
    expect(isEmbeddingConfigured({ ...BASE_ENV, EMBEDDING_PROVIDER: 'none' })).toBe(false)
  })
})
