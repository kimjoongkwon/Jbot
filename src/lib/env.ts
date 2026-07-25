import { z } from 'zod'

// DATABASE_URL은 의도적으로 필수값이 아니라 빈 문자열 기본값으로 둔다. Prisma 쿼리가
// 실제로 실행되는 시점(요청 처리 중)에만 연결을 시도하므로, DATABASE_URL이 비어 있어도
// `next build`(빌드 시점 환경변수 검증) 자체는 항상 성공해야 한다 — DB가 실제로 필요한
// 화면/라우트는 `export const dynamic = 'force-dynamic'`로 빌드 시점 프리렌더링을
// 막아두었으므로, getEnv()가 여기서 던지지 않아도 안전하다. 런타임에 DB가 정말
// 필요한데 DATABASE_URL이 없다면, 그 오류는 실제 쿼리 시점(Prisma) 또는
// isDatabaseConfigured()를 사용하는 호출부(/api/ready 등)에서 사용자가 이해할 수 있는
// 형태로 처리한다.
const envSchema = z.object({
  DATABASE_URL: z.string().optional().default(''),
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
  // Vercel Preview처럼 영구 파일 저장소가 없는 환경에서 문서 업로드 기능을 안전하게
  // 비활성화하기 위한 스위치다. true면 업로드 UI가 비활성화되고 업로드 API는 503을
  // 반환한다. 로컬 개발(기본 false)에서는 기존 업로드 기능이 그대로 유지된다.
  PREVIEW_READ_ONLY_MODE: z
    .string()
    .optional()
    .default('false')
    .transform((value) => value.trim().toLowerCase() === 'true'),
})

export type Env = z.infer<typeof envSchema>

let cachedEnv: Env | null = null

/**
 * 환경변수를 Zod로 검증해 반환한다. Claude/임베딩 API 키, DATABASE_URL이 비어 있어도
 * 이 함수 자체는 절대 던지지 않는다 — "설정이 비어 있음"과 "그 설정이 필요한 기능을
 * 지금 쓰려고 함"을 구분해서, 후자의 경우에만(실제 사용 시점에) 각 기능별 호출부가
 * 판단하게 한다(§ isClaudeConfigured/isEmbeddingConfigured/isDatabaseConfigured).
 * 이 분리 덕분에 `next build`는 어떤 환경변수도 없이 항상 성공한다.
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

/** DATABASE_URL이 (형식적으로) 채워져 있는지만 확인한다. 실제 연결 가능 여부는 별개다. */
export function isDatabaseConfigured(env: Env = getEnv()): boolean {
  return env.DATABASE_URL.trim().length > 0
}

export function isPreviewReadOnlyMode(env: Env = getEnv()): boolean {
  return env.PREVIEW_READ_ONLY_MODE
}
