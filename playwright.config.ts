import { existsSync } from 'node:fs'
import { defineConfig, devices } from '@playwright/test'

// 이 경로는 개발에 쓰인 특정 샌드박스 환경에만 존재하는 사전 설치 Chromium
// 위치다. GitHub Actions 등 다른 환경에는 없으므로, 존재할 때만 명시적으로
// 지정하고 그 외에는 Playwright의 기본 브라우저 탐색(예: `playwright install`로
// 설치된 위치)을 그대로 사용한다.
const SANDBOX_CHROMIUM_PATH = '/opt/pw-browsers/chromium'
const chromiumExecutablePath = existsSync(SANDBOX_CHROMIUM_PATH) ? SANDBOX_CHROMIUM_PATH : undefined

export default defineConfig({
  testDir: './e2e',
  globalTeardown: './e2e/globalTeardown.ts',
  timeout: 30_000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:3100',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run dev -- --port 3100',
    url: 'http://localhost:3100/login',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: chromiumExecutablePath ? { executablePath: chromiumExecutablePath } : {},
      },
    },
  ],
})
