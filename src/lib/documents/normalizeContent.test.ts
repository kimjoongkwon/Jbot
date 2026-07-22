import { describe, expect, it } from 'vitest'
import { normalizeContent } from './normalizeContent'

describe('normalizeContent', () => {
  it('CRLF를 LF로 통일한다', () => {
    expect(normalizeContent('가\r\n나')).toBe('가\n나')
  })

  it('연속 공백/탭을 하나로 줄인다', () => {
    expect(normalizeContent('가   나\t\t다')).toBe('가 나 다')
  })

  it('3줄 이상 빈 줄은 2줄로 줄인다', () => {
    expect(normalizeContent('가\n\n\n\n나')).toBe('가\n\n나')
  })

  it('앞뒤 공백을 제거한다', () => {
    expect(normalizeContent('  가나다  ')).toBe('가나다')
  })
})
