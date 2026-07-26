-- 이전 마이그레이션(20260722154410_production_auth_and_sessions)이 인증 브랜치를
-- 병합하는 과정에서 실수로 searchVector 생성 컬럼과 GIN 인덱스를 DROP했다
-- (해당 브랜치의 schema.prisma에는 이 컬럼이 애초에 표현되어 있지 않아, Prisma가
-- drift로 착각하고 DROP 문을 생성한 것으로 추정). 그 결과 새로 `prisma migrate
-- deploy`를 실행하는 모든 환경(Neon 최초 배포, CI, 새 로컬 클론)에서 하이브리드
-- 검색의 키워드/FTS 단계가 "column searchVector does not exist" 오류로 항상
-- 실패하는 상태였다. 컬럼과 인덱스를 다시 생성해 복구한다.
ALTER TABLE "LegalChunk"
  ADD COLUMN "searchVector" tsvector
  GENERATED ALWAYS AS (to_tsvector('simple', "searchText")) STORED;

CREATE INDEX "LegalChunk_searchVector_idx" ON "LegalChunk" USING GIN ("searchVector");
