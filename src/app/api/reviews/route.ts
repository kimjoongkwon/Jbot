import { type NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/session'
import { prisma } from '@/lib/db'

export async function GET(request: NextRequest) {
  const user = await requireRole(['ADMIN', 'REVIEWER'])
  if (!user) return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const reviewStatus = searchParams.get('reviewStatus') as never

  const messages = await prisma.chatMessage.findMany({
    where: { role: 'ASSISTANT', reviewStatus: reviewStatus || undefined },
    include: {
      chatSession: { include: { user: { select: { name: true, email: true } } } },
      citations: { include: { legalChunk: { include: { documentVersion: { include: { legalDocument: true } } } } } },
      feedbacks: true,
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
  })

  // ChatMessage에는 질문·답변 쌍 링크가 없으므로, 같은 세션에서 이 답변 직전의
  // 사용자 질문 메시지를 함께 조회해 화면에 표시한다.
  const withQuestions = await Promise.all(
    messages.map(async (message) => {
      const question = await prisma.chatMessage.findFirst({
        where: { chatSessionId: message.chatSessionId, role: 'USER', createdAt: { lt: message.createdAt } },
        orderBy: { createdAt: 'desc' },
      })
      return { ...message, question: question?.content ?? null }
    }),
  )

  return NextResponse.json({ messages: withQuestions })
}
