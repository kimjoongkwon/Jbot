import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/session'
import { prisma } from '@/lib/db'
import { isClaudeConfigured, isEmbeddingConfigured } from '@/lib/env'
import { isNationalLawProviderConfigured } from '@/lib/legal-sources/national-law-provider'

export async function GET() {
  const user = await requireRole(['ADMIN', 'REVIEWER'])
  if (!user) return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 })

  const [
    totalDocuments,
    activeDocuments,
    processingDocuments,
    errorDocuments,
    totalChunks,
    recentQuestions,
    lowConfidenceAnswers,
    incorrectFeedbackCount,
  ] = await Promise.all([
    prisma.legalDocument.count(),
    prisma.legalDocument.count({ where: { status: 'ACTIVE' } }),
    prisma.legalDocument.count({ where: { status: 'PROCESSING' } }),
    prisma.legalDocument.count({ where: { status: 'ERROR' } }),
    prisma.legalChunk.count(),
    prisma.chatMessage.count({ where: { role: 'USER', createdAt: { gte: new Date(Date.now() - 7 * 86400000) } } }),
    prisma.chatMessage.count({ where: { role: 'ASSISTANT', confidence: 'LOW' } }),
    prisma.answerFeedback.count({ where: { reason: { in: ['INCORRECT', 'MISSING_CITATION', 'UNSUPPORTED_CONCLUSION'] } } }),
  ])

  return NextResponse.json({
    totalDocuments,
    activeDocuments,
    processingDocuments,
    errorDocuments,
    totalChunks,
    recentQuestions,
    lowConfidenceAnswers,
    incorrectFeedbackCount,
    embeddingConfigured: isEmbeddingConfigured(),
    claudeConfigured: isClaudeConfigured(),
    externalLegalApiConfigured: isNationalLawProviderConfigured(),
  })
}
