import { type NextRequest, NextResponse } from 'next/server'
import { recordAuditLog } from '@/lib/audit/auditLog'
import { createSession, SESSION_COOKIE_NAME } from '@/lib/auth/session'
import { prisma } from '@/lib/db'
import { isDevAuthBypassEnabled } from '@/lib/env'
import { CSRF_COOKIE_NAME, generateCsrfToken } from '@/lib/security/csrf'

/**
 * 개발 전용 인증 우회. isDevAuthBypassEnabled()는 NODE_ENV !== 'production'
 * 이면서 DEV_AUTH_BYPASS=true인 경우에만 true를 반환한다(src/lib/env.ts).
 * 프로덕션에서는 애초에 앱이 기동에 실패하도록 되어 있지만, 방어적으로
 * 이 라우트에서도 다시 한 번 확인하고, 비활성화 상태에서는 라우트가 아예
 * 없는 것처럼 404로 응답해 기능의 존재 자체를 드러내지 않는다.
 */
export async function POST(request: NextRequest) {
  if (!isDevAuthBypassEnabled()) {
    return NextResponse.json({ error: 'Not Found' }, { status: 404 })
  }

  const body = await request.json().catch(() => null)
  const userId = body && typeof body === 'object' && typeof (body as { userId?: unknown }).userId === 'string'
    ? (body as { userId: string }).userId
    : ''
  const user = userId ? await prisma.user.findUnique({ where: { id: userId } }) : null
  if (!user || !user.isActive) {
    return NextResponse.json({ error: 'Not Found' }, { status: 404 })
  }

  const session = await createSession(user.id, request.headers.get('user-agent'))
  const csrfToken = generateCsrfToken()
  await recordAuditLog({
    userId: user.id,
    action: 'LOGIN_SUCCESS',
    targetType: 'User',
    targetId: user.id,
    metadata: { devBypass: true },
  })

  const response = NextResponse.json({
    redirectTo: user.mustChangePassword ? '/account/security' : '/chat',
  })
  // isDevAuthBypassEnabled()가 true인 시점에서 NODE_ENV는 항상 'production'이
  // 아니므로 secure 플래그는 고정 false로 둔다(로컬 http 개발환경 지원).
  response.cookies.set(SESSION_COOKIE_NAME, session.token, {
    httpOnly: true,
    secure: false,
    sameSite: 'lax',
    path: '/',
    expires: session.expiresAt,
  })
  response.cookies.set(CSRF_COOKIE_NAME, csrfToken, {
    httpOnly: false,
    secure: false,
    sameSite: 'lax',
    path: '/',
    expires: session.expiresAt,
  })
  return response
}
