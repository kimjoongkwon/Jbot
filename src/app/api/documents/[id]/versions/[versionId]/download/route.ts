import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/session'
import { canViewInternalMemo } from '@/lib/auth/permissions'
import { prisma } from '@/lib/db'
import { recordAuditLog } from '@/lib/audit/auditLog'
import { getFileStorageProvider } from '@/lib/storage'

/**
 * 업로드 원본 파일 다운로드. 일반 사용자(USER)는 원본 파일에 접근할 수
 * 없고(요구사항 §4, "다운로드 URL 직접 입력" 공격 시나리오), INTERNAL_MEMO
 * 문서는 ADMIN/REVIEWER만 내려받을 수 있다.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; versionId: string }> },
) {
  const user = await requireRole(['ADMIN', 'REVIEWER'])
  if (!user) return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 })

  const { id, versionId } = await params
  const version = await prisma.documentVersion.findFirst({
    where: { id: versionId, legalDocumentId: id },
    include: { legalDocument: { select: { documentType: true } } },
  })
  if (!version) return NextResponse.json({ error: '파일을 찾을 수 없습니다.' }, { status: 404 })

  if (version.legalDocument.documentType === 'INTERNAL_MEMO' && !canViewInternalMemo(user.role)) {
    return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 })
  }

  const provider = getFileStorageProvider()

  await recordAuditLog({
    userId: user.id,
    action: 'DOCUMENT_FILE_DOWNLOAD',
    targetType: 'DocumentVersion',
    targetId: version.id,
    legalDocumentId: id,
  })

  // S3 등 서명 URL을 지원하는 저장소에서는 서버가 파일 전체를 메모리로 읽어
  // 프록시하지 않고, 짧게 만료되는 서명 URL로 리다이렉트해 클라이언트가
  // 스토리지에서 직접 내려받게 한다(대용량 파일에서도 서버 메모리를 쓰지
  // 않는다). Local 저장소처럼 서명 URL을 지원하지 않는 구현체는 기존대로
  // 버퍼를 직접 응답한다.
  if (provider.getSignedDownloadUrl) {
    const signedUrl = await provider.getSignedDownloadUrl(version.storagePath, 60)
    return NextResponse.redirect(signedUrl, { status: 302 })
  }

  const buffer = await provider.get(version.storagePath)
  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      'Content-Type': version.mimeType || 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${encodeURIComponent(version.originalFilename)}"`,
      'Content-Length': String(buffer.length),
    },
  })
}
