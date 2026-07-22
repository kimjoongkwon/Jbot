'use client'

import { BUSINESS_TYPE_OPTIONS, PROCEDURE_STAGE_OPTIONS, REGION_OPTIONS } from './types'

export interface ChatFilters {
  region: string
  businessType: string
  procedureStage: string
  referenceDate: string
}

interface FilterPanelProps {
  filters: ChatFilters
  onChange: (filters: ChatFilters) => void
  open: boolean
  onToggle: () => void
}

export function FilterPanel({ filters, onChange, open, onToggle }: FilterPanelProps) {
  return (
    <div className="border-b border-slate-200 bg-white">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between px-4 py-2 text-sm font-medium text-navy-700 md:hidden"
      >
        검색 조건 {open ? '접기' : '펼치기'}
        <span aria-hidden>{open ? '▲' : '▼'}</span>
      </button>

      <div className={`${open ? 'grid' : 'hidden'} grid-cols-2 gap-3 p-4 md:grid md:grid-cols-4`}>
        <label className="flex flex-col gap-1 text-xs text-slate-600">
          지역
          <select
            className="rounded-md border border-slate-300 px-2 py-2 text-sm"
            value={filters.region}
            onChange={(e) => onChange({ ...filters, region: e.target.value })}
          >
            {REGION_OPTIONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-xs text-slate-600">
          사업 유형
          <select
            className="rounded-md border border-slate-300 px-2 py-2 text-sm"
            value={filters.businessType}
            onChange={(e) => onChange({ ...filters, businessType: e.target.value })}
          >
            <option value="">전체</option>
            {BUSINESS_TYPE_OPTIONS.map((b) => (
              <option key={b.value} value={b.value}>
                {b.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-xs text-slate-600">
          절차 단계
          <select
            className="rounded-md border border-slate-300 px-2 py-2 text-sm"
            value={filters.procedureStage}
            onChange={(e) => onChange({ ...filters, procedureStage: e.target.value })}
          >
            <option value="">전체</option>
            {PROCEDURE_STAGE_OPTIONS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-xs text-slate-600">
          기준일
          <input
            type="date"
            className="rounded-md border border-slate-300 px-2 py-2 text-sm"
            value={filters.referenceDate}
            onChange={(e) => onChange({ ...filters, referenceDate: e.target.value })}
          />
        </label>
      </div>
    </div>
  )
}
