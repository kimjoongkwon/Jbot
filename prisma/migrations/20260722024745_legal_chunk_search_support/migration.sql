-- Full Text Search: LegalChunk.searchText(한국어 대응 2-gram 토큰 문자열)를
-- tsvector로 변환하는 생성 컬럼과 GIN 인덱스를 추가한다.
-- 'simple' 설정을 쓰는 이유: searchText가 애플리케이션 단에서 이미
-- 한글 2-gram/영문 단어로 토큰화되어 저장되므로, 한국어 형태소 분석 없이도
-- 어간 추출(stemming) 없는 단순 일치 검색으로 충분하다.
ALTER TABLE "LegalChunk"
  ADD COLUMN "searchVector" tsvector
  GENERATED ALWAYS AS (to_tsvector('simple', "searchText")) STORED;

CREATE INDEX "LegalChunk_searchVector_idx" ON "LegalChunk" USING GIN ("searchVector");

-- pgvector 코사인 거리 연산(<=>)은 인덱스 없이도 순차 스캔으로 동작한다.
-- MVP 단계의 데이터 규모(수천 chunk 이하)에서는 ANN 인덱스 없이도 충분히
-- 빠르므로, ivfflat/hnsw 인덱스 생성은 docs/NEXT_STEPS.md의 후속 작업으로 남긴다.
