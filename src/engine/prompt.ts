import type { Bm25Result } from './bm25'

export interface RagPrompt {
  system: string
  userMessage: string
}

export const RAG_SYSTEM_PROMPT = `당신은 한국 도시정비사업(재개발·재건축·가로주택정비·모아타운) 관련 질문에 답변하는 AI 도우미입니다.
아래 제공되는 "참고 문서 발췌"만을 근거로 답변하세요.
- 참고 문서에 없는 내용은 추측하지 말고, 문서에서 확인할 수 없다고 명확히 답하세요.
- 답변할 때 어떤 문서를 근거로 했는지 자연스럽게 언급하세요.
- 참고 문서가 비어 있다면, 일반 지식은 참고용일 뿐 확정적 근거가 아님을 밝히고 답변하세요.`

/**
 * BM25 검색 결과를 근거 컨텍스트로 삼아 Claude에 보낼 시스템/사용자 프롬프트를 구성한다.
 */
export function buildRagPrompt(question: string, sources: Bm25Result[]): RagPrompt {
  if (sources.length === 0) {
    return {
      system: RAG_SYSTEM_PROMPT,
      userMessage: `[관련된 참고 문서를 찾지 못했습니다]\n\n질문: ${question}`,
    }
  }

  const context = sources
    .map((source, index) => `[문서 ${index + 1}: ${source.chunk.docName}]\n${source.chunk.text}`)
    .join('\n\n---\n\n')

  return {
    system: RAG_SYSTEM_PROMPT,
    userMessage: `참고 문서 발췌:\n\n${context}\n\n---\n\n질문: ${question}`,
  }
}
