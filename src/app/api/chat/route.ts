import type { BusinessType } from '@prisma/client'
import { type NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/session'
import { prisma } from '@/lib/db'
import { isClaudeConfigured } from '@/lib/env'
import { hybridSearch } from '@/lib/search/hybridSearch'
import { legalHierarchyLabel } from '@/lib/search/legalHierarchy'
import type { CitationSourceChunk } from '@/lib/claude/contextBuilder'
import { generateLegalAnswer } from '@/lib/claude/generateAnswer'
import { NO_EVIDENCE_CONCLUSION, ANSWER_DISCLAIMER } from '@/lib/claude/systemPrompt'
import { toErrorResponse } from '@/lib/http/errorResponse'

const CLAUDE_NOT_CONFIGURED_NOTICE =
  '관련 법령 자료는 검색되었으나 AI 답변 기능이 설정되지 않았습니다. ANTHROPIC_API_KEY를 설정하면 근거 기반 해석 답변을 사용할 수 있습니다.'

interface ChatRequestBody {
  question: string
  sessionId?: string
  region?: string
  businessType?: BusinessType
  procedureStage?: string
  referenceDate?: string
}

async function hydrateCitationChunks(
  chunkIds: string[],
): Promise<{ sourceChunks: CitationSourceChunk[]; scoreByCitationId: Map<string, number> }> {
  const chunks = await prisma.legalChunk.findMany({
    where: { id: { in: chunkIds } },
    include: { documentVersion: { include: { legalDocument: true } } },
  })
  const byId = new Map(chunks.map((c) => [c.id, c]))
  const scoreByCitationId = new Map<string, number>()

  const sourceChunks: CitationSourceChunk[] = []
  chunkIds.forEach((chunkId, index) => {
    const chunk = byId.get(chunkId)
    if (!chunk) return
    const citationId = `C${index + 1}`
    sourceChunks.push({
      citationId,
      legalChunkId: chunk.id,
      documentTitle: chunk.documentVersion.legalDocument.title,
      documentType: chunk.documentVersion.legalDocument.documentType,
      jurisdictionName: chunk.documentVersion.legalDocument.jurisdictionName,
      hierarchyPath: chunk.hierarchyPath,
      content: chunk.content,
      effectiveFrom: chunk.documentVersion.effectiveFrom?.toISOString().slice(0, 10) ?? null,
      isCurrent: chunk.documentVersion.isCurrent,
    })
  })

  return { sourceChunks, scoreByCitationId }
}

function buildDisplaySources(sourceChunks: CitationSourceChunk[], scores: Map<string, number>) {
  return sourceChunks.map((c) => ({
    citationId: c.citationId,
    legalChunkId: c.legalChunkId,
    documentTitle: c.documentTitle,
    documentTypeLabel: legalHierarchyLabel(c.documentType),
    jurisdictionName: c.jurisdictionName,
    hierarchyPath: c.hierarchyPath,
    quotedText: c.content,
    effectiveFrom: c.effectiveFrom,
    isCurrent: c.isCurrent,
    relevanceScore: scores.get(c.citationId) ?? null,
    detailUrl: `/documents/${c.legalChunkId}`,
  }))
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })

  try {
    const body = (await request.json()) as ChatRequestBody
    const question = body.question?.trim()
    if (!question) {
      return NextResponse.json({ error: '질문을 입력해 주세요.' }, { status: 400 })
    }

    const referenceDate = body.referenceDate ? new Date(body.referenceDate) : new Date()
    const referenceDateStr = referenceDate.toISOString().slice(0, 10)

    const session = body.sessionId
      ? await prisma.chatSession.findUnique({ where: { id: body.sessionId } })
      : await prisma.chatSession.create({
          data: {
            userId: user.id,
            title: question.slice(0, 60),
            region: body.region ?? null,
            businessType: body.businessType ?? null,
            procedureStage: (body.procedureStage as never) ?? null,
            referenceDate,
          },
        })

    if (!session) {
      return NextResponse.json({ error: '대화 세션을 찾을 수 없습니다.' }, { status: 404 })
    }

    // 감사로그에는 질문 원문을 남기지 않는다 (요구사항 §5). ChatMessage에만 저장한다.
    await prisma.chatMessage.create({
      data: { chatSessionId: session.id, role: 'USER', content: question },
    })

    const searchResults = await hybridSearch({
      question,
      region: body.region ?? null,
      businessType: body.businessType ?? null,
      referenceDate,
    })

    const { sourceChunks } = await hydrateCitationChunks(searchResults.map((r) => r.chunkId))
    const scoreByCitationId = new Map(sourceChunks.map((c, i) => [c.citationId, searchResults[i]?.score ?? 0]))
    const displaySources = buildDisplaySources(sourceChunks, scoreByCitationId)

    if (!isClaudeConfigured()) {
      const assistantMessage = await prisma.chatMessage.create({
        data: {
          chatSessionId: session.id,
          role: 'ASSISTANT',
          content: CLAUDE_NOT_CONFIGURED_NOTICE,
          confidence: null,
        },
      })
      return NextResponse.json({
        sessionId: session.id,
        messageId: assistantMessage.id,
        aiConfigured: false,
        notice: CLAUDE_NOT_CONFIGURED_NOTICE,
        sources: displaySources,
      })
    }

    if (sourceChunks.length === 0) {
      const assistantMessage = await prisma.chatMessage.create({
        data: {
          chatSessionId: session.id,
          role: 'ASSISTANT',
          content: NO_EVIDENCE_CONCLUSION,
          confidence: 'LOW',
          structuredAnswer: {
            conclusion: NO_EVIDENCE_CONCLUSION,
            summary: NO_EVIDENCE_CONCLUSION,
            legalBasis: [],
            analysis: [],
            exceptions: [],
            factsToConfirm: [],
            conflictsOrLimitations: ['검색된 참고자료가 없습니다.'],
            confidence: 'LOW',
            confidenceReason: '등록된 자료 중 질문과 관련된 조문을 찾지 못했습니다.',
            referenceDate: referenceDateStr,
            disclaimer: ANSWER_DISCLAIMER,
          },
        },
      })
      return NextResponse.json({
        sessionId: session.id,
        messageId: assistantMessage.id,
        aiConfigured: true,
        answer: (assistantMessage.structuredAnswer as object) ?? null,
        sources: [],
      })
    }

    const { answer, hadCoreInvalidCitation } = await generateLegalAnswer(question, sourceChunks, referenceDateStr)

    // 허위 인용(citationId 검증 실패)이 핵심 근거에 포함되었다면 신뢰도를 하향한다 (요구사항 §9).
    const finalAnswer =
      hadCoreInvalidCitation && answer.confidence !== 'LOW'
        ? {
            ...answer,
            confidence: 'LOW' as const,
            confidenceReason: `${answer.confidenceReason} (일부 인용이 검색 결과와 일치하지 않아 신뢰도를 하향 조정했습니다.)`,
          }
        : answer

    const assistantMessage = await prisma.chatMessage.create({
      data: {
        chatSessionId: session.id,
        role: 'ASSISTANT',
        content: finalAnswer.conclusion,
        structuredAnswer: finalAnswer,
        confidence: finalAnswer.confidence,
      },
    })

    const citationIdToChunk = new Map(sourceChunks.map((c) => [c.citationId, c]))
    await prisma.$transaction(
      finalAnswer.legalBasis.map((basis, index) => {
        const chunk = citationIdToChunk.get(basis.citationId)!
        const score = scoreByCitationId.get(basis.citationId) ?? null
        return prisma.answerCitation.create({
          data: {
            chatMessageId: assistantMessage.id,
            legalChunkId: chunk.legalChunkId,
            citationOrder: index,
            quotedText: chunk.content,
            relevanceScore: score,
            citationReason: basis.explanation,
          },
        })
      }),
    )

    return NextResponse.json({
      sessionId: session.id,
      messageId: assistantMessage.id,
      aiConfigured: true,
      answer: finalAnswer,
      sources: displaySources,
    })
  } catch (error) {
    return toErrorResponse(error)
  }
}
