import { createHash } from 'node:crypto'

/**
 * 업로드된 파일 원본 바이트를 기준으로 SHA-256 해시를 계산한다.
 * 동일 파일의 중복 업로드를 막기 위한 식별자로 사용한다.
 */
export function computeContentHash(fileBuffer: Buffer | Uint8Array): string {
  return createHash('sha256').update(fileBuffer).digest('hex')
}

/**
 * 새로 업로드된 파일의 해시가 이미 등록된 해시 목록에 존재하는지 확인한다.
 * 실제 조회는 DocumentVersion.contentHash에 대한 DB 유니크 제약으로 보강되며,
 * 이 함수는 업로드 폼에서 조기에 사용자에게 안내하기 위한 순수 판단 로직이다.
 */
export function isDuplicateHash(existingHashes: readonly string[], hash: string): boolean {
  return existingHashes.includes(hash)
}
