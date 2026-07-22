import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const CLAUDE_MODELS = [
  { id: 'claude-sonnet-5', label: 'Claude Sonnet 5 (권장, 균형)' },
  { id: 'claude-opus-4-8', label: 'Claude Opus 4.8 (고성능)' },
  { id: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5 (빠르고 저렴)' },
] as const

export type ClaudeModelId = (typeof CLAUDE_MODELS)[number]['id']

interface ApiKeyState {
  apiKey: string
  model: ClaudeModelId
  setApiKey: (key: string) => void
  clearApiKey: () => void
  setModel: (model: ClaudeModelId) => void
}

// API 키는 이 브라우저의 localStorage에만 저장되며 서버로 전송되지 않는다
// (Claude API 호출 시에만 사용자의 브라우저에서 Anthropic API로 직접 전송됨).
export const useApiKeyStore = create<ApiKeyState>()(
  persist(
    (set) => ({
      apiKey: '',
      model: 'claude-sonnet-5',
      setApiKey: (key) => set({ apiKey: key.trim() }),
      clearApiKey: () => set({ apiKey: '' }),
      setModel: (model) => set({ model }),
    }),
    { name: 'jbot-api-key' },
  ),
)
