import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

const UPLOAD_ROOT = path.join(process.cwd(), 'storage', 'uploads')

/**
 * 검증된 업로드 파일을 storage/uploads에 원본 그대로 저장한다.
 * 파일명은 path.basename으로 한 번 더 정리해 경로 조작 가능성을 제거한다.
 */
export async function saveUploadedFile(
  buffer: Buffer,
  contentHash: string,
  originalFilename: string,
): Promise<string> {
  await mkdir(UPLOAD_ROOT, { recursive: true })
  const safeName = path.basename(originalFilename)
  const storedFilename = `${contentHash}-${safeName}`
  const fullPath = path.join(UPLOAD_ROOT, storedFilename)
  await writeFile(fullPath, buffer)
  return path.join('storage', 'uploads', storedFilename)
}
