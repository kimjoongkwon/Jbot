import { afterEach, describe, expect, it, vi } from 'vitest'
import { askClaude, ClaudeApiError } from './claudeClient'

describe('askClaude', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('API 키가 없으면 요청 없이 에러를 던진다', async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)

    await expect(
      askClaude({ apiKey: '', model: 'claude-sonnet-5', system: 'sys', messages: [] }),
    ).rejects.toThrow(ClaudeApiError)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('필요한 헤더와 바디로 Anthropic API를 호출한다', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ content: [{ type: 'text', text: '답변입니다.' }] }), {
        status: 200,
      }),
    )
    vi.stubGlobal('fetch', fetchSpy)

    const result = await askClaude({
      apiKey: 'sk-ant-test',
      model: 'claude-sonnet-5',
      system: '시스템 프롬프트',
      messages: [{ role: 'user', content: '질문' }],
    })

    expect(result).toBe('답변입니다.')
    expect(fetchSpy).toHaveBeenCalledTimes(1)
    const [url, init] = fetchSpy.mock.calls[0]
    expect(url).toBe('https://api.anthropic.com/v1/messages')
    expect(init.headers['x-api-key']).toBe('sk-ant-test')
    expect(init.headers['anthropic-dangerous-direct-browser-access']).toBe('true')
    const body = JSON.parse(init.body)
    expect(body.model).toBe('claude-sonnet-5')
    expect(body.system).toBe('시스템 프롬프트')
    expect(body.messages).toEqual([{ role: 'user', content: '질문' }])
  })

  it('응답이 실패하면 서버 에러 메시지를 포함한 ClaudeApiError를 던진다', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: { message: '잘못된 API 키입니다.' } }), {
        status: 401,
      }),
    )
    vi.stubGlobal('fetch', fetchSpy)

    await expect(
      askClaude({ apiKey: 'bad-key', model: 'claude-sonnet-5', system: 's', messages: [] }),
    ).rejects.toThrow('잘못된 API 키입니다.')
  })

  it('네트워크 오류 시 사용자 친화적 에러를 던진다', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new TypeError('Failed to fetch')),
    )

    await expect(
      askClaude({ apiKey: 'sk-ant-test', model: 'claude-sonnet-5', system: 's', messages: [] }),
    ).rejects.toThrow('Claude API에 연결할 수 없습니다')
  })
})
