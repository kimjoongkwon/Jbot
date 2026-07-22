import { NextResponse } from 'next/server'
import { DuplicateFileError, ValidationError } from '../documents/errors'
import { ClaudeNotConfiguredError } from '../claude/generateAnswer'
import { CsrfError } from '../security/csrf'

/**
 * 서버 오류의 stack trace를 사용자에게 노출하지 않는다 (요구사항 §14).
 * 예상된 도메인 오류(검증 실패, 중복, 미설정)는 원인 메시지를 그대로
 * 전달하고, 그 외 예상하지 못한 오류는 서버 로그에만 기록한다.
 */
export function toErrorResponse(error: unknown): NextResponse {
  if (error instanceof ValidationError || error instanceof DuplicateFileError) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }
  if (error instanceof ClaudeNotConfiguredError) {
    return NextResponse.json({ error: error.message, code: 'CLAUDE_NOT_CONFIGURED' }, { status: 200 })
  }
  if (error instanceof CsrfError) {
    return NextResponse.json({ error: error.message }, { status: 403 })
  }

  console.error(error)
  return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
}

/** 임시 비밀번호 등으로 비밀번호 변경이 강제된 사용자가 일반 기능 API를 호출할 때 반환한다. */
export function mustChangePasswordResponse(): NextResponse {
  return NextResponse.json(
    { error: '비밀번호를 변경해야 계속 이용할 수 있습니다.', code: 'MUST_CHANGE_PASSWORD' },
    { status: 403 },
  )
}
