'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { csrfFetch } from '@/lib/security/csrfFetch'

type Role = 'ADMIN' | 'REVIEWER' | 'USER'

interface AdminUserRow {
  id: string
  email: string
  name: string
  role: Role
  isActive: boolean
  mustChangePassword: boolean
  failedLoginCount: number
  lockedUntil: Date | null
  lastLoginAt: Date | null
}

const ROLE_OPTIONS: Role[] = ['ADMIN', 'REVIEWER', 'USER']

function isLocked(lockedUntil: Date | null): boolean {
  return !!lockedUntil && new Date(lockedUntil).getTime() > Date.now()
}

export function UserManagementTable({
  initialUsers,
  currentUserId,
}: {
  initialUsers: AdminUserRow[]
  currentUserId: string
}) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [newUser, setNewUser] = useState({ email: '', name: '', role: 'USER' as Role })
  const [creating, setCreating] = useState(false)

  async function patchUser(id: string, body: Record<string, unknown>) {
    setBusyId(id)
    setError(null)
    setNotice(null)
    try {
      const res = await csrfFetch(`/api/admin/users/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? '요청에 실패했습니다.')
        return
      }
      if (data.temporaryPassword) {
        setNotice(`임시 비밀번호가 발급되었습니다 (한 번만 표시됨): ${data.temporaryPassword}`)
      }
      router.refresh()
    } catch {
      setError('네트워크 오류가 발생했습니다.')
    } finally {
      setBusyId(null)
    }
  }

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setCreating(true)
    setError(null)
    setNotice(null)
    try {
      const res = await csrfFetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newUser),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? '사용자 생성에 실패했습니다.')
        return
      }
      setNotice(`사용자를 생성했습니다. 임시 비밀번호(한 번만 표시됨): ${data.temporaryPassword}`)
      setNewUser({ email: '', name: '', role: 'USER' })
      router.refresh()
    } catch {
      setError('네트워크 오류가 발생했습니다.')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <form
        onSubmit={handleCreate}
        className="flex flex-wrap items-end gap-2 rounded-lg border border-slate-200 bg-white p-4"
      >
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-600">이메일</label>
          <input
            type="email"
            required
            value={newUser.email}
            onChange={(e) => setNewUser((s) => ({ ...s, email: e.target.value }))}
            className="rounded border border-slate-300 px-2 py-1 text-sm"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-600">이름</label>
          <input
            required
            value={newUser.name}
            onChange={(e) => setNewUser((s) => ({ ...s, name: e.target.value }))}
            className="rounded border border-slate-300 px-2 py-1 text-sm"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-600">역할</label>
          <select
            value={newUser.role}
            onChange={(e) => setNewUser((s) => ({ ...s, role: e.target.value as Role }))}
            className="rounded border border-slate-300 px-2 py-1 text-sm"
          >
            {ROLE_OPTIONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          disabled={creating}
          className="rounded bg-navy-800 px-3 py-1.5 text-sm font-medium text-white hover:bg-navy-700 disabled:opacity-50"
        >
          {creating ? '생성 중...' : '사용자 추가'}
        </button>
      </form>

      {notice && <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}
      {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="bg-slate-50 text-xs text-slate-500">
            <tr>
              <th className="px-3 py-2">이메일</th>
              <th className="px-3 py-2">이름</th>
              <th className="px-3 py-2">역할</th>
              <th className="px-3 py-2">상태</th>
              <th className="px-3 py-2">최근 로그인</th>
              <th className="px-3 py-2">작업</th>
            </tr>
          </thead>
          <tbody>
            {initialUsers.map((u) => {
              const busy = busyId === u.id
              const locked = isLocked(u.lockedUntil)
              return (
                <tr key={u.id} className="border-t border-slate-100">
                  <td className="px-3 py-2">{u.email}</td>
                  <td className="px-3 py-2">{u.name}</td>
                  <td className="px-3 py-2">
                    <select
                      defaultValue={u.role}
                      disabled={busy}
                      onChange={(e) => patchUser(u.id, { action: 'setRole', role: e.target.value })}
                      className="rounded border border-slate-300 px-1.5 py-0.5 text-xs"
                    >
                      {ROLE_OPTIONS.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2 text-xs">
                    <div className="flex flex-col gap-0.5">
                      <span className={u.isActive ? 'text-emerald-700' : 'text-slate-400'}>
                        {u.isActive ? '활성' : '비활성'}
                      </span>
                      {locked && <span className="text-red-600">잠김</span>}
                      {u.mustChangePassword && <span className="text-amber-600">비밀번호 변경 필요</span>}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-500">
                    {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString('ko-KR') : '-'}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => patchUser(u.id, { action: 'setActive', isActive: !u.isActive })}
                        className="rounded border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50 disabled:opacity-50"
                      >
                        {u.isActive ? '비활성화' : '활성화'}
                      </button>
                      {locked && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => patchUser(u.id, { action: 'unlock' })}
                          className="rounded border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50 disabled:opacity-50"
                        >
                          잠금 해제
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => {
                          if (window.confirm('임시 비밀번호를 발급하시겠습니까? 기존 로그인 세션은 모두 해제됩니다.')) {
                            patchUser(u.id, { action: 'issueTemporaryPassword' })
                          }
                        }}
                        className="rounded border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50 disabled:opacity-50"
                      >
                        임시 비밀번호 발급
                      </button>
                      {u.id === currentUserId && <span className="px-2 py-1 text-xs text-slate-400">(본인)</span>}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
