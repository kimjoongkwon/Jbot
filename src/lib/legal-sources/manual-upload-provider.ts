import { prisma } from '../db'
import type {
  ExternalLegalDocument,
  ExternalLegalDocumentVersion,
  LegalSourceFetchInput,
  LegalSourceProvider,
  LegalSourceSearchInput,
} from './types'

/**
 * 이번 MVP의 실제 자료 출처: 관리자가 직접 업로드해 등록한 문서.
 * LegalSourceProvider 인터페이스를 구현해, 향후 외부 API 공급자(예:
 * NationalLawProvider)로 교체하거나 병행할 때 호출부 코드를 바꾸지 않아도 되게 한다.
 */
export class ManualUploadProvider implements LegalSourceProvider {
  readonly name = 'manual-upload'

  async searchDocuments(input: LegalSourceSearchInput): Promise<ExternalLegalDocument[]> {
    const documents = await prisma.legalDocument.findMany({
      where: {
        status: 'ACTIVE',
        title: input.query ? { contains: input.query } : undefined,
        jurisdictionName: input.jurisdictionName || undefined,
        documentType: (input.documentType as never) || undefined,
      },
      take: 20,
    })

    return documents.map((doc) => ({
      externalId: doc.id,
      title: doc.title,
      documentType: doc.documentType,
      jurisdictionName: doc.jurisdictionName,
      sourceUrl: doc.sourceUrl ?? '',
    }))
  }

  async fetchDocument(input: LegalSourceFetchInput): Promise<ExternalLegalDocumentVersion> {
    const version = await prisma.documentVersion.findFirst({
      where: {
        legalDocumentId: input.externalId,
        ...(input.versionLabel ? { versionLabel: input.versionLabel } : { isCurrent: true }),
      },
      include: { legalDocument: true },
    })

    if (!version) {
      throw new Error('등록된 문서 버전을 찾을 수 없습니다.')
    }

    return {
      externalId: input.externalId,
      versionLabel: version.versionLabel,
      promulgationDate: version.promulgationDate?.toISOString() ?? null,
      effectiveFrom: version.effectiveFrom?.toISOString() ?? null,
      rawText: version.rawText ?? '',
      sourceUrl: version.legalDocument.sourceUrl ?? '',
    }
  }
}
