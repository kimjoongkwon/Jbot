import { DevBypassPanel } from '@/components/auth/DevBypassPanel'
import { LoginForm } from '@/components/auth/LoginForm'
import { DatabaseUnavailableNotice } from '@/components/shared/DatabaseUnavailableNotice'
import { prisma } from '@/lib/db'
import { isDevAuthBypassEnabled } from '@/lib/env'

// 로그인 화면은 인증 여부와 무관하게(cookies() 등 동적 API를 쓰지 않고) 개발용 우회
// 계정 목록을 조건부로 조회할 수 있으므로, 이 지시가 없으면 Next.js가 빌드 시점에
// 정적 프리렌더링을 시도하며 그 시점에 실제 DB 접속을 시도한다. DATABASE_URL이
// 없거나 DB가 아직 준비되지 않은 Preview 빌드에서 빌드 자체가 실패하는 것을 막기
// 위해 항상 요청 시점에만 렌더링하도록 강제한다.
export const dynamic = 'force-dynamic'

export default async function LoginPage() {
  const devBypassEnabled = isDevAuthBypassEnabled()
  let devUsers: { id: string; email: string; name: string; role: string }[] = []

  if (devBypassEnabled) {
    try {
      devUsers = await prisma.user.findMany({
        where: { isActive: true },
        orderBy: { createdAt: 'asc' },
        select: { id: true, email: true, name: true, role: true },
      })
    } catch (error) {
      console.error('[login] DB 조회 실패:', error)
      return <DatabaseUnavailableNotice />
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 p-6">
      <div>
        <h1 className="text-xl font-bold text-navy-800">JK | 정비사업 법령 AI</h1>
        <p className="mt-1 text-sm text-slate-500">이메일과 비밀번호로 로그인하세요.</p>
      </div>

      <LoginForm />

      {devBypassEnabled && devUsers.length > 0 && <DevBypassPanel users={devUsers} />}
    </main>
  )
}
