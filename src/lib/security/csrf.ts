import { randomBytes, timingSafeEqual } from 'node:crypto'
import type { NextRequest } from 'next/server'
import { CSRF_COOKIE_NAME, CSRF_HEADER_NAME } from './csrfConstants'

export { CSRF_COOKIE_NAME, CSRF_FORM_FIELD_NAME, CSRF_HEADER_NAME } from './csrfConstants'

export function generateCsrfToken(): string {
  return randomBytes(32).toString('hex')
}

/**
 * 더블 서브밋 쿠키(double-submit cookie) 방식의 CSRF 검증이다.
 * 로그인 시 쿠키(HttpOnly 아님, 자바스크립트가 읽어 헤더/폼값에 실어 보낼 수
 * 있어야 함)로 토큰을 내려주고, 상태를 변경하는 모든 요청에서 그 값을
 * 다시 헤더(x-csrf-token) 또는 폼 필드(csrfToken)로 제출하게 한 뒤 쿠키
 * 값과 일치하는지 검사한다. 공격 사이트는 same-origin 정책 때문에 쿠키
 * 값을 읽을 수 없으므로 일치하는 값을 위조하지 못한다.
 */
export function verifyCsrfToken(cookieValue: string | undefined | null, submittedValue: string | undefined | null): boolean {
  if (!cookieValue || !submittedValue) return false
  const cookieBuffer = Buffer.from(cookieValue)
  const submittedBuffer = Buffer.from(submittedValue)
  if (cookieBuffer.length !== submittedBuffer.length) return false
  return timingSafeEqual(cookieBuffer, submittedBuffer)
}

export class CsrfError extends Error {
  constructor() {
    super('CSRF 토큰이 유효하지 않습니다. 페이지를 새로고침한 뒤 다시 시도해 주세요.')
    this.name = 'CsrfError'
  }
}

/**
 * 상태를 변경하는 라우트 핸들러(POST/PATCH/DELETE 등)에서 호출한다.
 * 헤더(x-csrf-token, fetch 호출용)와 폼 필드(csrfToken, 네이티브 <form> 제출용)
 * 중 명시적으로 넘겨준 값이 없으면 헤더를 우선 확인한다. 검증에 실패하면
 * CsrfError를 던진다 — 호출부는 이를 잡아 403 응답으로 변환한다.
 */
export function assertCsrf(request: NextRequest, submittedValue?: string | null): void {
  const cookieValue = request.cookies.get(CSRF_COOKIE_NAME)?.value
  const submitted = submittedValue ?? request.headers.get(CSRF_HEADER_NAME)
  if (!verifyCsrfToken(cookieValue, submitted)) {
    throw new CsrfError()
  }
}
