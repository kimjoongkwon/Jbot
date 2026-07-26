import { PrismaClient } from '@prisma/client'

/**
 * E2E 테스트가 만든 데이터(문서·대화)를 로컬 개발 DB에서 정리한다.
 * 실제 운영 DB에서 실행하지 않도록 DATABASE_URL은 .env(로컬 개발용)만 사용한다.
 */
export default async function globalTeardown() {
  const prisma = new PrismaClient()
  try {
    await prisma.legalDocument.deleteMany({ where: { title: { startsWith: '[TEST]' } } })
    await prisma.chatSession.deleteMany({ where: {} })

    const testUsers = await prisma.user.findMany({
      where: { email: { startsWith: 'e2e-' } },
      select: { id: true },
    })
    const testUserIds = testUsers.map((u) => u.id)
    if (testUserIds.length > 0) {
      await prisma.userSession.deleteMany({ where: { userId: { in: testUserIds } } })
      await prisma.loginAttempt.deleteMany({ where: { userId: { in: testUserIds } } })
      await prisma.auditLog.deleteMany({ where: { userId: { in: testUserIds } } })
      await prisma.user.deleteMany({ where: { id: { in: testUserIds } } })
    }
  } finally {
    await prisma.$disconnect()
  }
}
