import { beforeEach, describe, expect, it, vi } from 'vitest'

const sendMock = vi.fn()

vi.mock('@aws-sdk/client-s3', () => {
  class FakeCommand<T> {
    constructor(public readonly input: T) {}
  }
  return {
    S3Client: vi.fn().mockImplementation((config: unknown) => ({ send: sendMock, config })),
    PutObjectCommand: class extends FakeCommand<unknown> {},
    GetObjectCommand: class extends FakeCommand<unknown> {},
    DeleteObjectCommand: class extends FakeCommand<unknown> {},
    HeadObjectCommand: class extends FakeCommand<unknown> {},
  }
})

const getSignedUrlMock = vi.fn()
vi.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: getSignedUrlMock,
}))

const { S3Client } = await import('@aws-sdk/client-s3')
const { S3FileStorageProvider } = await import('./S3FileStorageProvider')

describe('S3FileStorageProvider', () => {
  beforeEach(() => {
    sendMock.mockReset()
    getSignedUrlMock.mockReset()
    vi.mocked(S3Client).mockClear()
  })

  it('자격증명이 제공되면 client에 credentials를 전달한다', () => {
    new S3FileStorageProvider({
      bucket: 'test-bucket',
      region: 'us-east-1',
      accessKeyId: 'AKIA...',
      secretAccessKey: 'secret',
    })

    const config = vi.mocked(S3Client).mock.calls[0][0] as { credentials?: unknown }
    expect(config.credentials).toEqual({ accessKeyId: 'AKIA...', secretAccessKey: 'secret' })
  })

  it('자격증명이 없으면 credentials를 undefined로 둔다(환경변수/IAM 역할 등 SDK 기본 탐색에 위임)', () => {
    new S3FileStorageProvider({ bucket: 'test-bucket', region: 'us-east-1' })

    const config = vi.mocked(S3Client).mock.calls[0][0] as { credentials?: unknown }
    expect(config.credentials).toBeUndefined()
  })

  it('put()은 버킷·키·본문·contentType·contentDisposition을 그대로 전달한다', async () => {
    sendMock.mockResolvedValueOnce({})
    const provider = new S3FileStorageProvider({ bucket: 'test-bucket', region: 'us-east-1' })

    const result = await provider.put({
      key: 'abc-test.txt',
      buffer: Buffer.from('hello'),
      contentType: 'text/plain',
      contentDisposition: 'attachment; filename="test.txt"',
    })

    expect(result).toEqual({ key: 'abc-test.txt', size: 5, provider: 's3' })
    const sentCommand = sendMock.mock.calls[0][0] as { input: Record<string, unknown> }
    expect(sentCommand.input).toMatchObject({
      Bucket: 'test-bucket',
      Key: 'abc-test.txt',
      ContentType: 'text/plain',
      ContentDisposition: 'attachment; filename="test.txt"',
    })
  })

  it('get()은 스트림 청크를 모아 Buffer로 반환한다', async () => {
    async function* fakeBody() {
      yield Buffer.from('hel')
      yield Buffer.from('lo')
    }
    sendMock.mockResolvedValueOnce({ Body: fakeBody() })
    const provider = new S3FileStorageProvider({ bucket: 'test-bucket', region: 'us-east-1' })

    const buffer = await provider.get('abc-test.txt')
    expect(buffer.toString('utf-8')).toBe('hello')
  })

  it('get()은 Body가 없으면 오류를 던진다', async () => {
    sendMock.mockResolvedValueOnce({})
    const provider = new S3FileStorageProvider({ bucket: 'test-bucket', region: 'us-east-1' })

    await expect(provider.get('missing.txt')).rejects.toThrow('파일을 찾을 수 없습니다.')
  })

  it('exists()는 HeadObject가 성공하면 true, 실패(예: 404)하면 false를 반환한다', async () => {
    const provider = new S3FileStorageProvider({ bucket: 'test-bucket', region: 'us-east-1' })

    sendMock.mockResolvedValueOnce({})
    expect(await provider.exists('present.txt')).toBe(true)

    sendMock.mockRejectedValueOnce(new Error('NotFound'))
    expect(await provider.exists('missing.txt')).toBe(false)
  })

  it('delete()는 지정한 버킷·키로 DeleteObject를 호출한다', async () => {
    sendMock.mockResolvedValueOnce({})
    const provider = new S3FileStorageProvider({ bucket: 'test-bucket', region: 'us-east-1' })

    await provider.delete('to-delete.txt')
    const sentCommand = sendMock.mock.calls[0][0] as { input: Record<string, unknown> }
    expect(sentCommand.input).toMatchObject({ Bucket: 'test-bucket', Key: 'to-delete.txt' })
  })

  it('getSignedDownloadUrl()은 만료시간을 그대로 전달해 서명 URL을 발급한다', async () => {
    getSignedUrlMock.mockResolvedValueOnce('https://signed.example.com/abc-test.txt?sig=xyz')
    const provider = new S3FileStorageProvider({ bucket: 'test-bucket', region: 'us-east-1' })

    const url = await provider.getSignedDownloadUrl('abc-test.txt', 60)

    expect(url).toBe('https://signed.example.com/abc-test.txt?sig=xyz')
    expect(getSignedUrlMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ input: expect.objectContaining({ Bucket: 'test-bucket', Key: 'abc-test.txt' }) }),
      { expiresIn: 60 },
    )
  })
})
