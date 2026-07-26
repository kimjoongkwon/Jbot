import { afterAll, describe, expect, it, vi } from 'vitest'
import { SESSION_COOKIE_NAME } from '@/lib/auth/session'

let mockToken: string | null = null

vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => (name === SESSION_COOKIE_NAME && mockToken ? { value: mockToken } : undefined),
  }),
}))

// vi.mock은 호이스팅되므로, 모킹 대상을 사용하는 모듈은 그 이후에 동적으로 불러온다.
const { getCurrentUser, requireRole, createSession, bumpSessionVersion, revokeSessionByToken } = await import(
  '@/lib/auth/session'
)
const { prisma } = await import('@/lib/db')

describe('세션·권한 통합 테스트 (실제 DB + DB 기반 세션 토큰)', () => {
  const createdUserIds: string[] = []

  afterAll(async () => {
    await prisma.userSession.deleteMany({ where: { userId: { in: createdUserIds } } })
    await prisma.loginAttempt.deleteMany({ where: { userId: { in: createdUserIds } } })
    await prisma.auditLog.deleteMany({ where: { userId: { in: createdUserIds } } })
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } })
    await prisma.$disconnect()
  })

  it('ADMIN 사용자는 ADMIN 전용 화면 접근 권한을 얻는다', async () => {
    const admin = await prisma.user.create({
      data: { email: `admin-${Date.now()}@test.local`, name: '테스트 관리자', role: 'ADMIN' },
    })
    createdUserIds.push(admin.id)
    mockToken = (await createSession(admin.id)).token

    const user = await requireRole(['ADMIN'])
    expect(user?.id).toBe(admin.id)
  })

  it('USER 역할은 ADMIN 전용 화면에 접근할 수 없다', async () => {
    const normalUser = await prisma.user.create({
      data: { email: `user-${Date.now()}@test.local`, name: '테스트 사용자', role: 'USER' },
    })
    createdUserIds.push(normalUser.id)
    mockToken = (await createSession(normalUser.id)).token

    const result = await requireRole(['ADMIN'])
    expect(result).toBeNull()
  })

  it('REVIEWER는 ADMIN·REVIEWER 화면에는 접근하지만 ADMIN 전용 작업에서는 제외된다', async () => {
    const reviewer = await prisma.user.create({
      data: { email: `reviewer-${Date.now()}@test.local`, name: '테스트 검토자', role: 'REVIEWER' },
    })
    createdUserIds.push(reviewer.id)
    mockToken = (await createSession(reviewer.id)).token

    expect((await requireRole(['ADMIN', 'REVIEWER']))?.id).toBe(reviewer.id)
    expect(await requireRole(['ADMIN'])).toBeNull()
  })

  it('로그인하지 않은 경우(쿠키 없음) getCurrentUser는 null을 반환한다', async () => {
    mockToken = null
    expect(await getCurrentUser()).toBeNull()
  })

  it('존재하지 않거나 위조된 토큰은 거부된다', async () => {
    mockToken = 'forged-token-that-does-not-exist-in-db'
    expect(await getCurrentUser()).toBeNull()
    expect(await requireRole(['ADMIN'])).toBeNull()
  })

  it('로그아웃(철회)된 세션은 더 이상 사용할 수 없다', async () => {
    const user = await prisma.user.create({
      data: { email: `revoke-${Date.now()}@test.local`, name: '철회테스트', role: 'USER' },
    })
    createdUserIds.push(user.id)
    const { token } = await createSession(user.id)
    mockToken = token
    expect((await getCurrentUser())?.id).toBe(user.id)

    await revokeSessionByToken(token)
    expect(await getCurrentUser()).toBeNull()
  })

  it('비밀번호 변경·역할 변경과 동일하게 sessionVersion이 올라가면 기존 세션이 즉시 무효화된다', async () => {
    const user = await prisma.user.create({
      data: { email: `bump-${Date.now()}@test.local`, name: '세션버전테스트', role: 'USER' },
    })
    createdUserIds.push(user.id)
    const { token } = await createSession(user.id)
    mockToken = token
    expect((await getCurrentUser())?.id).toBe(user.id)

    await bumpSessionVersion(user.id)
    expect(await getCurrentUser()).toBeNull()
  })

  it('세션 발급 이후 계정이 비활성화되면(세션은 그대로여도) 접근할 수 없다', async () => {
    const user = await prisma.user.create({
      data: { email: `inactive-${Date.now()}@test.local`, name: '비활성테스트', role: 'USER' },
    })
    createdUserIds.push(user.id)
    const { token } = await createSession(user.id)
    mockToken = token
    expect((await getCurrentUser())?.id).toBe(user.id)

    await prisma.user.update({ where: { id: user.id }, data: { isActive: false } })
    expect(await getCurrentUser()).toBeNull()
  })

  it('만료 시각이 지난 세션은 더 이상 사용할 수 없다', async () => {
    const user = await prisma.user.create({
      data: { email: `expired-${Date.now()}@test.local`, name: '만료테스트', role: 'USER' },
    })
    createdUserIds.push(user.id)
    const { token } = await createSession(user.id)
    await prisma.userSession.updateMany({
      where: { userId: user.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    })
    mockToken = token
    expect(await getCurrentUser()).toBeNull()
  })
})
