import { createHmac, timingSafeEqual } from 'node:crypto'
import { cookies } from 'next/headers'
import type { Role, User } from '@prisma/client'
import { prisma } from '../db'
import { getEnv } from '../env'

export const SESSION_COOKIE_NAME = 'jk_legal_session_user'

/**
 * 매우 단순화된 세션 구현이다. User 모델에 비밀번호 필드가 없으므로(요구사항 §5),
 * 이번 MVP는 "로그인할 사용자 선택" 방식으로 역할(RBAC) 구분만 시연한다.
 * 실제 운영 전에는 비밀번호/OAuth 등 실제 인증으로 반드시 교체해야 한다
 * (docs/NEXT_STEPS.md 참고).
 *
 * 쿠키 값은 `userId.서명(HMAC-SHA256)` 형식으로 SESSION_SECRET을 이용해 서명한다.
 * 이는 "누구인지 증명"하는 실제 인증은 아니지만(비밀번호 없음), 로그인 절차 없이
 * 브라우저 쿠키 값만 다른 사용자의 id로 바꿔 적어 임의로 관리자 등 다른 역할을
 * 사칭하는 것은 막아준다(서명 없이는 유효한 쿠키를 만들 수 없음).
 */
function signUserId(userId: string): string {
  const { SESSION_SECRET } = getEnv()
  const signature = createHmac('sha256', SESSION_SECRET).update(userId).digest('hex')
  return `${userId}.${signature}`
}

function verifySignedUserId(signedValue: string): string | null {
  const separatorIndex = signedValue.lastIndexOf('.')
  if (separatorIndex <= 0) return null

  const userId = signedValue.slice(0, separatorIndex)
  const providedSignature = signedValue.slice(separatorIndex + 1)

  const { SESSION_SECRET } = getEnv()
  const expectedSignature = createHmac('sha256', SESSION_SECRET).update(userId).digest('hex')

  const providedBuffer = Buffer.from(providedSignature, 'hex')
  const expectedBuffer = Buffer.from(expectedSignature, 'hex')
  if (providedBuffer.length !== expectedBuffer.length) return null
  if (!timingSafeEqual(providedBuffer, expectedBuffer)) return null

  return userId
}

export function createSessionCookieValue(userId: string): string {
  return signUserId(userId)
}

export async function getCurrentUser(): Promise<User | null> {
  const cookieStore = await cookies()
  const rawValue = cookieStore.get(SESSION_COOKIE_NAME)?.value
  if (!rawValue) return null

  const userId = verifySignedUserId(rawValue)
  if (!userId) return null

  return prisma.user.findUnique({ where: { id: userId } })
}

export async function requireRole(roles: Role[]): Promise<User | null> {
  const user = await getCurrentUser()
  if (!user) return null
  if (!roles.includes(user.role)) return null
  return user
}
