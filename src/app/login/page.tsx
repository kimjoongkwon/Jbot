import { prisma } from '@/lib/db'

export default async function LoginPage() {
  const users = await prisma.user.findMany({ orderBy: { createdAt: 'asc' } })

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
