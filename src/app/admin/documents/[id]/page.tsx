import { notFound } from 'next/navigation'
import { prisma } from '@/lib/db'
import { businessTypeLabel, documentStatusLabel, documentTypeLabel } from '@/lib/labels'
import { DocumentActions } from '@/components/admin/DocumentActions'
import { DocumentUploadForm } from '@/components/admin/DocumentUploadForm'

function formatDate(date: Date | null) {
  return date ? date.toISOString().slice(0, 10) : '정보 없음'
}

export default async function DocumentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const document = await prisma.legalDocument.findUnique({
    where: { id },
    include: {
      versions: {
        orderBy: { createdAt: 'desc' },
        include: {
          ingestionJobs: { orderBy: { createdAt: 'desc' } },
          _count: { select: { chunks: true } },
        },
      },
    },
  })
  if (!document) notFound()

  const currentVersion = document.versions.find((v) => v.isCurrent) ?? document.versions[0] ?? null
  const chunks = currentVersion
    ? await prisma.legalChunk.findMany({
        where: { documentVersionId: currentVersion.id },
        orderBy: { sequence: 'asc' },
        take: 50,
      })
    : []
  const citationCount = currentVersion
    ? await prisma.answerCitation.count({ where: { legalChunk: { documentVersionId: currentVersion.id } } })
    : 0

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-bold text-navy-800">{document.title}</h1>
          <p className="text-sm text-slate-500">
            {documentTypeLabel[document.documentType]} · {document.jurisdictionName} · {documentStatusLabel[document.status]}
          </p>
        </div>
        <DocumentActions documentId={document.id} status={document.status} />
      </div>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="mb-2 text-sm font-semibold text-navy-700">문서 기본 정보</h2>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm md:grid-cols-3">
          <Info label="약칭" value={document.shortTitle ?? '-'} />
          <Info label="발령기관" value={document.issuingAuthority ?? '-'} />
          <Info label="원문 URL" value={document.sourceUrl ?? '-'} />
          <Info
            label="사업 유형"
            value={document.businessTypes.map((b) => businessTypeLabel[b] ?? b).join(', ') || '전체'}
          />
          <Info label="답변 인용 횟수" value={String(citationCount)} />
          <Info label="등록일" value={formatDate(document.createdAt)} />
        </dl>
        {document.description && <p className="mt-3 text-sm text-slate-600">{document.description}</p>}
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="mb-2 text-sm font-semibold text-navy-700">버전 목록</h2>
        <div className="table-scroll">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="text-left text-xs text-slate-500">
              <tr>
                <th className="py-1.5 pr-3">버전</th>
                <th className="py-1.5 pr-3">현행</th>
                <th className="py-1.5 pr-3">공포일</th>
                <th className="py-1.5 pr-3">시행일</th>
                <th className="py-1.5 pr-3">파싱 상태</th>
                <th className="py-1.5 pr-3">청크 수</th>
                <th className="py-1.5 pr-3">최근 처리</th>
              </tr>
            </thead>
            <tbody>
              {document.versions.map((v) => (
                <tr key={v.id} className="border-t border-slate-100">
                  <td className="py-1.5 pr-3">{v.versionLabel}</td>
                  <td className="py-1.5 pr-3">{v.isCurrent ? '✓' : ''}</td>
                  <td className="py-1.5 pr-3">{formatDate(v.promulgationDate)}</td>
                  <td className="py-1.5 pr-3">
                    {formatDate(v.effectiveFrom)} ~ {v.effectiveTo ? formatDate(v.effectiveTo) : '(현행)'}
                  </td>
                  <td className="py-1.5 pr-3">{v.parsingStatus}</td>
                  <td className="py-1.5 pr-3">{v._count.chunks}</td>
                  <td className="py-1.5 pr-3 text-xs text-slate-500">
                    {v.ingestionJobs[0]
                      ? `${v.ingestionJobs[0].status} (${v.ingestionJobs[0].processedChunks}/${v.ingestionJobs[0].totalChunks})`
                      : '-'}
                    {v.ingestionJobs[0]?.errorMessage && (
                      <p className="text-red-600">{v.ingestionJobs[0].errorMessage}</p>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="mb-2 text-sm font-semibold text-navy-700">새 버전 등록</h2>
        <DocumentUploadForm legalDocumentId={document.id} />
      </section>

      {currentVersion?.rawText && (
        <section className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="mb-2 text-sm font-semibold text-navy-700">전체 추출 텍스트 (현행 버전)</h2>
          <details>
            <summary className="cursor-pointer text-xs text-accent-600">펼쳐 보기</summary>
            <pre className="mt-2 max-h-96 overflow-y-auto whitespace-pre-wrap rounded bg-slate-50 p-3 text-xs leading-relaxed text-slate-700">
              {currentVersion.rawText}
            </pre>
          </details>
        </section>
      )}

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="mb-2 text-sm font-semibold text-navy-700">
          생성된 조문 청크 (현행 버전, 최대 50개 표시 / 전체 {currentVersion?._count.chunks ?? 0}개)
        </h2>
        <div className="flex flex-col gap-2">
          {chunks.map((chunk) => (
            <div key={chunk.id} className="rounded border border-slate-100 p-2 text-xs">
              <p className="font-medium text-slate-700">{chunk.hierarchyPath}</p>
              <p className="mt-1 whitespace-pre-wrap text-slate-600">{chunk.content.slice(0, 200)}</p>
            </div>
          ))}
          {chunks.length === 0 && <p className="text-sm text-slate-400">생성된 청크가 없습니다.</p>}
        </div>
      </section>
    </div>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-slate-400">{label}</dt>
      <dd className="text-slate-800">{value}</dd>
    </div>
  )
}
