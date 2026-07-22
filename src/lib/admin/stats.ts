import { prisma } from '../db'
import { isClaudeConfigured, isEmbeddingConfigured } from '../env'
import { isNationalLawProviderConfigured } from '../legal-sources/national-law-provider'

export interface AdminStats {
  totalDocuments: number
  activeDocuments: number
  processingDocuments: number
  errorDocuments: number
  totalChunks: number
  recentQuestions: number
  lowConfidenceAnswers: number
  incorrectFeedbackCount: number
  embeddingConfigured: boolean
  claudeConfigured: boolean
  externalLegalApiConfigured: boolean
}

export async function getAdminStats(): Promise<AdminStats> {
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
    prisma.answerFeedback.count({
      where: { reason: { in: ['INCORRECT', 'MISSING_CITATION', 'UNSUPPORTED_CONCLUSION'] } },
    }),
  ])

  return {
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
  }
}
