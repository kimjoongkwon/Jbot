import type {
  ExternalLegalDocument,
  ExternalLegalDocumentVersion,
  LegalSourceFetchInput,
  LegalSourceProvider,
  LegalSourceSearchInput,
} from './types'

export const EXTERNAL_LEGAL_API_NOT_CONFIGURED_MESSAGE =
  '현재 외부 법령 API 자동 동기화는 설정되지 않았습니다. 관리자 문서 업로드 방식으로 법령 자료를 등록할 수 있습니다.'

/**
 * 국가법령정보센터 등 외부 법령 API 연동을 위한 자리표시자(placeholder) 구현체.
 *
 * 실제 공식 API의 엔드포인트·인증 방식·응답 스키마를 확인하지 않은 상태이므로,
 * 가짜 URL이나 임의로 지어낸 응답 형식을 구현하지 않는다 (요구사항 §12, §21).
 * 향후 국가법령정보 Open API 문서를 확인한 뒤 이 클래스를 실제로 구현한다.
 * 자세한 계획은 docs/NEXT_STEPS.md 참고.
 */
export class NationalLawProvider implements LegalSourceProvider {
  readonly name = 'national-law-api'

  async searchDocuments(_input: LegalSourceSearchInput): Promise<ExternalLegalDocument[]> {
    throw new Error(EXTERNAL_LEGAL_API_NOT_CONFIGURED_MESSAGE)
  }

  async fetchDocument(_input: LegalSourceFetchInput): Promise<ExternalLegalDocumentVersion> {
    throw new Error(EXTERNAL_LEGAL_API_NOT_CONFIGURED_MESSAGE)
  }
}

export function isNationalLawProviderConfigured(): boolean {
  return false
}
