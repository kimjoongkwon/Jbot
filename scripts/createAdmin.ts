import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { hashPassword, validatePasswordPolicy } from '../src/lib/auth/password'

const prisma = new PrismaClient()

/**
 * 최초 관리자 계정을 1회 생성하는 명령형 스크립트다 (`npm run admin:create`).
 * BOOTSTRAP_ADMIN_EMAIL/PASSWORD/NAME 환경변수를 읽어 사용하며, 마이그레이션
 * 시 존재하는 사용자에게 임의의 기본 비밀번호를 채우지 않는다는 원칙(§3-2)과
 * 같은 이유로, 같은 이메일의 사용자가 이미 있으면 절대 비밀번호를 덮어쓰지
 * 않고 아무 것도 하지 않는다. 비밀번호는 어떤 로그에도 출력하지 않는다.
 */
async function main() {
  const email = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase() ?? ''
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD ?? ''
  const name = process.env.BOOTSTRAP_ADMIN_NAME?.trim() ?? ''

  if (!email || !password || !name) {
    console.error(
      'BOOTSTRAP_ADMIN_EMAIL, BOOTSTRAP_ADMIN_PASSWORD, BOOTSTRAP_ADMIN_NAME이 모두 설정되어야 합니다.',
    )
    process.exitCode = 1
    return
  }

  const policy = validatePasswordPolicy(password)
  if (!policy.valid) {
    console.error(`BOOTSTRAP_ADMIN_PASSWORD가 정책을 만족하지 않습니다: ${policy.errorMessage}`)
    process.exitCode = 1
    return
  }

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    console.log(
      `이미 존재하는 이메일입니다 (${email}, role=${existing.role}). 비밀번호를 포함해 아무 것도 변경하지 않았습니다.`,
    )
    return
  }

  const passwordHash = await hashPassword(password)
  const admin = await prisma.user.create({
    data: {
      email,
      name,
      role: 'ADMIN',
      passwordHash,
      isActive: true,
      mustChangePassword: false,
      passwordChangedAt: new Date(),
    },
  })

  await prisma.auditLog.create({
    data: {
      userId: admin.id,
      action: 'USER_CREATED',
      targetType: 'User',
      targetId: admin.id,
      metadata: { method: 'bootstrap' },
    },
  })

  console.log(`관리자 계정을 생성했습니다: ${email} (id=${admin.id}).`)
  console.log('보안을 위해 지금 BOOTSTRAP_ADMIN_EMAIL/PASSWORD/NAME 환경변수를 배포 환경에서 제거하세요.')
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
