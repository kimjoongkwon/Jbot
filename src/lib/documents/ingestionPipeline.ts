import { prisma } from '../db'
import { createEmbeddingProvider } from '../embeddings'
import { setChunkEmbedding } from '../db/vector'
import { buildLegalChunks } from '../legal-parsing/buildLegalChunks'
import { parseLegalStructure } from '../legal-parsing/parseLegalStructure'
import { buildSearchText, tokenize } from '../search/tokenize'
import { normalizeContent } from './normalizeContent'

export interface RunIngestionPipelineOptions {
  /**
   * false면 이 버전의 처리 결과가 LegalDocument.status에 반영되지 않는다.
   * 현행(isCurrent)이 아닌 과거 버전을 새로 추가할 때 사용 — 그 버전의 처리
   * 성패가 이미 정상 동작 중인 현행 문서의 활성 상태를 바꾸지 않도록 한다.
   */
  affectDocumentStatus?: boolean
}

/**
 * 추출된 원문 텍스트(DocumentVersion.rawText)를 조문 구조로 파싱하고
 * chunk로 저장한 뒤, 임베딩 공급자가 설정되어 있으면 임베딩까지 채운다.
 * 재처리 시 새 IngestionJob을 생성하고, 기존 LegalChunk는 지우고 다시
 * 생성한다(DocumentVersion 자체, 원본 파일, rawText는 보존).
 */
export async function runIngestionPipeline(
  documentVersionId: string,
  options: RunIngestionPipelineOptions = {},
): Promise<void> {
  const affectDocumentStatus = options.affectDocumentStatus ?? true
  const version = await prisma.documentVersion.findUniqueOrThrow({
    where: { id: documentVersionId },
    include: { legalDocument: true },
  })

  const job = await prisma.ingestionJob.create({
    data: { documentVersionId, status: 'PARSING', startedAt: new Date() },
  })

  try {
    if (!version.rawText || version.rawText.trim().length === 0) {
      throw new Error('추출된 원문 텍스트가 없어 파싱할 수 없습니다.')
    }

    await prisma.ingestionJob.update({ where: { id: job.id }, data: { status: 'CHUNKING' } })

    const parsedNodes = parseLegalStructure(version.rawText)
    const drafts = buildLegalChunks(version.legalDocument.title, parsedNodes)

    if (drafts.length === 0) {
      throw new Error('문서에서 조문 구조를 찾지 못했습니다. 원문 형식을 확인해 주세요.')
    }

    const embeddingProvider = createEmbeddingProvider()
    const useEmbedding = embeddingProvider.name !== 'none'

    await prisma.ingestionJob.update({
      where: { id: job.id },
      data: { status: useEmbedding ? 'EMBEDDING' : 'CHUNKING', totalChunks: drafts.length },
    })

    let embeddings: number[][] = []
    if (useEmbedding) {
      embeddings = await embeddingProvider.embed(drafts.map((d) => d.content))
    }

    // 재처리 시 기존 chunk를 지우고 새로 생성한다 (DocumentVersion·원본 파일은 유지).
    await prisma.legalChunk.deleteMany({ where: { documentVersionId } })

    let processed = 0
    for (let i = 0; i < drafts.length; i++) {
      const draft = drafts[i]
      const normalizedContent = normalizeContent(draft.content)
      const chunk = await prisma.legalChunk.create({
        data: {
          documentVersionId,
          chunkType: draft.chunkType,
          articleNumber: draft.articleNumber,
          articleTitle: draft.articleTitle,
          paragraphNumber: draft.paragraphNumber,
          itemNumber: draft.itemNumber,
          subItemNumber: draft.subItemNumber,
          hierarchyPath: draft.hierarchyPath,
          content: draft.content,
          normalizedContent,
          searchText: buildSearchText(normalizedContent),
          tokenCount: tokenize(normalizedContent).length,
          sequence: draft.sequence,
        },
      })

      const embedding = embeddings[i]
      if (useEmbedding && embedding && embedding.length > 0) {
        await setChunkEmbedding(chunk.id, embedding)
      }

      processed++
      await prisma.ingestionJob.update({ where: { id: job.id }, data: { processedChunks: processed } })
    }

    await prisma.ingestionJob.update({
      where: { id: job.id },
      data: { status: 'COMPLETED', completedAt: new Date() },
    })
    await prisma.documentVersion.update({ where: { id: documentVersionId }, data: { parsingStatus: 'SUCCESS' } })
    if (affectDocumentStatus) {
      await prisma.legalDocument.update({ where: { id: version.legalDocumentId }, data: { status: 'ACTIVE' } })
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : '수집 처리 중 알 수 없는 오류가 발생했습니다.'
    await prisma.ingestionJob.update({
      where: { id: job.id },
      data: { status: 'FAILED', errorMessage: message, completedAt: new Date() },
    })
    await prisma.documentVersion.update({ where: { id: documentVersionId }, data: { parsingStatus: 'FAILED' } })
    if (affectDocumentStatus) {
      await prisma.legalDocument.update({ where: { id: version.legalDocumentId }, data: { status: 'ERROR' } })
    }
    throw error
  }
}
