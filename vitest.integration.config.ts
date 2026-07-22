import path from 'node:path'
import { defineConfig } from 'vitest/config'
import { config as loadDotenv } from 'dotenv'

loadDotenv({ path: path.resolve(__dirname, '.env') })

// 통합 테스트는 실제 PostgreSQL(+pgvector) 연결이 필요하다.
// DATABASE_URL이 가리키는 DB에 직접 읽기/쓰기를 수행하므로 개발용 DB로만 실행한다.
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'node',
    include: ['tests/integration/**/*.integration.test.ts'],
    testTimeout: 20000,
    fileParallelism: false,
  },
})
