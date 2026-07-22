export class ValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ValidationError'
  }
}

export class DuplicateFileError extends Error {
  constructor(message = '이미 등록된 파일입니다 (동일한 내용의 문서가 이미 존재합니다).') {
    super(message)
    this.name = 'DuplicateFileError'
  }
}
