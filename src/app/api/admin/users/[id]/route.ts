import type { Role } from '@prisma/client'
import { type NextRequest, NextResponse } from 'next/server'
import { recordAuditLog } from '@/lib/audit/auditLog'
import { generateTemporaryPassword, hashPassword } from '@/lib/auth/password'
import { requiresPasswordChange } from '@/lib/auth/permissions'
import { bumpSessionVersion, requireRole } from '@/lib/auth/session'
import { prisma } from '@/lib/db'
import { mustChangePasswordResponse, toErrorResponse } from '@/lib/http/errorResponse'
import { assertCsrf } from '@/lib/security/csrf'

const VALID_ROLES: Role[] = ['ADMIN', 'REVIEWER', 'USER']

interface PatchBody {
  action: 'setRole' | 'setActive' | 'issueTemporaryPassword' | 'unlock' | 'requirePasswordChange'
  role?: string
  isActive?: boolean
}

/**
 * 활성 ADMIN 수가 대상 사용자를 제외하고도 1명 이상 남는지 확인한다.
 * 관리자 자신이든 다른 관리자든, 마지막 남은 활성 관리자의 권한을
 * 제거하거나 비활성화해 "관리자 0명" 상태가 되는 것을 막기 위해 사용한다.
 */
async function hasOtherActiveAdmin(excludeUserId: string): Promise<boolean> {
  const count = await prisma.user.count({
    where: { role: 'ADMIN', isActive: true, id: { not: excludeUserId } },
  })
  return count > 0
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireRole(['ADMIN'])
  if (!admin) return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 })
  if (requiresPasswordChange(admin)) return mustChangePasswordResponse()

  const { id } = await params

  try {
    assertCsrf(request)
    const target = await prisma.user.findUnique({ where: { id } })
    if (!target) {
      return NextResponse.json({ error: '사용자를 찾을 수 없습니다.' }, { status: 404 })
    }

    const body = (await request.json()) as PatchBody

    switch (body.action) {
      case 'setRole': {
        const nextRole = body.role as Role
        if (!nextRole || !VALID_ROLES.includes(nextRole)) {
          return NextResponse.json({ error: '올바르지 않은 역할입니다.' }, { status: 400 })
        }
        if (target.role === 'ADMIN' && nextRole !== 'ADMIN' && !(await hasOtherActiveAdmin(target.id))) {
          return NextResponse.json({ error: '마지막 남은 관리자의 권한은 변경할 수 없습니다.' }, { status: 400 })
        }
        await prisma.user.update({ where: { id }, data: { role: nextRole } })
        await bumpSessionVersion(id)
        await recordAuditLog({
          userId: admin.id,
          action: 'USER_ROLE_CHANGED',
          targetType: 'User',
          targetId: id,
          metadata: { from: target.role, to: nextRole },
        })
        return NextResponse.json({ ok: true })
      }

      case 'setActive': {
        if (typeof body.isActive !== 'boolean') {
          return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 })
        }
        if (!body.isActive && target.role === 'ADMIN' && !(await hasOtherActiveAdmin(target.id))) {
          return NextResponse.json({ error: '마지막 남은 활성 관리자는 비활성화할 수 없습니다.' }, { status: 400 })
        }
        await prisma.user.update({ where: { id }, data: { isActive: body.isActive } })
        if (!body.isActive) await bumpSessionVersion(id)
        await recordAuditLog({
          userId: admin.id,
          action: body.isActive ? 'USER_ACTIVATED' : 'USER_DEACTIVATED',
          targetType: 'User',
          targetId: id,
        })
        return NextResponse.json({ ok: true })
      }

      case 'issueTemporaryPassword': {
        const temporaryPassword = generateTemporaryPassword()
        const passwordHash = await hashPassword(temporaryPassword)
        await prisma.user.update({
          where: { id },
          data: {
            passwordHash,
            mustChangePassword: true,
            passwordChangedAt: new Date(),
            failedLoginCount: 0,
            lockedUntil: null,
          },
        })
        await bumpSessionVersion(id)
        await recordAuditLog({ userId: admin.id, action: 'ADMIN_PASSWORD_RESET', targetType: 'User', targetId: id })
        return NextResponse.json({ ok: true, temporaryPassword })
      }

      case 'unlock': {
        await prisma.user.update({ where: { id }, data: { failedLoginCount: 0, lockedUntil: null } })
        return NextResponse.json({ ok: true })
      }

      case 'requirePasswordChange': {
        await prisma.user.update({ where: { id }, data: { mustChangePassword: true } })
        await bumpSessionVersion(id)
        return NextResponse.json({ ok: true })
      }

      default:
        return NextResponse.json({ error: '알 수 없는 작업입니다.' }, { status: 400 })
    }
  } catch (error) {
    return toErrorResponse(error)
  }
}
