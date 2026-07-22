import { getAdminStats } from '@/lib/admin/stats'

function StatTile({ label, value, tone }: { label: string; value: string | number; tone?: 'warn' | 'error' }) {
  const toneClass =
    tone === 'error' ? 'text-red-600' : tone === 'warn' ? 'text-amber-600' : 'text-navy-800'
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${toneClass}`}>{value}</p>
    </div>
  )
}

export default async function AdminDashboardPage() {
  const stats = await getAdminStats()

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-lg font-bold text-navy-800">대시보드</h1>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile label="전체 등록 문서 수" value={stats.totalDocuments} />
        <StatTile label="활성 문서 수" value={stats.activeDocuments} />
        <StatTile label="처리 중 문서 수" value={stats.processingDocuments} tone={stats.processingDocuments > 0 ? 'warn' : undefined} />
        <StatTile label="오류 문서 수" value={stats.errorDocuments} tone={stats.errorDocuments > 0 ? 'error' : undefined} />
        <StatTile label="전체 청크 수" value={stats.totalChunks} />
        <StatTile label="최근 7일 질문 수" value={stats.recentQuestions} />
        <StatTile label="낮은 신뢰도 답변 수" value={stats.lowConfidenceAnswers} tone={stats.lowConfidenceAnswers > 0 ? 'warn' : undefined} />
        <StatTile label="부정확 피드백 수" value={stats.incorrectFeedbackCount} tone={stats.incorrectFeedbackCount > 0 ? 'warn' : undefined} />
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500">임베딩(의미 검색)</p>
          <p className={`mt-1 text-sm font-semibold ${stats.embeddingConfigured ? 'text-emerald-600' : 'text-slate-400'}`}>
            {stats.embeddingConfigured ? '활성화됨' : '비활성화 (키워드/조문 검색만 사용)'}
          </p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500">Claude API 답변 생성</p>
          <p className={`mt-1 text-sm font-semibold ${stats.claudeConfigured ? 'text-emerald-600' : 'text-slate-400'}`}>
            {stats.claudeConfigured ? '설정됨' : '미설정 (검색 결과만 제공)'}
          </p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500">외부 법령 API 자동 동기화</p>
          <p className="mt-1 text-sm font-semibold text-slate-400">
            {stats.externalLegalApiConfigured ? '설정됨' : '미설정 (관리자 업로드로 등록)'}
          </p>
        </div>
      </div>
    </div>
  )
}
