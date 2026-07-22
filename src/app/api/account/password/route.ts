import { type NextRequest, NextResponse } from 'next/server'
import { recordAuditLog } from '@/lib/audit/auditLog'
import { hashPassword, validatePasswordPolicy, verifyPassword } from '@/lib/auth/password'
import { getCurrentUser, revokeAllSessionsForUser, SESSION_COOKIE_NAME } from '@/lib/auth/session'
import { prisma } from '@/lib/db'
import { toErrorResponse } from '@/lib/http/errorResponse'
import { assertCsrf } from '@/lib/security/csrf'

export async function POST(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })

  try {
    assertCsrf(request)
    const body = (await request.json()) as {
      currentPassword?: string
      newPassword?: string
      confirmPassword?: string
    }
    const currentPassword = body.currentPassword ?? ''
    const newPassword = body.newPassword ?? ''
    const confirmPassword = body.confirmPassword ?? ''

    if (!currentPassword || !newPassword || !confirmPassword) {
      return NextResponse.json({ error: '모든 항목을 입력해 주세요.' }, { status: 400 })
    }

    const currentOk = user.passwordHash ? await verifyPassword(user.passwordHash, currentPassword) : false
    if (!currentOk) {
      return NextResponse.json({ error: '현재 비밀번호가 올바르지 않습니다.' }, { status: 400 })
    }

    if (newPassword !== confirmPassword) {
      return NextResponse.json({ error: '새 비밀번호와 확인이 일치하지 않습니다.' }, { status: 400 })
    }

    const policy = validatePasswordPolicy(newPassword)
    if (!policy.valid) {
      return NextResponse.json({ error: policy.errorMessage }, { status: 400 })
    }

    // 이전과 같은 비밀번호로 재사용하는 것을 막는다 (요구사항 §3-5).
    const sameAsBefore = user.passwordHash ? await verifyPassword(user.passwordHash, newPassword) : false
    if (sameAsBefore) {
      return NextResponse.json({ error: '새 비밀번호는 현재 비밀번호와 달라야 합니다.' }, { status: 400 })
    }

    const passwordHash = await hashPassword(newPassword)
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash, passwordChangedAt: new Date(), mustChangePassword: false },
    })

    // 현재 세션은 유지하고, 다른 기기/브라우저에 남아 있는 세션만 무효화한다.
    const currentToken = request.cookies.get(SESSION_COOKIE_NAME)?.value
    await revokeAllSessionsForUser(user.id, currentToken)

    await recordAuditLog({ userId: user.id, action: 'PASSWORD_CHANGED', targetType: 'User', targetId: user.id })

    return NextResponse.json({ ok: true })
  } catch (error) {
    return toErrorResponse(error)
  }
}
