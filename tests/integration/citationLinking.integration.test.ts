import { afterAll, describe, expect, it } from 'vitest'
import { prisma } from '@/lib/db'
import { cleanupTestDocuments, createTestChunk, createTestDocument, createTestVersion } from './testHelpers'

describe('답변-인용(citation) 연결 통합 테스트', () => {
  const createdDocIds: string[] = []

  afterAll(async () => {
    await cleanupTestDocuments(createdDocIds)
    await prisma.$disconnect()
  })

  it('ChatMessage(ASSISTANT)와 AnswerCitation이 LegalChunk까지 정확히 연결된다', async () => {
    const doc = await createTestDocument({ title: '[TEST] 인용연결법' })
    createdDocIds.push(doc.id)
    const version = await createTestVersion(doc.id)
    const chunk = await createTestChunk(version.id, {
      articleNumber: '10',
      hierarchyPath: '[TEST] 인용연결법 > 제10조',
      content: '인용 연결 테스트용 조문 내용.',
    })

    const session = await prisma.chatSession.create({ data: { title: '테스트 세션' } })
    await prisma.chatMessage.create({ data: { chatSessionId: session.id, role: 'USER', content: '질문입니다.' } })

    const assistantMessage = await prisma.chatMessage.create({
      data: {
        chatSessionId: session.id,
        role: 'ASSISTANT',
        content: '결론입니다.',
        confidence: 'HIGH',
        structuredAnswer: { conclusion: '결론입니다.' },
      },
    })

    await prisma.answerCitation.create({
      data: {
        chatMessageId: assistantMessage.id,
        legalChunkId: chunk.id,
        citationOrder: 0,
        quotedText: chunk.content,
        relevanceScore: 12.3,
        citationReason: '핵심 근거',
      },
    })

    const fetched = await prisma.chatMessage.findUniqueOrThrow({
      where: { id: assistantMessage.id },
      include: {
        citations: {
          include: { legalChunk: { include: { documentVersion: { include: { legalDocument: true } } } } },
        },
      },
    })

    expect(fetched.citations).toHaveLength(1)
    expect(fetched.citations[0].legalChunk.id).toBe(chunk.id)
    expect(fetched.citations[0].legalChunk.documentVersion.legalDocument.id).toBe(doc.id)
    expect(fetched.citations[0].quotedText).toBe(chunk.content)

    // 세션 정리
    await prisma.chatSession.delete({ where: { id: session.id } })
  })
})
