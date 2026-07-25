/**
 * DB를 사용하는 페이지에서 Prisma 쿼리가 실패했을 때 Next.js 기본 오류 화면
 * 대신 보여주는 안내다. DATABASE_URL 미설정/오타, DB 서버 미기동, 마이그레이션
 * 미적용 등 배포 초기 설정 실수를 사용자가 바로 알아볼 수 있게 한다.
 */
export function DatabaseUnavailableNotice() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-3 p-6 text-center">
      <h1 className="text-lg font-bold text-red-700">데이터베이스에 연결할 수 없습니다</h1>
      <p className="text-sm text-slate-600">
        DATABASE_URL 환경변수가 비어 있거나, 가리키는 PostgreSQL에 연결할 수 없거나, 마이그레이션이
        아직 적용되지 않았을 수 있습니다. 배포 환경변수와 <code>/api/ready</code> 응답을 확인한 뒤
        다시 시도해 주세요.
      </p>
    </main>
  )
}
