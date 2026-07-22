import path from 'node:path'
import { getEnv } from '../env'
import type { FileStorageProvider } from './FileStorageProvider'
import { LocalFileStorageProvider } from './LocalFileStorageProvider'
import { S3FileStorageProvider } from './S3FileStorageProvider'

export type { FileStorageProvider, PutFileInput, StoredFile } from './FileStorageProvider'

let cachedProvider: FileStorageProvider | null = null

/** STORAGE_PROVIDER 환경변수에 따라 로컬/S3 구현체를 선택한다 (요구사항 §6). */
export function getFileStorageProvider(env = getEnv()): FileStorageProvider {
  if (cachedProvider) return cachedProvider

  if (env.STORAGE_PROVIDER === 's3') {
    cachedProvider = new S3FileStorageProvider({
      bucket: env.STORAGE_S3_BUCKET,
      region: env.STORAGE_S3_REGION,
      endpoint: env.STORAGE_S3_ENDPOINT.trim() || undefined,
      forcePathStyle: env.STORAGE_S3_FORCE_PATH_STYLE,
      accessKeyId: env.STORAGE_S3_ACCESS_KEY_ID.trim() || undefined,
      secretAccessKey: env.STORAGE_S3_SECRET_ACCESS_KEY.trim() || undefined,
    })
  } else {
    cachedProvider = new LocalFileStorageProvider(path.join(process.cwd(), env.STORAGE_LOCAL_ROOT))
  }

  return cachedProvider
}
