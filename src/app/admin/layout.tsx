import { redirect } from 'next/navigation'
import { requireRole } from '@/lib/auth/session'

const NAV_ITEMS = [
  { href: '/admin', label: '대시보드' },
  { href: '/admin/documents', label: '문서 관리' },
  { href: '/admin/reviews', label: '질문 검토' },
]

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole(['ADMIN', 'REVIEWER'])
  if (!user) redirect('/login')

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
        </nav>
        <div className="mt-auto flex flex-col gap-2 pt-4 text-xs">
          <a href="/chat" className="text-navy-100 hover:underline">
            챗봇 화면으로
          </a>
          <form action="/api/auth/logout" method="POST">
            <button type="submit" className="text-navy-100 hover:underline">
              로그아웃
            </button>
          </form>
        </div>
      </aside>
      <main className="flex-1 bg-slate-50 p-4 md:p-6">{children}</main>
    </div>
  )
}
