import { DevBypassPanel } from '@/components/auth/DevBypassPanel'
import { LoginForm } from '@/components/auth/LoginForm'
import { prisma } from '@/lib/db'
import { isDevAuthBypassEnabled } from '@/lib/env'

export default async function LoginPage() {
  const devBypassEnabled = isDevAuthBypassEnabled()
  const devUsers = devBypassEnabled
    ? await prisma.user.findMany({
        where: { isActive: true },
        orderBy: { createdAt: 'asc' },
        select: { id: true, email: true, name: true, role: true },
      })
    : []

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
