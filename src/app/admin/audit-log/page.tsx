import { notFound } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth/session'
import { prisma } from '@/lib/db'

/**
 * 감사로그는 ADMIN 전용 화면이다. 관리자 레이아웃은 ADMIN·REVIEWER 공통
 * 진입을 허용하므로, REVIEWER가 이 URL을 직접 입력해도 접근하지 못하도록
 * 화면 단에서 다시 한 번 역할을 검사한다 (요구사항 §4 공격 시나리오:
 * "감사로그 URL 직접 입력").
 */
export default async function AuditLogPage() {
  const user = await getCurrentUser()
  if (user?.role !== 'ADMIN') notFound()

  const logs = await prisma.auditLog.findMany({
    orderBy: { createdAt: 'desc' },
    take: 50,
    include: { user: { select: { email: true, name: true } } },
  })

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-bold text-navy-800">감사 로그</h1>
      <div className="table-scroll">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="text-left text-xs text-slate-500">
            <tr>
              <th className="py-1.5 pr-3">시각</th>
              <th className="py-1.5 pr-3">사용자</th>
              <th className="py-1.5 pr-3">액션</th>
              <th className="py-1.5 pr-3">대상</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log.id} className="border-t border-slate-100">
                <td className="py-1.5 pr-3 text-xs text-slate-500">
                  {log.createdAt.toISOString().slice(0, 19).replace('T', ' ')}
                </td>
                <td className="py-1.5 pr-3">{log.user ? `${log.user.name} (${log.user.email})` : '(시스템)'}</td>
                <td className="py-1.5 pr-3">{log.action}</td>
                <td className="py-1.5 pr-3 text-xs text-slate-500">
                  {log.targetType}
                  {log.targetId ? ` #${log.targetId}` : ''}
                </td>
              </tr>
            ))}
            {logs.length === 0 && (
              <tr>
                <td colSpan={4} className="py-3 text-center text-sm text-slate-400">
                  기록된 감사 로그가 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
