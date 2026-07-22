'use client'

import { useState } from 'react'
import { LogoutButton } from '@/components/auth/LogoutButton'
import { csrfFetch } from '@/lib/security/csrfFetch'
import { AnswerCard } from './AnswerCard'
import { FilterPanel, type ChatFilters } from './FilterPanel'
import type { ChatTurn } from './types'

function todayString() {
  return new Date().toISOString().slice(0, 10)
}

export function ChatPageClient({ userName, userRole }: { userName: string; userRole: string }) {
  const [filters, setFilters] = useState<ChatFilters>({
    region: '전국',
    businessType: '',
    procedureStage: '',
    referenceDate: todayString(),
  })
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [turns, setTurns] = useState<ChatTurn[]>([])
  const [question, setQuestion] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit() {
    const trimmed = question.trim()
    if (!trimmed || loading) return
    setLoading(true)
    setQuestion('')

    const turnId = `${Date.now()}`
    setTurns((prev) => [
      ...prev,
      { id: turnId, question: trimmed, aiConfigured: true, answer: null, sources: [], messageId: null },
    ])

    try {
      const res = await csrfFetch('/api/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          question: trimmed,
          sessionId,
          region: filters.region,
          businessType: filters.businessType || undefined,
          procedureStage: filters.procedureStage || undefined,
          referenceDate: filters.referenceDate,
        }),
      })
      const data = await res.json()

      if (!res.ok) {
        setTurns((prev) =>
          prev.map((t) => (t.id === turnId ? { ...t, error: data.error ?? '오류가 발생했습니다.' } : t)),
        )
        return
      }

      setSessionId(data.sessionId)
      setTurns((prev) =>
        prev.map((t) =>
          t.id === turnId
            ? {
                ...t,
                aiConfigured: data.aiConfigured,
                notice: data.notice,
                answer: data.answer ?? null,
                sources: data.sources ?? [],
                messageId: data.messageId ?? null,
              }
            : t,
        ),
      )
    } catch {
      setTurns((prev) =>
        prev.map((t) => (t.id === turnId ? { ...t, error: '네트워크 오류가 발생했습니다.' } : t)),
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
        <div>
          <h1 className="text-base font-bold text-navy-800">JK | 정비사업 법령 AI</h1>
          <p className="text-xs text-slate-500">{userName}님 ({userRole})</p>
        </div>
        <div className="flex items-center gap-3 text-xs">
          {(userRole === 'ADMIN' || userRole === 'REVIEWER') && (
            <a href="/admin" className="font-medium text-navy-700 hover:underline">
              관리자
            </a>
          )}
          <a href="/account/security" className="text-slate-500 hover:underline">
            비밀번호 변경
          </a>
          <LogoutButton className="text-slate-500 hover:underline" />
        </div>
      </header>

      <FilterPanel filters={filters} onChange={setFilters} open={filtersOpen} onToggle={() => setFiltersOpen((v) => !v)} />

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 p-4">
        {turns.length === 0 && (
          <p className="mt-8 text-center text-sm text-slate-400">
            창립총회 이후 부족한 조합설립 동의서를 추가로 받을 수 있나요? 와 같이 질문해보세요.
          </p>
        )}
        {turns.map((turn) => (
          <div key={turn.id} className="flex flex-col gap-2">
            <div className="self-end rounded-lg bg-navy-700 px-4 py-2 text-sm text-white">{turn.question}</div>
            <AnswerCard turn={turn} />
          </div>
        ))}
        {loading && <p className="text-sm text-slate-400">답변 생성 중입니다...</p>}
      </main>

      <div className="sticky bottom-0 flex gap-2 border-t border-slate-200 bg-white p-3">
        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              handleSubmit()
            }
          }}
          rows={1}
          placeholder="질문을 입력하세요"
          className="flex-1 resize-none rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
        <button
          type="button"
          onClick={handleSubmit}
          disabled={loading || question.trim().length === 0}
          className="rounded-md bg-navy-700 px-4 py-2 text-sm font-medium text-white disabled:bg-slate-300"
        >
          전송
        </button>
      </div>
    </div>
  )
}
