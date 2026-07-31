import { NextRequest } from 'next/server'
import { afterAll, describe, expect, it, vi } from 'vitest'
import { SESSION_COOKIE_NAME } from '@/lib/auth/session'

// Vercel Preview 배포 준비(빌드 시 DB 미접속, 읽기 전용 업로드 차단, 가상 시드
// idempotency, 상태 확인 API)를 실제 PostgreSQL 연결로 검증한다.

// 업로드 API가 PREVIEW_READ_ONLY_MODE를 실제로 확인하는지 보려면, 이 라우트
// 모듈이 이 파일에서 처음 import될 때 getEnv()가 이 값을 읽도록 다른 어떤
// import보다도 먼저 설정해야 한다. getEnv()는 함수 본문 안에서만 호출되므로
// (모듈 최상단에서 호출되지 않으므로) 정적 import 자체는 안전하다 — 실제
// 평가는 아래 it() 안에서 POST()를 호출할 때 처음 일어난다.
process.env.PREVIEW_READ_ONLY_MODE = 'true'

let mockCookieValue: string | null = null

vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) =>
      name === SESSION_COOKIE_NAME && mockCookieValue ? { value: mockCookieValue } : undefined,
  }),
}))

const { createSession } = await import('@/lib/auth/session')
const { prisma } = await import('@/lib/db')
const { POST: postDocuments } = await import('@/app/api/documents/route')
const { POST: postVersion } = await import('@/app/api/documents/[id]/versions/route')
const { GET: getReady } = await import('@/app/api/ready/route')
const { GET: getHealth } = await import('@/app/api/health/route')
const { seedPreviewData, PREVIEW_NATIONAL_LAW_TITLE, PREVIEW_SEOUL_ORDINANCE_TITLE } = await import(
  '@/lib/documents/previewSeedData'
)
const { hybridSearch } = await import('@/lib/search/hybridSearch')

describe('Preview 읽기 전용 모드 (PREVIEW_READ_ONLY_MODE=true)', () => {
  const createdUserIds: string[] = []

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } })
  })

  it('문서 신규 등록 API(POST /api/documents)는 503과 안내 메시지를 반환한다', async () => {
    const admin = await prisma.user.create({
      data: { email: `preview-admin-${Date.now()}@test.local`, name: '테스트 관리자', role: 'ADMIN' },
    })
    createdUserIds.push(admin.id)
    mockCookieValue = (await createSession(admin.id)).token

    const request = new NextRequest('http://localhost/api/documents', { method: 'POST' })
    const response = await postDocuments(request)

    expect(response.status).toBe(503)
    const body = await response.json()
    expect(body.code).toBe('PREVIEW_READ_ONLY_MODE')
    expect(body.error).toContain('읽기 전용')
  })

  it('새 버전 등록 API(POST /api/documents/:id/versions)도 503을 반환한다', async () => {
    const admin = await prisma.user.create({
      data: { email: `preview-admin2-${Date.now()}@test.local`, name: '테스트 관리자2', role: 'ADMIN' },
    })
    createdUserIds.push(admin.id)
    mockCookieValue = (await createSession(admin.id)).token

    const request = new NextRequest('http://localhost/api/documents/some-id/versions', { method: 'POST' })
    const response = await postVersion(request, { params: Promise.resolve({ id: 'some-id' }) })

    expect(response.status).toBe(503)
    const body = await response.json()
    expect(body.code).toBe('PREVIEW_READ_ONLY_MODE')
  })
})

describe('상태 확인 API', () => {
  it('/api/health는 DB 없이 항상 200 ok를 반환한다', async () => {
    const response = await getHealth()
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.status).toBe('ok')
  })

  it('/api/ready는 DB 연결·마이그레이션 상태가 정상이면 200 ok를 반환하고 민감정보를 포함하지 않는다', async () => {
    const response = await getReady()
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.status).toBe('ok')
    expect(body.database.connected).toBe(true)
    expect(body.database.migrationsApplied).toBe(true)

    const serialized = JSON.stringify(body)
    expect(serialized).not.toMatch(/postgres(ql)?:\/\//i)
    expect(serialized.toLowerCase()).not.toContain('password')
  })
})

describe('Preview 시드 (실제 법령 문구 없는 가상 문서)', () => {
  afterAll(async () => {
    await prisma.legalDocument.deleteMany({
      where: { title: { in: [PREVIEW_NATIONAL_LAW_TITLE, PREVIEW_SEOUL_ORDINANCE_TITLE] } },
    })
  })

  it('반복 실행해도 중복 문서를 만들지 않는다', async () => {
    const first = await seedPreviewData(prisma)
    const second = await seedPreviewData(prisma)

    expect(first.nationalLaw).toBe('created')
    expect(first.seoulOrdinance).toBe('created')
    // 두 번째 실행은 이미 존재하므로 건너뛴다 — 중복 생성 방지 확인.
    expect(second.nationalLaw).toBe('skipped')
    expect(second.seoulOrdinance).toBe('skipped')

    const count = await prisma.legalDocument.count({
      where: { title: { in: [PREVIEW_NATIONAL_LAW_TITLE, PREVIEW_SEOUL_ORDINANCE_TITLE] } },
    })
    expect(count).toBe(2)
  })

  it('시드된 가상 문서는 일반 검색으로 찾을 수 있다(Preview 읽기 전용 모드에서도 검색은 항상 가능)', async () => {
    await seedPreviewData(prisma)

    const nationalResults = await hybridSearch({ question: '가상 정비구역이 무엇인가요?', region: null })
    expect(nationalResults.length).toBeGreaterThan(0)

    const seoulResults = await hybridSearch({ question: '적용범위', region: '서울특별시' })
    expect(seoulResults.length).toBeGreaterThan(0)
  })
})
