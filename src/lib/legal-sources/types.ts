export interface LegalSourceSearchInput {
  query: string
  jurisdictionName?: string
  documentType?: string
}

export interface ExternalLegalDocument {
  externalId: string
  title: string
  documentType: string
  jurisdictionName: string
  sourceUrl: string
}

export interface LegalSourceFetchInput {
  externalId: string
  versionLabel?: string
}

export interface ExternalLegalDocumentVersion {
  externalId: string
  versionLabel: string
  promulgationDate: string | null
  effectiveFrom: string | null
  rawText: string
  sourceUrl: string
}

/**
 * 법령 자료의 출처(수동 업로드, 향후 외부 API 등)를 추상화하는 인터페이스.
 * 새 출처를 추가할 때 이 인터페이스만 구현하면 수집 파이프라인 나머지는
 * 그대로 재사용할 수 있다.
 */
export interface LegalSourceProvider {
  readonly name: string
  searchDocuments(input: LegalSourceSearchInput): Promise<ExternalLegalDocument[]>
  fetchDocument(input: LegalSourceFetchInput): Promise<ExternalLegalDocumentVersion>
}
