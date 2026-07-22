import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/session'
import { getAdminStats } from '@/lib/admin/stats'

export async function GET() {
  const user = await requireRole(['ADMIN', 'REVIEWER'])
  if (!user) return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 })

  const stats = await getAdminStats()
  return NextResponse.json(stats)
}
