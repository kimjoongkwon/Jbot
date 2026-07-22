import { describe, expect, it } from 'vitest'
import { HWP_NOT_SUPPORTED_MESSAGE, validateUploadFile } from './fileValidation'

const base = { maxSizeMb: 20 }

describe('validateUploadFile', () => {
  it('허용된 PDF 파일은 통과한다', () => {
    const result = validateUploadFile({
      ...base,
      filename: '도시정비법.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 1024,
    })
    expect(result.valid).toBe(true)
  })

  it('HWP 파일은 전용 안내 메시지와 함께 거부된다', () => {
    const result = validateUploadFile({
      ...base,
      filename: '규정.hwp',
      mimeType: 'application/x-hwp',
      sizeBytes: 1024,
    })
    expect(result.valid).toBe(false)
    expect(result.isHwp).toBe(true)
    expect(result.errorMessage).toBe(HWP_NOT_SUPPORTED_MESSAGE)
  })

  it('실행 파일 확장자는 거부된다', () => {
    const result = validateUploadFile({
      ...base,
      filename: 'malware.exe',
      mimeType: 'application/octet-stream',
      sizeBytes: 1024,
    })
    expect(result.valid).toBe(false)
  })

  it('이중 확장자로 실행 파일을 위장해도 거부된다', () => {
    const result = validateUploadFile({
      ...base,
      filename: '규정.pdf.exe',
      mimeType: 'application/pdf',
      sizeBytes: 1024,
    })
    expect(result.valid).toBe(false)
  })

  it('경로 조작 문자가 포함된 파일명은 거부된다', () => {
    expect(
      validateUploadFile({ ...base, filename: '../../etc/passwd.txt', mimeType: 'text/plain', sizeBytes: 10 })
        .valid,
    ).toBe(false)
    expect(
      validateUploadFile({ ...base, filename: '..\\windows\\system32.txt', mimeType: 'text/plain', sizeBytes: 10 })
        .valid,
    ).toBe(false)
  })

  it('확장자와 MIME 타입이 일치하지 않으면 거부된다', () => {
    const result = validateUploadFile({
      ...base,
      filename: '규정.pdf',
      mimeType: 'text/plain',
      sizeBytes: 1024,
    })
    expect(result.valid).toBe(false)
  })

  it('허용 크기를 초과하면 거부된다', () => {
    const result = validateUploadFile({
      ...base,
      filename: '규정.txt',
      mimeType: 'text/plain',
      sizeBytes: 21 * 1024 * 1024,
    })
    expect(result.valid).toBe(false)
    expect(result.errorMessage).toContain('20MB')
  })

  it('빈 파일은 거부된다', () => {
    const result = validateUploadFile({ ...base, filename: '규정.txt', mimeType: 'text/plain', sizeBytes: 0 })
    expect(result.valid).toBe(false)
  })

  it('지원하지 않는 확장자는 거부된다', () => {
    const result = validateUploadFile({
      ...base,
      filename: '규정.hwpx',
      mimeType: 'application/octet-stream',
      sizeBytes: 1024,
    })
    expect(result.valid).toBe(false)
    expect(result.isHwp).toBe(true)
  })
})
