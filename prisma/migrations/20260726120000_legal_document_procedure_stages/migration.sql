-- 문서가 적용되는 정비사업 절차단계를 관리자가 태그할 수 있게 한다.
-- businessTypes와 동일하게 빈 배열은 "모든 절차단계에 적용"을 의미한다
-- (검색 필터 쪽 로직은 hybridSearch.ts에서 처리).
ALTER TABLE "LegalDocument" ADD COLUMN "procedureStages" "ProcedureStage"[] NOT NULL DEFAULT ARRAY[]::"ProcedureStage"[];
