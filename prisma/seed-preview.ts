import { PrismaClient } from '@prisma/client'
import { seedPreviewData } from '../src/lib/documents/previewSeedData'

const prisma = new PrismaClient()

async function main() {
  const result = await seedPreviewData(prisma)
  console.log(`가상 법률: ${result.nationalLaw === 'created' ? '등록 완료' : '이미 존재함, 건너뜀'}`)
  console.log(`가상 조례: ${result.seoulOrdinance === 'created' ? '등록 완료' : '이미 존재함, 건너뜀'}`)
  console.log('Preview 시드 완료: admin/reviewer/user@example.com + 가상 문서 2건')
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
