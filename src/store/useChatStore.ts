import { create } from 'zustand'

export interface ChatSource {
  docName: string
  chunkText: string
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  sources?: ChatSource[]
  createdAt: string
}

interface ChatState {
  messages: ChatMessage[]
  isLoading: boolean
  error: string | null
  addUserMessage: (content: string) => ChatMessage
  addAssistantMessage: (content: string, sources: ChatSource[]) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  clearMessages: () => void
}

function createMessageId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

// 대화 내용은 새로고침 시 초기화된다 (의도적으로 localStorage에 저장하지 않음).
export const useChatStore = create<ChatState>((set) => ({
  messages: [],
  isLoading: false,
  error: null,
  addUserMessage: (content) => {
    const message: ChatMessage = {
      id: createMessageId(),
      role: 'user',
      content,
      createdAt: new Date().toISOString(),
    }
    set((state) => ({ messages: [...state.messages, message] }))
    return message
  },
  addAssistantMessage: (content, sources) =>
    set((state) => ({
      messages: [
        ...state.messages,
        {
          id: createMessageId(),
          role: 'assistant',
          content,
          sources,
          createdAt: new Date().toISOString(),
        },
      ],
    })),
  setLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error }),
  clearMessages: () => set({ messages: [], error: null }),
}))
