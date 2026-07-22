import { CitationCard } from './CitationCard'
import { FeedbackBar } from './FeedbackBar'
import type { ChatTurn } from './types'

const CONFIDENCE_LABEL: Record<string, string> = { HIGH: '높음', MEDIUM: '보통', LOW: '낮음' }
const CONFIDENCE_COLOR: Record<string, string> = {
  HIGH: 'bg-emerald-100 text-emerald-700',
  MEDIUM: 'bg-amber-100 text-amber-700',
  LOW: 'bg-red-100 text-red-700',
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</h3>
      {children}
    </div>
  )
}

export function AnswerCard({ turn }: { turn: ChatTurn }) {
  if (turn.error) {
    return <p className="rounded-lg bg-red-50 p-4 text-sm text-red-700">{turn.error}</p>
  }

  if (!turn.aiConfigured) {
    return (
      <div className="flex flex-col gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4">
        <p className="text-sm text-amber-800">{turn.notice}</p>
        {turn.sources.length > 0 && (
          <Section title="검색된 관련 조문">
            <div className="flex flex-col gap-2">
              {turn.sources.map((s) => (
                <CitationCard key={s.citationId} source={s} />
              ))}
            </div>
          </Section>
        )}
        {turn.messageId && (
          <div className="border-t border-amber-200 pt-3">
            <FeedbackBar chatMessageId={turn.messageId} />
          </div>
        )}
      </div>
    )
  }

  const answer = turn.answer
  if (!answer) return null

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-4">
      <Section title="1. 결론">
        <p className="text-[15px] leading-relaxed text-slate-900">{answer.conclusion}</p>
      </Section>

      <Section title="2. 판단 요약">
        <p className="text-sm leading-relaxed text-slate-700">{answer.summary}</p>
      </Section>

      {turn.sources.length > 0 && (
        <Section title="3. 관련 조문과 근거">
          <div className="flex flex-col gap-2">
            {turn.sources.map((s) => (
              <CitationCard key={s.citationId} source={s} />
            ))}
          </div>
        </Section>
      )}

      {answer.exceptions.length > 0 && (
        <Section title="4. 예외 및 주의사항">
          <ul className="list-inside list-disc text-sm text-slate-700">
            {answer.exceptions.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        </Section>
      )}

      {answer.factsToConfirm.length > 0 && (
        <Section title="5. 추가 확인사항">
          <ul className="list-inside list-disc text-sm text-slate-700">
            {answer.factsToConfirm.map((f, i) => (
              <li key={i}>{f}</li>
            ))}
          </ul>
        </Section>
      )}

      {answer.conflictsOrLimitations.length > 0 && (
        <Section title="6. 자료 충돌 또는 한계">
          <ul className="list-inside list-disc text-sm text-amber-700">
            {answer.conflictsOrLimitations.map((c, i) => (
              <li key={i}>{c}</li>
            ))}
          </ul>
        </Section>
      )}

      <Section title="7. 답변 신뢰도">
        <div className="flex items-center gap-2">
          <span className={`rounded px-2 py-0.5 text-xs font-medium ${CONFIDENCE_COLOR[answer.confidence]}`}>
            {CONFIDENCE_LABEL[answer.confidence]}
          </span>
          <span className="text-xs text-slate-500">{answer.confidenceReason}</span>
        </div>
      </Section>

      <Section title="8. 적용 기준일">
        <p className="text-sm text-slate-700">{answer.referenceDate}</p>
      </Section>

      <Section title="9. 안내">
        <p className="text-xs leading-relaxed text-slate-500">{answer.disclaimer}</p>
      </Section>

      {turn.messageId && (
        <div className="border-t border-slate-100 pt-3">
          <FeedbackBar chatMessageId={turn.messageId} />
        </div>
      )}
    </div>
  )
}
