export interface FileValidationInput {
  filename: string
  mimeType: string
  sizeBytes: number
  maxSizeMb: number
}

export interface FileValidationResult {
  valid: boolean
  errorMessage: string | null
  isHwp: boolean
}

const ALLOWED_MIME_BY_EXTENSION: Record<string, string[]> = {
  '.pdf': ['application/pdf'],
  '.txt': ['text/plain'],
  '.md': ['text/markdown', 'text/x-markdown', 'text/plain'],
  '.docx': ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
}

const HWP_EXTENSIONS = new Set(['.hwp', '.hwpx'])

const EXECUTABLE_EXTENSIONS = new Set([
  '.exe',
  '.sh',
  '.bat',
  '.cmd',
  '.msi',
  '.dll',
  '.bin',
  '.app',
  '.jar',
  '.ps1',
  '.com',
  '.scr',
  '.vbs',
  '.js',
  '.jsx',
  '.apk',
])

export const HWP_NOT_SUPPORTED_MESSAGE =
  '현재 HWP 원본 파일의 직접 분석은 지원하지 않습니다. PDF, DOCX 또는 TXT로 변환하여 등록해 주세요.'

function getExtension(filename: string): string {
  const lower = filename.toLowerCase()
  const idx = lower.lastIndexOf('.')
  if (idx === -1) return ''
  return lower.slice(idx)
}

function hasPathTraversal(filename: string): boolean {
  return (
    filename.includes('..') ||
    filename.includes('/') ||
    filename.includes('\\') ||
    filename.includes('\0')
  )
}

/**
 * 업로드 파일명·MIME·크기를 검증한다. 확장자 허용 목록(.pdf/.txt/.md/.docx)에
 * 없는 파일은 모두 거부되므로 실행 파일도 자연히 차단되지만, 사용자에게
 * 원인을 명확히 전달하기 위해 HWP·실행 파일은 별도 메시지를 반환한다.
 */
export function validateUploadFile(input: FileValidationInput): FileValidationResult {
  const { filename, mimeType, sizeBytes, maxSizeMb } = input

  if (!filename || filename.trim().length === 0) {
    return { valid: false, errorMessage: '파일명이 비어 있습니다.', isHwp: false }
  }
  if (filename.length > 255) {
    return { valid: false, errorMessage: '파일명이 너무 깁니다.', isHwp: false }
  }
  if (hasPathTraversal(filename)) {
    return { valid: false, errorMessage: '파일명에 허용되지 않는 경로 문자가 포함되어 있습니다.', isHwp: false }
  }

  const extension = getExtension(filename)

  if (HWP_EXTENSIONS.has(extension)) {
    return { valid: false, errorMessage: HWP_NOT_SUPPORTED_MESSAGE, isHwp: true }
  }

  if (EXECUTABLE_EXTENSIONS.has(extension)) {
    return { valid: false, errorMessage: '실행 파일 형식은 업로드할 수 없습니다.', isHwp: false }
  }

  const allowedMimeTypes = ALLOWED_MIME_BY_EXTENSION[extension]
  if (!allowedMimeTypes) {
    return {
      valid: false,
      errorMessage: '지원하지 않는 파일 형식입니다. (.pdf, .txt, .md, .docx만 등록 가능)',
      isHwp: false,
    }
  }

  if (!allowedMimeTypes.includes(mimeType)) {
    return {
      valid: false,
      errorMessage: `파일 확장자(${extension})와 실제 파일 형식(${mimeType})이 일치하지 않습니다.`,
      isHwp: false,
    }
  }

  if (sizeBytes <= 0) {
    return { valid: false, errorMessage: '빈 파일은 업로드할 수 없습니다.', isHwp: false }
  }

  const maxBytes = maxSizeMb * 1024 * 1024
  if (sizeBytes > maxBytes) {
    return {
      valid: false,
      errorMessage: `파일 크기가 허용 한도(${maxSizeMb}MB)를 초과했습니다.`,
      isHwp: false,
    }
  }

  return { valid: true, errorMessage: null, isHwp: false }
}
