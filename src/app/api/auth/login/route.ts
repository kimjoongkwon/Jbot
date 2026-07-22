import { type NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { recordAuditLog } from '@/lib/audit/auditLog'
import { applyFailedLogin, isCurrentlyLocked, remainingLockoutMinutes, resetLockoutState } from '@/lib/auth/lockout'
import { verifyPassword } from '@/lib/auth/password'
import { createSession, SESSION_COOKIE_NAME } from '@/lib/auth/session'
import { CSRF_COOKIE_NAME, generateCsrfToken } from '@/lib/security/csrf'

// 존재하지 않는 이메일과 틀린 비밀번호를 구분하지 않는다 (요구사항 §3-4, §5).
const GENERIC_ERROR = '이메일 또는 비밀번호를 확인해 주세요.'

export async function POST(request: NextRequest) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 400 })
  }

  const email = isRecord(body) && typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
  const password = isRecord(body) && typeof body.password === 'string' ? body.password : ''

  if (!email || !password) {
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 400 })
  }

  const user = await prisma.user.findUnique({ where: { email } })

  // 이미 잠긴 계정: 이 시점에는 무차별 대입 의도가 이미 명백하므로 잠금
  // 사실 자체는 예외적으로 알려준다(§5). 실패 횟수는 추가로 늘리지 않는다.
  if (user && isCurrentlyLocked(user)) {
    await prisma.loginAttempt.create({ data: { userId: user.id, emailAttempted: email, success: false } })
    await recordAuditLog({ userId: user.id, action: 'LOGIN_FAILURE', targetType: 'User', targetId: user.id, metadata: { reason: 'locked' } })
    return NextResponse.json(
      { error: `계정이 잠겼습니다. 약 ${remainingLockoutMinutes(user.lockedUntil!)}분 후 다시 시도해 주세요.` },
      { status: 423 },
    )
  }

  const passwordOk = user?.passwordHash ? await verifyPassword(user.passwordHash, password) : false
  const loginAllowed = !!user && user.isActive && passwordOk

  if (!loginAllowed) {
    if (user) {
      const nextState = applyFailedLogin(user)
      await prisma.user.update({
        where: { id: user.id },
        data: { failedLoginCount: nextState.failedLoginCount, lockedUntil: nextState.lockedUntil },
      })
      const justLocked = isCurrentlyLocked({ failedLoginCount: nextState.failedLoginCount, lockedUntil: nextState.lockedUntil })
      await recordAuditLog({
        userId: user.id,
        action: justLocked ? 'ACCOUNT_LOCKED' : 'LOGIN_FAILURE',
        targetType: 'User',
        targetId: user.id,
        metadata: { reason: user.isActive ? 'bad_password' : 'inactive' },
      })
    }
    await prisma.loginAttempt.create({ data: { userId: user?.id ?? null, emailAttempted: email, success: false } })
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 401 })
  }

  const lockoutReset = resetLockoutState()
  await prisma.user.update({
    where: { id: user.id },
    data: {
      failedLoginCount: lockoutReset.failedLoginCount,
      lockedUntil: lockoutReset.lockedUntil,
      lastLoginAt: new Date(),
    },
  })
  await prisma.loginAttempt.create({ data: { userId: user.id, emailAttempted: email, success: true } })
  await recordAuditLog({ userId: user.id, action: 'LOGIN_SUCCESS', targetType: 'User', targetId: user.id })

  // 세션 고정 공격 방지: 항상 새 무작위 토큰을 발급하며, 클라이언트가 들고
  // 있던 기존 쿠키 값을 절대 재사용하지 않는다.
  const session = await createSession(user.id, request.headers.get('user-agent'))
  const csrfToken = generateCsrfToken()
  const isProd = process.env.NODE_ENV === 'production'

  const response = NextResponse.json({
    redirectTo: user.mustChangePassword ? '/account/security' : '/chat',
  })
  response.cookies.set(SESSION_COOKIE_NAME, session.token, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    path: '/',
    expires: session.expiresAt,
  })
  // CSRF 쿠키는 자바스크립트가 읽어 헤더/폼값으로 되돌려 보내야 하므로
  // HttpOnly로 설정하지 않는다(더블 서브밋 쿠키 패턴).
  response.cookies.set(CSRF_COOKIE_NAME, csrfToken, {
    httpOnly: false,
    secure: isProd,
    sameSite: 'lax',
    path: '/',
    expires: session.expiresAt,
  })
  return response
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
