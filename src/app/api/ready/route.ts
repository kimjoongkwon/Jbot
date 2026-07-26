import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getEnv, isDatabaseConfigured } from '@/lib/env'

// DB 연결 가능 여부와 필요한 테이블(마이그레이션 적용 여부)을 확인한다.
// 비밀번호·DB 주소·API 키 등 민감정보는 절대 응답에 포함하지 않는다.
export const dynamic = 'force-dynamic'

export async function GET() {
  const env = getEnv()

  if (!isDatabaseConfigured(env)) {
    return NextResponse.json(
      { status: 'error', database: { configured: false, connected: false, migrationsApplied: false } },
      { status: 503 },
    )
  }

  try {
    await prisma.$queryRaw`SELECT 1`
  } catch {
    return NextResponse.json(
      { status: 'error', database: { configured: true, connected: false, migrationsApplied: false } },
      { status: 503 },
    )
  }

  try {
    // 마이그레이션이 적용되어 있는지 실제 테이블 조회로 확인한다(스키마 존재 확인).
    await prisma.user.count()
    await prisma.legalDocument.count()
  } catch {
    return NextResponse.json(
      { status: 'error', database: { configured: true, connected: true, migrationsApplied: false } },
      { status: 503 },
    )
  }

  return NextResponse.json({ status: 'ok', database: { configured: true, connected: true, migrationsApplied: true } })
}
