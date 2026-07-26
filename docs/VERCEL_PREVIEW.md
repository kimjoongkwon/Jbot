# Vercel Preview 배포 가이드 (휴대전화에서 화면 확인용)

이 문서는 **실제 운영 배포가 아니라**, `kimjoongkwon/Jbot` main 브랜치의 화면과 기본
검색 기능을 휴대전화에서 확인하기 위한 Preview 배포 절차다. 문서 업로드는 비활성화되어
있고(§"알려진 제한사항" 참고), 검색에 쓰이는 문서는 모두
`[개발 테스트용 가상 문서 - 실제 법령이 아님]`로 표시된 가상 데이터다.

## 0. 전체 흐름 요약

1. Neon(무료 PostgreSQL + pgvector)에서 DB를 만들고 연결 문자열을 받는다.
2. 그 연결 문자열을 GitHub Secret `PREVIEW_DATABASE_URL`로 등록한다.
3. GitHub Actions(수동 실행)로 마이그레이션 + 미리보기용 가상 문서를 넣는다.
4. Vercel에 저장소를 연결하고, 같은 연결 문자열 등을 Vercel 환경변수로 등록한다.
5. 배포하고 나온 `https://….vercel.app` 주소를 휴대전화에서 연다.

DB 준비(1~3번)와 Vercel 배포(4~5번)는 순서가 중요하다 — **DB 마이그레이션을 먼저
끝내야** Vercel 빌드/실행이 정상 동작한다.

## 1. Neon 프로젝트 생성 및 DATABASE_URL 준비

1. [neon.tech](https://neon.tech) 접속 → GitHub 계정으로 로그인.
2. **Create a project**로 새 프로젝트 생성 (리전은 아무 곳이나 선택해도 된다).
3. 프로젝트 대시보드의 **Connect** 또는 **Connection string** 항목에서 연결 문자열을
   복사한다. 형태는 다음과 같다.

   ```
   postgresql://사용자:비밀번호@ep-xxxx.neon.tech/dbname?sslmode=require
   ```

4. Neon은 pgvector를 모든 요금제(무료 포함)에서 기본 지원한다. 별도 애드온 설치는
   필요 없다 — 실제 활성화(`CREATE EXTENSION`)는 2단계에서 자동으로 실행된다.
5. 이 연결 문자열은 **절대 GitHub 코드에 커밋하지 않는다.** 아래 2단계에서 GitHub
   Secret으로만 등록한다.

## 2. GitHub Secret 등록 + 마이그레이션·시드 실행 (휴대전화 가능)

1. GitHub 웹(모바일 브라우저에서도 가능) → `kimjoongkwon/Jbot` 저장소 →
   **Settings → Secrets and variables → Actions**.
2. **New repository secret** → 이름 `PREVIEW_DATABASE_URL`, 값에 1단계에서 복사한
   Neon 연결 문자열을 붙여넣고 저장한다.
3. 저장소의 **Actions** 탭 → 왼쪽 목록에서 **Preview DB Setup (manual)** 선택 →
   **Run workflow** 버튼.
4. 입력값:
   - `confirm`: 정확히 `APPLY-PREVIEW-DB` 입력 (오타가 있으면 실행이 거부된다 —
     실수로 잘못된 DB에 실행하는 것을 막기 위한 안전장치).
   - `run_seed`: `true`로 두면 미리보기용 가상 문서·계정까지 함께 들어간다(권장).
5. **Run workflow** 클릭 → 실행 로그에서 `pgvector 확장 확인/활성화 완료`,
   `마이그레이션 적용 완료`가 뜨는지 확인한다. 연결 문자열 값 자체는 로그에 절대
   출력되지 않는다.
6. 실패하면 로그의 `::error::` 메시지를 확인한다(예: 시크릿 미설정, 연결 실패,
   권한 부족 등 원인이 그대로 표시된다).

## 3. Vercel에 GitHub로 로그인

1. [vercel.com](https://vercel.com) 접속 → **Continue with GitHub**로 로그인.
2. GitHub 인증 화면에서 `kimjoongkwon/Jbot` 저장소(또는 소속 조직 전체)에 대한
   접근 권한을 허용한다.

## 4. `kimjoongkwon/Jbot` 저장소 Import

1. Vercel 대시보드 → **Add New… → Project**.
2. 저장소 목록에서 `kimjoongkwon/Jbot` 선택 → **Import**.
3. Framework Preset은 Next.js가 자동으로 인식된다. **Root Directory**는 저장소
   루트 그대로 둔다(별도 변경 불필요).
4. **Build Command / Output Directory는 기본값 그대로 둔다.** 이 프로젝트는 빌드
   커맨드에서 DB 시드를 자동 실행하지 않는다 — 마이그레이션·시드는 항상 2단계의
   GitHub Actions(수동)로만 실행한다.

## 5. Environment Variables 등록

Import 화면(또는 배포 후 **Project → Settings → Environment Variables**)에서 아래
값을 등록한다. **Environment는 Production과 Preview 둘 다 체크**해 두면 브랜치
Preview에서도 동일하게 동작한다.

| 변수 | 값 | 필수 |
|---|---|---|
| `DATABASE_URL` | 1단계에서 받은 Neon 연결 문자열과 동일한 값 | 필수 |
| `SESSION_SECRET` | 무작위 문자열(터미널에서 `openssl rand -hex 32`로 생성) | 필수 |
| `PREVIEW_READ_ONLY_MODE` | `true` | 필수 (문서 업로드 비활성화) |
| `ANTHROPIC_API_KEY` | Claude API 키 | 선택 |
| `ANTHROPIC_MODEL` | 예: `claude-sonnet-5` | 선택(`ANTHROPIC_API_KEY`와 함께 설정) |

`ANTHROPIC_API_KEY`를 넣지 않으면 `/chat`에서 검색된 조문만 보여주고 "AI 답변
기능이 설정되지 않았습니다" 안내가 표시된다 — Preview 화면 확인 목적에는 이 상태로도
충분하다.

그 외 `NEXT_PUBLIC_APP_NAME`, `MAX_UPLOAD_SIZE_MB`, `EMBEDDING_PROVIDER` 등은
`.env.example`의 기본값으로도 동작하므로 꼭 등록하지 않아도 된다.

## 6. 배포

1. 환경변수를 저장한 뒤 **Deploy** 클릭(처음 Import 시) 또는 이미 배포된 프로젝트라면
   **Deployments** 탭에서 최신 배포가 자동으로 시작된다.
2. 빌드가 끝나면 Vercel이 `https://프로젝트이름.vercel.app` 형태의 URL을 보여준다.

## 7. Preview URL 확인 (휴대전화에서 열기)

1. Vercel 대시보드(모바일 브라우저에서도 동일) → 방금 배포된 항목 → **Visit** 또는
   URL을 직접 복사.
2. 휴대전화 브라우저에 그 주소를 붙여넣어 연다. `/login` 화면이 뜨면 성공이다.
3. 시드된 계정(예: `user@example.com`)을 선택해 로그인 → `/chat`에서 아래처럼
   질문해 가상 문서가 검색되는지 확인한다.
   - "가상 정비구역이 무엇인가요?" (전국 공통 가상 법률에서 검색됨)
   - "서울특별시 조례 적용범위는?" (서울특별시 가상 조례에서 검색됨)

## 8. 배포 실패 로그 확인

1. Vercel 대시보드 → **Deployments** → 실패한(빨간 X) 배포 클릭.
2. **Build Logs** 또는 **Function Logs** 탭에서 오류 메시지를 확인한다.
3. 자주 발생하는 원인:
   - `DATABASE_URL`을 등록하지 않았거나 오타가 있음 → `/api/ready`가 503을 반환하고,
     `/login` 등 DB를 쓰는 화면은 "데이터베이스에 연결할 수 없습니다" 안내를 보여준다
     (Next.js 기본 오류 화면이 아니라 이 프로젝트가 직접 처리하는 안내다).
   - 2단계의 GitHub Actions(마이그레이션)를 아직 실행하지 않음 → 테이블이 없어
     동일하게 DB 연결/조회 오류가 발생한다. 2단계를 먼저 실행한다.
   - `PREVIEW_READ_ONLY_MODE`를 등록하지 않음 → 업로드 기능이 꺼지지 않아 실제로는
     동작하지 않을 업로드 버튼이 활성화된 채로 보일 수 있다(Vercel 서버리스에는 영구
     파일 저장소가 없으므로).

## 9. 환경변수 수정 후 Redeploy

1. **Project → Settings → Environment Variables**에서 값을 수정/추가하고 저장한다.
2. 환경변수 변경은 **다음 배포부터** 적용된다 — 이미 실행 중인 배포에는 자동 반영되지
   않는다. **Deployments** 탭 → 최신 배포 우측 **⋯ 메뉴 → Redeploy**를 눌러 새로
   빌드한다.

## 10. 상태 확인 API

배포된 주소 뒤에 아래 경로를 붙이면 상태를 바로 확인할 수 있다(둘 다 비밀번호·DB
주소·API 키를 응답에 포함하지 않는다).

- `GET /api/health` — 앱 프로세스 자체가 살아 있는지만 확인(DB 접속 없음).
- `GET /api/ready` — DB 연결 가능 여부와 마이그레이션(테이블 존재) 여부를 확인한다.
  `{"status":"ok", ...}`가 아니면 위 8번의 원인 중 하나일 가능성이 높다.

## 알려진 제한사항 (Preview 전용)

- **문서 업로드 비활성화**: `PREVIEW_READ_ONLY_MODE=true`이므로 관리자 화면의 문서
  등록 버튼이 비활성화되어 있고, 업로드 API를 직접 호출해도 503을 반환한다. Vercel
  서버리스 환경에는 영구 파일 저장소가 없어 실제 운영에서는 S3 등 Object Storage
  연결이 필요하다(`docs/DEPLOYMENT.md` 참고 대상은 별도 운영 배포 문서다).
  이미 등록된(시드된) 가상 문서의 검색·열람은 정상 동작한다.
  - 로컬 개발(`npm run dev`, `PREVIEW_READ_ONLY_MODE=false` 또는 미설정)에서는 기존
    업로드 기능이 그대로 유지된다.
- **가상 데이터만 존재**: 검색되는 문서는 전부 예시일 뿐이며, 실제 법률 검토에
  사용해서는 안 된다.
- **AI 답변**: `ANTHROPIC_API_KEY`를 등록하지 않으면 검색 결과만 표시된다.
