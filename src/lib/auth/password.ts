import argon2 from 'argon2'

export const MIN_PASSWORD_LENGTH = 10

export interface PasswordValidationResult {
  valid: boolean
  errorMessage: string | null
}

/**
 * 비밀번호 최소 요건을 검사한다. 정책을 단순하게 유지하기 위해 길이만
 * 강제하고(너무 세세한 문자 조합 규칙은 사용자가 예측 가능한 패턴으로
 * 우회하기 쉬워 오히려 보안에 도움이 되지 않는다는 NIST 가이드라인을 따름),
 * 최소 길이는 10자로 설정한다.
 */
export function validatePasswordPolicy(password: string): PasswordValidationResult {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return {
      valid: false,
      errorMessage: `비밀번호는 최소 ${MIN_PASSWORD_LENGTH}자 이상이어야 합니다.`,
    }
  }
  return { valid: true, errorMessage: null }
}

/**
 * Argon2id로 비밀번호를 해시한다. 평문 비밀번호는 해시 계산 이후 즉시
 * 폐기되며, 어떤 로그·감사로그에도 원문을 남기지 않는다.
 */
export async function hashPassword(plainPassword: string): Promise<string> {
  return argon2.hash(plainPassword, { type: argon2.argon2id })
}

/**
 * 저장된 해시와 입력한 평문 비밀번호를 비교한다. 형식이 다른 해시(예: 향후
 * bcrypt로 교체된 경우)도 argon2.verify가 해시 헤더를 보고 스스로 판별한다.
 */
export async function verifyPassword(passwordHash: string, plainPassword: string): Promise<boolean> {
  try {
    return await argon2.verify(passwordHash, plainPassword)
  } catch {
    // 해시 형식이 손상되었거나 지원하지 않는 알고리즘인 경우 안전하게 실패 처리
    return false
  }
}

/**
 * 관리자가 임시 비밀번호를 발급할 때 사용할 무작위 비밀번호를 생성한다.
 * 사람이 옮겨 적기 쉬운 문자만 사용하고(혼동되는 0/O, 1/l/I 등 제외),
 * 최소 길이 요건을 항상 만족한다.
 */
export function generateTemporaryPassword(): string {
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('')
}
