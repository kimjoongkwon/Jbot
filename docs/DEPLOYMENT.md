# 배포 가이드

이 문서는 정비사업 법령 AI를 실제 운영 환경에 배포하는 절차를 다룬다. 애플리케이션은
상태를 저장하는 PostgreSQL(+pgvector)에 의존하는 전통적인 서버 애플리케이션이므로,
**Docker Compose 기반 자체 호스팅**을 기본 배포 방식으로 안내한다. Vercel 같은 완전
서버리스 플랫폼에 올리려면 별도의 관리형 Postgres(+pgvector)와 `STORAGE_PROVIDER=s3`
설정이 필수이며, 이 문서의 환경변수·마이그레이션 절차는 그대로 적용할 수 있다.

## 1. 구성 요소

| 구성 요소 | 설명 |
|---|---|
| `app` | Next.js 애플리케이션 (standalone 빌드) |
| `db` | PostgreSQL 16 + pgvector 확장 (`pgvector/pgvector:pg16` 이미지) |
| 파일 저장소 | `STORAGE_PROVIDER`에 따라 로컬 디스크 또는 S3 호환 오브젝트 스토리지 |

## 2. 배포 전 필수 체크리스트

- [ ] **HTTPS가 적용된 도메인이 있다.** 세션 쿠키는 프로덕션(`NODE_ENV=production`)에서
      `Secure` 속성으로 발급되므로, HTTPS가 아니면 브라우저가 쿠키를 저장하지 않아
      로그인 자체가 동작하지 않는다. 반드시 리버스 프록시(Nginx, Caddy 등) 또는 로드
      밸런서에서 TLS를 종료한 뒤 `app` 컨테이너로 프록시한다.
- [ ] `.env`에 `BOOTSTRAP_ADMIN_EMAIL`/`PASSWORD`/`NAME`을 채워 최초 관리자를 생성할
      준비가 되어 있다(§5).
- [ ] `DEV_AUTH_BYPASS`는 설정하지 않거나 `false`로 둔다. `true`인 채 프로덕션에서
      기동하면 애플리케이션이 즉시 오류를 던지며 시작되지 않는다(의도된 안전장치).
- [ ] 운영 규모에 맞는 `STORAGE_PROVIDER`를 결정했다(§6). 서버를 2대 이상 두거나
      오토스케일링/재배포가 잦다면 반드시 `s3`를 사용한다 — `local`은 컨테이너가
      재생성되면 업로드 파일이 사라진다.
- [ ] `ANTHROPIC_API_KEY`/`ANTHROPIC_MODEL`을 설정할지 결정했다(비워두면 AI 답변 없이
      검색 결과만 제공하는 축소 모드로 정상 동작한다).

## 3. 환경변수 전체 목록

`.env.example`을 복사해 `.env`를 만든다. 프로덕션에서는 이 파일을 저장소에 커밋하지
않고, 배포 환경의 시크릿 관리 도구(호스트의 `.env` 파일, Docker secrets, 클라우드
시크릿 매니저 등)로 주입한다.

| 변수 | 필수 | 설명 |
|---|---|---|
| `DATABASE_URL` | 필수 | PostgreSQL 연결 문자열 |
| `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL` | 선택 | 비우면 AI 답변 없이 검색만 동작 |
| `EMBEDDING_PROVIDER` | 선택 | `none`(기본)/`openai`/`voyage` |
| `OPENAI_API_KEY`, `OPENAI_EMBEDDING_MODEL` | 선택 | `EMBEDDING_PROVIDER=openai`일 때 |
| `VOYAGE_API_KEY`, `VOYAGE_EMBEDDING_MODEL` | 선택 | `EMBEDDING_PROVIDER=voyage`일 때 |
| `NEXT_PUBLIC_APP_NAME` | 선택 | 화면에 표시할 서비스명 |
| `MAX_UPLOAD_SIZE_MB` | 선택 | 업로드 파일 최대 크기(MB) |
| `BOOTSTRAP_ADMIN_EMAIL/PASSWORD/NAME` | 최초 1회 | §5 참고. 생성 후 반드시 제거 |
| `DEV_AUTH_BYPASS` | 개발 전용 | 프로덕션에서는 무조건 무시되고 앱이 기동 실패함 |
| `STORAGE_PROVIDER` | 선택(기본 `local`) | `local` 또는 `s3` |
| `STORAGE_LOCAL_ROOT` | `local`일 때 | 로컬 저장 경로(기본 `storage/uploads`) |
| `STORAGE_S3_BUCKET` | `s3`일 때 필수 | 버킷 이름. 비어 있으면 앱이 기동 실패함 |
| `STORAGE_S3_REGION` | `s3`일 때 | 기본 `us-east-1` |
| `STORAGE_S3_ENDPOINT` | R2/MinIO 등일 때만 | AWS S3라면 비워둔다 |
| `STORAGE_S3_FORCE_PATH_STYLE` | MinIO 등일 때만 | 기본 `false` |
| `STORAGE_S3_ACCESS_KEY_ID/SECRET_ACCESS_KEY` | `s3`일 때 | IAM 자격 증명. 컨테이너
  환경에서 IAM 역할을 쓸 수 있다면 비워두고 역할 기반 인증을 사용해도 된다 |

## 4. Docker Compose로 배포하기

저장소 루트의 `Dockerfile`은 4단계로 구성된다: `deps`(전체 의존성) → `build`(Next.js
standalone 빌드) → `migrator`(Prisma CLI 포함, 마이그레이션/관리 명령 전용) →
`runner`(실행 전용 경량 이미지). `docker-compose.yml`이 이를 그대로 사용한다.

```bash
# 1) .env 준비
cp .env.example .env
vi .env   # DATABASE_URL, BOOTSTRAP_ADMIN_*, STORAGE_* 등을 채운다

# 2) 이미지 빌드
docker compose build

# 3) DB를 먼저 띄우고 마이그레이션 적용
docker compose up -d db
docker compose run --rm migrate

# 4) 최초 관리자 생성 (BOOTSTRAP_ADMIN_* 세 값이 .env에 채워져 있어야 함)
docker compose run --rm migrate npm run admin:create
# 생성 후 .env에서 BOOTSTRAP_ADMIN_EMAIL/PASSWORD/NAME을 반드시 제거한다.

# 5) 앱 기동
docker compose up -d app
```

이후 배포 업데이트 절차(새 버전 배포)는 다음을 반복한다:

```bash
git pull
docker compose build
docker compose run --rm migrate   # 스키마 변경사항 적용
docker compose up -d app          # 무중단은 아니며, 짧은 다운타임이 발생한다
```

> **참고**: `next build`가 생성하는 `.next/standalone` 산출물(Prisma Client·쿼리 엔진
> 포함)을 `node server.js`로 직접 실행해 `/login`이 정상 응답하는 것까지는 이 저장소의
> 개발 환경에서 확인했다. 다만 이 샌드박스에서는 아웃바운드 Docker 레지스트리 접근이
> 정책상 차단되어 있어 `docker build` 자체(베이스 이미지 pull 포함)는 실행해 검증하지
> 못했다. 실제 배포 환경에서 최초 1회는 `docker compose build`가 끝까지 정상적으로
> 끝나는지 직접 확인할 것을 권장한다.

### 리버스 프록시(TLS 종료) 예시 — Caddy

```
your-domain.example {
  reverse_proxy localhost:3000
}
```

Caddy는 Let's Encrypt 인증서 발급까지 자동으로 처리한다. Nginx를 쓴다면 일반적인
`proxy_pass http://127.0.0.1:3000;` 설정에 `X-Forwarded-Proto https`를 전달하도록
구성한다.

## 5. 최초 관리자 계정 생성

일반 사용자 생성(`/admin/users`)과 달리, 첫 관리자 계정은 로그인할 방법 자체가 없는
상태에서 만들어야 하므로 별도 절차를 둔다.

1. `.env`에 `BOOTSTRAP_ADMIN_EMAIL`, `BOOTSTRAP_ADMIN_PASSWORD`(최소 10자),
   `BOOTSTRAP_ADMIN_NAME`을 채운다.
2. `npm run admin:create`(또는 Docker 환경에서
   `docker compose run --rm migrate npm run admin:create`)를 실행한다.
3. 같은 이메일의 사용자가 이미 있으면 아무 것도 바꾸지 않고(비밀번호도 덮어쓰지 않음)
   종료한다 — 여러 번 실행해도 안전하다(멱등).
4. 생성 로그에는 성공 여부와 사용자 id만 출력되며, 비밀번호는 어떤 로그에도 남지
   않는다.
5. **생성이 끝나면 즉시 `BOOTSTRAP_ADMIN_EMAIL`/`PASSWORD`/`NAME`을 배포 환경변수에서
   제거한다.** 남겨두어도 앱이 재실행 시 다시 계정을 만들지는 않지만(3번 참고),
   불필요한 평문 비밀번호를 환경변수에 남겨둘 이유가 없다.
6. 이후 추가 사용자·역할 변경·계정 잠금 해제 등은 `/admin/users` 화면에서 수행한다.

## 6. 파일 저장소 운영 전환

기본값(`STORAGE_PROVIDER=local`)은 컨테이너 로컬 디스크에 저장하며, 컨테이너가
재생성되거나 서버가 여러 대면 업로드 파일이 유실될 수 있다(`docker-compose.yml`의
`uploads` 볼륨은 단일 서버 재시작 사이의 지속성만 보장한다). 다음 조건 중 하나라도
해당하면 `STORAGE_PROVIDER=s3`로 전환한다.

- 서버 인스턴스를 2대 이상 운영하거나 오토스케일링을 사용한다.
- 서버리스/컨테이너 오케스트레이션(예: 매 배포마다 컨테이너가 새로 생성되는 환경)에
  배포한다.
- 업로드 원본 파일의 장기 보관·백업이 필요하다.

전환 절차:

1. S3 버킷(또는 R2/MinIO 등 S3 호환 스토리지) 준비.
2. `STORAGE_PROVIDER=s3`, `STORAGE_S3_BUCKET`, `STORAGE_S3_REGION`,
   (R2/MinIO라면) `STORAGE_S3_ENDPOINT`/`STORAGE_S3_FORCE_PATH_STYLE`,
   `STORAGE_S3_ACCESS_KEY_ID`/`STORAGE_S3_SECRET_ACCESS_KEY`를 설정한다.
3. 버킷을 비워둔 채로 배포해도 무방하다 — 기존에 로컬 디스크에 저장된 파일은
   자동으로 옮겨지지 않으므로(이 저장소는 원본 파일을 재조회하지 않는 감사 보관
   용도로만 쓰므로), 과거 업로드분을 반드시 이관해야 한다면 `storage/uploads`
   디렉터리를 그대로 S3 버킷에 같은 키로 업로드하면 된다.
4. `STORAGE_S3_BUCKET`을 비운 채로 `STORAGE_PROVIDER=s3`를 설정하면 앱이 기동 시점에
   바로 오류를 던진다(설정 누락을 늦게 발견하지 않도록 하는 안전장치).

## 7. 데이터베이스 백업

```bash
# 백업
docker compose exec db pg_dump -U postgres legal_chatbot > backup-$(date +%Y%m%d).sql

# 복원 (새 DB로)
docker compose exec -T db psql -U postgres legal_chatbot < backup-20260101.sql
```

pgvector 확장이 설치된 DB로 복원해야 하며, 이 저장소의 마이그레이션이 이미
`CREATE EXTENSION IF NOT EXISTS "vector"`를 포함하므로 빈 DB에 마이그레이션부터 적용한
뒤 복원하는 것이 안전하다.

## 8. 배포 후 확인

- [ ] `/login`에서 부트스트랩 관리자로 로그인되는지 확인한다.
- [ ] `/admin/users`에서 사용자를 추가하고 임시 비밀번호로 로그인 → 강제 비밀번호
      변경(`/account/security`) 흐름이 동작하는지 확인한다.
- [ ] 로그인 실패를 5회 반복해 계정 잠금이 걸리는지 확인한다(테스트 후 반드시
      `/admin/users`에서 잠금 해제하거나 시간이 지나 자동 해제되길 기다린다).
- [ ] 문서 업로드가 정상적으로 저장되는지 확인한다(`STORAGE_PROVIDER=s3`라면 버킷에
      실제로 객체가 생성되는지 콘솔에서 확인).
- [ ] HTTPS가 아닌 URL로 접근했을 때 로그인이 실패하지 않는지(즉, 실제로 HTTPS로만
      서비스되고 있는지) 확인한다.

## 9. GitHub Actions CI

`.github/workflows/ci.yml`이 push/PR마다 lint, typecheck, 단위 테스트, 통합 테스트
(PostgreSQL+pgvector 서비스 컨테이너 사용), 프로덕션 빌드, E2E(Playwright)를 실행한다.
별도의 배포 자동화(CD)는 포함되어 있지 않다 — 위 3~4번 절차를 배포 스크립트나 별도
워크플로로 연결하는 것은 이 문서의 범위를 벗어나며, 각 팀의 배포 대상(단일 서버 SSH,
쿠버네티스, PaaS 등)에 맞게 별도로 구성해야 한다.
