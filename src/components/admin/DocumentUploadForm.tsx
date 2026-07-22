'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import {
  BUSINESS_TYPE_OPTIONS,
  DOCUMENT_TYPE_OPTIONS,
  JURISDICTION_TYPE_OPTIONS,
} from '@/lib/labels'
import { csrfFetch } from '@/lib/security/csrfFetch'

const HWP_MESSAGE =
  '현재 HWP 원본 파일의 직접 분석은 지원하지 않습니다. PDF, DOCX 또는 TXT로 변환하여 등록해 주세요.'

export function DocumentUploadForm({ legalDocumentId }: { legalDocumentId?: string }) {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fileWarning, setFileWarning] = useState<string | null>(null)

  function checkFile(file: File | undefined) {
    if (!file) {
      setFileWarning(null)
      return
    }
    const lower = file.name.toLowerCase()
    if (lower.endsWith('.hwp') || lower.endsWith('.hwpx')) {
      setFileWarning(HWP_MESSAGE)
    } else {
      setFileWarning(null)
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)

    const formData = new FormData(e.currentTarget)
    const url = legalDocumentId ? `/api/documents/${legalDocumentId}/versions` : '/api/documents'

    try {
      const res = await csrfFetch(url, { method: 'POST', body: formData })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? '등록에 실패했습니다.')
        return
      }
      const targetId = legalDocumentId ?? data.legalDocument?.id
      router.push(`/admin/documents/${targetId}`)
      router.refresh()
    } catch {
      setError('네트워크 오류가 발생했습니다.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-4">
      {!legalDocumentId && (
        <>
          <Field label="문서명" required>
            <input name="title" required className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm" />
          </Field>
          <Field label="약칭">
            <input name="shortTitle" className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="문서 종류" required>
              <select name="documentType" required className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm">
                {DOCUMENT_TYPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="관할 구분" required>
              <select name="jurisdictionType" required className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm">
                {JURISDICTION_TYPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="관할 지역" required>
            <input name="jurisdictionName" required placeholder="예: 전국, 서울특별시, 서울특별시 강남구" className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm" />
          </Field>
          <Field label="사업 유형 (복수 선택 가능)">
            <div className="grid grid-cols-2 gap-1 text-sm md:grid-cols-4">
              {BUSINESS_TYPE_OPTIONS.map((o) => (
                <label key={o.value} className="flex items-center gap-1.5">
                  <input type="checkbox" name="businessTypes" value={o.value} /> {o.label}
                </label>
              ))}
            </div>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="발령기관">
              <input name="issuingAuthority" className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm" />
            </Field>
            <Field label="원문 URL">
              <input name="sourceUrl" type="url" className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm" />
            </Field>
          </div>
          <Field label="설명">
            <textarea name="description" rows={2} className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm" />
          </Field>
        </>
      )}

      <Field label="버전 라벨" required>
        <input name="versionLabel" required defaultValue="최초 등록" className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm" />
      </Field>
      <div className="grid grid-cols-3 gap-3">
        <Field label="공포일">
          <input name="promulgationDate" type="date" className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm" />
        </Field>
        <Field label="시행 시작일">
          <input name="effectiveFrom" type="date" className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm" />
        </Field>
        <Field label="시행 종료일">
          <input name="effectiveTo" type="date" className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm" />
        </Field>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="isCurrent" value="true" defaultChecked />
        현행 버전으로 지정
      </label>

      <Field label="파일 (.pdf, .txt, .md, .docx)" required>
        <input
          name="file"
          type="file"
          required
          accept=".pdf,.txt,.md,.docx"
          onChange={(e) => checkFile(e.target.files?.[0])}
          className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm"
        />
      </Field>
      {fileWarning && <p className="rounded bg-amber-50 p-2 text-xs text-amber-700">{fileWarning}</p>}
      {error && <p className="rounded bg-red-50 p-2 text-xs text-red-700">{error}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="rounded-md bg-navy-700 px-4 py-2 text-sm font-medium text-white disabled:bg-slate-300"
      >
        {submitting ? '등록 중...' : '등록'}
      </button>
    </form>
  )
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
      {label} {required && <span className="text-red-500">*</span>}
      {children}
    </label>
  )
}
