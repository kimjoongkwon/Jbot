import { type NextRequest, NextResponse } from 'next/server'
import { recordAuditLog } from '@/lib/audit/auditLog'
import { getCurrentUser, revokeSessionByToken, SESSION_COOKIE_NAME } from '@/lib/auth/session'
import { assertCsrf, CSRF_COOKIE_NAME, CsrfError } from '@/lib/security/csrf'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData().catch(() => null)
    const submittedCsrf = formData?.get('csrfToken')
    assertCsrf(request, typeof submittedCsrf === 'string' ? submittedCsrf : undefined)
  } catch (error) {
    if (error instanceof CsrfError) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    throw error
  }

  const user = await getCurrentUser()
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value

  if (token) {
    await revokeSessionByToken(token)
  }
  if (user) {
    await recordAuditLog({ userId: user.id, action: 'LOGOUT', targetType: 'User', targetId: user.id })
  }

  const response = NextResponse.redirect(new URL('/login', request.url))
  response.cookies.delete(SESSION_COOKIE_NAME)
  response.cookies.delete(CSRF_COOKIE_NAME)
  return response
}
