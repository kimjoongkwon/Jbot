import { createHash, randomBytes } from 'node:crypto'
import { cookies } from 'next/headers'
import type { Role, User } from '@prisma/client'
import { prisma } from '../db'

export const SESSION_COOKIE_NAME = 'jk_session'
export const SESSION_TTL_MS = 12 * 60 * 60 * 1000 // 12시간

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

function generateSessionToken(): string {
  return randomBytes(32).toString('hex')
}

export interface CreatedSession {
  token: string
  expiresAt: Date
}

/**
 * 새 세션을 발급한다. 로그인 시 매번 완전히 새로운 무작위 토큰을 생성하며,
 * 기존에 클라이언트가 들고 있던 쿠키 값을 재사용하지 않는다(세션 고정 공격 방지).
 * 토큰 원문은 DB에 저장하지 않고 SHA-256 해시만 저장한다.
 */
export async function createSession(userId: string, userAgent?: string | null): Promise<CreatedSession> {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } })
  const token = generateSessionToken()
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS)

  await prisma.userSession.create({
    data: {
      userId,
      tokenHash: hashToken(token),
      sessionVersionAtIssue: user.sessionVersion,
      expiresAt,
      userAgent: userAgent?.slice(0, 255) ?? null,
    },
  })

  return { token, expiresAt }
}

/**
 * 현재 요청의 세션 쿠키를 검증하고 사용자를 반환한다. 다음 중 하나라도
 * 해당하면 로그인하지 않은 것으로 취급한다: 쿠키 없음/세션 없음/철회됨/
 * 만료됨/발급 이후 사용자의 sessionVersion이 바뀜(비밀번호 변경·역할 변경·
 * 비활성화 등)/계정 비활성화. sessionVersion 비교 덕분에 역할·활성 상태
 * 변경이 다음 요청부터 즉시 반영된다.
 */
export async function getCurrentUser(): Promise<User | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value
  if (!token) return null

  const session = await prisma.userSession.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: true },
  })
  if (!session) return null
  if (session.revokedAt) return null
  if (session.expiresAt.getTime() < Date.now()) return null
  if (session.sessionVersionAtIssue !== session.user.sessionVersion) return null
  if (!session.user.isActive) return null

  // 매 요청마다 쓰기가 발생하지 않도록 일정 간격(5분)마다만 lastSeenAt을 갱신한다.
  if (Date.now() - session.lastSeenAt.getTime() > 5 * 60 * 1000) {
    void prisma.userSession.update({ where: { id: session.id }, data: { lastSeenAt: new Date() } }).catch(() => undefined)
  }

  return session.user
}

export async function requireRole(roles: Role[]): Promise<User | null> {
  const user = await getCurrentUser()
  if (!user) return null
  if (!roles.includes(user.role)) return null
  return user
}

/** 현재 요청의 세션 쿠키가 가리키는 세션을 철회한다(로그아웃). */
export async function revokeSessionByToken(token: string): Promise<void> {
  await prisma.userSession.updateMany({
    where: { tokenHash: hashToken(token), revokedAt: null },
    data: { revokedAt: new Date() },
  })
}

/**
 * 특정 사용자의 세션을 모두 철회한다(exceptToken이 있으면 그 세션은 제외).
 * 비밀번호 변경 시 "현재 세션을 제외한 모든 세션 무효화"에 사용한다.
 */
export async function revokeAllSessionsForUser(userId: string, exceptToken?: string): Promise<void> {
  const exceptTokenHash = exceptToken ? hashToken(exceptToken) : undefined
  await prisma.userSession.updateMany({
    where: {
      userId,
      revokedAt: null,
      ...(exceptTokenHash ? { tokenHash: { not: exceptTokenHash } } : {}),
    },
    data: { revokedAt: new Date() },
  })
}

/**
 * 사용자의 sessionVersion을 올려, 이미 발급된 모든 세션(현재 요청 포함)을
 * 즉시 무효화한다. 비밀번호 변경, 역할 변경, 계정 비활성화 시 호출한다.
 */
export async function bumpSessionVersion(userId: string): Promise<void> {
  await prisma.user.update({ where: { id: userId }, data: { sessionVersion: { increment: 1 } } })
  await revokeAllSessionsForUser(userId)
}
