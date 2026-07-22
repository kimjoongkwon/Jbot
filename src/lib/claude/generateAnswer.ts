import Anthropic from '@anthropic-ai/sdk'
import { type Env, getEnv, isClaudeConfigured } from '../env'
import { LegalAnswerSchema, type LegalAnswer } from './answerSchema'
import { buildAnswerContext, type CitationSourceChunk } from './contextBuilder'
import { validateCitations } from './citationValidation'
import { LEGAL_ANSWER_SYSTEM_PROMPT } from './systemPrompt'

export class ClaudeNotConfiguredError extends Error {
  constructor() {
    super(
      '관련 법령 자료는 검색되었으나 AI 답변 기능이 설정되지 않았습니다. ' +
        'ANTHROPIC_API_KEY를 설정하면 근거 기반 해석 답변을 사용할 수 있습니다.',
    )
    this.name = 'ClaudeNotConfiguredError'
  }
}

export interface ClaudeMessageSender {
  send(system: string, userMessage: string, model: string): Promise<string>
}

export class AnthropicMessageSender implements ClaudeMessageSender {
  constructor(private readonly client: Anthropic) {}

  async send(system: string, userMessage: string, model: string): Promise<string> {
    const response = await this.client.messages.create({
      model,
      max_tokens: 4096,
      system,
      messages: [{ role: 'user', content: userMessage }],
    })
    const textBlock = response.content.find(
      (block): block is Anthropic.TextBlock => block.type === 'text',
    )
    if (!textBlock) {
      throw new Error('Claude 응답에서 텍스트를 찾을 수 없습니다.')
    }
    return textBlock.text
  }
}

export interface GenerateAnswerResult {
  answer: LegalAnswer
  removedCitationIds: string[]
  hadCoreInvalidCitation: boolean
}

function extractJson(text: string): string {
  const fencedMatch = /```(?:json)?\s*([\s\S]*?)```/.exec(text)
  return (fencedMatch ? fencedMatch[1] : text).trim()
}

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

function buildUserMessage(contextText: string, question: string, referenceDate: string): string {
  return [
    `참고자료:\n${contextText}`,
    '',
    `질문: ${question}`,
    `기준일: ${referenceDate}`,
    '',
    '위 참고자료만 근거로 지정된 JSON 스키마 형식(순수 JSON 객체 하나)으로만 답변하세요.',
  ].join('\n')
}

/**
 * 검색된 chunk를 근거로 Claude에게 구조화된 JSON 답변을 요청한다.
 * JSON 파싱/스키마 검증에 실패하면 한 번만 재시도하고(요구사항 §9),
 * 이후 citationId를 서버에서 검증해 허위 인용을 제거한다.
 */
export async function generateLegalAnswer(
  question: string,
  chunks: CitationSourceChunk[],
  referenceDate: string,
  deps: { env?: Env; sender?: ClaudeMessageSender } = {},
): Promise<GenerateAnswerResult> {
  const env = deps.env ?? getEnv()
  if (!isClaudeConfigured(env)) {
    throw new ClaudeNotConfiguredError()
  }

  const sender =
    deps.sender ?? new AnthropicMessageSender(new Anthropic({ apiKey: env.ANTHROPIC_API_KEY }))

  const { contextText, citationIds } = buildAnswerContext(chunks)
  const userMessage = buildUserMessage(contextText, question, referenceDate)

  let rawText = await sender.send(LEGAL_ANSWER_SYSTEM_PROMPT, userMessage, env.ANTHROPIC_MODEL)
  let parsed = LegalAnswerSchema.safeParse(safeJsonParse(extractJson(rawText)))

  if (!parsed.success) {
    rawText = await sender.send(
      LEGAL_ANSWER_SYSTEM_PROMPT,
      `${userMessage}\n\n(이전 응답이 지정된 JSON 스키마와 맞지 않았습니다. 반드시 순수 JSON 객체 하나만 다시 출력하세요.)`,
      env.ANTHROPIC_MODEL,
    )
    parsed = LegalAnswerSchema.safeParse(safeJsonParse(extractJson(rawText)))
  }

  if (!parsed.success) {
    throw new Error('Claude 응답을 구조화된 JSON으로 파싱하지 못했습니다.')
  }

  const { sanitizedAnswer, removedCitationIds, hadCoreInvalidCitation } = validateCitations(
    parsed.data,
    new Set(citationIds),
  )

  return { answer: sanitizedAnswer, removedCitationIds, hadCoreInvalidCitation }
}
