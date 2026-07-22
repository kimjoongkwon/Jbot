import type { FeedbackReason } from '@prisma/client'
import { type NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/session'
import { prisma } from '@/lib/db'
import { toErrorResponse } from '@/lib/http/errorResponse'

const REASON_TO_RATING: Record<FeedbackReason, 'POSITIVE' | 'NEGATIVE'> = {
  HELPFUL: 'POSITIVE',
  INCORRECT: 'NEGATIVE',
  MISSING_CITATION: 'NEGATIVE',
  OUTDATED_SOURCE: 'NEGATIVE',
  WRONG_REGION: 'NEGATIVE',
  UNSUPPORTED_CONCLUSION: 'NEGATIVE',
  OTHER: 'NEGATIVE',
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })

  try {
    const body = (await request.json()) as {
      chatMessageId: string
      reason: FeedbackReason
      comment?: string
    }

    if (!body.chatMessageId || !REASON_TO_RATING[body.reason]) {
      return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 })
    }

    const feedback = await prisma.answerFeedback.create({
      data: {
        chatMessageId: body.chatMessageId,
        userId: user.id,
        rating: REASON_TO_RATING[body.reason],
        reason: body.reason,
        comment: body.comment?.trim() || null,
      },
    })

    return NextResponse.json({ feedback }, { status: 201 })
  } catch (error) {
    return toErrorResponse(error)
  }
}
