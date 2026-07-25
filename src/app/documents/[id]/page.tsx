import { notFound, redirect, unstable_rethrow } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth/session'
import { canViewInternalMemo } from '@/lib/auth/permissions'
import { prisma } from '@/lib/db'
import { documentTypeLabel } from '@/lib/labels'
import { DatabaseUnavailableNotice } from '@/components/shared/DatabaseUnavailableNotice'

// 로그인 확인(cookies())과 DB 조회를 모두 사용하는 화면이므로 항상 요청
// 시점에만 렌더링한다(빌드 시점 정적 프리렌더링 시도 방지).
export const dynamic = 'force-dynamic'

/**
 * 챗봇 화면의 "문서 상세 보기" 링크가 향하는 읽기 전용 화면.
 * 관리자 상세 화면과 달리 처리 이력·오류 등은 노출하지 않고 법령 원문만 보여준다.
 */
export default async function PublicDocumentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  let user
  let document
  let currentVersion
  let chunks
  try {
    user = await getCurrentUser()
    if (!user) redirect('/login')

    const { id } = await params
    document = await prisma.legalDocument.findFirst({ where: { id, status: 'ACTIVE' } })
    if (!document) notFound()

    // 내부 검토자료(INTERNAL_MEMO)는 일반 사용자에게 노출하지 않는다 (요구사항 §14).
    if (document.documentType === 'INTERNAL_MEMO' && !canViewInternalMemo(user.role)) {
      notFound()
    }

    currentVersion = await prisma.documentVersion.findFirst({
      where: { legalDocumentId: id, isCurrent: true },
    })
    chunks = currentVersion
      ? await prisma.legalChunk.findMany({
          where: { documentVersionId: currentVersion.id },
          orderBy: { sequence: 'asc' },
        })
      : []
  } catch (error) {
    // redirect()/notFound()는 내부적으로 예외를 던져 네비게이션을 수행하므로,
    // Next.js 공식 헬퍼로 그 제어 흐름 예외만 정확히 구분해 그대로 전파한다
    // (digest 문자열을 직접 비교하면 Next 버전이 바뀔 때 깨지기 쉽다).
    unstable_rethrow(error)
    console.error('[documents/:id] DB 조회 실패:', error)
    return <DatabaseUnavailableNotice />
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4 p-4 md:p-8">
      <a href="/chat" className="text-xs text-accent-600 hover:underline">
        ← 챗봇 화면으로
      </a>
      <div>
        <h1 className="text-xl font-bold text-navy-800">{document.title}</h1>
        <p className="mt-1 text-sm text-slate-500">
          {documentTypeLabel[document.documentType]} · {document.jurisdictionName}
          {currentVersion?.effectiveFrom &&
            ` · 시행일: ${currentVersion.effectiveFrom.toISOString().slice(0, 10)}`}
        </p>
        {document.sourceUrl && (
          <a href={document.sourceUrl} className="text-xs text-accent-600 hover:underline">
            원문 출처 링크 →
          </a>
        )}
      </div>

      <div className="flex flex-col gap-3">
        {chunks.map((chunk) => (
          <div key={chunk.id} className="rounded-lg border border-slate-200 bg-white p-4">
            <p className="mb-2 text-sm font-medium text-navy-700">{chunk.hierarchyPath}</p>
            <p className="whitespace-pre-wrap text-base leading-8 text-slate-800">{chunk.content}</p>
          </div>
        ))}
        {chunks.length === 0 && <p className="text-sm text-slate-400">표시할 조문이 없습니다.</p>}
      </div>
    </div>
  )
}
