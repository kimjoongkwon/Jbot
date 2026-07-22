import { cookies } from 'next/headers'
import type { Role, User } from '@prisma/client'
import { prisma } from '../db'

export const SESSION_COOKIE_NAME = 'jk_legal_session_user'

/**
 * 매우 단순화된 세션 구현이다. User 모델에 비밀번호 필드가 없으므로(요구사항 §5),
 * 이번 MVP는 "로그인할 사용자 선택" 방식으로 역할(RBAC) 구분만 시연한다.
 * 실제 운영 전에는 비밀번호/OAuth 등 실제 인증으로 반드시 교체해야 한다
 * (docs/NEXT_STEPS.md 참고). 쿠키 값은 서명되지 않은 평문 userId이므로
 * 이 상태로는 프로덕션 보안 요건을 충족하지 못한다.
 */
export async function getCurrentUser(): Promise<User | null> {
  const cookieStore = await cookies()
  const userId = cookieStore.get(SESSION_COOKIE_NAME)?.value
  if (!userId) return null
  return prisma.user.findUnique({ where: { id: userId } })
}

export async function requireRole(roles: Role[]): Promise<User | null> {
  const user = await getCurrentUser()
  if (!user) return null
  if (!roles.includes(user.role)) return null
  return user
}
