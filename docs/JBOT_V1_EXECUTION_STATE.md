# Jbot v1.0 실행 상태 (Execution State)

**이 문서는 매 단계 종료 후 갱신한다.** 새 Claude 세션이 이 문서만 읽고 바로 이어서
작업할 수 있도록, 추측 없이 사실만 기록한다.

마지막 갱신: Stage 4(파일 저장소) 완료 직후

## 현재 단계

Stage 1(종합 코드 감사) + Stage 2(실제 인증 재검증) + Stage 3(공격 시나리오) +
Stage 4(파일 저장소) 모두 완료 → **§8 이후(Stage 5+) 지시서 내용 대기 중**

## 완료된 항목

- [x] PR #3("Vercel Preview 배포 호환 및 Neon 초기화 구성") `main` 병합 확인
- [x] `main` 최신화, 미커밋 파일 없음 확인, 브랜치 `claude/jbot-v1-production-completion-v1` 생성
- [x] `claude/production-auth-storage-v1`(실제 인증/저장소 구현 브랜치)을 병합(`--no-commit --no-ff`),
      충돌 8개 파일 전부 수동 해결, 자동 병합 파일도 직접 재확인, 병합 커밋 `8fd4971`
- [x] 병합 후 로컬 DB 재구성(`legal_chatbot_v1`), `.env` 재작성, `prisma migrate deploy` 적용
- [x] `npm run lint` — 클린
- [x] 병합 직후 typecheck 오류 2건 발견·수정 (`src/lib/env.test.ts`의 폐기된
      `SESSION_SECRET` 제거 + 신규 `Env` 필드 추가, `previewReadiness.integration.test.ts`의
      폐기된 `createSessionCookieValue` → `createSession()` 교체) — 커밋 `faccd0f`
- [x] 로컬 DB 마이그레이션 이력 drift 발견·복구: `legal_chunk_search_support` 마이그레이션이
      "적용됨"으로 기록돼 있었으나 `searchVector` 컬럼/GIN 인덱스가 실제로는 없어
      통합테스트 7건 실패 → 수동으로 `ALTER TABLE ... ADD COLUMN "searchVector" ...`,
      `CREATE INDEX ...` 실행해 스키마를 마이그레이션 파일과 일치시킴(로컬 DB 한정 조치,
      코드/마이그레이션 파일 자체는 변경 없음)
- [x] 전체 검증 1회차: 단위테스트 127 passed, 통합테스트 26 passed, build 3개 시나리오
      (DATABASE_URL 빈값/불능/정상) 전부 성공, E2E 14 passed / 1 skipped(Claude 키 필요)
- [x] `docs/JBOT_V1_MASTER_PLAN.md`, `docs/JBOT_V1_EXECUTION_STATE.md`(이 문서),
      `docs/JBOT_V1_ACCEPTANCE_CHECKLIST.md` 작성
- [x] Stage 3 공격 시나리오 8개 중 엔드포인트 자체가 없어 테스트 불가능했던 2개
      ("다운로드 URL 직접 입력", "감사로그 URL 직접 입력") 발견 → 최소 범위로
      기능 신설:
      - `GET /api/documents/:id/versions/:versionId/download` (ADMIN/REVIEWER,
        INTERNAL_MEMO는 `canViewInternalMemo`로 추가 검사, 감사로그 기록)
      - `GET /api/admin/audit-log` + `/admin/audit-log` 화면(ADMIN 전용, REVIEWER는
        레이아웃 공통 게이트를 통과해도 페이지 자체 검사로 차단)
      - `e2e/permissionAttacks.spec.ts`에 두 시나리오 테스트 추가 → §7의 8개
        공격 시나리오 전부(8/8) 통과 확인
      - `tests/integration/downloadAndAuditLog.integration.test.ts` 신설(4 tests)
      - 커밋 `e337140`
- [x] 전체 검증 2회차(Stage 3 보완 후): lint 클린, typecheck 클린, 통합테스트 30
      passed, E2E 16 passed / 1 skipped
- [x] **Stage 1: 종합 코드 감사 완료** (`docs/JBOT_V1_STAGE1_AUDIT.md`) — 지시서
      §5의 ~20개 영역을 실제 코드/쿼리/화면 캡처로 확인. BLOCKER 0건, HIGH 3건
      발견 즉시 수정:
      1. `hybridSearch`의 businessTypes 필터가 빈 배열(사업유형 미지정 = 전체
         적용 의도)인 일반 법령을 특정 사업유형 선택 시 완전히 숨기던 버그를
         실제 DB 쿼리로 재현·확인 후 `OR isEmpty/has` 패턴으로 수정
      2. 절차단계(procedureStage) 필터가 `ChatSession`에 저장만 되고
         `hybridSearch`에 전혀 전달되지 않던 결함 — `LegalDocument.procedureStages`
         필드 신설(마이그레이션 `20260726120000_legal_document_procedure_stages`)
         후 등록폼→API→검색까지 전체 경로 연결(프런트엔드는 이미 값을 보내고
         있었음)
      3. (Stage 3에서 이미 다룬 다운로드/감사로그 엔드포인트 부재도 이 감사
         목록에 포함해 §16/§17 항목으로 재기록)
      모바일 뷰포트(iPhone 13, 390px) 실측: `/login`·`/chat`·`/admin/documents`
      가로 스크롤 없음, 넓은 표는 자체 컨테이너 안에서만 스크롤 확인
      (`document.body.scrollWidth === innerWidth`)
      커밋 `7bdd8b4`. 전체 검증 3회차: lint/typecheck 클린, 단위 127 + 통합 32
      passed(신규 필터 회귀 테스트 2건 포함), build 3개 시나리오 모두 성공,
      E2E 16 passed / 1 skipped
- [x] **BLOCKER 발견·수정: 마이그레이션 체인이 searchVector를 삭제하는 버그.**
      Stage 1 감사 도중 "로컬 DB 이력 drift"로 처음 기록했던 현상을 완전히 새
      DB(`legal_chatbot_migration_test`)에 마이그레이션 5개를 처음부터 적용해
      재현한 결과, 실제로는 병합된 `20260722154410_production_auth_and_sessions`
      마이그레이션이 `searchVector` 컬럼/GIN 인덱스를 DROP하는 SQL을 포함하고
      있어서 **모든 신규 배포(Neon 최초 배포, CI, 새 클론)에서 하이브리드 검색의
      키워드/FTS 단계가 항상 실패**하는 상태였음을 확인. 신규 마이그레이션
      `20260726123000_restore_legal_chunk_search_vector`로 컬럼을 복구(기존
      마이그레이션 파일은 다른 곳에 이미 적용됐을 수 있어 수정하지 않음). 로컬
      dev DB를 완전히 삭제 후 5개 마이그레이션으로 처음부터 재구성해 재검증:
      단위 127 + 통합 32 passed, build 성공, E2E 16 passed/1 skipped.
- [x] **Stage 2 재검증 완료**: 지시서 §6 체크리스트를 코드로 하나씩 재확인.
      세션고정 방지(`login/route.ts`가 항상 새 토큰 발급, 기존 쿠키 재사용 없음),
      마지막 ADMIN 보호(`admin/users/[id]/route.ts`의 `hasOtherActiveAdmin` —
      역할변경·비활성화 양쪽 모두 차단), 비밀번호 변경 시 다른 세션 자동 무효화
      (`account/password/route.ts`), 관리자 발급 임시비밀번호가 항상 무작위 생성
      (`generateTemporaryPassword`, 고정 기본값 없음), 비밀번호 없는 기존 계정은
      로그인 자체가 항상 거부(`passwordHash` nullable, 자동 백필 없음),
      DEV_AUTH_BYPASS가 환경변수 검증(`assertDevAuthBypassSafety`)과 라우트 자체
      (`isDevAuthBypassEnabled() → 404`) 이중으로 프로덕션 차단됨을 모두 코드
      직접 확인으로 재검증. 추가 결함 없음.
- [x] **PR #4 생성 + 실제 GitHub Actions CI 최초 검증**: `ci.yml`이 지금까지
      `main`에 병합된 적이 없어 실제로 실행된 적이 없었음을 발견(사용자 확인 후
      PR 생성). 첫 실행에서 E2E 잡이 17개 테스트 전부
      `browserType.launch: Failed to launch chromium because executable doesn't
      exist at /opt/pw-browsers/chromium`로 실패 — `playwright.config.ts`가 개발에
      쓰인 특정 샌드박스 환경에만 존재하는 Chromium 경로를 무조건
      `executablePath`로 지정하고 있었음(GitHub Actions 러너에는 그 경로가 없어
      `playwright install`로 설치한 브라우저를 무시하고 있었음). 그 경로가 실제
      존재할 때만 지정하고 없으면 Playwright 기본 브라우저 탐색을 쓰도록 수정,
      재푸시 후 CI 두 잡(Lint·Typecheck·Unit·Integration·Build / E2E) 모두
      success 확인. 이 브랜치가 실제 GitHub Actions 검증을 통과한 것은 이번이
      처음이다.
- [x] **Stage 4(파일 저장소) 완료**: 지시서 §8 원문의 이어지는 부분을 끝내
      받지 못해, 사용자의 "계속 진행" 지시에 따라 이미 병합된
      `FileStorageProvider`/`Local`/`S3` 구현을 Stage 1과 같은 수준으로 자체
      재감사했다. 실제 결함 2건 발견·수정:
      1. `S3FileStorageProvider.getSignedDownloadUrl()`이 완전히 구현돼 있었지만
         앱 어디에서도 호출되지 않아 죽은 코드였음 — 운영(S3) 환경에서도 다운로드
         API가 항상 파일 전체를 서버 메모리로 읽어 프록시하고 있었다(대용량 파일에
         비효율적). 다운로드 라우트가 `getSignedDownloadUrl`을 지원하는 저장소에서는
         60초 만료 서명 URL로 302 리다이렉트하고, 미지원(Local)에서는 기존대로
         버퍼 프록시하도록 수정. 업로드 시 `ContentDisposition`을 S3 객체 메타데이터로
         함께 저장해, 서명 URL로 직접 접속해도 원본 파일명이 유지되게 함
         (`PutFileInput.contentDisposition` 필드 신설).
      2. `S3FileStorageProvider`에 단위테스트가 전혀 없었음 — AWS SDK를 모킹해
         put/get/delete/exists/getSignedDownloadUrl 8개 테스트 신설
         (`S3FileStorageProvider.test.ts`), 라우트 레벨 리다이렉트 동작도 통합
         테스트로 신설(`downloadSignedUrl.integration.test.ts`).
      `docs/ARCHITECTURE.md`에 다운로드 흐름 설명 추가.
      검증: lint/typecheck 클린, 단위 135(+8) + 통합 33(+1) passed, build 성공,
      E2E 16 passed/1 skipped.

## 진행 중인 항목

없음 (다음 작업 대기 상태)

## 실패했던 명령과 해결

| 명령 | 실패 원인 | 해결 |
|---|---|---|
| `npm run test:integration` (1회차) | 로컬 DB에 `searchVector` 생성 컬럼 없음(`column "searchVector" does not exist`, code 42703) | `_prisma_migrations`에는 적용 완료로 기록되어 있었으나 실제 DDL 미적용 상태였음. `psql`로 직접 `ALTER TABLE`/`CREATE INDEX` 실행해 복구, 재실행 시 통과 |
| `npx tsc --noEmit` (병합 직후) | `env.test.ts`의 `SESSION_SECRET` 필드(폐기됨), `previewReadiness.integration.test.ts`의 `createSessionCookieValue`(폐기됨) | 두 파일을 병합된 `Env`/`session.ts` API에 맞게 수정 |

## 남은 블로커

없음 (BLOCKED_EXTERNAL 항목은 마스터 플랜 §5 참조 — 실제 Vercel/Neon/S3/Claude
운영 계정·키가 필요한 최종 배포 실행 단계에서만 발생 예정, 아직 그 단계에 도달하지 않음)

## 마지막 커밋

```
(다음 커밋 예정) feat: Stage 4 완료 — 다운로드 서명 URL 리다이렉트 + S3 provider 테스트
5da6360 fix: E2E가 GitHub Actions CI에서 항상 실패하던 원인 수정 (Chromium 경로 하드코딩)
33b4949 docs: Stage 2(실제 인증) 재검증 완료 기록
4453675 fix: 병합된 마이그레이션이 searchVector를 삭제하던 BLOCKER 버그 복구
bfa8651 docs: Stage 1 종합 코드 감사 결과 + 완료체크리스트/실행상태 갱신
7bdd8b4 fix: 사업유형/절차단계 필터가 일반 법령을 숨기는 결함 수정 + 절차단계 필터 신설
```

브랜치는 `origin/claude/jbot-v1-production-completion-v1`에 푸시 완료.
PR #4(`claude/jbot-v1-production-completion-v1` → `main`)가 열려 있음, GitHub
Actions CI 두 잡 모두 success 확인됨. **자동 병합하지 않았음 — 사용자 확인 후
수동 병합 필요.**

## 다음 액션 (새 세션이 이어받을 경우 그대로 실행)

1. Stage 1~4 모두 완료됨 — 근거는 각 섹션의 "완료된 항목"과
   `docs/JBOT_V1_STAGE1_AUDIT.md` 참고.
2. PR #4가 열려 있고 CI green 상태다. 사용자가 병합을 명시적으로 요청하면
   병합하고(자동 병합 금지, 항상 명시적 요청 확인), 요청 전까지는 열어 둔다.
3. 지시서 §8 이후(Stage 5+) 내용은 아직 수신하지 못했다 — 사용자가 이어지는
   지시를 주면 그 내용에 따라 진행한다.
4. 사용자가 실제 Neon/Vercel/S3 계정과 자격증명을 제공하면(마스터 플랜 §5
   BLOCKED_EXTERNAL), 문서·코드는 이미 준비되어 있으므로 바로 실배포 단계로
   진행할 수 있다.
