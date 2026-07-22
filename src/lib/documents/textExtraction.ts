export interface ExtractionResult {
  status: 'SUCCESS' | 'NO_TEXT_EXTRACTED' | 'FAILED'
  text: string
  errorMessage: string | null
}

export const SCANNED_DOCUMENT_MESSAGE =
  '텍스트를 추출할 수 없는 스캔 문서입니다. OCR 처리 또는 텍스트 변환본 등록이 필요합니다.'

const MIN_MEANINGFUL_CHARS = 20

function getExtension(filename: string): string {
  const lower = filename.toLowerCase()
  const idx = lower.lastIndexOf('.')
  return idx === -1 ? '' : lower.slice(idx)
}

/**
 * 업로드 파일(txt/md/pdf/docx)에서 원문 텍스트를 추출한다.
 * 텍스트가 거의 없는(스캔 PDF 등) 경우 잘못된 내용을 만들지 않고
 * NO_TEXT_EXTRACTED 상태로 안내 메시지를 반환한다.
 */
export async function extractText(
  buffer: Buffer,
  filename: string,
): Promise<ExtractionResult> {
  const extension = getExtension(filename)

  try {
    let text = ''

    if (extension === '.txt' || extension === '.md') {
      text = buffer.toString('utf-8')
    } else if (extension === '.pdf') {
      const { default: pdfParse } = await import('pdf-parse')
      const result = await pdfParse(buffer)
      text = result.text
    } else if (extension === '.docx') {
      const mammoth = await import('mammoth')
      const result = await mammoth.extractRawText({ buffer })
      text = result.value
    } else {
      return {
        status: 'FAILED',
        text: '',
        errorMessage: `지원하지 않는 파일 형식입니다: ${extension}`,
      }
    }

    const trimmed = text.trim()
    if (trimmed.length < MIN_MEANINGFUL_CHARS) {
      return { status: 'NO_TEXT_EXTRACTED', text: '', errorMessage: SCANNED_DOCUMENT_MESSAGE }
    }

    return { status: 'SUCCESS', text: trimmed, errorMessage: null }
  } catch (error) {
    return {
      status: 'FAILED',
      text: '',
      errorMessage: error instanceof Error ? error.message : '텍스트 추출 중 알 수 없는 오류가 발생했습니다.',
    }
  }
}
