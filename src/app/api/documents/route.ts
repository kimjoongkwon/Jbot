import type { BusinessType, DocumentType, JurisdictionType } from '@prisma/client'
import { type NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/session'
import { prisma } from '@/lib/db'
import { toErrorResponse } from '@/lib/http/errorResponse'
import { registerLegalDocument } from '@/lib/documents/registerDocument'

function parseDate(value: FormDataEntryValue | null): Date | null {
  if (!value || typeof value !== 'string' || value.trim().length === 0) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

export async function GET(request: NextRequest) {
  const user = await requireRole(['ADMIN', 'REVIEWER'])
  if (!user) return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const documentType = searchParams.get('documentType') as DocumentType | null
  const jurisdictionName = searchParams.get('jurisdictionName')
  const status = searchParams.get('status') as never
  const isCurrentParam = searchParams.get('isCurrent')
  const query = searchParams.get('q')

  const documents = await prisma.legalDocument.findMany({
    where: {
      documentType: documentType || undefined,
      jurisdictionName: jurisdictionName || undefined,
      status: status || undefined,
      title: query ? { contains: query } : undefined,
    },
    include: {
      versions: {
        where: isCurrentParam === 'true' ? { isCurrent: true } : undefined,
        orderBy: { createdAt: 'desc' },
        select: { id: true, versionLabel: true, isCurrent: true, effectiveFrom: true, parsingStatus: true },
      },
      _count: { select: { versions: true } },
    },
    orderBy: { updatedAt: 'desc' },
    take: 100,
  })

  return NextResponse.json({ documents })
}

export async function POST(request: NextRequest) {
  const user = await requireRole(['ADMIN'])
  if (!user) return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 })

  try {
    const formData = await request.formData()
    const file = formData.get('file')
    if (!(file instanceof File)) {
      return NextResponse.json({ error: '파일이 첨부되지 않았습니다.' }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const businessTypes = formData.getAll('businessTypes').map((v) => String(v)) as BusinessType[]

    const result = await registerLegalDocument(
      {
        title: String(formData.get('title') ?? ''),
        shortTitle: (formData.get('shortTitle') as string) || null,
        documentType: String(formData.get('documentType') ?? 'OTHER') as DocumentType,
        jurisdictionType: String(formData.get('jurisdictionType') ?? 'NATIONAL') as JurisdictionType,
        jurisdictionName: String(formData.get('jurisdictionName') ?? '전국'),
        businessTypes,
        issuingAuthority: (formData.get('issuingAuthority') as string) || null,
        sourceUrl: (formData.get('sourceUrl') as string) || null,
        description: (formData.get('description') as string) || null,
      },
      {
        versionLabel: String(formData.get('versionLabel') ?? '최초 등록'),
        promulgationDate: parseDate(formData.get('promulgationDate')),
        effectiveFrom: parseDate(formData.get('effectiveFrom')),
        effectiveTo: parseDate(formData.get('effectiveTo')),
        isCurrent: formData.get('isCurrent') !== 'false',
      },
      { buffer, filename: file.name, mimeType: file.type || 'application/octet-stream' },
      user.id,
    )

    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    return toErrorResponse(error)
  }
}
