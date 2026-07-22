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
  // 최초 관리자 부트스트랩 계정. 셋 다 채워져 있을 때만 앱 시작 시 1회
  // 생성을 시도하며(이미 같은 이메일의 사용자가 있으면 건드리지 않음),
  // 비밀번호를 로그에 남기지 않는다. 최초 생성 후에는 README 안내대로
  // 이 값들을 반드시 제거한다.
  BOOTSTRAP_ADMIN_EMAIL: z.string().optional().default(''),
  BOOTSTRAP_ADMIN_PASSWORD: z.string().optional().default(''),
  BOOTSTRAP_ADMIN_NAME: z.string().optional().default(''),
  // 개발 전용 인증 우회 스위치. NODE_ENV==='production'이면 이 값이 무엇이든
  // 절대 우회를 허용하지 않으며, 오히려 'true'로 설정된 채 프로덕션에서
  // 기동되면 앱을 즉시 실패시킨다(요구사항 §3-7) — 아래 assertDevAuthBypassSafety 참고.
  DEV_AUTH_BYPASS: z
    .string()
    .optional()
    .default('false')
    .transform((value) => value.trim().toLowerCase() === 'true'),
  // 업로드 원본 파일 저장소 (요구사항 §6). 'local'은 단일 서버 로컬 디스크
  // 전용 개발용 구현이며, 서버리스·다중 인스턴스 운영 환경에서는 's3'로
  // 설정해 S3 호환 오브젝트 스토리지(AWS S3, R2, MinIO 등)를 사용해야 한다.
  STORAGE_PROVIDER: z.enum(['local', 's3']).optional().default('local'),
  STORAGE_LOCAL_ROOT: z.string().optional().default('storage/uploads'),
  STORAGE_S3_BUCKET: z.string().optional().default(''),
  STORAGE_S3_REGION: z.string().optional().default('us-east-1'),
  // AWS S3라면 비워둔다. R2/MinIO 등 S3 호환 스토리지일 때만 지정한다.
  STORAGE_S3_ENDPOINT: z.string().optional().default(''),
  STORAGE_S3_FORCE_PATH_STYLE: z
    .string()
    .optional()
    .default('false')
    .transform((value) => value.trim().toLowerCase() === 'true'),
  STORAGE_S3_ACCESS_KEY_ID: z.string().optional().default(''),
  STORAGE_S3_SECRET_ACCESS_KEY: z.string().optional().default(''),
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
  assertDevAuthBypassSafety(parsed.data)
  assertStorageConfigSafety(parsed.data)
  cachedEnv = parsed.data
  return cachedEnv
}

/** STORAGE_PROVIDER=s3인데 버킷이 비어 있으면 파일 저장이 항상 실패하므로 시작 시점에 바로 알린다. */
function assertStorageConfigSafety(env: Env): void {
  if (env.STORAGE_PROVIDER === 's3' && env.STORAGE_S3_BUCKET.trim().length === 0) {
    throw new Error('STORAGE_PROVIDER=s3로 설정했지만 STORAGE_S3_BUCKET이 비어 있습니다.')
  }
}

/**
 * DEV_AUTH_BYPASS=true 상태로 프로덕션이 기동되는 것을 막는 안전장치.
 * NODE_ENV==='production'에서는 이 플래그가 설정되어 있으면 무조건
 * 앱 시작을 중단시킨다 (요구사항 §3-7: "프로덕션에서는 설정되어 있어도
 * 앱이 기동에 실패하거나 명확한 보안 오류를 던져야 한다").
 */
function assertDevAuthBypassSafety(env: Env): void {
  if (env.DEV_AUTH_BYPASS && process.env.NODE_ENV === 'production') {
    throw new Error(
      '보안 오류: DEV_AUTH_BYPASS=true 상태로는 프로덕션(NODE_ENV=production)에서 실행할 수 없습니다. ' +
        '배포 환경변수에서 DEV_AUTH_BYPASS를 제거하세요.',
    )
  }
}

/** 현재 환경에서 개발용 인증 우회가 실제로 허용되는지 여부. */
export function isDevAuthBypassEnabled(env: Env = getEnv()): boolean {
  return process.env.NODE_ENV !== 'production' && env.DEV_AUTH_BYPASS
}

export function isClaudeConfigured(env: Env = getEnv()): boolean {
  return env.ANTHROPIC_API_KEY.trim().length > 0 && env.ANTHROPIC_MODEL.trim().length > 0
}

export function isEmbeddingConfigured(env: Env = getEnv()): boolean {
  if (env.EMBEDDING_PROVIDER === 'openai') return env.OPENAI_API_KEY.trim().length > 0
  if (env.EMBEDDING_PROVIDER === 'voyage') return env.VOYAGE_API_KEY.trim().length > 0
  return false
}
