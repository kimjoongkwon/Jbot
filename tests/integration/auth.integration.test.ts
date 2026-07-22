import { afterAll, describe, expect, it, vi } from 'vitest'
import { SESSION_COOKIE_NAME } from '@/lib/auth/session'

let mockCookieValue: string | null = null

vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) =>
      name === SESSION_COOKIE_NAME && mockCookieValue ? { value: mockCookieValue } : undefined,
  }),
}))

// vi.mock은 호이스팅되므로, 모킹 대상을 사용하는 모듈은 그 이후에 동적으로 불러온다.
const { getCurrentUser, requireRole, createSessionCookieValue } = await import('@/lib/auth/session')
const { prisma } = await import('@/lib/db')

describe('관리자 권한 확인 통합 테스트 (실제 DB + 세션 쿠키 모킹)', () => {
  const createdUserIds: string[] = []

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } })
    await prisma.$disconnect()
  })

  it('ADMIN 사용자는 ADMIN 전용 화면 접근 권한을 얻는다', async () => {
    const admin = await prisma.user.create({
      data: { email: `admin-${Date.now()}@test.local`, name: '테스트 관리자', role: 'ADMIN' },
    })
    createdUserIds.push(admin.id)
    mockCookieValue = createSessionCookieValue(admin.id)

    const user = await requireRole(['ADMIN'])
    expect(user?.id).toBe(admin.id)
  })

  it('USER 역할은 ADMIN 전용 화면에 접근할 수 없다', async () => {
    const normalUser = await prisma.user.create({
      data: { email: `user-${Date.now()}@test.local`, name: '테스트 사용자', role: 'USER' },
    })
    createdUserIds.push(normalUser.id)
    mockCookieValue = createSessionCookieValue(normalUser.id)

    const result = await requireRole(['ADMIN'])
    expect(result).toBeNull()
  })

  it('REVIEWER는 ADMIN·REVIEWER 화면에는 접근하지만 ADMIN 전용 작업에서는 제외된다', async () => {
    const reviewer = await prisma.user.create({
      data: { email: `reviewer-${Date.now()}@test.local`, name: '테스트 검토자', role: 'REVIEWER' },
    })
    createdUserIds.push(reviewer.id)
    mockCookieValue = createSessionCookieValue(reviewer.id)

    expect((await requireRole(['ADMIN', 'REVIEWER']))?.id).toBe(reviewer.id)
    expect(await requireRole(['ADMIN'])).toBeNull()
  })

  it('로그인하지 않은 경우(쿠키 없음) getCurrentUser는 null을 반환한다', async () => {
    mockCookieValue = null
    expect(await getCurrentUser()).toBeNull()
  })

  it('서명이 유효한 쿠키라도 존재하지 않는 사용자를 가리키면 null을 반환한다', async () => {
    mockCookieValue = createSessionCookieValue('nonexistent-user-id')
    expect(await getCurrentUser()).toBeNull()
  })

  it('서명 없이 userId만 적은 위조 쿠키는 거부된다 (평문 쿠키 위변조 방지)', async () => {
    const admin = await prisma.user.create({
      data: { email: `forge-admin-${Date.now()}@test.local`, name: '위조테스트 관리자', role: 'ADMIN' },
    })
    createdUserIds.push(admin.id)

    // 서명 없이 실제 관리자 userId를 그대로 쿠키 값으로 넣어보는 공격 시나리오
    mockCookieValue = admin.id
    expect(await getCurrentUser()).toBeNull()
    expect(await requireRole(['ADMIN'])).toBeNull()
  })

  it('다른 사용자의 서명을 붙여넣어도(서명 불일치) 위조 쿠키는 거부된다', async () => {
    const admin = await prisma.user.create({
      data: { email: `forge2-admin-${Date.now()}@test.local`, name: '위조테스트2 관리자', role: 'ADMIN' },
    })
    const normalUser = await prisma.user.create({
      data: { email: `forge2-user-${Date.now()}@test.local`, name: '위조테스트2 사용자', role: 'USER' },
    })
    createdUserIds.push(admin.id, normalUser.id)

    // normalUser의 정상 서명 뒤에서 userId만 admin.id로 바꿔치기
    const normalUserSigned = createSessionCookieValue(normalUser.id)
    const signature = normalUserSigned.slice(normalUserSigned.lastIndexOf('.') + 1)
    mockCookieValue = `${admin.id}.${signature}`

    expect(await getCurrentUser()).toBeNull()
  })
})
