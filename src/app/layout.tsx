import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'JK | 정비사업 법령 AI',
  description: '등록된 법령·조례·검토자료를 근거로 답변하는 정비사업 법령 AI 챗봇',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  )
}
