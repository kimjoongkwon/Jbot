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

  const buffer = await getFileStorageProvider().get(version.storagePath)

  await recordAuditLog({
    userId: user.id,
    action: 'DOCUMENT_FILE_DOWNLOAD',
    targetType: 'DocumentVersion',
    targetId: version.id,
    legalDocumentId: id,
  })

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      'Content-Type': version.mimeType || 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${encodeURIComponent(version.originalFilename)}"`,
      'Content-Length': String(buffer.length),
    },
  })
}
