import Link from 'next/link'
import { prisma } from '@/lib/db'
import { DOCUMENT_STATUS_OPTIONS, DOCUMENT_TYPE_OPTIONS, documentStatusLabel, documentTypeLabel } from '@/lib/labels'
import { DocumentActions } from '@/components/admin/DocumentActions'

interface SearchParams {
  q?: string
  documentType?: string
  jurisdictionName?: string
  status?: string
  isCurrent?: string
}

export default async function AdminDocumentsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const params = await searchParams

  const documents = await prisma.legalDocument.findMany({
    where: {
      title: params.q ? { contains: params.q } : undefined,
      documentType: (params.documentType as never) || undefined,
      jurisdictionName: params.jurisdictionName || undefined,
      status: (params.status as never) || undefined,
    },
    include: {
      versions: {
        orderBy: { createdAt: 'desc' },
        select: { id: true, isCurrent: true, effectiveFrom: true, parsingStatus: true },
      },
    },
    orderBy: { updatedAt: 'desc' },
    take: 100,
  })

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-navy-800">문서 관리</h1>
        <Link href="/admin/documents/new" className="rounded-md bg-navy-700 px-4 py-2 text-sm text-white">
          문서 등록
        </Link>
      </div>

      <form method="GET" className="grid grid-cols-2 gap-2 rounded-lg border border-slate-200 bg-white p-3 md:grid-cols-5">
        <input
          name="q"
          defaultValue={params.q}
          placeholder="문서명 검색"
          className="col-span-2 rounded-md border border-slate-300 px-2 py-1.5 text-sm md:col-span-1"
        />
        <select name="documentType" defaultValue={params.documentType} className="rounded-md border border-slate-300 px-2 py-1.5 text-sm">
          <option value="">전체 문서 종류</option>
          {DOCUMENT_TYPE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <input
          name="jurisdictionName"
          defaultValue={params.jurisdictionName}
          placeholder="관할 지역"
          className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
        />
        <select name="status" defaultValue={params.status} className="rounded-md border border-slate-300 px-2 py-1.5 text-sm">
          <option value="">전체 상태</option>
          {DOCUMENT_STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <button type="submit" className="rounded-md bg-slate-800 px-3 py-1.5 text-sm text-white">
          검색
        </button>
      </form>

      <div className="table-scroll rounded-lg border border-slate-200 bg-white">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-slate-50 text-left text-xs text-slate-500">
            <tr>
              <th className="px-3 py-2">문서명</th>
              <th className="px-3 py-2">종류</th>
              <th className="px-3 py-2">관할</th>
              <th className="px-3 py-2">상태</th>
              <th className="px-3 py-2">현행 버전</th>
              <th className="px-3 py-2">작업</th>
            </tr>
          </thead>
          <tbody>
            {documents.map((doc) => {
              const currentVersion = doc.versions.find((v) => v.isCurrent)
              return (
                <tr key={doc.id} className="border-t border-slate-100">
                  <td className="px-3 py-2">
                    <Link href={`/admin/documents/${doc.id}`} className="font-medium text-navy-700 hover:underline">
                      {doc.title}
                    </Link>
                  </td>
                  <td className="px-3 py-2">{documentTypeLabel[doc.documentType]}</td>
                  <td className="px-3 py-2">{doc.jurisdictionName}</td>
                  <td className="px-3 py-2">{documentStatusLabel[doc.status]}</td>
                  <td className="px-3 py-2 text-xs text-slate-500">
                    {currentVersion?.effectiveFrom
                      ? new Date(currentVersion.effectiveFrom).toISOString().slice(0, 10)
                      : '정보 없음'}
                  </td>
                  <td className="px-3 py-2">
                    <DocumentActions documentId={doc.id} status={doc.status} />
                  </td>
                </tr>
              )
            })}
            {documents.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-sm text-slate-400">
                  등록된 문서가 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
