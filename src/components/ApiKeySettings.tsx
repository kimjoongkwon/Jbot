import { useState } from 'react'
import { CLAUDE_MODELS, useApiKeyStore } from '../store/useApiKeyStore'
import './ApiKeySettings.css'

export function ApiKeySettings() {
  const apiKey = useApiKeyStore((state) => state.apiKey)
  const model = useApiKeyStore((state) => state.model)
  const setApiKey = useApiKeyStore((state) => state.setApiKey)
  const clearApiKey = useApiKeyStore((state) => state.clearApiKey)
  const setModel = useApiKeyStore((state) => state.setModel)

  const [draft, setDraft] = useState('')
  const [reveal, setReveal] = useState(false)

  function handleSave() {
    if (draft.trim().length === 0) return
    setApiKey(draft)
    setDraft('')
  }

  return (
    <div className="api-key-settings">
      <h2>Claude API 키</h2>
      <p className="api-key-settings__hint">
        입력한 키는 이 브라우저의 localStorage에만 저장되며, Claude API 호출 시에만
        Anthropic 서버로 직접 전송됩니다. 서버나 다른 사람에게 전달되지 않습니다.
      </p>

      {apiKey ? (
        <div className="api-key-settings__saved">
          <span>{reveal ? apiKey : maskKey(apiKey)}</span>
          <button type="button" onClick={() => setReveal((v) => !v)}>
            {reveal ? '숨기기' : '보기'}
          </button>
          <button type="button" onClick={clearApiKey} className="api-key-settings__clear">
            삭제
          </button>
        </div>
      ) : (
        <div className="api-key-settings__form">
          <input
            type="password"
            placeholder="sk-ant-..."
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSave()
            }}
          />
          <button type="button" onClick={handleSave} disabled={draft.trim().length === 0}>
            저장
          </button>
        </div>
      )}

      <label className="api-key-settings__model">
        모델
        <select value={model} onChange={(e) => setModel(e.target.value as typeof model)}>
          {CLAUDE_MODELS.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </select>
      </label>
    </div>
  )
}

function maskKey(key: string) {
  if (key.length <= 8) return '••••••••'
  return `${key.slice(0, 6)}••••${key.slice(-4)}`
}
