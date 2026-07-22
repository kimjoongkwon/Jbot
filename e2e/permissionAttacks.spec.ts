import { expect, test } from '@playwright/test'
import type { APIRequestContext, Browser, BrowserContext, Page } from '@playwright/test'

// 요구사항 §4의 명시적 공격 시나리오를 실제 HTTP 요청으로 검증한다:
// - USER가 관리자 전용 API URL을 직접 호출하는 경우
// - REVIEWER가 문서 삭제/재처리 API를 호출하는 경우
// - USER가 다른 사용자의 ChatSession ID를 추측해 직접 접근하는 경우
// - 비활성화된 계정이 이전 세션 쿠키를 그대로 들고 있는 경우
// - 역할 변경 이전에 발급된 세션이 변경 후에도 사용되는 경우

const DEV_SEED_PASSWORD = 'DevSeed!2026Pw'
const CREDENTIALS_BY_ROLE = {
  ADMIN: { email: 'admin@example.com', password: DEV_SEED_PASSWORD },
  REVIEWER: { email: 'reviewer@example.com', password: DEV_SEED_PASSWORD },
  USER: { email: 'user@example.com', password: DEV_SEED_PASSWORD },
} as const

async function loginAs(page: Page, roleLabel: keyof typeof CREDENTIALS_BY_ROLE) {
  const { email, password } = CREDENTIALS_BY_ROLE[roleLabel]
  await page.goto('/login')
  await page.fill('#email', email)
  await page.fill('#password', password)
  await Promise.all([page.waitForURL(/\/chat|\/admin/), page.click('button[type=submit]')])
}

function readCsrfCookie(context: BrowserContext): Promise<string | undefined> {
  return context.cookies().then((cookies) => cookies.find((c) => c.name === 'jk_csrf_token')?.value)
}

async function csrfPost(request: APIRequestContext, context: BrowserContext, url: string, data: unknown) {
  const csrfToken = await readCsrfCookie(context)
  return request.post(url, { data, headers: csrfToken ? { 'x-csrf-token': csrfToken } : {} })
}

async function csrfPatch(request: APIRequestContext, context: BrowserContext, url: string, data: unknown) {
  const csrfToken = await readCsrfCookie(context)
  return request.patch(url, { data, headers: csrfToken ? { 'x-csrf-token': csrfToken } : {} })
}

async function newContextLoggedInAs(browser: Browser, roleLabel: keyof typeof CREDENTIALS_BY_ROLE) {
  const context = await browser.newContext()
  const page = await context.newPage()
  await loginAs(page, roleLabel)
  return { context, page }
}

test.describe('API 권한 재검증 (§4 공격 시나리오)', () => {
  test('USER가 관리자 전용 사용자관리 API를 직접 호출하면 403이다', async ({ browser }) => {
    const { context, page } = await newContextLoggedInAs(browser, 'USER')
    const res = await page.request.get('/api/admin/users')
    expect(res.status()).toBe(403)
    await context.close()
  })

  test('REVIEWER가 문서 상태 변경·재처리 API를 호출하면 403이다', async ({ browser }) => {
    const { context, page } = await newContextLoggedInAs(browser, 'REVIEWER')

    const patchRes = await csrfPatch(page.request, context, '/api/documents/nonexistent-id', { status: 'INACTIVE' })
    expect(patchRes.status()).toBe(403)

    const reprocessRes = await csrfPost(page.request, context, '/api/documents/nonexistent-id/reprocess', {})
    expect(reprocessRes.status()).toBe(403)

    await context.close()
  })

  test('USER가 다른 사용자의 ChatSession ID를 추측해 접근해도 이어붙일 수 없다', async ({ browser }) => {
    const owner = await newContextLoggedInAs(browser, 'USER')
    const ownerRes = await csrfPost(owner.page.request, owner.context, '/api/chat', { question: '소유자 전용 질문입니다' })
    expect(ownerRes.ok()).toBe(true)
    const { sessionId } = await ownerRes.json()
    expect(sessionId).toBeTruthy()

    const attacker = await newContextLoggedInAs(browser, 'REVIEWER')
    const attackRes = await csrfPost(attacker.page.request, attacker.context, '/api/chat', {
      question: '남의 세션에 끼어들기 시도',
      sessionId,
    })
    expect(attackRes.status()).toBe(404)

    await owner.context.close()
    await attacker.context.close()
  })

  test('비활성화된 계정은 이전 세션 쿠키를 그대로 들고 있어도 더 이상 접근할 수 없다', async ({ browser }) => {
    const admin = await newContextLoggedInAs(browser, 'ADMIN')
    const email = `e2e-deactivate-${Date.now()}@test.local`
    const createRes = await csrfPost(admin.page.request, admin.context, '/api/admin/users', {
      email,
      name: 'E2E 비활성화테스트',
      role: 'USER',
    })
    expect(createRes.ok()).toBe(true)
    const { user: createdUser, temporaryPassword } = await createRes.json()

    const target = await browser.newContext()
    const targetPage = await target.newPage()
    await targetPage.goto('/login')
    await targetPage.fill('#email', email)
    await targetPage.fill('#password', temporaryPassword)
    await Promise.all([
      targetPage.waitForURL(/\/account\/security/),
      targetPage.click('button[type=submit]'),
    ])

    // 세션 쿠키는 이미 발급된 상태다. 관리자가 이 계정을 비활성화한다.
    const deactivateRes = await csrfPatch(admin.page.request, admin.context, `/api/admin/users/${createdUser.id}`, {
      action: 'setActive',
      isActive: false,
    })
    expect(deactivateRes.ok()).toBe(true)

    // 비활성화 이전에 발급된 세션 쿠키를 그대로 사용해도 더 이상 로그인 상태로 인정되지 않고,
    // 로그인 화면으로 리다이렉트된다(redirect를 직접 확인하기 위해 자동 추적을 끈다).
    const staleRes = await targetPage.request.get('/account/security', { maxRedirects: 0 })
    expect(staleRes.status()).toBe(307)
    expect(staleRes.headers().location).toContain('/login')

    await target.close()
    await admin.context.close()
  })

  test('역할 변경 이전에 발급된 세션은 변경 후 즉시 무효화된다', async ({ browser }) => {
    const admin = await newContextLoggedInAs(browser, 'ADMIN')
    const email = `e2e-rolechange-${Date.now()}@test.local`
    const createRes = await csrfPost(admin.page.request, admin.context, '/api/admin/users', {
      email,
      name: 'E2E 역할변경테스트',
      role: 'USER',
    })
    expect(createRes.ok()).toBe(true)
    const { user: createdUser, temporaryPassword } = await createRes.json()

    const target = await browser.newContext()
    const targetPage = await target.newPage()
    await targetPage.goto('/login')
    await targetPage.fill('#email', email)
    await targetPage.fill('#password', temporaryPassword)
    await Promise.all([
      targetPage.waitForURL(/\/account\/security/),
      targetPage.click('button[type=submit]'),
    ])

    const roleChangeRes = await csrfPatch(admin.page.request, admin.context, `/api/admin/users/${createdUser.id}`, {
      action: 'setRole',
      role: 'ADMIN',
    })
    expect(roleChangeRes.ok()).toBe(true)

    // 역할 변경 이전에 발급된 세션은 새 권한으로 계속 쓰이는 것이 아니라
    // 즉시 완전히 무효화되어야 한다(세션 재사용 자체가 차단됨).
    const staleRes = await targetPage.request.get('/account/security', { maxRedirects: 0 })
    expect(staleRes.status()).toBe(307)
    expect(staleRes.headers().location).toContain('/login')

    await target.close()
    await admin.context.close()
  })
})
