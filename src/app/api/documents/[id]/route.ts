import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/session'
import { prisma } from '@/lib/db'
import { activateDocument, deactivateDocument } from '@/lib/documents/documentAdmin'
import { toErrorResponse } from '@/lib/http/errorResponse'

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireRole(['ADMIN', 'REVIEWER'])
  if (!user) return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 })

  const { id } = await params
  const document = await prisma.legalDocument.findUnique({
    where: { id },
    include: {
      versions: {
        orderBy: { createdAt: 'desc' },
        include: {
          ingestionJobs: { orderBy: { createdAt: 'desc' }, take: 5 },
          _count: { select: { chunks: true } },
        },
      },
    },
  })

  if (!document) {
    return NextResponse.json({ error: '문서를 찾을 수 없습니다.' }, { status: 404 })
  }

  const currentVersion = document.versions.find((v) => v.isCurrent) ?? document.versions[0] ?? null
  const chunks = currentVersion
    ? await prisma.legalChunk.findMany({
        where: { documentVersionId: currentVersion.id },
        orderBy: { sequence: 'asc' },
      })
    : []

  const citationCount = currentVersion
    ? await prisma.answerCitation.count({ where: { legalChunk: { documentVersionId: currentVersion.id } } })
    : 0

  return NextResponse.json({ document, chunks, citationCount })
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireRole(['ADMIN'])
  if (!user) return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 })

  const { id } = await params
  try {
    const body = (await request.json()) as { status?: 'ACTIVE' | 'INACTIVE' }
    if (body.status === 'ACTIVE') {
      await activateDocument(id, user.id)
    } else if (body.status === 'INACTIVE') {
      await deactivateDocument(id, user.id)
    } else {
      return NextResponse.json({ error: '잘못된 상태 값입니다.' }, { status: 400 })
    }
    return NextResponse.json({ ok: true })
  } catch (error) {
    return toErrorResponse(error)
  }
}
