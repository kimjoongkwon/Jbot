import { prisma } from '../db'

export interface AuditLogInput {
  userId?: string | null
  action: string
  targetType: string
  targetId?: string | null
  legalDocumentId?: string | null
  metadata?: Record<string, unknown>
}

/**
 * 관리자 작업(문서 등록·활성화·비활성화·재처리 등)을 감사로그에 기록한다.
 * API 키나 사용자의 민감한 질문 원문은 절대 기록하지 않는다 (요구사항 §5).
 */
export async function recordAuditLog(input: AuditLogInput) {
  return prisma.auditLog.create({
    data: {
      userId: input.userId ?? null,
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId ?? null,
      legalDocumentId: input.legalDocumentId ?? null,
      metadata: input.metadata ? JSON.parse(JSON.stringify(input.metadata)) : undefined,
    },
  })
}
