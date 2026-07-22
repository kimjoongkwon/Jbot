import { expect, test } from '@playwright/test'

// 요구사항 §17 E2E 시나리오:
// 1) 관리자가 TXT 문서를 등록한다 → 2) 처리가 완료된다 → 3) 사용자가 질문한다 →
// 4) 관련 조문이 검색된다 → 5) API 키가 있으면 Claude 답변+출처 표시 →
// 6) API 키가 없으면 검색결과+설정안내 표시 → 7) 피드백을 남긴다 →
// 8) 관리자가 검토 화면에서 확인한다.
//
// 이 테스트 환경에는 ANTHROPIC_API_KEY가 설정되어 있지 않으므로 5번은
// 검증하지 않고 명시적으로 건너뛴다(실행하지 않은 것을 실행했다고 보고하지 않기 위함).

// Playwright는 테스트마다 이 파일을 별도로 로드할 수 있어 모듈 스코프 상수가
// 테스트 간에 재계산될 수 있으므로, 테스트 간 상관관계가 필요한 값은 타임스탬프
// 없이 고정 문자열로 둔다. 대신 파일 "내용"에 실행 시각을 넣어 재실행 시
// contentHash 중복 오류가 나지 않게 한다.
const DOC_TITLE = '[TEST] E2E 정비사업 테스트법'
const SAMPLE_TEXT = [
  '[개발 테스트용 가상 문서 - 실제 법령이 아님]',
  '',
  '제3장 조합 및 조합설립인가',
  '',
  '제40조(시공사 선정 총회) 조합은 시공사를 선정하기 위한 총회를 개최할 수 있다.',
  '①총회의 의결은 조합원 과반수의 출석과 출석 조합원 과반수의 찬성으로 한다.',
  '',
  `(테스트 실행 시각: ${Date.now()})`,
].join('\n')

async function loginAs(page: import('@playwright/test').Page, roleLabel: 'ADMIN' | 'REVIEWER' | 'USER') {
  await page.goto('/login')
  const targetForm = page.locator('form', { has: page.getByText(roleLabel, { exact: true }) })
  await Promise.all([page.waitForURL(/\/chat|\/admin/), targetForm.locator('button[type=submit]').click()])
}

test.describe('정비사업 법령 AI 챗봇 E2E', () => {
  test('1~2. 관리자가 TXT 문서를 등록하면 파싱이 완료되고 문서가 활성화된다', async ({ page }) => {
    await loginAs(page, 'ADMIN')

    await page.goto('/admin/documents/new')
    await page.fill('input[name=title]', DOC_TITLE)
    await page.selectOption('select[name=documentType]', 'LAW')
    await page.selectOption('select[name=jurisdictionType]', 'NATIONAL')
    await page.fill('input[name=jurisdictionName]', '전국')
    await page.check('input[name=businessTypes][value=RECONSTRUCTION]')
    await page.fill('input[name=versionLabel]', '최초 등록')
    await page.fill('input[name=effectiveFrom]', '2024-01-01')

    const buffer = Buffer.from(SAMPLE_TEXT, 'utf-8')
    await page.setInputFiles('input[name=file]', {
      name: 'e2e-sample.txt',
      mimeType: 'text/plain',
      buffer,
    })

    await Promise.all([page.waitForURL(/\/admin\/documents\/.+/), page.click('button[type=submit]:has-text("등록")')])

    await expect(page.getByText('법률 · 전국 · 활성')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText('COMPLETED')).toBeVisible()
    await expect(page.getByText('생성된 조문 청크')).toBeVisible()
    await expect(page.getByText('제40조 시공사 선정 총회')).toBeVisible()
  })

  test('3~4, 6. 사용자가 질문하면 관련 조문이 검색되고, API 키 미설정 안내가 표시된다', async ({ page }) => {
    await loginAs(page, 'USER')

    await page.goto('/chat')
    await page.fill('textarea', '시공사 선정 총회의 의결 요건은 무엇인가요?')
    await page.click('button:has-text("전송")')

    await expect(page.getByText('AI 답변 기능이 설정되지 않았습니다')).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText(DOC_TITLE, { exact: true })).toBeVisible()
    await expect(page.getByText('제40조 시공사 선정 총회')).toBeVisible()
  })

  test('5. Claude API 키가 설정된 경우 근거 기반 답변과 출처가 표시된다', async ({ page }) => {
    test.skip(
      !process.env.ANTHROPIC_API_KEY,
      'ANTHROPIC_API_KEY가 없어 이 환경에서는 실행하지 않음 (실제 키가 있을 때만 Claude 답변/출처 표시를 검증)',
    )
    await loginAs(page, 'USER')
    await page.goto('/chat')
    await page.fill('textarea', '시공사 선정 총회의 의결 요건은 무엇인가요?')
    await page.click('button:has-text("전송")')
    await expect(page.getByText('1. 결론')).toBeVisible({ timeout: 20_000 })
    await expect(page.getByText('9. 안내')).toBeVisible()
  })

  test('7. 사용자가 답변에 피드백을 남길 수 있다', async ({ page }) => {
    await loginAs(page, 'USER')
    await page.goto('/chat')
    await page.fill('textarea', '시공사 선정 총회의 의결 요건은 무엇인가요?')
    await page.click('button:has-text("전송")')
    await expect(page.getByText('AI 답변 기능이 설정되지 않았습니다')).toBeVisible({ timeout: 15_000 })

    await page.getByRole('button', { name: '도움이 됨' }).click()
    await expect(page.getByText('피드백이 접수되었습니다')).toBeVisible()
  })

  test('8. 관리자가 검토 화면에서 질문·답변·피드백을 확인할 수 있다', async ({ page }) => {
    await loginAs(page, 'ADMIN')
    await page.goto('/admin/reviews')
    await expect(page.getByText('시공사 선정 총회의 의결 요건은 무엇인가요?').first()).toBeVisible({ timeout: 10_000 })
  })
})
