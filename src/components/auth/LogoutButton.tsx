'use client'

import { CSRF_COOKIE_NAME, CSRF_HEADER_NAME } from '@/lib/security/csrfConstants'

function readCookie(name: string): string | undefined {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`))
  return match ? decodeURIComponent(match[1]) : undefined
}

/**
 * 더블 서브밋 쿠키 CSRF 값을 자바스크립트로 읽어 헤더에 실어 로그아웃 요청을
 * 보낸다(로그아웃 쿠키는 HttpOnly가 아니므로 읽을 수 있음). 네이티브
 * <form method="POST"> 방식으로는 헤더를 붙일 수 없어 클라이언트 컴포넌트로 구현한다.
 */
export function LogoutButton({ className }: { className?: string }) {
  async function handleLogout() {
    const csrfToken = readCookie(CSRF_COOKIE_NAME)
    await fetch('/api/auth/logout', {
      method: 'POST',
      headers: csrfToken ? { [CSRF_HEADER_NAME]: csrfToken } : undefined,
    })
    window.location.href = '/login'
  }

  return (
    <button type="button" onClick={handleLogout} className={className}>
      로그아웃
    </button>
  )
}
