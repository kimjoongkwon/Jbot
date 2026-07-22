# 제이봇 (jbot)

한국 도시정비사업(재개발·재건축) 관련 질문에 답변하는 **대화형 AI 챗봇**.
사용자가 업로드한 문서(규정·절차 등)를 근거로 답변하는 RAG(검색 증강 생성) 방식이다.

PPA-V2, telegram-ai와는 완전히 별개의 독립 프로젝트다.

## 특징

- **오프라인 단일 HTML**: `npm run build` 후 `dist/index.html` 파일 하나만 있으면 실행 가능
  (서버 불필요, 더블클릭으로 브라우저에서 바로 열림)
- **문서 기반 RAG**: 사용자가 업로드한 `.txt`/`.md` 문서를 문단 단위로 청크 분할 → 질문 시
  BM25 키워드 검색으로 관련 청크를 찾아 Claude에게 근거로 제공
- **개인 API 키 방식**: 별도 백엔드 서버가 없으므로, 각 사용자가 본인의 Claude API 키를
  브라우저에 직접 입력한다. 키는 해당 브라우저의 `localStorage`에만 저장되며, Claude API
  호출 시에만 Anthropic 서버로 직접 전송된다 (다른 서버나 사람에게 전달되지 않음)

## 알려진 한계

- 단일 HTML 오프라인 구조 특성상 API 키를 코드/네트워크 요청에서 완전히 숨길 수 없다.
  이 저장소는 "각자 자신의 키를 입력해 사용하는 개인 도구"를 전제로 하며, 여러 명이 공유
  파일을 주고받는 경우 비밀번호 등의 보호 장치는 제공하지 않는다.
- 업로드 문서는 브라우저 `localStorage`에 저장된다. 브라우저 저장 용량 제한(수 MB 수준)이
  있으므로 매우 큰 문서는 나눠서 업로드해야 할 수 있다.
- 검색은 임베딩 기반 의미 검색이 아닌 BM25 키워드 검색이다. 문서에 등장하지 않는 동의어·
  유사 표현으로 질문하면 관련 청크를 찾지 못할 수 있다.
- 대화 맥락은 유지되지 않는다 (질문마다 새로 검색해 단발성으로 답변). 대화 기록은 새로고침
  시 초기화된다.
- 현재 `.txt`, `.md` 파일만 지원한다 (PDF/DOCX 미지원).

## 스택

- React + TypeScript + Vite
- 상태관리: Zustand
- 빌드 산출물: `vite-plugin-singlefile`로 단일 HTML 파일 생성

## 폴더 구조

```
src/engine/       순수 함수 (문서 청크 분할, 토큰화, BM25 검색, RAG 프롬프트 구성)
src/services/     Claude API 호출 (브라우저에서 직접 호출, 부수효과 있음)
src/store/        Zustand 스토어 (문서/API 키/대화 상태)
src/components/   화면 (문서 관리, API 키 설정, 채팅창)
```

## 개발 명령어

```
npm install
npm run dev       # 개발 서버
npm run build     # tsc -b && vite build (단일 HTML 파일로 출력)
npm run preview   # 빌드 결과 미리보기
npm run test      # vitest 단위 테스트
npm run lint      # oxlint
```

## 사용 방법

1. `npm run build` 실행 후 `dist/index.html`을 배포(또는 `npm run dev`로 로컬 실행)
2. 브라우저에서 열고, 좌측 사이드바에서 본인의 Claude API 키 입력
3. 근거로 사용할 문서(.txt, .md)를 업로드
4. 하단 입력창에 질문 입력
