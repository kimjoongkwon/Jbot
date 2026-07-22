import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'
import { viteSingleFile } from 'vite-plugin-singlefile'

// 사내/개인 PC에서 서버 없이 index.html 더블클릭 실행을 목표로 하므로
// 빌드 결과를 단일 HTML 파일로 인라인한다 (JS/CSS 분리 산출물 없음).
export default defineConfig({
  plugins: [react(), viteSingleFile()],
  build: {
    assetsInlineLimit: 100 * 1024 * 1024,
    cssCodeSplit: false,
    chunkSizeWarningLimit: 100 * 1024 * 1024,
  },
  test: {
    environment: 'jsdom',
  },
})
