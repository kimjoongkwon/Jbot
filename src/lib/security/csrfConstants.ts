// node:crypto 등 서버 전용 의존성이 없는 순수 상수 모듈이다. 클라이언트
// 컴포넌트(csrf.ts를 직접 import하면 node:crypto가 브라우저 번들에 섞여
// 빌드가 실패한다)와 서버 코드가 공통으로 이 값들만 가져다 쓸 수 있게 분리했다.
export const CSRF_COOKIE_NAME = 'jk_csrf_token'
export const CSRF_HEADER_NAME = 'x-csrf-token'
export const CSRF_FORM_FIELD_NAME = 'csrfToken'
