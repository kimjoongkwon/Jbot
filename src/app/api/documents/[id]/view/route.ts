import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/session'
import { prisma } from '@/lib/db'

/**
 * 챗봇 화면의 "문서 상세 보기" 링크에서 쓰는 읽기 전용 조회.
 * 관리자 상세(app/api/documents/[id])와 달리 처리 이력·오류 등은 노출하지 않고,
 * 활성 문서의 현행 버전 원문만 보여준다. 로그인한 사용자라면 역할 무관하게 접근 가능.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })

  const { id } = await params
  const document = await prisma.legalDocument.findFirst({
    where: { id, status: 'ACTIVE' },
  })
  if (!document) {
    return NextResponse.json({ error: '문서를 찾을 수 없습니다.' }, { status: 404 })
  }

  const currentVersion = await prisma.documentVersion.findFirst({
    where: { legalDocumentId: id, isCurrent: true },
  })
  const chunks = currentVersion
    ? await prisma.legalChunk.findMany({
        where: { documentVersionId: currentVersion.id },
        orderBy: { sequence: 'asc' },
      })
    : []

  return NextResponse.json({ document, version: currentVersion, chunks })
}
