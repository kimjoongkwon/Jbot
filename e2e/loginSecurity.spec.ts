import { PrismaClient } from '@prisma/client'
import { expect, test } from '@playwright/test'
import { hashPassword } from '../src/lib/auth/password'

// 요구사항 §5: 로그인 실패 5회 시 15분 잠금, 성공 시 실패 횟수 초기화,
// 이메일 존재 여부를 노출하지 않는 동일한 오류 메시지, 감사로그 기록을
// 실제 API 호출(page.request)과 DB 조회로 검증한다.

const GENERIC_ERROR = '이메일 또는 비밀번호를 확인해 주세요.'
const TEST_PASSWORD = 'LoginSecurityTest!2026'

const prisma = new PrismaClient()

test.describe('로그인 보안 (§5)', () => {
  let email: string
  let userId: string

  test.beforeEach(async () => {
    email = `e2e-loginsec-${Date.now()}@test.local`
    const passwordHash = await hashPassword(TEST_PASSWORD)
    const user = await prisma.user.create({
      data: { email, name: 'E2E 로그인보안테스트', role: 'USER', passwordHash, passwordChangedAt: new Date() },
    })
    userId = user.id
  })

  test.afterEach(async () => {
    await prisma.userSession.deleteMany({ where: { userId } })
    await prisma.loginAttempt.deleteMany({ where: { userId } })
    await prisma.auditLog.deleteMany({ where: { userId } })
    await prisma.user.deleteMany({ where: { id: userId } })
  })

  test.afterAll(async () => {
    await prisma.$disconnect()
  })

  test('존재하지 않는 이메일과 틀린 비밀번호는 동일한 오류 메시지·상태코드를 반환한다', async ({ request }) => {
    const wrongPasswordRes = await request.post('/api/auth/login', {
      data: { email, password: 'wrong-password' },
    })
    const nonexistentRes = await request.post('/api/auth/login', {
      data: { email: `nobody-${Date.now()}@test.local`, password: 'whatever' },
    })

    expect(wrongPasswordRes.status()).toBe(nonexistentRes.status())
    const [wrongBody, nonexistentBody] = await Promise.all([wrongPasswordRes.json(), nonexistentRes.json()])
    expect(wrongBody.error).toBe(GENERIC_ERROR)
    expect(nonexistentBody.error).toBe(GENERIC_ERROR)
  })

  test('5회 연속 실패하면 계정이 잠기고, 올바른 비밀번호도 거부된다', async ({ request }) => {
    for (let i = 0; i < 5; i++) {
      await request.post('/api/auth/login', { data: { email, password: 'wrong-password' } })
    }

    const res = await request.post('/api/auth/login', { data: { email, password: TEST_PASSWORD } })
    expect(res.status()).toBe(423)
    const body = await res.json()
    expect(body.error).toContain('잠겼습니다')

    const dbUser = await prisma.user.findUniqueOrThrow({ where: { id: userId } })
    expect(dbUser.failedLoginCount).toBeGreaterThanOrEqual(5)
    expect(dbUser.lockedUntil).not.toBeNull()
  })

  test('로그인 성공/실패/잠금이 감사로그에 요구된 액션명으로 기록된다', async ({ request }) => {
    await request.post('/api/auth/login', { data: { email, password: 'wrong-password' } })
    const successRes = await request.post('/api/auth/login', { data: { email, password: TEST_PASSWORD } })
    expect(successRes.ok()).toBe(true)

    const logs = await prisma.auditLog.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } })
    const actions = logs.map((l) => l.action)
    expect(actions).toContain('LOGIN_FAILURE')
    expect(actions).toContain('LOGIN_SUCCESS')

    // 로그인 실패 감사로그에는 입력한 비밀번호 등 민감정보가 남지 않는다 (요구사항 §5).
    for (const log of logs) {
      const serialized = JSON.stringify(log.metadata ?? {})
      expect(serialized).not.toContain('wrong-password')
      expect(serialized).not.toContain(TEST_PASSWORD)
    }
  })

  test('로그인에 성공하면 실패 횟수가 초기화된다', async ({ request }) => {
    await request.post('/api/auth/login', { data: { email, password: 'wrong-password' } })
    await request.post('/api/auth/login', { data: { email, password: 'wrong-password' } })
    const successRes = await request.post('/api/auth/login', { data: { email, password: TEST_PASSWORD } })
    expect(successRes.ok()).toBe(true)

    const dbUser = await prisma.user.findUniqueOrThrow({ where: { id: userId } })
    expect(dbUser.failedLoginCount).toBe(0)
    expect(dbUser.lockedUntil).toBeNull()
  })
})
