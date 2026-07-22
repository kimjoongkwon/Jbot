import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// 아래 사용자·문서는 로그인 없이 역할 구분을 시연하기 위한 개발용 시드 데이터다.
// LegalDocument는 "[개발 테스트용 가상 문서 - 실제 법령이 아님]"로 명시하며
// 실제 법령 원문이 아니다 (요구사항 §16). 실제 서비스에서는 비밀번호/OAuth 등
// 실제 인증으로 교체해야 한다 (docs/NEXT_STEPS.md 참고).
async function main() {
  await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: {},
    create: { email: 'admin@example.com', name: '관리자(시드)', role: 'ADMIN' },
  })
  await prisma.user.upsert({
    where: { email: 'reviewer@example.com' },
    update: {},
    create: { email: 'reviewer@example.com', name: '검토자(시드)', role: 'REVIEWER' },
  })
  await prisma.user.upsert({
    where: { email: 'user@example.com' },
    update: {},
    create: { email: 'user@example.com', name: '일반사용자(시드)', role: 'USER' },
  })

  console.log('시드 완료: admin@example.com / reviewer@example.com / user@example.com')
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
