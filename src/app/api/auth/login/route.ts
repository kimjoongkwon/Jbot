import { type NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { SESSION_COOKIE_NAME } from '@/lib/auth/session'

export async function POST(request: NextRequest) {
  const formData = await request.formData()
  const userId = String(formData.get('userId') ?? '')
  const user = await prisma.user.findUnique({ where: { id: userId } })

  if (!user) {
    return NextResponse.redirect(new URL('/login?error=1', request.url))
  }

  const response = NextResponse.redirect(new URL('/chat', request.url))
  response.cookies.set(SESSION_COOKIE_NAME, user.id, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
  })
  return response
}
