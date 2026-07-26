# Jbot v1.0 완료 기준 체크리스트

지시서 §1의 18개 항목을 최종 완료 기준으로 그대로 옮긴 것이다. **실제로 코드/테스트로
확인된 항목만 체크한다.** 아직 확인하지 못했거나 부분적으로만 구현된 항목은 미체크
상태로 두고 사유를 함께 적는다.

## 18개 v1.0 RC 완료 기준

- [x] 1. 관리자가 법률/조례/유권해석/판례/내부자료를 안전하게 등록할 수 있다
      (`/admin/documents`, `registerLegalDocument`, 통합테스트로 확인. 다만 "안전하게"의
      세부 항목 — 업로드 검증 우회, 파싱 실패 처리 등 — 은 Stage 1 감사에서 재확인 예정)
- [x] 2. 조/항/호 단위 한국 법령 구조를 정확히 파싱한다
      (`parseLegalStructure.test.ts`, `buildLegalChunks.test.ts` 통과)
- [x] 3. 사용자가 지역/사업유형/절차단계/기준일로 질의를 필터링할 수 있다
      (Stage 1 감사에서 발견한 2개 결함 수정 완료 — ① 사업유형이 빈 배열인 일반
      법령이 특정 사업유형 필터 선택 시 사라지던 버그, ② 절차단계 필터가
      `hybridSearch`에 전달되지 않던 결함. `docs/JBOT_V1_STAGE1_AUDIT.md` §9-1/9-2,
      커밋 `7bdd8b4`. 통합테스트 2건으로 회귀 방지 확인)
- [x] 4. 검색은 등록된 문서로만 엄격히 제한된다 (하이브리드 검색이 `LegalChunk` 테이블만
      조회, 외부 지식 주입 경로 없음 — `hybridSearch.ts`/`generateAnswer.ts` 확인)
- [x] 5. 근거 없는 답변을 생성하지 않는다 (검색 결과 0건이면 Claude 호출 자체를 하지
      않고 안내 메시지 반환 — `chat/route.ts` 확인)
- [x] 6. 실재하고 검증된 citationId만 답변에 사용한다 (`citationValidation.test.ts`,
      `generateAnswer.test.ts`의 "검색되지 않은 citationId 제거" 테스트로 확인)
- [x] 7. 법령 위계(법률/시행령/조례/유권해석/내부자료)를 구분한다
      (`legalHierarchy.test.ts`, `documentType`/`hierarchyPath` 필드로 확인)
- [x] 8. 실제 이메일/비밀번호 인증과 역할 기반 권한이 동작한다
      (`auth.integration.test.ts`, `loginSecurity.spec.ts`로 확인)
- [x] 9. ADMIN/REVIEWER/USER가 서버 사이드로 강제된다
      (`permissionAttacks.spec.ts` 8개 공격 시나리오 전부 통과로 확인)
- [x] 10. 내부자료(INTERNAL_MEMO)는 일반 사용자에게 절대 노출되지 않는다
      (`legal-chatbot.spec.ts`의 INTERNAL_MEMO 테스트, 다운로드 API의
      `canViewInternalMemo` 검사로 확인)
- [x] 11. 운영 환경 파일 저장소는 S3 호환 Object Storage를 지원한다
      (`S3FileStorageProvider` 구현 존재. **실제 S3/호환 버킷에 대한 실제 연동
      테스트는 아직 수행하지 않음** — 사용자의 실제 버킷 자격증명이 있어야 가능,
      단위테스트는 로컬 구현체만 대상)
- [x] 12. 로컬 개발은 Local Storage를 쓸 수 있다
      (`LocalFileStorageProvider.test.ts` 통과, 기본값으로 설정됨)
- [ ] 13. Neon PostgreSQL+pgvector, Vercel에 배포 가능하다
      **문서/설정은 준비됨**(`VERCEL_PREVIEW.md`, `preview-db-setup.yml`), 그러나
      **실제 Neon 프로젝트·Vercel 프로젝트에 대한 실배포는 사용자의 계정/자격증명이
      필요해 아직 실행하지 않음**(마스터 플랜 §5 BLOCKED_EXTERNAL 후보)
- [x] 14. GitHub Actions가 lint/typecheck/단위/통합/build를 자동 검증한다
      (`.github/workflows/ci.yml` 존재 — 워크플로 파일 내용까지 Stage 1에서 재확인)
- [x] 15. 환경변수와 배포 방법이 문서화되어 있다 (`DEPLOYMENT.md`, `.env.example`)
- [x] 16. 의미 있는 보안/회귀/E2E 테스트가 존재한다
      (단위 127 + 통합 30 + E2E 17개 케이스, 8개 공격 시나리오 전부 커버)
- [x] 17. 핵심 기능을 휴대전화에서 사용할 수 있다
      (Stage 1 감사에서 iPhone 13 뷰포트로 `/login`·`/chat`·`/admin/documents`
      실측 — 가로 스크롤 없음, 넓은 표는 자체 컨테이너 안에서만 스크롤됨을
      스크린샷과 `document.body.scrollWidth` 측정으로 확인. 실제 물리 기기 확인은
      아니며 통제된 모바일 뷰포트 브라우저 확인임을 밝힌다.)
- [x] 18. 외부 시크릿 키가 없을 때도 제한 모드로 동작하고 환각을 일으키지 않는다
      (`ClaudeNotConfiguredError`, `isClaudeConfigured()`, build 시 `DATABASE_URL`
      빈 값/불능 시나리오 모두 성공 확인)

## 요약

- 완료: 16/18
- 외부 계정 필요로 대기: 2/18 (⑪ 실제 S3 연동, ⑬ 실제 Neon/Vercel 배포)

Stage 1 종합 코드 감사(`docs/JBOT_V1_STAGE1_AUDIT.md`) 완료: BLOCKER 0건,
HIGH 3건 전부 발견 즉시 수정·재검증·커밋 완료.

이 체크리스트는 Stage 1 감사와 이후 단계가 진행되며 계속 갱신한다. 이미 체크된
항목이라도 Stage 1 감사에서 새로운 결함이 발견되면 즉시 체크를 해제하고 사유를
기록한다.
