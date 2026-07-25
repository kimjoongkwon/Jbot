import { prisma } from '@/lib/db'
import { DatabaseUnavailableNotice } from '@/components/shared/DatabaseUnavailableNotice'

// 로그인 화면은 인증 여부와 무관하게(cookies() 등 동적 API를 쓰지 않고) 사용자
// 목록을 무조건 조회하므로, 이 지시가 없으면 Next.js가 빌드 시점에 정적
// 프리렌더링을 시도하며 그 시점에 실제 DB 접속을 시도한다. DATABASE_URL이 없거나
// DB가 아직 준비되지 않은 Preview 빌드에서 빌드 자체가 실패하는 것을 막기 위해
// 항상 요청 시점에만 렌더링하도록 강제한다.
export const dynamic = 'force-dynamic'

export default async function LoginPage() {
  let users
  try {
    users = await prisma.user.findMany({ orderBy: { createdAt: 'asc' } })
  } catch (error) {
    console.error('[login] DB 조회 실패:', error)
    return <DatabaseUnavailableNotice />
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 p-6">
      <div>
        <h1 className="text-xl font-bold text-navy-800">JK | 정비사업 법령 AI</h1>
        <p className="mt-1 text-sm text-slate-500">
          로그인할 사용자를 선택하세요. (개발용 간이 로그인이며, 비밀번호 등 실제 인증은
          아직 구현되지 않았습니다 — docs/NEXT_STEPS.md 참고)
        </p>
      </div>

      {users.length === 0 ? (
        <p className="rounded-lg bg-red-50 p-4 text-sm text-red-700">
          등록된 사용자가 없습니다. <code>npm run db:seed</code>를 먼저 실행하세요.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {users.map((user) => (
            <li key={user.id}>
              <form action="/api/auth/login" method="POST">
                <input type="hidden" name="userId" value={user.id} />
                <button
                  type="submit"
                  className="flex w-full items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-3 text-left shadow-sm hover:border-navy-600"
                >
                  <span>
                    <span className="block font-medium text-slate-900">{user.name}</span>
                    <span className="block text-xs text-slate-500">{user.email}</span>
                  </span>
                  <span className="rounded bg-slate-100 px-2 py-1 text-xs text-slate-600">{user.role}</span>
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
