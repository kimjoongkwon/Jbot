import { NextResponse } from 'next/server'
import { DuplicateFileError, ValidationError } from '../documents/errors'
import { ClaudeNotConfiguredError } from '../claude/generateAnswer'

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

  console.error(error)
  return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
}
