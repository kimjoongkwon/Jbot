import type { DisplaySource } from './types'

export function CitationCard({ source }: { source: DisplaySource }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded bg-navy-50 px-2 py-0.5 text-xs font-medium text-navy-700">{source.citationId}</span>
        <span className="font-medium text-slate-900">{source.documentTitle}</span>
        <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">{source.documentTypeLabel}</span>
        {!source.isCurrent && (
          <span className="rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-700">개정 전·이력 버전</span>
        )}
      </div>
      <p className="mt-1 text-xs text-slate-500">
        {source.hierarchyPath} · 관할: {source.jurisdictionName} · 시행일: {source.effectiveFrom ?? '정보 없음'}
      </p>
      <p className="mt-2 whitespace-pre-wrap rounded bg-slate-50 p-2 text-[13px] leading-relaxed text-slate-800">
        {source.quotedText}
      </p>
      <a href={source.detailUrl} className="mt-2 inline-block text-xs font-medium text-accent-600 hover:underline">
        문서 상세 보기 →
      </a>
    </div>
  )
}
