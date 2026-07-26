import type { PrismaClient } from '@prisma/client'
import { DuplicateFileError } from './errors'
import { registerLegalDocument } from './registerDocument'

// Vercel Preview 화면·검색 확인용 시드 데이터다. 실제 법령 문구를 절대 만들어내지
// 않고, 모든 문서 제목과 본문 첫 줄에 "[개발 테스트용 가상 문서 - 실제 법령이 아님]"을
// 명시한다. 문서 구조는 화면·검색이 정상 동작하는지 확인할 수 있도록 장/조/항/호를
// 모두 포함한다.
export const PREVIEW_DISCLAIMER = '[개발 테스트용 가상 문서 - 실제 법령이 아님]'

export const PREVIEW_NATIONAL_LAW_TITLE = `${PREVIEW_DISCLAIMER} 가상 도시정비 기본법`
export const PREVIEW_SEOUL_ORDINANCE_TITLE = `${PREVIEW_DISCLAIMER} 서울특별시 가상 정비사업 조례`

const NATIONAL_LAW_TEXT = [
  PREVIEW_DISCLAIMER,
  '',
  '가상 도시정비 기본법',
  '',
  '제1장 총칙',
  '',
  '제1조(목적) 이 법은 미리보기(Preview) 환경에서 검색·화면 기능을 확인하기 위해 만든',
  '가상의 법률이며, 실제 법령이 아니다.',
  '① 이 법은 정비사업 절차를 예시로 설명하는 목적으로만 사용한다.',
  '1. 이 조문은 실제 법적 효력이 없다.',
  '',
  '제2조(정의) 이 법에서 사용하는 가상의 용어는 다음과 같다.',
  '① "가상 정비구역"이란 미리보기 데이터 검증을 위해 지정한 예시 구역을 말한다.',
  '1. 가상 정비구역은 실제 행정구역과 무관하다.',
].join('\n')

const SEOUL_ORDINANCE_TEXT = [
  PREVIEW_DISCLAIMER,
  '',
  '서울특별시 가상 정비사업 조례',
  '',
  '제1장 총칙',
  '',
  '제1조(목적) 이 조례는 서울특별시 미리보기 환경에서 지역 필터 검색 기능을 확인하기',
  '위해 만든 가상의 조례이며, 실제 조례가 아니다.',
  '① 이 조례는 서울특별시를 예시 관할 지역으로 지정한 가상 데이터다.',
  '1. 이 조문은 실제 법적 효력이 없다.',
  '',
  '제2조(적용범위) 이 조례에서 정하는 가상의 적용범위는 다음과 같다.',
  '① 이 조례는 서울특별시 가상 정비구역에 한해 예시로 적용된다.',
  '1. 실제 서울특별시 조례와는 무관하다.',
].join('\n')

async function seedUsers(prisma: PrismaClient) {
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
  return prisma.user.findUniqueOrThrow({ where: { email: 'admin@example.com' } })
}

async function seedDocumentIfMissing(
  prisma: PrismaClient,
  title: string,
  text: string,
  meta: Parameters<typeof registerLegalDocument>[0],
  actorUserId: string,
): Promise<'created' | 'skipped'> {
  const existing = await prisma.legalDocument.findFirst({ where: { title } })
  if (existing) return 'skipped'

  const buffer = Buffer.from(text, 'utf-8')
  try {
    await registerLegalDocument(
      meta,
      { versionLabel: '최초 등록(Preview seed)', effectiveFrom: new Date('2024-01-01'), isCurrent: true },
      { buffer, filename: `${title}.txt`, mimeType: 'text/plain' },
      actorUserId,
    )
    return 'created'
  } catch (error) {
    // 같은 내용(contentHash)의 버전이 이미 있으면 registerLegalDocument가
    // DuplicateFileError를 던진다 — 반복 실행해도 안전하게 건너뛴다.
    if (error instanceof DuplicateFileError) return 'skipped'
    throw error
  }
}

export interface PreviewSeedResult {
  nationalLaw: 'created' | 'skipped'
  seoulOrdinance: 'created' | 'skipped'
}

/** 반복 실행해도 중복 데이터를 만들지 않는다(제목/contentHash로 존재 여부를 먼저 확인). */
export async function seedPreviewData(prisma: PrismaClient): Promise<PreviewSeedResult> {
  const admin = await seedUsers(prisma)

  const nationalLaw = await seedDocumentIfMissing(
    prisma,
    PREVIEW_NATIONAL_LAW_TITLE,
    NATIONAL_LAW_TEXT,
    {
      title: PREVIEW_NATIONAL_LAW_TITLE,
      documentType: 'LAW',
      jurisdictionType: 'NATIONAL',
      jurisdictionName: '전국',
      businessTypes: ['RECONSTRUCTION', 'REDEVELOPMENT'],
      procedureStages: [],
      description: 'Preview 배포 화면·검색 확인용 가상 법률. 실제 법령 아님.',
    },
    admin.id,
  )

  const seoulOrdinance = await seedDocumentIfMissing(
    prisma,
    PREVIEW_SEOUL_ORDINANCE_TITLE,
    SEOUL_ORDINANCE_TEXT,
    {
      title: PREVIEW_SEOUL_ORDINANCE_TITLE,
      documentType: 'LOCAL_ORDINANCE',
      jurisdictionType: 'METROPOLITAN',
      jurisdictionName: '서울특별시',
      businessTypes: ['RECONSTRUCTION', 'REDEVELOPMENT'],
      procedureStages: [],
      description: 'Preview 배포 화면·검색 확인용 가상 조례. 실제 조례 아님.',
    },
    admin.id,
  )

  return { nationalLaw, seoulOrdinance }
}
