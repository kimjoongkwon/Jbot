import { z } from 'zod'

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL이 설정되지 않았습니다.'),
  ANTHROPIC_API_KEY: z.string().optional().default(''),
  ANTHROPIC_MODEL: z.string().optional().default(''),
  EMBEDDING_PROVIDER: z.enum(['none', 'openai', 'voyage']).optional().default('none'),
  OPENAI_API_KEY: z.string().optional().default(''),
  OPENAI_EMBEDDING_MODEL: z.string().optional().default('text-embedding-3-small'),
  VOYAGE_API_KEY: z.string().optional().default(''),
  VOYAGE_EMBEDDING_MODEL: z.string().optional().default(''),
  NEXT_PUBLIC_APP_NAME: z.string().optional().default('정비사업 법령 AI'),
  MAX_UPLOAD_SIZE_MB: z.coerce.number().positive().optional().default(20),
  // 세션 쿠키(HMAC) 서명 키. 배포 환경에서는 반드시 무작위 값으로 교체해야 한다.
  // (`openssl rand -hex 32` 등으로 생성). 비어 있으면(다른 키들과 동일한 관례로
  // 빈 문자열을 "미설정"으로 취급) 로컬 개발 전용 기본값으로 대체된다.
  SESSION_SECRET: z
    .string()
    .optional()
    .default('')
    .transform((value) => (value.trim().length > 0 ? value : 'dev-only-insecure-session-secret-change-me')),
})

export type Env = z.infer<typeof envSchema>

let cachedEnv: Env | null = null

/**
 * 환경변수를 Zod로 검증해 반환한다. Claude/임베딩 API 키가 비어 있어도
 * 앱 자체는 정상 동작해야 하므로, 해당 값들은 필수값이 아니라 빈 문자열
 * 기본값으로 허용한다 (기능별 활성화 여부는 호출부에서 개별 판단).
 */
export function getEnv(): Env {
  if (cachedEnv) return cachedEnv
  const parsed = envSchema.safeParse(process.env)
  if (!parsed.success) {
    throw new Error(`환경변수 설정이 올바르지 않습니다: ${parsed.error.message}`)
  }
  cachedEnv = parsed.data
  return cachedEnv
}

export function isClaudeConfigured(env: Env = getEnv()): boolean {
  return env.ANTHROPIC_API_KEY.trim().length > 0 && env.ANTHROPIC_MODEL.trim().length > 0
}

export function isEmbeddingConfigured(env: Env = getEnv()): boolean {
  if (env.EMBEDDING_PROVIDER === 'openai') return env.OPENAI_API_KEY.trim().length > 0
  if (env.EMBEDDING_PROVIDER === 'voyage') return env.VOYAGE_API_KEY.trim().length > 0
  return false
}
