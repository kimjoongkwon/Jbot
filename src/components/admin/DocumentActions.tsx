'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

export function DocumentActions({ documentId, status }: { documentId: string; status: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function setStatus(next: 'ACTIVE' | 'INACTIVE') {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/documents/${documentId}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ status: next }),
      })
      if (!res.ok) throw new Error()
      router.refresh()
    } catch {
      setError('처리에 실패했습니다.')
    } finally {
      setBusy(false)
    }
  }

  async function reprocess() {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/documents/${documentId}/reprocess`, { method: 'POST' })
      if (!res.ok) throw new Error()
      router.refresh()
    } catch {
      setError('재처리 요청에 실패했습니다.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex gap-1.5">
        {status !== 'ACTIVE' && (
          <button
            type="button"
            disabled={busy}
            onClick={() => setStatus('ACTIVE')}
            className="rounded border border-emerald-300 px-2 py-1 text-xs text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
          >
            활성화
          </button>
        )}
        {status !== 'INACTIVE' && (
          <button
            type="button"
            disabled={busy}
            onClick={() => setStatus('INACTIVE')}
            className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-50"
          >
            비활성화
          </button>
        )}
        <button
          type="button"
          disabled={busy}
          onClick={reprocess}
          className="rounded border border-navy-300 px-2 py-1 text-xs text-navy-700 hover:bg-navy-50 disabled:opacity-50"
        >
          재처리
        </button>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}
