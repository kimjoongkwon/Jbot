# 아키텍처

## 전체 아키텍처

```
┌──────────────┐     ┌──────────────────────┐     ┌────────────────────┐
│  브라우저     │ ── │  Next.js App Router   │ ── │  PostgreSQL         │
│  /chat, /admin│     │  (Route Handlers +    │     │  + pgvector        │
│              │     │   Server Components)  │     │  + Full Text Search │
└──────────────┘     └──────────────────────┘     └────────────────────┘
                              │
                    ┌─────────┴─────────┐
                    │                   │
             ┌──────▼─────┐     ┌───────▼────────┐
             │ Anthropic  │     │ OpenAI/Voyage   │
             │ Claude API │     │ Embeddings API  │
             │ (선택)     │     │ (선택)          │
             └────────────┘     └────────────────┘
```

- 프론트엔드: Next.js App Router의 Server Component(목록/상세)와 소수의 Client
  Component("use client" — 업로드 폼, 채팅 입력, 관리자 액션 버튼)로 구성. Tailwind CSS로
  스타일링.
- 백엔드: Next.js Route Handler(`src/app/api/**/route.ts`)가 API 엔드포인트를 제공하며,
  실제 로직은 `src/lib/**`의 순수 함수/서비스 모듈에 위치한다(라우트는 얇은 어댑터 역할).
- 데이터베이스: PostgreSQL 하나에 관계형 데이터(Prisma 모델)와 pgvector 임베딩,
  PostgreSQL Full Text Search용 생성 컬럼(tsvector)을 함께 둔다. 별도 검색 엔진(Elasticsearch
  등)을 두지 않고 PostgreSQL 하나로 하이브리드 검색을 구현했다.
- 외부 서비스: Claude API(답변 생성), 임베딩 API(OpenAI/Voyage, 선택)는 모두 인터페이스로
  분리되어 있어(`EmbeddingProvider`, `LegalSourceProvider`) 키가 없어도 앱이 정상 동작한다.

## 문서 처리 흐름

```
업로드(admin/documents/new)
  → validateUploadFile (확장자/MIME/크기/파일명/경로조작/실행파일 검증)
  → computeContentHash → 중복 확인 (DocumentVersion.contentHash unique)
  → saveUploadedFile (storage/uploads/에 원본 보존)
  → extractText (txt/md 직접 읽기, pdf: pdf-parse, docx: mammoth)
      → 텍스트가 거의 없으면(스캔 문서) NO_TEXT_EXTRACTED로 중단, 추측 없음
  → LegalDocument + DocumentVersion 레코드 생성 (status: PROCESSING)
  → runIngestionPipeline (IngestionJob으로 진행 상태 추적)
      → parseLegalStructure: 장/절/조/조의N/항(원문자)/호/목/별표/부칙 파싱
      → buildLegalChunks: 조문 단위 청크, maxArticleChars 초과 시 항 단위로 분할
      → (임베딩 설정 시) embed() → pgvector 컬럼에 저장
      → LegalChunk 테이블에 저장 (hierarchyPath, searchText 포함)
  → 성공 시 LegalDocument.status = ACTIVE, 실패 시 ERROR (원본·rawText는 보존)
```

재처리(`reprocessDocumentVersion`)는 기존 LegalChunk를 지우고 다시 생성하되, DocumentVersion
자체(원본 파일, rawText)는 덮어쓰지 않는다. 새 버전 등록(`registerDocumentVersion`)은 기존
버전을 건드리지 않고 새 DocumentVersion을 추가한다.

## 검색 흐름 (하이브리드 검색, `src/lib/search/hybridSearch.ts`)

1. **후보 좁히기**: `status = ACTIVE`인 LegalDocument 중 지역(`isJurisdictionMatch`)·
   사업유형·문서종류가 맞는 것만 선택. 기준일이 주어지면 `pickApplicableVersion`으로 그
   시점에 유효한 DocumentVersion 하나만, 아니면 `isCurrent` 버전만 후보에 넣는다.
2. **정확 조문 검색**: `extractArticleQuery`로 질문에서 "제35조", "도시정비법 제39조" 같은
   패턴을 추출해 articleNumber가 일치하는 chunk에 최고 점수를 부여한다.
3. **키워드/FTS 검색**: `tokenize`로 질문을 한국어 2-gram + 영문/숫자 단어로 토큰화한 뒤
   `to_tsquery('simple', ...)`로 `LegalChunk.searchVector`(생성 컬럼, GIN 인덱스)를 조회하고
   `ts_rank`로 점수를 매긴다.
4. **벡터 검색(선택)**: 임베딩 공급자가 설정된 경우, 질문을 임베딩해 pgvector의 코사인
   거리(`<=>`)로 후보 chunk를 재정렬한다.
5. **병합·정리**: 세 방식의 점수 중 최고값을 채택하고, 법령 위계(`legalHierarchyBoost`)를
   작은 가중치로 더한다. 동일 조문(동일 documentVersionId+articleNumber) 결과가 과도하게
   포함되지 않도록 그룹당 최대 2개로 제한하고, 최종 8~12개(기본 10개)로 자른다.

## Claude 답변 생성 흐름 (`src/lib/claude/generateAnswer.ts`)

1. 검색된 chunk에 `C1`, `C2`... citationId를 부여하고 `buildAnswerContext`로 원문을
   `<<< >>>`로 감싼 참고자료 텍스트를 구성한다(프롬프트 인젝션 방지, 아래 참고).
2. `LEGAL_ANSWER_SYSTEM_PROMPT`(법령 위계 구분, 근거 한정 답변, citationId 연결, 인젝션
   무시 등 원칙 포함)와 함께 Claude Messages API를 호출한다.
3. 응답을 JSON으로 파싱하고 `LegalAnswerSchema`(Zod)로 검증한다. 실패하면 한 번만
   재시도한다.
4. `validateCitations`로 서버가 실제 검색 결과에 없는 citationId(허위 인용)를 제거하고,
   `legalBasis`(핵심 근거)에 허위 인용이 있었다면 답변 신뢰도를 `LOW`로 하향한다
   (`src/app/api/chat/route.ts`).
5. Claude가 설정되지 않았거나 검색 결과가 0건이면 Claude를 호출하지 않고 각각 미설정
   안내/근거 없음 문구를 직접 반환한다(비용 절감 + 응답 일관성).

## 인용 검증

- `buildAnswerContext`가 부여한 citationId 집합만 "유효"하다.
- `validateCitations`(순수 함수, 테스트 있음)가 `legalBasis[].citationId`와
  `analysis[].citationIds[]`를 검사해 유효 집합에 없는 것을 제거한다.
- 핵심 근거(`legalBasis`)에서 하나라도 제거되면 `hadCoreInvalidCitation = true`가 되고,
  호출부(`/api/chat`)에서 confidence를 `LOW`로 강제 하향한다.
- 제거된 citationId는 사용자에게 보여주지 않는다(허위 인용을 조용히 숨김).

## 보안 구조

- API 키(Claude, 임베딩)는 서버 환경변수로만 관리하고 클라이언트에 절대 전달하지 않는다.
- 서버 오류는 `toErrorResponse`(`src/lib/http/errorResponse.ts`)를 통해 도메인 오류만
  메시지를 노출하고, 그 외에는 stack trace 없이 일반 오류 메시지만 반환한다(서버 로그에는
  기록).
- 업로드 파일은 `validateUploadFile`로 확장자/MIME/크기/파일명(경로 조작 문자, 실행 파일
  확장자)을 검증한다.
- 업로드 문서 내용은 절대 실행되지 않는다(텍스트 추출만 수행, 스크립트 실행 없음). Claude
  프롬프트에서도 문서 내용은 `<<< >>>`로 감싸 "데이터"로만 취급하도록 시스템 프롬프트에
  명시한다.
- `INTERNAL_MEMO` 문서 종류는 `hybridSearch`의 `includeInternalMemo` 옵션으로 일반 사용자
  검색에서 제외할 수 있게 구조화되어 있다.
- 문서 비활성화는 soft delete(`status: INACTIVE`)이며, 하드 삭제 API는 제공하지 않는다.
- 감사로그(`AuditLog`)에는 API 키나 질문 원문 등 민감 정보를 저장하지 않고, 작업 종류·
  대상·수행자만 기록한다.
