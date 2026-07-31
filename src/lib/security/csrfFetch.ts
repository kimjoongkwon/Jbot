'use client'

const CSRF_COOKIE_NAME = 'jk_csrf_token'
const CSRF_HEADER_NAME = 'x-csrf-token'

function readCsrfCookie(): string | undefined {
  const match = document.cookie.match(new RegExp(`(?:^|; )${CSRF_COOKIE_NAME}=([^;]*)`))
  return match ? decodeURIComponent(match[1]) : undefined
}

/**
 * 상태를 변경하는(POST/PATCH/DELETE) 클라이언트 fetch 호출에 CSRF 헤더를
 * 자동으로 붙여준다. 더블 서브밋 쿠키 값은 HttpOnly가 아니므로 여기서
 * document.cookie로 직접 읽을 수 있다 (src/lib/security/csrf.ts 참고).
 */
export function csrfFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const csrfToken = readCsrfCookie()
  const headers = new Headers(init.headers)
  if (csrfToken) {
    headers.set(CSRF_HEADER_NAME, csrfToken)
  }
  return fetch(input, { ...init, headers })
}
