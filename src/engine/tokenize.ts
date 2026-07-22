// 한글은 공백 없이 이어지는 경우가 많아 단순 공백 분리로는 검색 품질이 떨어진다.
// 한글·한자 등 CJK 구간은 2-gram(연속 2글자) 단위로, 영문/숫자는 단어 단위로 토큰화한다.
const CJK_CHAR_RE = /[ㄱ-ㆎ가-힣一-鿿]/
const LATIN_DIGIT_RE = /[a-z0-9]/

export function tokenize(text: string): string[] {
  const tokens: string[] = []
  const lower = text.toLowerCase()
  let cjkBuffer = ''

  const flushCjkBuffer = () => {
    if (cjkBuffer.length === 0) return
    if (cjkBuffer.length === 1) {
      tokens.push(cjkBuffer)
    } else {
      for (let j = 0; j < cjkBuffer.length - 1; j++) {
        tokens.push(cjkBuffer.slice(j, j + 2))
      }
    }
    cjkBuffer = ''
  }

  let i = 0
  while (i < lower.length) {
    const ch = lower[i]
    if (CJK_CHAR_RE.test(ch)) {
      cjkBuffer += ch
      i++
      continue
    }
    flushCjkBuffer()

    if (LATIN_DIGIT_RE.test(ch)) {
      let j = i
      while (j < lower.length && LATIN_DIGIT_RE.test(lower[j])) j++
      tokens.push(lower.slice(i, j))
      i = j
      continue
    }

    i++
  }
  flushCjkBuffer()

  return tokens
}
