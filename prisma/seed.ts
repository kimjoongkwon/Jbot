import { PrismaClient } from '@prisma/client'
import { hashPassword } from '../src/lib/auth/password'

const prisma = new PrismaClient()

// 아래 사용자·문서는 역할 구분을 시연하기 위한 개발용 시드 데이터다.
// LegalDocument는 "[개발 테스트용 가상 문서 - 실제 법령이 아님]"로 명시하며
// 실제 법령 원문이 아니다 (요구사항 §16).
//
// 시드 비밀번호는 이 스크립트(npm run db:seed)를 로컬에서 직접 실행하는
// 개발자만 사용하는 고정값이며, 마이그레이션이 기존 사용자에게 임의의
// 기본 비밀번호를 자동으로 채우는 것과는 다르다(그건 금지됨, §3-2). 운영
// 환경에서는 이 스크립트로 시드하지 않고 npm run admin:create로 별도
// 관리자를 발급한다.
const DEV_SEED_PASSWORD = 'DevSeed!2026Pw'

async function main() {
  const passwordHash = await hashPassword(DEV_SEED_PASSWORD)

  await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: { passwordHash, passwordChangedAt: new Date() },
    create: { email: 'admin@example.com', name: '관리자(시드)', role: 'ADMIN', passwordHash, passwordChangedAt: new Date() },
  })
  await prisma.user.upsert({
    where: { email: 'reviewer@example.com' },
    update: { passwordHash, passwordChangedAt: new Date() },
    create: {
      email: 'reviewer@example.com',
      name: '검토자(시드)',
      role: 'REVIEWER',
      passwordHash,
      passwordChangedAt: new Date(),
    },
  })
  await prisma.user.upsert({
    where: { email: 'user@example.com' },
    update: { passwordHash, passwordChangedAt: new Date() },
    create: { email: 'user@example.com', name: '일반사용자(시드)', role: 'USER', passwordHash, passwordChangedAt: new Date() },
  })

  console.log('시드 완료: admin@example.com / reviewer@example.com / user@example.com')
  console.log(`개발용 비밀번호(전체 공통, 로컬 전용): ${DEV_SEED_PASSWORD}`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
