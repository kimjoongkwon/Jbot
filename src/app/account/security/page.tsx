import { redirect } from 'next/navigation'
import { LogoutButton } from '@/components/auth/LogoutButton'
import { PasswordChangeForm } from '@/components/auth/PasswordChangeForm'
import { getCurrentUser } from '@/lib/auth/session'

export default async function AccountSecurityPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 p-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-navy-800">비밀번호 변경</h1>
          <p className="mt-1 text-sm text-slate-500">
            {user.name}님 ({user.email})
          </p>
        </div>
        {!user.mustChangePassword && <LogoutButton className="text-xs text-slate-500 hover:underline" />}
      </div>

      <PasswordChangeForm forced={user.mustChangePassword} />
    </main>
  )
}
