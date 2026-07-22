import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { LocalFileStorageProvider } from './LocalFileStorageProvider'

describe('LocalFileStorageProvider', () => {
  let root: string
  let provider: LocalFileStorageProvider

  beforeEach(() => {
    root = mkdtempSync(path.join(tmpdir(), 'storage-test-'))
    provider = new LocalFileStorageProvider(root)
  })

  afterEach(() => {
    rmSync(root, { recursive: true, force: true })
  })

  it('저장한 파일을 그대로 다시 읽을 수 있다', async () => {
    const buffer = Buffer.from('hello world')
    const stored = await provider.put({ key: 'abc-test.txt', buffer })

    expect(stored.size).toBe(buffer.length)
    expect(stored.provider).toBe('local')
    expect(await provider.get('abc-test.txt')).toEqual(buffer)
  })

  it('존재 여부를 정확히 반환한다', async () => {
    expect(await provider.exists('missing.txt')).toBe(false)
    await provider.put({ key: 'present.txt', buffer: Buffer.from('x') })
    expect(await provider.exists('present.txt')).toBe(true)
  })

  it('삭제한 파일은 더 이상 존재하지 않는다', async () => {
    await provider.put({ key: 'to-delete.txt', buffer: Buffer.from('x') })
    await provider.delete('to-delete.txt')
    expect(await provider.exists('to-delete.txt')).toBe(false)
  })

  it('키에 경로 조작(../)이 섞여 있으면 저장소 바깥으로 벗어나지 못하고 오류를 던진다', async () => {
    await expect(provider.put({ key: '../outside.txt', buffer: Buffer.from('x') })).rejects.toThrow()
    await expect(provider.get('../../etc/passwd')).rejects.toThrow()
  })
})
