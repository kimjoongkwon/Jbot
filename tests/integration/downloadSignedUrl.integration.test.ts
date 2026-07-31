import { NextRequest } from 'next/server'
import { afterAll, describe, expect, it, vi } from 'vitest'
import { SESSION_COOKIE_NAME } from '@/lib/auth/session'

// S3 등 서명 URL을 지원하는 저장소로 전환됐을 때, 다운로드 API가 파일
// 버퍼를 직접 프록시하지 않고 짧게 만료되는 서명 URL로 302 리다이렉트하는지
// 검증한다. 실제 S3 대신 getSignedDownloadUrl을 제공하는 가짜 저장소로
// 대체해 라우트 레벨 동작만 확인한다(요구사항 §6/§8).

let mockCookieValue: string | null = null

vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) =>
      name === SESSION_COOKIE_NAME && mockCookieValue ? { value: mockCookieValue } : undefined,
  }),
}))

const getMock = vi.fn()
const getSignedDownloadUrlMock = vi.fn().mockResolvedValue('https://signed.example.com/fake-key?sig=xyz')

vi.mock('@/lib/storage', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/storage')>()
  return {
    ...actual,
    getFileStorageProvider: () => ({
      put: vi.fn(async (input: { key: string; buffer: Buffer }) => ({
        key: input.key,
        size: input.buffer.length,
        provider: 's3' as const,
      })),
      get: getMock,
      delete: vi.fn(),
      exists: vi.fn(),
      getSignedDownloadUrl: getSignedDownloadUrlMock,
    }),
  }
})

const { createSession } = await import('@/lib/auth/session')
const { prisma } = await import('@/lib/db')
const { registerLegalDocument } = await import('@/lib/documents/registerDocument')
const { GET: downloadFile } = await import('@/app/api/documents/[id]/versions/[versionId]/download/route')

describe('서명 URL을 지원하는 저장소로의 다운로드 리다이렉트', () => {
  const createdUserIds: string[] = []
  const createdDocIds: string[] = []

  afterAll(async () => {
    await prisma.legalDocument.deleteMany({ where: { id: { in: createdDocIds } } })
    await prisma.userSession.deleteMany({ where: { userId: { in: createdUserIds } } })
    await prisma.auditLog.deleteMany({ where: { userId: { in: createdUserIds } } })
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } })
  })

  it('저장소가 getSignedDownloadUrl을 제공하면 파일을 프록시하지 않고 302로 리다이렉트한다', async () => {
    const admin = await prisma.user.create({
      data: { email: `signedurl-admin-${Date.now()}@test.local`, name: '서명URL테스트관리자', role: 'ADMIN' },
    })
    createdUserIds.push(admin.id)
    mockCookieValue = (await createSession(admin.id)).token

    const result = await registerLegalDocument(
      {
        title: `[TEST] 서명URL테스트법 ${Date.now()}`,
        documentType: 'LAW',
        jurisdictionType: 'NATIONAL',
        jurisdictionName: '전국',
        businessTypes: [],
        procedureStages: [],
      },
      { versionLabel: '최초 등록', isCurrent: true },
      { buffer: Buffer.from('[TEST] 서명 URL 리다이렉트 확인용 내용.', 'utf-8'), filename: 'signed-url-test.txt', mimeType: 'text/plain' },
      admin.id,
    )
    createdDocIds.push(result.legalDocument.id)

    const request = new NextRequest(
      `http://localhost/api/documents/${result.legalDocument.id}/versions/${result.documentVersion.id}/download`,
    )
    const response = await downloadFile(request, {
      params: Promise.resolve({ id: result.legalDocument.id, versionId: result.documentVersion.id }),
      // Next.js redirect() 응답은 자동으로 리다이렉트를 따라가지 않도록 fetch가 아닌
      // 라우트 핸들러를 직접 호출하므로 Response.redirected 대신 status/Location을 본다.
    })

    expect(response.status).toBe(302)
    expect(response.headers.get('location')).toBe('https://signed.example.com/fake-key?sig=xyz')
    expect(getSignedDownloadUrlMock).toHaveBeenCalledWith(result.documentVersion.storagePath, 60)
    expect(getMock).not.toHaveBeenCalled()
  })
})
