# 정비사업 법령 AI (legal-rag-chatbot)

한국 도시정비사업(재개발·재건축·가로주택정비·모아타운) 관련 법령·조례·유권해석·판례·
내부 검토자료를 관리자가 등록하면, 사용자가 질문했을 때 **등록된 자료 안에서만** 관련
조문을 검색해 근거와 함께 답변하는 서비스다.

## 프로젝트 목적

- 정비사업 실무자가 "창립총회 이후 부족한 동의서를 추가로 받을 수 있나요?" 같은 질문을
  했을 때, 등록된 법령·조례·유권해석·판례·내부자료에서 실제로 검색된 조문만을 근거로
  답변한다.
- AI가 등록되지 않은 조문이나 사실을 만들어내지 않도록(hallucination 방지) 서버 단에서
  citationId를 검증하고, 근거가 없으면 "확인하지 못했다"고 답하도록 강제한다.
- 법률/시행령/시행규칙/조례/조례시행규칙/행정규칙·고시/법령해석/판례·행정심판/내부자료의
  법적 위계를 구분해서 표현한다.

## 주요 기능

- 관리자 문서 등록: PDF/DOCX/TXT/MD 업로드 → 텍스트 추출 → 한국 법령 구조(장/절/조/항/
  호/목/별표/부칙) 파싱 → 조문 단위 청크 분할 → (선택) 임베딩 생성
- 하이브리드 검색: 정확한 조문 번호 검색 > PostgreSQL Full Text Search(키워드) > 벡터
  유사도 검색(임베딩 설정 시) 순으로 우선순위를 두고 병합, 지역·사업유형·기준일·활성
  상태로 필터링
- Claude 기반 구조화 답변: 검색된 조문만 근거로 결론/요약/법적근거/분석/예외/추가확인
  사항/자료충돌/신뢰도/기준일/면책문구를 Zod로 검증된 JSON으로 생성, 서버에서 citationId
  실재 여부를 재검증
- 사용자 챗봇 화면(`/chat`): 지역/사업유형/절차단계/기준일 선택, 답변 피드백
- 관리자 화면(`/admin`): 대시보드 통계, 문서 관리(등록/활성화/비활성화/재처리/버전관리),
  질문 검토 큐

## 기술 스택

- Next.js App Router + TypeScript(strict) + Tailwind CSS
- PostgreSQL + Prisma ORM
- PostgreSQL Full Text Search (한국어 2-gram 사전 토큰화 + `simple` tsvector)
- pgvector (임베딩 벡터 검색, 선택 사항)
- Zod (Claude 구조화 응답 검증)
- Anthropic Claude API (`@anthropic-ai/sdk`)
- Vitest(단위/통합) + Playwright(E2E)

## 설치 방법

```bash
npm install
```

## 환경변수

`.env.example`을 `.env`로 복사한 뒤 값을 채운다. 실제 API 키를 저장소에 커밋하지 않는다.

```
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/legal_chatbot"

ANTHROPIC_API_KEY=""
ANTHROPIC_MODEL=""

EMBEDDING_PROVIDER="none"
OPENAI_API_KEY=""
OPENAI_EMBEDDING_MODEL="text-embedding-3-small"
VOYAGE_API_KEY=""
VOYAGE_EMBEDDING_MODEL=""

NEXT_PUBLIC_APP_NAME="정비사업 법령 AI"
MAX_UPLOAD_SIZE_MB="20"

# 최초 1회 관리자 계정 부트스트랩용 (아래 "인증·계정 관리" 참고)
BOOTSTRAP_ADMIN_EMAIL=""
BOOTSTRAP_ADMIN_PASSWORD=""
BOOTSTRAP_ADMIN_NAME=""

# 개발 전용 인증 우회. NODE_ENV=production이면 무조건 무시되며 앱이 기동을 거부한다.
DEV_AUTH_BYPASS="false"

# 업로드 원본 파일 저장소 ("local" 또는 "s3", 아래 "파일 저장소" 참고)
STORAGE_PROVIDER="local"
STORAGE_LOCAL_ROOT="storage/uploads"
```

`ANTHROPIC_API_KEY`/`ANTHROPIC_MODEL`, 임베딩 관련 키가 비어 있어도 앱은 정상 실행되며,
문서 등록·조문 검색은 그대로 동작한다(§"Claude API 설정", "임베딩 설정" 참고). 운영 배포
절차 전체(HTTPS, S3, systemd/Docker 등)는 [`docs/DEPLOYMENT.md`](./docs/DEPLOYMENT.md)에
정리되어 있다.

## PostgreSQL 준비

로컬에 PostgreSQL 16(또는 호환 버전)을 설치하고 데이터베이스를 만든다.

```bash
sudo -u postgres createdb legal_chatbot
sudo -u postgres psql -c "ALTER USER postgres PASSWORD 'postgres';"
```

## pgvector 설정

`vector` 확장을 설치하고(Ubuntu 기준 `postgresql-16-pgvector` 패키지), Prisma 마이그레이션이
`CREATE EXTENSION IF NOT EXISTS "vector"`를 자동으로 실행한다.

```bash
sudo apt-get install -y postgresql-16-pgvector
```

pgvector가 설치되지 않은 상태에서 마이그레이션을 실행하면 다음과 같은 오류가 발생한다.

```
ERROR: could not open extension control file ".../vector.control": No such file or directory
```

이 오류가 보이면 pgvector 확장 자체가 설치되어 있지 않다는 뜻이다. 위 설치 명령을 실행한 뒤
마이그레이션을 다시 시도한다.

## Prisma 마이그레이션

```bash
npm run db:generate
npm run db:migrate       # 로컬 개발(대화형): prisma migrate dev
# 비대화형 환경(CI 등)에서는 아래를 사용한다
npx prisma migrate deploy
```

시드 데이터(개발용 사용자 3명 — ADMIN/REVIEWER/USER)를 넣으려면:

```bash
npm run db:seed
```

## 실행 방법

```bash
npm run dev        # 개발 서버 (http://localhost:3000)
npm run build       # 프로덕션 빌드
npm run start        # 프로덕션 서버 실행
```

`npm run db:seed`로 만든 개발용 계정(admin/reviewer/user@example.com, 공통 비밀번호
`DevSeed!2026Pw`)으로 `/login`에서 로그인한다. 이 계정들은 로컬 개발 전용이며 운영
환경에서는 시딩하지 않는다 — 운영 최초 관리자는 아래 "인증·계정 관리"를 따른다.

## 인증·계정 관리

- 이메일+비밀번호 로그인, Argon2id 해싱, HttpOnly+Secure(운영)+SameSite 세션 쿠키
  (DB 기반 토큰, 12시간 만료), 더블 서브밋 쿠키 방식 CSRF 방어, 5회 실패 시 15분 계정
  잠금, 감사로그(`AuditLog`)를 갖춘 실제 인증 시스템이다(`src/lib/auth/`,
  `src/lib/security/csrf.ts`).
- **최초 관리자 생성**: `BOOTSTRAP_ADMIN_EMAIL`/`BOOTSTRAP_ADMIN_PASSWORD`/
  `BOOTSTRAP_ADMIN_NAME`을 채운 뒤 아래 명령을 실행한다. 같은 이메일의 사용자가 이미
  있으면 비밀번호를 포함해 아무 것도 바꾸지 않는다(멱등).
  ```bash
  npm run admin:create
  ```
  생성에 성공하면 **반드시** 이 세 환경변수를 배포 환경에서 제거한다. 비밀번호는 어떤
  로그에도 출력되지 않는다.
- 이후 사용자 추가/역할 변경/비활성화/임시 비밀번호 발급은 관리자가 `/admin/users`
  화면에서 수행한다. 임시 비밀번호를 발급받은 사용자는 첫 로그인 후 `/account/security`
  에서 비밀번호를 변경하기 전까지 일반 기능을 사용할 수 없다.
- 역할/활성 상태 변경, 비밀번호 변경은 기존에 발급된 세션을 즉시(다음 요청부터)
  무효화한다(`sessionVersion` 비교, `src/lib/auth/session.ts`).
- `DEV_AUTH_BYPASS=true`(로컬 개발 전용, `NODE_ENV=production`에서는 무조건 무시되고
  앱이 기동을 거부함)를 설정하면 `/login` 화면에 시드 사용자로 즉시 로그인하는 개발용
  버튼이 추가로 표시된다.

## 파일 저장소

업로드된 원본 문서 파일은 `FileStorageProvider` 인터페이스(`src/lib/storage/`)를 통해
저장한다. `STORAGE_PROVIDER=local`(기본값)은 로컬 디스크(`storage/uploads`)에 저장하며
단일 서버 개발 환경에서만 유효하다. 서버리스·다중 인스턴스로 배포할 때는
`STORAGE_PROVIDER=s3`로 설정해 AWS S3 또는 S3 호환 스토리지(Cloudflare R2, MinIO 등,
`STORAGE_S3_ENDPOINT`로 지정)를 사용해야 한다. 파싱된 조문 본문(`rawText`)은 이 저장소가
아니라 PostgreSQL에 저장되므로 검색·답변 기능은 어떤 저장소를 선택해도 동일하게
동작한다.

## 법령 문서 등록 방법

`/admin/documents/new`에서 문서명·문서 종류·관할 지역·사업 유형·공포일·시행일·발령기관·
원문 URL과 함께 `.pdf`/`.txt`/`.md`/`.docx` 파일을 업로드한다. 자세한 절차와 주의사항은
[`docs/DOCUMENT_IMPORT_GUIDE.md`](./docs/DOCUMENT_IMPORT_GUIDE.md)를 참고한다.

## Claude API 설정

`ANTHROPIC_API_KEY`와 `ANTHROPIC_MODEL`을 설정하면 `/chat`에서 검색된 조문을 근거로 한
구조화된 AI 답변이 생성된다. 설정하지 않으면 검색된 관련 조문만 표시하고 다음 안내를
보여준다: "관련 법령 자료는 검색되었으나 AI 답변 기능이 설정되지 않았습니다..."

## 임베딩 설정

`EMBEDDING_PROVIDER`를 `openai` 또는 `voyage`로 설정하고 해당 API 키를 넣으면 벡터 유사도
검색이 추가로 활성화된다. `none`(기본값)이면 정확 조문검색 + PostgreSQL Full Text
Search(키워드)만으로 동작한다. DB의 임베딩 컬럼은 `vector(1536)`(OpenAI
text-embedding-3-small 기준)으로 고정되어 있으므로, 다른 차원의 임베딩 모델을 쓰려면
마이그레이션으로 차원을 맞춰야 한다.

## 테스트 방법

```bash
npm run test              # 단위 테스트 (DB 불필요)
npm run test:integration   # 통합 테스트 (실제 PostgreSQL 필요, DATABASE_URL 사용)
npm run test:e2e           # Playwright E2E (Next 서버를 자동으로 띄워 실행, npm run db:seed 선행 필요)
npm run typecheck
npm run lint
```

`e2e/permissionAttacks.spec.ts`와 `e2e/loginSecurity.spec.ts`는 요구사항 §4·§5의 공격
시나리오(관리자 API 직접 호출, 다른 사용자 세션 추측, 계정 잠금, 역할 변경 후 세션 재사용
등)를 실제 HTTP 요청으로 검증한다. `.github/workflows/ci.yml`이 push/PR마다 lint부터
E2E까지 전 과정을 PostgreSQL+pgvector 서비스 컨테이너 위에서 실행한다.

## 법률 자문 면책

**본 서비스와 이 저장소의 모든 답변·문서는 정보 제공 목적의 검토 결과이며, 구체적인
사건에 대한 법률 자문이나 관할 행정청의 공식 판단을 대체하지 않는다.** 실제 의사결정
전에는 반드시 관할 행정청, 법률 전문가 또는 공식 유권해석을 확인해야 한다.

이 저장소의 개발/테스트용 샘플 문서에는 `[개발 테스트용 가상 문서 - 실제 법령이 아님]`
표시가 포함되어 있으며, **이 샘플 문서를 실제 법률 검토에 사용해서는 안 된다.**

## 알려진 제한사항

- **OAuth/SSO 미지원**: 이메일/비밀번호 인증만 지원한다(`docs/NEXT_STEPS.md`).
- **감사로그 조회 화면 없음**: 로그인/계정 관리 이벤트는 `AuditLog`에 기록되지만 관리자
  화면에서 조회하는 UI는 아직 없다.
- **외부 법령 API**: 국가법령정보센터 등 공식 API 연동은 구현되어 있지 않다
  (`src/lib/legal-sources/national-law-provider.ts`는 인터페이스만 준비된 상태이며 호출 시
  명확한 미설정 오류를 던진다). 관리자 업로드로만 문서를 등록할 수 있다.
- **OCR 미지원**: 스캔 PDF처럼 텍스트가 없는 문서는 등록 시 안내만 표시하고 자동으로
  텍스트를 만들어내지 않는다.
- **HWP 미지원**: HWP 원본은 직접 파싱하지 않는다. PDF/DOCX/TXT로 변환 후 등록해야 한다.
- **검색**: PostgreSQL Full Text Search는 한국어 2-gram 사전 토큰화 기반이며, 형태소
  분석기를 쓰지 않는다. 임베딩(의미 검색)은 API 키가 있을 때만 추가된다.
- **다중 조직 분리(멀티테넌시)**: 구현되어 있지 않다. 모든 문서는 하나의 조직 범위에서
  공유된다.
