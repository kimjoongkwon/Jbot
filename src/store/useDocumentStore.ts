import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { chunkDocument, type DocumentChunk } from '../engine/chunking'

export interface UploadedDocument {
  id: string
  name: string
  addedAt: string
  charCount: number
  chunkCount: number
}

interface DocumentState {
  documents: UploadedDocument[]
  chunks: DocumentChunk[]
  addDocument: (name: string, text: string) => void
  removeDocument: (id: string) => void
  clearDocuments: () => void
}

function createDocId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export const useDocumentStore = create<DocumentState>()(
  persist(
    (set) => ({
      documents: [],
      chunks: [],
      addDocument: (name, text) =>
        set((state) => {
          const id = createDocId()
          const chunks = chunkDocument(id, name, text)
          const doc: UploadedDocument = {
            id,
            name,
            addedAt: new Date().toISOString(),
            charCount: text.length,
            chunkCount: chunks.length,
          }
          return {
            documents: [...state.documents, doc],
            chunks: [...state.chunks, ...chunks],
          }
        }),
      removeDocument: (id) =>
        set((state) => ({
          documents: state.documents.filter((doc) => doc.id !== id),
          chunks: state.chunks.filter((chunk) => chunk.docId !== id),
        })),
      clearDocuments: () => set({ documents: [], chunks: [] }),
    }),
    { name: 'jbot-documents' },
  ),
)
