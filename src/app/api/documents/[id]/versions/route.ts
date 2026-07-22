import { type NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/session'
import { registerDocumentVersion } from '@/lib/documents/registerDocument'
import { toErrorResponse } from '@/lib/http/errorResponse'

function parseDate(value: FormDataEntryValue | null): Date | null {
  if (!value || typeof value !== 'string' || value.trim().length === 0) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireRole(['ADMIN'])
  if (!user) return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 })

  const { id } = await params
  try {
    const formData = await request.formData()
    const file = formData.get('file')
    if (!(file instanceof File)) {
      return NextResponse.json({ error: '파일이 첨부되지 않았습니다.' }, { status: 400 })
    }
    const buffer = Buffer.from(await file.arrayBuffer())

    const result = await registerDocumentVersion(
      id,
      {
        versionLabel: String(formData.get('versionLabel') ?? '새 버전'),
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
