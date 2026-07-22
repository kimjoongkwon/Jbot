import type { Role } from '@prisma/client'
import { type NextRequest, NextResponse } from 'next/server'
import { recordAuditLog } from '@/lib/audit/auditLog'
import { generateTemporaryPassword, hashPassword } from '@/lib/auth/password'
import { requiresPasswordChange } from '@/lib/auth/permissions'
import { requireRole } from '@/lib/auth/session'
import { prisma } from '@/lib/db'
import { mustChangePasswordResponse, toErrorResponse } from '@/lib/http/errorResponse'
import { assertCsrf } from '@/lib/security/csrf'

const VALID_ROLES: Role[] = ['ADMIN', 'REVIEWER', 'USER']

export async function GET() {
  const admin = await requireRole(['ADMIN'])
  if (!admin) return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 })

  const users = await prisma.user.findMany({
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      isActive: true,
      mustChangePassword: true,
      failedLoginCount: true,
      lockedUntil: true,
      lastLoginAt: true,
      createdAt: true,
    },
  })
  return NextResponse.json({ users })
}

export async function POST(request: NextRequest) {
  const admin = await requireRole(['ADMIN'])
  if (!admin) return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 })
  if (requiresPasswordChange(admin)) return mustChangePasswordResponse()

  try {
    assertCsrf(request)
    const body = (await request.json()) as { email?: string; name?: string; role?: string }
    const email = body.email?.trim().toLowerCase() ?? ''
    const name = body.name?.trim() ?? ''
    const role = (body.role ?? 'USER') as Role

    if (!email || !name) {
      return NextResponse.json({ error: '이메일과 이름을 입력해 주세요.' }, { status: 400 })
    }
    if (!VALID_ROLES.includes(role)) {
      return NextResponse.json({ error: '올바르지 않은 역할입니다.' }, { status: 400 })
    }

    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) {
      return NextResponse.json({ error: '이미 사용 중인 이메일입니다.' }, { status: 409 })
    }

    // 관리자가 발급하는 임시 비밀번호이며, 최초 로그인 시 반드시 변경해야 한다.
    const temporaryPassword = generateTemporaryPassword()
    const passwordHash = await hashPassword(temporaryPassword)

    const created = await prisma.user.create({
      data: { email, name, role, passwordHash, mustChangePassword: true, passwordChangedAt: new Date() },
    })

    await recordAuditLog({
      userId: admin.id,
      action: 'USER_CREATED',
      targetType: 'User',
      targetId: created.id,
      metadata: { role },
    })

    return NextResponse.json(
      {
        user: { id: created.id, email: created.email, name: created.name, role: created.role },
        temporaryPassword,
      },
      { status: 201 },
    )
  } catch (error) {
    return toErrorResponse(error)
  }
}
