export interface PutFileInput {
  /** 저장소 내에서 파일을 식별하는 키(경로 조각). 충돌 방지를 위해 contentHash를 포함해 만든다. */
  key: string
  buffer: Buffer
  contentType?: string
}

export interface StoredFile {
  key: string
  size: number
  provider: 'local' | 's3'
}

/**
 * 업로드된 원본 문서 파일을 저장하는 방식을 추상화한다. 로컬 디스크
 * (storage/uploads)는 서버리스·다중 인스턴스 배포에서 지속성이 없으므로,
 * 운영 환경에서는 S3 호환 구현체로 교체할 수 있게 인터페이스로 분리했다
 * (요구사항 §6). 파싱된 본문 텍스트는 이 저장소가 아니라 DB
 * (DocumentVersion.rawText)에 저장되므로, 검색·답변 로직은 이 인터페이스와
 * 무관하다 — 여기서 다루는 것은 원본 파일 보관/다운로드뿐이다.
 */
export interface FileStorageProvider {
  put(input: PutFileInput): Promise<StoredFile>
  get(key: string): Promise<Buffer>
  delete(key: string): Promise<void>
  exists(key: string): Promise<boolean>
  getSignedDownloadUrl?(key: string, expiresInSeconds: number): Promise<string>
}
