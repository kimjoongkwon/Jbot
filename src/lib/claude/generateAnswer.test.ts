import { describe, expect, it } from 'vitest'
import type { Env } from '../env'
import type { CitationSourceChunk } from './contextBuilder'
import { ClaudeMessageSender, ClaudeNotConfiguredError, generateLegalAnswer } from './generateAnswer'

const BASE_ENV: Env = {
  DATABASE_URL: 'postgresql://test',
  ANTHROPIC_API_KEY: 'sk-ant-test',
  ANTHROPIC_MODEL: 'claude-sonnet-5',
  EMBEDDING_PROVIDER: 'none',
  OPENAI_API_KEY: '',
  OPENAI_EMBEDDING_MODEL: '',
  VOYAGE_API_KEY: '',
  VOYAGE_EMBEDDING_MODEL: '',
  NEXT_PUBLIC_APP_NAME: '정비사업 법령 AI',
  MAX_UPLOAD_SIZE_MB: 20,
}

const CHUNK: CitationSourceChunk = {
  citationId: 'C1',
  legalChunkId: 'chunk-1',
  legalDocumentId: 'doc-1',
  documentTitle: '가상 정비사업 테스트법',
  documentType: 'LAW',
  jurisdictionName: '전국',
  hierarchyPath: '가상 정비사업 테스트법 > 제35조 조합설립인가 등',
  content: '조합을 설립하려는 경우 토지등소유자 4분의 3 이상의 동의를 받아야 한다.',
  effectiveFrom: '2024-01-01',
  isCurrent: true,
}

function validJson(overrides: Record<string, unknown> = {}) {
  return JSON.stringify({
    conclusion: '결론',
    summary: '요약',
    legalBasis: [{ citationId: 'C1', documentTitle: '가상 정비사업 테스트법', article: '제35조', explanation: '설명' }],
    analysis: [{ issue: '쟁점', reasoning: '이유', citationIds: ['C1'] }],
    exceptions: [],
    factsToConfirm: [],
    conflictsOrLimitations: [],
    confidence: 'HIGH',
    confidenceReason: '근거 명확',
    referenceDate: '2026-07-22',
    disclaimer: '본 답변은 등록된 자료를 기반으로 한 정보 제공용 검토 결과이며, 구체적인 사건에 대한 법률 자문이나 관할 행정청의 공식 판단을 대체하지 않습니다.',
    ...overrides,
  })
}

class FakeSender implements ClaudeMessageSender {
  calls = 0
  constructor(private readonly responses: string[]) {}
  async send(): Promise<string> {
    const response = this.responses[this.calls] ?? this.responses[this.responses.length - 1]
    this.calls++
    return response
  }
}

describe('generateLegalAnswer', () => {
  it('Claude가 설정되지 않으면 ClaudeNotConfiguredError를 던진다', async () => {
    const env = { ...BASE_ENV, ANTHROPIC_API_KEY: '' }
    await expect(generateLegalAnswer('질문', [CHUNK], '2026-07-22', { env })).rejects.toThrow(
      ClaudeNotConfiguredError,
    )
  })

  it('정상 JSON 응답을 파싱해 구조화된 답변을 반환한다', async () => {
    const sender = new FakeSender([validJson()])
    const result = await generateLegalAnswer('질문', [CHUNK], '2026-07-22', { env: BASE_ENV, sender })
    expect(result.answer.conclusion).toBe('결론')
    expect(result.hadCoreInvalidCitation).toBe(false)
    expect(sender.calls).toBe(1)
  })

  it('첫 응답이 JSON으로 파싱되지 않으면 한 번만 재시도한다', async () => {
    const sender = new FakeSender(['이것은 JSON이 아닙니다', validJson()])
    const result = await generateLegalAnswer('질문', [CHUNK], '2026-07-22', { env: BASE_ENV, sender })
    expect(sender.calls).toBe(2)
    expect(result.answer.conclusion).toBe('결론')
  })

  it('재시도 후에도 파싱 실패하면 오류를 던진다', async () => {
    const sender = new FakeSender(['아님', '역시 아님'])
    await expect(generateLegalAnswer('질문', [CHUNK], '2026-07-22', { env: BASE_ENV, sender })).rejects.toThrow()
    expect(sender.calls).toBe(2)
  })

  it('마크다운 코드블록으로 감싼 JSON도 파싱한다', async () => {
    const sender = new FakeSender(['```json\n' + validJson() + '\n```'])
    const result = await generateLegalAnswer('질문', [CHUNK], '2026-07-22', { env: BASE_ENV, sender })
    expect(result.answer.conclusion).toBe('결론')
  })

  it('검색되지 않은 citationId를 인용하면 제거되고 핵심 허위 인용으로 표시된다', async () => {
    const sender = new FakeSender([
      validJson({
        legalBasis: [
          { citationId: 'C1', documentTitle: '가상 정비사업 테스트법', article: '제35조', explanation: '설명' },
          { citationId: 'C99', documentTitle: '존재하지 않는 법', article: '제1조', explanation: '지어낸 근거' },
        ],
      }),
    ])
    const result = await generateLegalAnswer('질문', [CHUNK], '2026-07-22', { env: BASE_ENV, sender })
    expect(result.answer.legalBasis).toHaveLength(1)
    expect(result.hadCoreInvalidCitation).toBe(true)
    expect(result.removedCitationIds).toContain('C99')
  })
})
