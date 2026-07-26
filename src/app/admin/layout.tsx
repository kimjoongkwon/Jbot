import { redirect } from 'next/navigation'
import { LogoutButton } from '@/components/auth/LogoutButton'
import { requireRole } from '@/lib/auth/session'
import { getEnv, isPreviewReadOnlyMode } from '@/lib/env'
import { DatabaseUnavailableNotice } from '@/components/shared/DatabaseUnavailableNotice'

const NAV_ITEMS = [
  { href: '/admin', label: '대시보드' },
  { href: '/admin/documents', label: '문서 관리' },
  { href: '/admin/reviews', label: '질문 검토' },
]

// 이 레이아웃과 그 하위 /admin/** 페이지는 모두 로그인 세션(cookies())과 DB
// 데이터를 사용한다. force-dynamic을 레이아웃에서 한 번 지정하면 하위 경로
// 전체에 적용되므로, 빌드 시점에 어떤 /admin/** 페이지도 정적 프리렌더링을
// 시도하지 않는다(따라서 빌드 중 Prisma 쿼리가 실행되지 않는다).
export const dynamic = 'force-dynamic'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  let user
  try {
    user = await requireRole(['ADMIN', 'REVIEWER'])
  } catch (error) {
    console.error('[admin] 로그인 확인 중 DB 조회 실패:', error)
    return <DatabaseUnavailableNotice />
  }
  if (!user) redirect('/login')
  if (user.mustChangePassword) redirect('/account/security')

  const readOnly = isPreviewReadOnlyMode(getEnv())

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <aside className="flex shrink-0 flex-col gap-1 border-b border-slate-200 bg-navy-900 p-4 text-white md:w-56 md:border-b-0 md:border-r">
        <div className="mb-4">
          <p className="text-sm font-bold">JK | 정비사업 법령 AI</p>
          <p className="text-xs text-navy-100">
            {user.name} ({user.role})
          </p>
        </div>
        <nav className="flex flex-row gap-1 overflow-x-auto md:flex-col">
          {NAV_ITEMS.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="whitespace-nowrap rounded-md px-3 py-2 text-sm text-navy-50 hover:bg-navy-800"
            >
              {item.label}
            </a>
          ))}
          {user.role === 'ADMIN' && (
            <a
              href="/admin/users"
              className="whitespace-nowrap rounded-md px-3 py-2 text-sm text-navy-50 hover:bg-navy-800"
            >
              사용자 관리
            </a>
          )}
        </nav>
        <div className="mt-auto flex flex-col gap-2 pt-4 text-xs">
          <a href="/chat" className="text-navy-100 hover:underline">
            챗봇 화면으로
          </a>
          <a href="/account/security" className="text-navy-100 hover:underline">
            비밀번호 변경
          </a>
          <LogoutButton className="text-left text-navy-100 hover:underline" />
        </div>
      </aside>
      <main className="flex-1 bg-slate-50 p-4 md:p-6">
        {readOnly && (
          <p className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
            현재 미리보기 환경은 읽기 전용입니다. 문서 업로드는 운영용 Object Storage 연결 후
            사용할 수 있습니다.
          </p>
        )}
        {children}
      </main>
    </div>
  )
}
