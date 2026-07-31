import { existsSync } from 'node:fs'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import type { FileStorageProvider, PutFileInput, StoredFile } from './FileStorageProvider'

/**
 * 로컬 디스크에 저장하는 개발용 구현체다. 단일 서버 인스턴스에서만 유효하며,
 * 서버리스·다중 인스턴스 배포에서는 지속성이 없으므로 운영 환경에서는
 * S3FileStorageProvider를 사용해야 한다 (요구사항 §6).
 */
export class LocalFileStorageProvider implements FileStorageProvider {
  constructor(private readonly root: string) {}

  /** key에 "../" 등이 섞여 들어와도 root 바깥으로 벗어나지 못하게 한다. */
  private resolveKeyPath(key: string): string {
    const fullPath = path.join(this.root, key)
    const normalizedRoot = path.normalize(this.root + path.sep)
    if (!path.normalize(fullPath).startsWith(normalizedRoot)) {
      throw new Error('올바르지 않은 저장소 키입니다.')
    }
    return fullPath
  }

  async put(input: PutFileInput): Promise<StoredFile> {
    const fullPath = this.resolveKeyPath(input.key)
    await mkdir(path.dirname(fullPath), { recursive: true })
    await writeFile(fullPath, input.buffer)
    return { key: input.key, size: input.buffer.length, provider: 'local' }
  }

  async get(key: string): Promise<Buffer> {
    return readFile(this.resolveKeyPath(key))
  }

  async delete(key: string): Promise<void> {
    await rm(this.resolveKeyPath(key), { force: true })
  }

  async exists(key: string): Promise<boolean> {
    return existsSync(this.resolveKeyPath(key))
  }
}
