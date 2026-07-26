import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import type { FileStorageProvider, PutFileInput, StoredFile } from './FileStorageProvider'

export interface S3FileStorageConfig {
  bucket: string
  region: string
  /** S3 호환 스토리지(Cloudflare R2, MinIO 등)를 쓸 때만 지정한다. AWS S3라면 비워둔다. */
  endpoint?: string
  forcePathStyle?: boolean
  accessKeyId?: string
  secretAccessKey?: string
}

/**
 * S3 호환 오브젝트 스토리지 구현체다. AWS S3뿐 아니라 endpoint를 지정하면
 * R2/MinIO 등 S3 API 호환 스토리지에도 그대로 쓸 수 있다.
 */
export class S3FileStorageProvider implements FileStorageProvider {
  private readonly client: S3Client
  private readonly bucket: string

  constructor(config: S3FileStorageConfig) {
    this.bucket = config.bucket
    this.client = new S3Client({
      region: config.region,
      endpoint: config.endpoint,
      forcePathStyle: config.forcePathStyle,
      credentials:
        config.accessKeyId && config.secretAccessKey
          ? { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey }
          : undefined,
    })
  }

  async put(input: PutFileInput): Promise<StoredFile> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: input.key,
        Body: input.buffer,
        ContentType: input.contentType,
      }),
    )
    return { key: input.key, size: input.buffer.length, provider: 's3' }
  }

  async get(key: string): Promise<Buffer> {
    const result = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }))
    if (!result.Body) {
      throw new Error('파일을 찾을 수 없습니다.')
    }
    const chunks: Buffer[] = []
    for await (const chunk of result.Body as AsyncIterable<Uint8Array>) {
      chunks.push(Buffer.from(chunk))
    }
    return Buffer.concat(chunks)
  }

  async delete(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }))
  }

  async exists(key: string): Promise<boolean> {
    try {
      await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }))
      return true
    } catch {
      return false
    }
  }

  async getSignedDownloadUrl(key: string, expiresInSeconds: number): Promise<string> {
    const command = new GetObjectCommand({ Bucket: this.bucket, Key: key })
    return getSignedUrl(this.client, command, { expiresIn: expiresInSeconds })
  }
}
