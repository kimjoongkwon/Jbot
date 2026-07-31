import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  serverExternalPackages: ['pdf-parse', 'mammoth'],
  // Docker 이미지 크기를 줄이고 배포를 단순화하기 위해 standalone 산출물을 생성한다
  // (docs/DEPLOYMENT.md 참고). node_modules 전체를 이미지에 복사할 필요가 없어진다.
  output: 'standalone',
}

export default nextConfig
