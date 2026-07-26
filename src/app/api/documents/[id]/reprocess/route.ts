import { type NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/session'
import { requiresPasswordChange } from '@/lib/auth/permissions'
import { prisma } from '@/lib/db'
import { reprocessDocumentVersion } from '@/lib/documents/documentAdmin'
import { mustChangePasswordResponse, toErrorResponse } from '@/lib/http/errorResponse'
import { assertCsrf } from '@/lib/security/csrf'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireRole(['ADMIN'])
  if (!user) return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 })
  if (requiresPasswordChange(user)) return mustChangePasswordResponse()

  const { id } = await params
  try {
    assertCsrf(request)
    const version =
      (await prisma.documentVersion.findFirst({ where: { legalDocumentId: id, isCurrent: true } })) ??
      (await prisma.documentVersion.findFirst({ where: { legalDocumentId: id }, orderBy: { createdAt: 'desc' } }))

    if (!version) {
      return NextResponse.json({ error: '재처리할 버전을 찾을 수 없습니다.' }, { status: 404 })
    }

    await reprocessDocumentVersion(version.id, user.id)
    return NextResponse.json({ ok: true })
  } catch (error) {
    return toErrorResponse(error)
  }
}
