import type { Paper } from './types';
import { llmGenerate } from './llmService';

/** Generate a 3-5 sentence summary of a paper. */
export async function summarizePaper(paper: Paper): Promise<string> {
  const abstractSection = paper.abstract
    ? `Abstract:\n${paper.abstract}`
    : '(No abstract available — summarize based on title and metadata only)';

  const prompt = `You are a research assistant helping a food science researcher study academic papers.
Analyze the following paper and return a structured summary in EXACTLY this markdown format.
모든 내용은 한국어로 작성하라. 고유명사·학술 기법명만 영어 원문 병기 가능.

## 한줄 요약
[핵심 기여를 1문장으로]

## 연구 프레임
- **대상(Subject)**: 무엇을/누구를 연구했는가
- **과업(Task)**: 어떤 문제 또는 목표를 다루는가
- **시스템(System)**: 어떤 방법론/도구/모델/절차를 사용했는가
- **검증(Validation)**: 어떻게 효과를 측정하거나 검증했는가

## 주요 발견
- [결과 bullet 2~4개, 수치/통계 포함]

---
Paper info:
Title: ${paper.title}
Authors: ${paper.authors.join(', ')}
Year: ${paper.year}
Journal: ${paper.journal ?? 'Unknown'}
${abstractSection}

Return ONLY the markdown above. Do not add any text before or after.`;

  return llmGenerate('summary', [{ role: 'user', content: prompt }], { maxTokens: 900 });
}
