import { afterAll, describe, expect, it } from 'vitest'
import { prisma } from '@/lib/db'
import { hybridSearch } from '@/lib/search/hybridSearch'
import { cleanupTestDocuments, createTestChunk, createTestDocument, createTestVersion } from './testHelpers'

describe('hybridSearch 통합 테스트 (실제 PostgreSQL 연결)', () => {
  const createdDocIds: string[] = []

  afterAll(async () => {
    await cleanupTestDocuments(createdDocIds)
    await prisma.$disconnect()
  })

  it('정확한 조문 번호로 질문하면 해당 조문이 최상위로 검색된다', async () => {
    const doc = await createTestDocument({ title: '[TEST] 조문검색법' })
    createdDocIds.push(doc.id)
    const version = await createTestVersion(doc.id)
    const targetChunk = await createTestChunk(version.id, {
      articleNumber: '77',
      hierarchyPath: '[TEST] 조문검색법 > 제77조',
      content: '제77조 관련 특별 내용입니다.',
    })
    await createTestChunk(version.id, {
      articleNumber: '1',
      hierarchyPath: '[TEST] 조문검색법 > 제1조',
      content: '제1조 관련 다른 내용입니다.',
      sequence: 1,
    })

    const results = await hybridSearch({ question: '제77조는 어떤 내용인가요?', region: null })
    expect(results.length).toBeGreaterThan(0)
    expect(results[0].chunkId).toBe(targetChunk.id)
    expect(results[0].matchReason).toBe('EXACT_ARTICLE')
  })

  it('조문 번호 없이 키워드만으로도 관련 청크를 찾는다', async () => {
    const doc = await createTestDocument({ title: '[TEST] 키워드검색법' })
    createdDocIds.push(doc.id)
    const version = await createTestVersion(doc.id)
    const chunk = await createTestChunk(version.id, {
      content: '재건축분담금은 권리가액과 비례율을 기준으로 산정한다.',
    })

    const results = await hybridSearch({ question: '재건축분담금 산정 기준이 궁금합니다', region: null })
    expect(results.some((r) => r.chunkId === chunk.id)).toBe(true)
  })

  it('지역을 선택하면 다른 지역 조례는 검색되지 않는다', async () => {
    const seoulDoc = await createTestDocument({
      title: '[TEST] 서울특별시 조례',
      documentType: 'LOCAL_ORDINANCE',
      jurisdictionType: 'METROPOLITAN',
      jurisdictionName: '서울특별시',
    })
    const busanDoc = await createTestDocument({
      title: '[TEST] 부산광역시 조례',
      documentType: 'LOCAL_ORDINANCE',
      jurisdictionType: 'METROPOLITAN',
      jurisdictionName: '부산광역시',
    })
    createdDocIds.push(seoulDoc.id, busanDoc.id)

    const seoulVersion = await createTestVersion(seoulDoc.id)
    const busanVersion = await createTestVersion(busanDoc.id)
    const seoulChunk = await createTestChunk(seoulVersion.id, { content: '정비계획고유표현 입안 특별 요건에 관한 조례 내용.' })
    const busanChunk = await createTestChunk(busanVersion.id, { content: '정비계획고유표현 입안 특별 요건에 관한 조례 내용.' })

    const seoulResults = await hybridSearch({ question: '정비계획고유표현 입안 요건이 궁금합니다', region: '서울특별시' })
    expect(seoulResults.some((r) => r.chunkId === seoulChunk.id)).toBe(true)
    expect(seoulResults.some((r) => r.chunkId === busanChunk.id)).toBe(false)

    const busanResults = await hybridSearch({ question: '정비계획고유표현 입안 요건이 궁금합니다', region: '부산광역시' })
    expect(busanResults.some((r) => r.chunkId === busanChunk.id)).toBe(true)
    expect(busanResults.some((r) => r.chunkId === seoulChunk.id)).toBe(false)
  })

  it('기준일에 유효한 버전의 청크만 검색된다 (개정 전/후 버전 분리)', async () => {
    const doc = await createTestDocument({ title: '[TEST] 기준일법' })
    createdDocIds.push(doc.id)
    const oldVersion = await createTestVersion(doc.id, {
      versionLabel: '개정 전',
      isCurrent: false,
      effectiveFrom: new Date('2020-01-01'),
      effectiveTo: new Date('2023-12-31'),
    })
    const newVersion = await createTestVersion(doc.id, {
      versionLabel: '현행',
      isCurrent: true,
      effectiveFrom: new Date('2024-01-01'),
      effectiveTo: null,
    })
    const oldChunk = await createTestChunk(oldVersion.id, { content: '기준일테스트고유문구 개정전 내용' })
    const newChunk = await createTestChunk(newVersion.id, { content: '기준일테스트고유문구 현행 내용' })

    const oldResults = await hybridSearch({
      question: '기준일테스트고유문구',
      region: null,
      referenceDate: new Date('2022-06-01'),
    })
    expect(oldResults.some((r) => r.chunkId === oldChunk.id)).toBe(true)
    expect(oldResults.some((r) => r.chunkId === newChunk.id)).toBe(false)

    const newResults = await hybridSearch({
      question: '기준일테스트고유문구',
      region: null,
      referenceDate: new Date('2025-01-01'),
    })
    expect(newResults.some((r) => r.chunkId === newChunk.id)).toBe(true)
    expect(newResults.some((r) => r.chunkId === oldChunk.id)).toBe(false)
  })

  it('비활성 문서는 검색 결과에서 제외된다', async () => {
    const doc = await createTestDocument({ title: '[TEST] 비활성문서법', status: 'INACTIVE' })
    createdDocIds.push(doc.id)
    const version = await createTestVersion(doc.id)
    const chunk = await createTestChunk(version.id, { content: '비활성문서고유문구 내용입니다.' })

    const results = await hybridSearch({ question: '비활성문서고유문구', region: null })
    expect(results.some((r) => r.chunkId === chunk.id)).toBe(false)
  })

  it('includeInternalMemo가 false면 내부 검토자료는 검색 결과에서 제외된다 (일반 사용자 보호)', async () => {
    const doc = await createTestDocument({
      title: '[TEST] 내부검토자료',
      documentType: 'INTERNAL_MEMO',
    })
    createdDocIds.push(doc.id)
    const version = await createTestVersion(doc.id)
    const chunk = await createTestChunk(version.id, { content: '내부검토고유문구 대외비 내용입니다.' })

    const asUser = await hybridSearch({ question: '내부검토고유문구', region: null, includeInternalMemo: false })
    expect(asUser.some((r) => r.chunkId === chunk.id)).toBe(false)

    const asAdmin = await hybridSearch({ question: '내부검토고유문구', region: null, includeInternalMemo: true })
    expect(asAdmin.some((r) => r.chunkId === chunk.id)).toBe(true)
  })
})
