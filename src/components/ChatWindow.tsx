import { useMemo, useState } from 'react'
import { buildBm25Index, searchBm25 } from '../engine/bm25'
import { buildRagPrompt } from '../engine/prompt'
import { askClaude, ClaudeApiError } from '../services/claudeClient'
import { useApiKeyStore } from '../store/useApiKeyStore'
import { useChatStore } from '../store/useChatStore'
import { useDocumentStore } from '../store/useDocumentStore'
import './ChatWindow.css'

const TOP_K = 5

export function ChatWindow() {
  const chunks = useDocumentStore((state) => state.chunks)
  const apiKey = useApiKeyStore((state) => state.apiKey)
  const model = useApiKeyStore((state) => state.model)

  const messages = useChatStore((state) => state.messages)
  const isLoading = useChatStore((state) => state.isLoading)
  const error = useChatStore((state) => state.error)
  const addUserMessage = useChatStore((state) => state.addUserMessage)
  const addAssistantMessage = useChatStore((state) => state.addAssistantMessage)
  const setLoading = useChatStore((state) => state.setLoading)
  const setError = useChatStore((state) => state.setError)

  const [input, setInput] = useState('')
  const bm25Index = useMemo(() => buildBm25Index(chunks), [chunks])

  const canSend = input.trim().length > 0 && !isLoading && apiKey.length > 0

  async function handleSend() {
    const question = input.trim()
    if (!question || isLoading || !apiKey) return

    addUserMessage(question)
    setInput('')
    setError(null)
    setLoading(true)

    try {
      const sources = searchBm25(bm25Index, question, TOP_K)
      const { system, userMessage } = buildRagPrompt(question, sources)
      const answer = await askClaude({
        apiKey,
        model,
        system,
        messages: [{ role: 'user', content: userMessage }],
      })
      addAssistantMessage(
        answer,
        sources.map((s) => ({ docName: s.chunk.docName, chunkText: s.chunk.text })),
      )
    } catch (err) {
      const message = err instanceof ClaudeApiError ? err.message : '알 수 없는 오류가 발생했습니다.'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="chat-window">
      <div className="chat-window__messages">
        {messages.length === 0 && (
          <p className="chat-window__empty">
            정비사업(재개발·재건축) 관련 질문을 입력해보세요. 업로드한 문서를 근거로 답변합니다.
          </p>
        )}
        {messages.map((message) => (
          <div key={message.id} className={`chat-message chat-message--${message.role}`}>
            <div className="chat-message__content">{message.content}</div>
            {message.sources && message.sources.length > 0 && (
              <details className="chat-message__sources">
                <summary>참고한 문서 {message.sources.length}건</summary>
                <ul>
                  {message.sources.map((source, index) => (
                    <li key={index}>
                      <strong>{source.docName}</strong>
                      <p>{truncate(source.chunkText, 160)}</p>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        ))}
        {isLoading && <div className="chat-window__loading">답변 생성 중...</div>}
      </div>

      {error && <p className="chat-window__error">{error}</p>}
      {!apiKey && (
        <p className="chat-window__warning">먼저 왼쪽에서 Claude API 키를 입력해주세요.</p>
      )}

      <div className="chat-window__input">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              handleSend()
            }
          }}
          placeholder="질문을 입력하세요 (Shift+Enter로 줄바꿈)"
          rows={2}
        />
        <button type="button" onClick={handleSend} disabled={!canSend}>
          전송
        </button>
      </div>
    </div>
  )
}

function truncate(text: string, maxLength: number) {
  if (text.length <= maxLength) return text
  return `${text.slice(0, maxLength)}…`
}
