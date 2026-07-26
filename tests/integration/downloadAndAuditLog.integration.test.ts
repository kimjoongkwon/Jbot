import { NextRequest } from 'next/server'
import { afterAll, describe, expect, it, vi } from 'vitest'
import { SESSION_COOKIE_NAME } from '@/lib/auth/session'

// 원본 파일 다운로드(§4 "다운로드 URL 직접 입력")와 감사로그 조회(§4 "감사로그
// URL 직접 입력") 공격 시나리오에 대응하는 API를 실제 DB·파일 저장소로 검증한다.

let mockCookieValue: string | null = null

vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) =>
      name === SESSION_COOKIE_NAME && mockCookieValue ? { value: mockCookieValue } : undefined,
  }),
}))

const { createSession } = await import('@/lib/auth/session')
const { prisma } = await import('@/lib/db')
const { registerLegalDocument } = await import('@/lib/documents/registerDocument')
const { GET: downloadFile } = await import('@/app/api/documents/[id]/versions/[versionId]/download/route')
const { GET: getAuditLog } = await import('@/app/api/admin/audit-log/route')

describe('원본 파일 다운로드 API', () => {
  const createdUserIds: string[] = []
  const createdDocIds: string[] = []

  afterAll(async () => {
    await prisma.legalDocument.deleteMany({ where: { id: { in: createdDocIds } } })
    await prisma.userSession.deleteMany({ where: { userId: { in: createdUserIds } } })
    await prisma.auditLog.deleteMany({ where: { userId: { in: createdUserIds } } })
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } })
  })

  it('ADMIN은 등록된 문서의 원본 파일을 내려받고, 감사로그가 기록된다', async () => {
    const admin = await prisma.user.create({
      data: { email: `download-admin-${Date.now()}@test.local`, name: '다운로드테스트관리자', role: 'ADMIN' },
    })
    createdUserIds.push(admin.id)
    mockCookieValue = (await createSession(admin.id)).token

    const result = await registerLegalDocument(
      {
        title: `[TEST] 다운로드테스트법 ${Date.now()}`,
        documentType: 'LAW',
        jurisdictionType: 'NATIONAL',
        jurisdictionName: '전국',
        businessTypes: [],
      },
      { versionLabel: '최초 등록', isCurrent: true },
      { buffer: Buffer.from('[TEST] 다운로드 원본 파일 내용입니다.', 'utf-8'), filename: 'download-test.txt', mimeType: 'text/plain' },
      admin.id,
    )
    createdDocIds.push(result.legalDocument.id)

    const request = new NextRequest(
      `http://localhost/api/documents/${result.legalDocument.id}/versions/${result.documentVersion.id}/download`,
    )
    const response = await downloadFile(request, {
      params: Promise.resolve({ id: result.legalDocument.id, versionId: result.documentVersion.id }),
    })

    expect(response.status).toBe(200)
    const text = await response.text()
    expect(text).toContain('다운로드 원본 파일 내용입니다')

    const log = await prisma.auditLog.findFirst({
      where: { userId: admin.id, action: 'DOCUMENT_FILE_DOWNLOAD', targetId: result.documentVersion.id },
    })
    expect(log).not.toBeNull()
  })

  it('USER는 원본 파일을 내려받을 수 없다 (403)', async () => {
    const user = await prisma.user.create({
      data: { email: `download-user-${Date.now()}@test.local`, name: '다운로드테스트일반', role: 'USER' },
    })
    createdUserIds.push(user.id)
    mockCookieValue = (await createSession(user.id)).token

    const request = new NextRequest('http://localhost/api/documents/x/versions/y/download')
    const response = await downloadFile(request, { params: Promise.resolve({ id: 'x', versionId: 'y' }) })
    expect(response.status).toBe(403)
  })
})

describe('감사로그 조회 API', () => {
  const createdUserIds: string[] = []

  afterAll(async () => {
    await prisma.userSession.deleteMany({ where: { userId: { in: createdUserIds } } })
    await prisma.auditLog.deleteMany({ where: { userId: { in: createdUserIds } } })
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } })
  })

  it('ADMIN은 감사로그 목록을 조회할 수 있다', async () => {
    const admin = await prisma.user.create({
      data: { email: `auditlog-admin-${Date.now()}@test.local`, name: '감사로그테스트관리자', role: 'ADMIN' },
    })
    createdUserIds.push(admin.id)
    mockCookieValue = (await createSession(admin.id)).token

    const response = await getAuditLog(new NextRequest('http://localhost/api/admin/audit-log'))
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(Array.isArray(body.logs)).toBe(true)
  })

  it('REVIEWER는 감사로그 API를 호출할 수 없다 (403)', async () => {
    const reviewer = await prisma.user.create({
      data: { email: `auditlog-reviewer-${Date.now()}@test.local`, name: '감사로그테스트검토자', role: 'REVIEWER' },
    })
    createdUserIds.push(reviewer.id)
    mockCookieValue = (await createSession(reviewer.id)).token

    const response = await getAuditLog(new NextRequest('http://localhost/api/admin/audit-log'))
    expect(response.status).toBe(403)
  })
})
