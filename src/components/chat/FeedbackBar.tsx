'use client'

import { useState } from 'react'
import { FEEDBACK_REASON_OPTIONS } from './types'

export function FeedbackBar({ chatMessageId }: { chatMessageId: string }) {
  const [submitted, setSubmitted] = useState<string | null>(null)
  const [showComment, setShowComment] = useState(false)
  const [comment, setComment] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function submit(reason: string, commentValue?: string) {
    setError(null)
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ chatMessageId, reason, comment: commentValue }),
      })
      if (!res.ok) throw new Error('전송 실패')
      setSubmitted(reason)
      setShowComment(false)
    } catch {
      setError('피드백 전송에 실패했습니다.')
    }
  }

  if (submitted) {
    return <p className="text-xs text-slate-500">피드백이 접수되었습니다. 감사합니다.</p>
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-1.5">
        {FEEDBACK_REASON_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => (option.value === 'OTHER' ? setShowComment(true) : submit(option.value))}
            className="rounded-full border border-slate-300 px-2.5 py-1 text-xs text-slate-600 hover:border-navy-600 hover:text-navy-700"
          >
            {option.label}
          </button>
        ))}
      </div>
      {showComment && (
        <div className="flex gap-2">
          <input
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="의견을 입력하세요"
            className="flex-1 rounded-md border border-slate-300 px-2 py-1 text-xs"
          />
          <button
            type="button"
            onClick={() => submit('OTHER', comment)}
            className="rounded-md bg-navy-700 px-3 py-1 text-xs text-white"
          >
            제출
          </button>
        </div>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}
