'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { REVIEW_STATUS_OPTIONS } from '@/lib/labels'

export function ReviewStatusSelect({ messageId, value }: { messageId: string; value: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  async function handleChange(next: string) {
    setBusy(true)
    try {
      await fetch(`/api/reviews/${messageId}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ reviewStatus: next }),
      })
      router.refresh()
    } finally {
      setBusy(false)
    }
  }

  return (
    <select
      defaultValue={value}
      disabled={busy}
      onChange={(e) => handleChange(e.target.value)}
      className="rounded border border-slate-300 px-2 py-1 text-xs"
    >
      {REVIEW_STATUS_OPTIONS.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  )
}
