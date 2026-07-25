import { NextResponse } from 'next/server'

// DB에 전혀 접속하지 않는다 — 프로세스 자체가 살아 있고 요청을 처리할 수
// 있는지만 답한다. 로드밸런서/모니터링의 liveness probe 용도.
export const dynamic = 'force-dynamic'

export async function GET() {
  return NextResponse.json({ status: 'ok' })
}
