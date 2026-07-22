'use client'

interface DevUser {
  id: string
  email: string
  name: string
  role: string
}

/**
 * DEV_AUTH_BYPASS=true 이고 NODE_ENV !== 'production'일 때만 로그인 페이지
 * 서버 컴포넌트가 이 패널을 렌더링한다(src/app/login/page.tsx 참고). 프로덕션
 * 빌드에서는 이 조건이 항상 거짓이므로 화면에 나타나지 않는다.
 */
export function DevBypassPanel({ users }: { users: DevUser[] }) {
  async function handleBypass(userId: string) {
    const res = await fetch('/api/auth/dev-bypass', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    })
    if (res.ok) {
      const data = await res.json()
      window.location.href = data.redirectTo ?? '/chat'
    }
  }

  return (
    <div className="rounded-lg border border-amber-300 bg-amber-50 p-4">
      <p className="mb-2 text-xs font-semibold text-amber-800">
        개발 전용 인증 우회(DEV_AUTH_BYPASS) — 프로덕션 환경에서는 표시되지 않습니다.
      </p>
      <ul className="flex flex-col gap-1">
        {users.map((user) => (
          <li key={user.id}>
            <button
              type="button"
              onClick={() => handleBypass(user.id)}
              className="w-full rounded-md border border-amber-200 bg-white px-3 py-2 text-left text-xs hover:border-amber-500"
            >
              {user.name} ({user.email}) — {user.role}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
