import { afterAll, describe, expect, it } from 'vitest'
import { prisma } from '@/lib/db'
import { registerDocumentVersion, registerLegalDocument } from '@/lib/documents/registerDocument'
import { cleanupTestDocuments } from './testHelpers'

const SAMPLE_TEXT = [
  '[TEST] 개발 테스트용 가상 문서 - 실제 법령이 아님',
  '',
  '제1장 총칙',
  '',
  '제1조(목적) 이 법은 정비사업의 원활한 추진을 목적으로 한다.',
  '제2조(정의) 이 법에서 사용하는 용어의 뜻은 다음과 같다.',
  '1. "정비사업"이란 도시기능을 회복하기 위한 사업을 말한다.',
].join('\n')

describe('문서 업로드 → 파싱 → LegalChunk 생성 통합 테스트', () => {
  const createdDocIds: string[] = []

  afterAll(async () => {
    await cleanupTestDocuments(createdDocIds)
    await prisma.$disconnect()
  })

  it('문서를 등록하면 DocumentVersion과 LegalChunk가 생성되고 문서가 활성화된다', async () => {
    const result = await registerLegalDocument(
      {
        title: `[TEST] 통합테스트법 ${Date.now()}`,
        documentType: 'LAW',
        jurisdictionType: 'NATIONAL',
        jurisdictionName: '전국',
        businessTypes: ['REDEVELOPMENT'],
      },
      { versionLabel: '최초 등록', isCurrent: true },
      { buffer: Buffer.from(SAMPLE_TEXT, 'utf-8'), filename: 'test.txt', mimeType: 'text/plain' },
      null,
    )
    createdDocIds.push(result.legalDocument.id)

    expect(result.extraction.status).toBe('SUCCESS')
    expect(result.documentVersion.rawText).toContain('정비사업의 원활한 추진')

    const version = await prisma.documentVersion.findUniqueOrThrow({ where: { id: result.documentVersion.id } })
    expect(version.parsingStatus).toBe('SUCCESS')

    const chunks = await prisma.legalChunk.findMany({ where: { documentVersionId: result.documentVersion.id } })
    expect(chunks.length).toBeGreaterThanOrEqual(2)
    expect(chunks.some((c) => c.articleNumber === '1')).toBe(true)
    expect(chunks.some((c) => c.articleNumber === '2')).toBe(true)

    const document = await prisma.legalDocument.findUniqueOrThrow({ where: { id: result.legalDocument.id } })
    expect(document.status).toBe('ACTIVE')
  })

  it('동일한 파일을 다시 업로드하면 중복 오류가 발생한다', async () => {
    const buffer = Buffer.from(SAMPLE_TEXT + '\n중복테스트', 'utf-8')
    const first = await registerLegalDocument(
      {
        title: `[TEST] 중복테스트법1 ${Date.now()}`,
        documentType: 'LAW',
        jurisdictionType: 'NATIONAL',
        jurisdictionName: '전국',
        businessTypes: [],
      },
      { versionLabel: '최초 등록', isCurrent: true },
      { buffer, filename: 'dup1.txt', mimeType: 'text/plain' },
      null,
    )
    createdDocIds.push(first.legalDocument.id)

    await expect(
      registerLegalDocument(
        {
          title: `[TEST] 중복테스트법2 ${Date.now()}`,
          documentType: 'LAW',
          jurisdictionType: 'NATIONAL',
          jurisdictionName: '전국',
          businessTypes: [],
        },
        { versionLabel: '최초 등록', isCurrent: true },
        { buffer, filename: 'dup2.txt', mimeType: 'text/plain' },
        null,
      ),
    ).rejects.toThrow(/이미 등록된 파일/)
  })

  it('스캔 문서처럼 텍스트가 거의 없으면 chunk를 만들지 않고 오류 상태로 표시한다', async () => {
    const result = await registerLegalDocument(
      {
        title: `[TEST] 빈문서법 ${Date.now()}`,
        documentType: 'LAW',
        jurisdictionType: 'NATIONAL',
        jurisdictionName: '전국',
        businessTypes: [],
      },
      { versionLabel: '최초 등록', isCurrent: true },
      { buffer: Buffer.from('a', 'utf-8'), filename: 'scan.txt', mimeType: 'text/plain' },
      null,
    )
    createdDocIds.push(result.legalDocument.id)

    expect(result.extraction.status).toBe('NO_TEXT_EXTRACTED')
    const chunks = await prisma.legalChunk.findMany({ where: { documentVersionId: result.documentVersion.id } })
    expect(chunks).toHaveLength(0)

    const document = await prisma.legalDocument.findUniqueOrThrow({ where: { id: result.legalDocument.id } })
    expect(document.status).toBe('ERROR')
  })

  it('정상 동작 중인 문서에 실패하는 새 버전을 올려도 기존 현행 버전과 활성 상태가 그대로 유지된다', async () => {
    const first = await registerLegalDocument(
      {
        title: `[TEST] 버전보존법 ${Date.now()}`,
        documentType: 'LAW',
        jurisdictionType: 'NATIONAL',
        jurisdictionName: '전국',
        businessTypes: [],
      },
      { versionLabel: '최초 등록', isCurrent: true },
      { buffer: Buffer.from(`${SAMPLE_TEXT}\n버전보존테스트 ${Date.now()}`, 'utf-8'), filename: 'good.txt', mimeType: 'text/plain' },
      null,
    )
    createdDocIds.push(first.legalDocument.id)

    // 최초 등록이 정상적으로 활성화되었는지 먼저 확인
    const before = await prisma.legalDocument.findUniqueOrThrow({ where: { id: first.legalDocument.id } })
    expect(before.status).toBe('ACTIVE')
    const goodVersionId = first.documentVersion.id

    // 거의 빈 파일(스캔 문서 상황)을 "현행 버전으로" 새 버전 등록 시도 → 실패해야 함
    const badResult = await registerDocumentVersion(
      first.legalDocument.id,
      { versionLabel: '실패할 버전', isCurrent: true },
      { buffer: Buffer.from(`x${Date.now()}`, 'utf-8'), filename: 'broken.txt', mimeType: 'text/plain' },
      null,
    )
    expect(badResult.extraction.status).toBe('NO_TEXT_EXTRACTED')

    // 실패한 새 버전은 현행이 되지 않는다
    const badVersion = await prisma.documentVersion.findUniqueOrThrow({ where: { id: badResult.documentVersion.id } })
    expect(badVersion.isCurrent).toBe(false)

    // 기존에 정상 동작하던 버전은 여전히 현행이며 청크도 그대로 남아 있다
    const goodVersion = await prisma.documentVersion.findUniqueOrThrow({ where: { id: goodVersionId } })
    expect(goodVersion.isCurrent).toBe(true)
    const goodChunks = await prisma.legalChunk.findMany({ where: { documentVersionId: goodVersionId } })
    expect(goodChunks.length).toBeGreaterThan(0)

    // 문서 전체 상태도 실패한 업로드 시도 때문에 ERROR로 바뀌지 않는다
    const after = await prisma.legalDocument.findUniqueOrThrow({ where: { id: first.legalDocument.id } })
    expect(after.status).toBe('ACTIVE')
  })
})
