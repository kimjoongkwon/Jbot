import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/session'
import { prisma } from '@/lib/db'
import { reprocessDocumentVersion } from '@/lib/documents/documentAdmin'
import { toErrorResponse } from '@/lib/http/errorResponse'

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireRole(['ADMIN'])
  if (!user) return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 })

  const { id } = await params
  try {
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
