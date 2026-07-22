import { prisma } from '@/lib/db'
import { businessTypeLabel, REVIEW_STATUS_OPTIONS } from '@/lib/labels'
import { ReviewStatusSelect } from '@/components/admin/ReviewStatusSelect'

export default async function AdminReviewsPage({
  searchParams,
}: {
  searchParams: Promise<{ reviewStatus?: string }>
}) {
  const { reviewStatus } = await searchParams

  const messages = await prisma.chatMessage.findMany({
    where: { role: 'ASSISTANT', reviewStatus: (reviewStatus as never) || undefined },
    include: {
      chatSession: { include: { user: { select: { name: true, email: true } } } },
      citations: { include: { legalChunk: { include: { documentVersion: { include: { legalDocument: true } } } } } },
      feedbacks: true,
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })

  const withQuestions = await Promise.all(
    messages.map(async (message) => {
      const question = await prisma.chatMessage.findFirst({
        where: { chatSessionId: message.chatSessionId, role: 'USER', createdAt: { lt: message.createdAt } },
        orderBy: { createdAt: 'desc' },
      })
      return { ...message, question: question?.content ?? '(질문 없음)' }
    }),
  )

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-bold text-navy-800">질문 검토</h1>

      <form method="GET" className="flex gap-2">
        <select name="reviewStatus" defaultValue={reviewStatus} className="rounded-md border border-slate-300 px-2 py-1.5 text-sm">
          <option value="">전체 검토 상태</option>
          {REVIEW_STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <button type="submit" className="rounded-md bg-slate-800 px-3 py-1.5 text-sm text-white">
          필터
        </button>
      </form>

      <div className="flex flex-col gap-3">
        {withQuestions.map((message) => (
          <div key={message.id} className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-slate-500">
                {message.chatSession.region ?? '전국'} ·{' '}
                {message.chatSession.businessType ? businessTypeLabel[message.chatSession.businessType] : '사업유형 미지정'} ·{' '}
                {new Date(message.createdAt).toISOString().slice(0, 16).replace('T', ' ')}
              </p>
              <ReviewStatusSelect messageId={message.id} value={message.reviewStatus} />
            </div>
            <p className="mt-2 text-sm font-medium text-slate-900">Q. {message.question}</p>
            <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">A. {message.content}</p>
            <p className="mt-2 text-xs text-slate-500">
              신뢰도: {message.confidence ?? '-'} · 인용 {message.citations.length}건 · 피드백 {message.feedbacks.length}건
            </p>
            {message.feedbacks.length > 0 && (
              <ul className="mt-1 list-inside list-disc text-xs text-amber-700">
                {message.feedbacks.map((f) => (
                  <li key={f.id}>
                    {f.reason} {f.comment ? `- ${f.comment}` : ''}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
        {withQuestions.length === 0 && <p className="text-sm text-slate-400">표시할 답변이 없습니다.</p>}
      </div>
    </div>
  )
}
