# RAG 답변 정책

이 문서는 챗봇이 답변을 만들 때 지키는 규칙을 정리한다. 실제 구현은
`src/lib/claude/systemPrompt.ts`(Claude 시스템 프롬프트)와 `src/app/api/chat/route.ts`
(검색·답변·인용 검증 흐름)에 있다.

## 등록 자료 한정 답변

- Claude는 검색된 chunk(참고자료)만 근거로 답변하도록 시스템 프롬프트에 명시되어 있다.
  "제공된 참고자료 안에서만 답변하고, 존재하지 않는 조문이나 사실을 만들지 마세요."
- 검색 결과가 0건이면 **Claude를 호출하지 않고** 서버가 직접 다음 문구를 반환한다(비용
  절감 + 항상 동일한 문구 보장):

  > "등록된 법령·조례와 검토자료에서는 이 질문에 대한 명확한 근거를 확인하지 못했습니다.
  > 관할 행정청, 법률 전문가 또는 추가 유권해석 자료 확인이 필요합니다."

## 법령 위계

`src/lib/search/legalHierarchy.ts`에 다음 순서로 위계를 정의한다(숫자가 낮을수록 상위).

1. 법률 (LAW)
2. 대통령령/시행령 (PRESIDENTIAL_DECREE)
3. 부령/시행규칙 (MINISTERIAL_ORDINANCE)
4. 조례 (LOCAL_ORDINANCE)
5. 조례 시행규칙 (LOCAL_RULE)
6. 행정규칙·고시 (ADMINISTRATIVE_RULE)
7. 법령해석·유권해석 (OFFICIAL_INTERPRETATION)
8. 판례·행정심판 (COURT_CASE, ADMINISTRATIVE_APPEAL)
9. 내부 검토자료 (INTERNAL_MEMO)
10. 기타 (OTHER)

- 검색 점수에는 위계를 작은 가중치(`legalHierarchyBoost`)로만 반영해, 관련도 점수를
  뒤집지 않으면서 동률일 때 상위 법령을 우대한다.
- Claude 시스템 프롬프트는 "하위 규범을 상위 법령과 동일한 효력을 가진 것처럼 표현하지
  말 것"을 명시하고, 관련 조문 카드에도 문서 종류 라벨을 항상 표시한다.

## 기준일 적용

- 사용자가 기준일을 선택하면(기본값: 오늘), `pickApplicableVersion`이 그 날짜에
  `effectiveFrom` ≤ 기준일 ≤ `effectiveTo`(또는 종료일 없음)를 만족하는 버전만 검색
  대상으로 삼는다.
- 기준일을 만족하는 버전이 여러 개면 `effectiveFrom`이 가장 최근인 것을 선택한다.
- 답변의 근거 조문 카드에는 항상 시행일과 "현행/개정 전·이력" 여부를 표시해, 개정 전
  버전이 인용되었을 때 사용자가 알 수 있게 한다.

## 지역 필터

- 전국 공통 법령(`jurisdictionType = NATIONAL`)은 지역 선택과 무관하게 항상 검색된다.
- 지역을 선택하지 않았거나 "전국"을 선택하면 지역 조례는 검색되지 않는다(임의로 특정
  지역 조례를 끌어오지 않음).
- 특정 지역을 선택하면 그 지역의 광역/기초자치단체 조례만 검색되고, 다른 지역 조례는
  제외된다(`isJurisdictionMatch`, 단위 테스트·통합 테스트로 검증됨).

## 근거 없는 답변 방지 (citationId 검증)

- Claude 응답의 `legalBasis[].citationId`, `analysis[].citationIds[]`는 서버가 실제 검색
  결과에 부여한 citationId 집합과 대조해 검증한다(`validateCitations`).
- 검색 결과에 없는 citationId(허위 인용)는 결과에서 조용히 제거된다.
- 핵심 근거(`legalBasis`)에 허위 인용이 하나라도 있었다면, 답변 신뢰도를 자동으로 `LOW`로
  하향하고 그 사실을 `confidenceReason`에 덧붙인다.

## 신뢰도 산정

- Claude가 스스로 `HIGH`/`MEDIUM`/`LOW`와 그 이유(`confidenceReason`)를 함께 반환하도록
  요구한다.
- 서버는 다음 경우 신뢰도를 강제로 `LOW`로 재조정한다.
  - 핵심 근거에 허위 인용(citationId 불일치)이 포함된 경우
  - 검색된 참고자료가 아예 없어 "근거 없음" 답변을 반환하는 경우
- 낮은 신뢰도 답변은 관리자 대시보드에서 집계되어(`lowConfidenceAnswers`) 검토 대상이
  된다.

## 면책 문구

모든 구조화 답변에는 `disclaimer` 필드가 고정 문구로 포함된다(시스템 프롬프트에서 강제):

> "본 답변은 등록된 자료를 기반으로 한 정보 제공용 검토 결과이며, 구체적인 사건에 대한
> 법률 자문이나 관할 행정청의 공식 판단을 대체하지 않습니다."

화면에도 답변의 마지막 항목("9. 안내")으로 항상 표시된다.
