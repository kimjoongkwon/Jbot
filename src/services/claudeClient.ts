import type { ClaudeModelId } from '../store/useApiKeyStore'

export interface ClaudeChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface AskClaudeParams {
  apiKey: string
  model: ClaudeModelId
  system: string
  messages: ClaudeChatMessage[]
  maxTokens?: number
}

export class ClaudeApiError extends Error {
  status?: number

  constructor(message: string, status?: number) {
    super(message)
    this.name = 'ClaudeApiError'
    this.status = status
  }
}

const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages'
const ANTHROPIC_VERSION = '2023-06-01'

interface ClaudeApiResponse {
  content?: Array<{ type: string; text?: string }>
}

/**
 * 브라우저에서 Anthropic Messages API를 직접 호출한다.
 * 백엔드 서버가 없는 단일 HTML 오프라인 도구이므로 사용자의 API 키로 직접 호출하며,
 * anthropic-dangerous-direct-browser-access 헤더가 필요하다.
 */
export async function askClaude({
  apiKey,
  model,
  system,
  messages,
  maxTokens = 1024,
}: AskClaudeParams): Promise<string> {
  if (!apiKey) {
    throw new ClaudeApiError('Claude API 키가 설정되지 않았습니다.')
  }

  let response: Response
  try {
    response = await fetch(CLAUDE_API_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': ANTHROPIC_VERSION,
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        system,
        messages,
      }),
    })
  } catch {
    throw new ClaudeApiError('Claude API에 연결할 수 없습니다. 네트워크 상태를 확인해주세요.')
  }

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: { message?: string } } | null
    const message = body?.error?.message ?? `Claude API 오류 (status ${response.status})`
    throw new ClaudeApiError(message, response.status)
  }

  const data = (await response.json()) as ClaudeApiResponse
  const text = (data.content ?? [])
    .filter((block) => block.type === 'text' && typeof block.text === 'string')
    .map((block) => block.text)
    .join('\n')
    .trim()

  if (!text) {
    throw new ClaudeApiError('Claude API 응답에서 답변을 찾을 수 없습니다.')
  }

  return text
}
