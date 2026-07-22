import { beforeEach, describe, expect, it } from 'vitest'
import { useDocumentStore } from './useDocumentStore'

describe('useDocumentStore', () => {
  beforeEach(() => {
    useDocumentStore.setState({ documents: [], chunks: [] })
    localStorage.clear()
  })

  it('문서를 추가하면 청크가 함께 생성된다', () => {
    useDocumentStore.getState().addDocument('규정.txt', '재개발 사업의 정의는 다음과 같다.')
    const state = useDocumentStore.getState()
    expect(state.documents).toHaveLength(1)
    expect(state.documents[0].name).toBe('규정.txt')
    expect(state.chunks).toHaveLength(1)
    expect(state.chunks[0].docId).toBe(state.documents[0].id)
  })

  it('문서를 삭제하면 해당 문서의 청크만 함께 제거된다', () => {
    useDocumentStore.getState().addDocument('문서A.txt', 'A 문서 내용입니다.')
    useDocumentStore.getState().addDocument('문서B.txt', 'B 문서 내용입니다.')

    const idToRemove = useDocumentStore.getState().documents[0].id
    useDocumentStore.getState().removeDocument(idToRemove)

    const state = useDocumentStore.getState()
    expect(state.documents).toHaveLength(1)
    expect(state.documents[0].name).toBe('문서B.txt')
    expect(state.chunks.every((chunk) => chunk.docId !== idToRemove)).toBe(true)
  })

  it('clearDocuments는 모든 문서와 청크를 제거한다', () => {
    useDocumentStore.getState().addDocument('문서A.txt', '내용')
    useDocumentStore.getState().clearDocuments()
    const state = useDocumentStore.getState()
    expect(state.documents).toEqual([])
    expect(state.chunks).toEqual([])
  })
})
