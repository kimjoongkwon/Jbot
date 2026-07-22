import type { Role } from '@prisma/client'

/**
 * 내부 검토자료(INTERNAL_MEMO)는 관리자·검토자만 조회/검색할 수 있다
 * (요구사항 §14, "일반 사용자 검색에서 제외할 수 있게 한다").
 */
export function canViewInternalMemo(role: Role): boolean {
  return role === 'ADMIN' || role === 'REVIEWER'
}
