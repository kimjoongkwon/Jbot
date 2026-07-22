import { type NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/session'
import { requiresPasswordChange } from '@/lib/auth/permissions'
import { prisma } from '@/lib/db'
import { mustChangePasswordResponse, toErrorResponse } from '@/lib/http/errorResponse'
import { assertCsrf } from '@/lib/security/csrf'

const VALID_STATUSES = new Set(['PENDING', 'REVIEWED', 'NEEDS_CORRECTION', 'APPROVED'])

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireRole(['ADMIN', 'REVIEWER'])
  if (!user) return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 })
  if (requiresPasswordChange(user)) return mustChangePasswordResponse()

  const { id } = await params
  try {
    assertCsrf(request)
    const body = (await request.json()) as { reviewStatus?: string }
    if (!body.reviewStatus || !VALID_STATUSES.has(body.reviewStatus)) {
      return NextResponse.json({ error: '잘못된 검토 상태입니다.' }, { status: 400 })
    }

    const message = await prisma.chatMessage.update({
      where: { id },
      data: { reviewStatus: body.reviewStatus as never },
    })

    return NextResponse.json({ message })
  } catch (error) {
    return toErrorResponse(error)
  }
}
