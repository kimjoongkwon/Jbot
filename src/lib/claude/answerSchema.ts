import { z } from 'zod'

export const LegalAnswerSchema = z.object({
  conclusion: z.string(),
  summary: z.string(),
  legalBasis: z.array(
    z.object({
      citationId: z.string(),
      documentTitle: z.string(),
      article: z.string().nullable(),
      explanation: z.string(),
    }),
  ),
  analysis: z.array(
    z.object({
      issue: z.string(),
      reasoning: z.string(),
      citationIds: z.array(z.string()),
    }),
  ),
  exceptions: z.array(z.string()),
  factsToConfirm: z.array(z.string()),
  conflictsOrLimitations: z.array(z.string()),
  confidence: z.enum(['HIGH', 'MEDIUM', 'LOW']),
  confidenceReason: z.string(),
  referenceDate: z.string(),
  disclaimer: z.string(),
})

export type LegalAnswer = z.infer<typeof LegalAnswerSchema>
