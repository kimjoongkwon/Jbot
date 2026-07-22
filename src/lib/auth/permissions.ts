import type { Role } from '@prisma/client'

/**
 * 내부 검토자료(INTERNAL_MEMO)는 관리자·검토자만 조회/검색할 수 있다
 * (요구사항 §14, "일반 사용자 검색에서 제외할 수 있게 한다").
 */
export function canViewInternalMemo(role: Role): boolean {
  return role === 'ADMIN' || role === 'REVIEWER'
}

/**
 * 관리자가 임시 비밀번호를 발급한 사용자는 본인이 비밀번호를 변경하기
 * 전까지 일반 기능을 사용할 수 없다 (요구사항 §3-4). 클라이언트 리다이렉트
 * (페이지 단)뿐 아니라 각 API 라우트에서도 서버 사이드로 다시 검사한다.
 */
export function requiresPasswordChange(user: { mustChangePassword: boolean }): boolean {
  return user.mustChangePassword
}
