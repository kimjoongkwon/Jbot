import { useRef, useState } from 'react'
import { useDocumentStore } from '../store/useDocumentStore'
import './DocumentManager.css'

const ACCEPTED_EXTENSIONS = ['.txt', '.md']

function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = () => reject(reader.error)
    reader.readAsText(file, 'utf-8')
  })
}

export function DocumentManager() {
  const documents = useDocumentStore((state) => state.documents)
  const addDocument = useDocumentStore((state) => state.addDocument)
  const removeDocument = useDocumentStore((state) => state.removeDocument)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return
    setError(null)

    for (const file of Array.from(fileList)) {
      const isAccepted = ACCEPTED_EXTENSIONS.some((ext) => file.name.toLowerCase().endsWith(ext))
      if (!isAccepted) {
        setError(`지원하지 않는 파일 형식입니다: ${file.name} (.txt, .md만 가능)`)
        continue
      }
      try {
        const text = await readFileAsText(file)
        if (text.trim().length === 0) {
          setError(`빈 문서입니다: ${file.name}`)
          continue
        }
        addDocument(file.name, text)
      } catch {
        setError(`파일을 읽는 중 오류가 발생했습니다: ${file.name}`)
      }
    }

    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <div className="document-manager">
      <h2>참고 문서</h2>
      <p className="document-manager__hint">
        규정·절차 등 근거로 사용할 문서를 업로드하세요. (.txt, .md, 브라우저에만 저장됨)
      </p>

      <label className="document-manager__upload">
        문서 업로드
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_EXTENSIONS.join(',')}
          multiple
          onChange={(e) => handleFiles(e.target.files)}
        />
      </label>

      {error && <p className="document-manager__error">{error}</p>}

      {documents.length === 0 ? (
        <p className="document-manager__empty">업로드된 문서가 없습니다.</p>
      ) : (
        <ul className="document-manager__list">
          {documents.map((doc) => (
            <li key={doc.id} className="document-manager__item">
              <div className="document-manager__item-info">
                <span className="document-manager__item-name">{doc.name}</span>
                <span className="document-manager__item-meta">
                  {doc.charCount.toLocaleString()}자 · 청크 {doc.chunkCount}개
                </span>
              </div>
              <button
                type="button"
                className="document-manager__remove"
                onClick={() => removeDocument(doc.id)}
                aria-label={`${doc.name} 삭제`}
              >
                삭제
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
