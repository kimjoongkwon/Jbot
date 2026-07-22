import { recordAuditLog } from '../audit/auditLog'
import { prisma } from '../db'
import { runIngestionPipeline } from './ingestionPipeline'

export async function activateDocument(legalDocumentId: string, actorUserId: string | null) {
  await prisma.legalDocument.update({ where: { id: legalDocumentId }, data: { status: 'ACTIVE' } })
  await recordAuditLog({
    userId: actorUserId,
    action: 'DOCUMENT_ACTIVATED',
    targetType: 'LegalDocument',
    targetId: legalDocumentId,
    legalDocumentId,
  })
}

export async function deactivateDocument(legalDocumentId: string, actorUserId: string | null) {
  // 운영 중 사용된 문서는 영구 삭제하지 않고 비활성화(soft delete)한다 (요구사항 §14).
  await prisma.legalDocument.update({ where: { id: legalDocumentId }, data: { status: 'INACTIVE' } })
  await recordAuditLog({
    userId: actorUserId,
    action: 'DOCUMENT_DEACTIVATED',
    targetType: 'LegalDocument',
    targetId: legalDocumentId,
    legalDocumentId,
  })
}

export async function reprocessDocumentVersion(documentVersionId: string, actorUserId: string | null) {
  const version = await prisma.documentVersion.findUniqueOrThrow({ where: { id: documentVersionId } })

  await recordAuditLog({
    userId: actorUserId,
    action: 'DOCUMENT_REPROCESSED',
    targetType: 'DocumentVersion',
    targetId: documentVersionId,
    legalDocumentId: version.legalDocumentId,
  })

  await prisma.legalDocument.update({ where: { id: version.legalDocumentId }, data: { status: 'PROCESSING' } })
  await runIngestionPipeline(documentVersionId)
}
