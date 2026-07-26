import { type NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/session'
import { prisma } from '@/lib/db'

/**
 * 감사로그 조회는 ADMIN 전용이다(요구사항 §4 권한 매트릭스). REVIEWER를
 * 포함하지 않는 이유: 감사로그에는 다른 관리자의 계정 관리 작업(잠금 해제,
 * 역할 변경 등)까지 담기므로 운영 책임자(ADMIN)로 접근을 좁힌다.
 */
export async function GET(request: NextRequest) {
  const user = await requireRole(['ADMIN'])
  if (!user) return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const cursor = searchParams.get('cursor')
  const take = 50

  const logs = await prisma.auditLog.findMany({
    orderBy: { createdAt: 'desc' },
    take,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    include: { user: { select: { id: true, email: true, name: true } } },
  })

  return NextResponse.json({
    logs,
    nextCursor: logs.length === take ? logs[logs.length - 1].id : null,
  })
}
