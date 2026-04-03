import type { Paper } from './types';
import { llmGenerateJSON } from './llmService';

/** Jaccard similarity on space-split tokens (0~1). Handles Korean naturally. */
function jaccardSim(a: string, b: string): number {
  const tok = (s: string) =>
    new Set(s.toLowerCase().replace(/[^\w\s가-힣]/g, '').split(/\s+/).filter(Boolean));
  const A = tok(a);
  const B = tok(b);
  let inter = 0;
  A.forEach((w) => { if (B.has(w)) inter++; });
  const union = new Set([...A, ...B]).size;
  return union === 0 ? 0 : inter / union;
}

function isDuplicate(suggestion: string, existing: string[]): boolean {
  return existing.some((e) => jaccardSim(suggestion, e) >= 0.35);
}

export interface GapSuggestion {
  description: string;
  relatedPaperIds: string[];
  dimension: string;
  rationale: string;
}

function buildPaperContext(paper: Paper): string {
  const header = `ID: ${paper.id}\nTitle: ${paper.title} (${paper.year ?? '?'}${paper.journal ? ', ' + paper.journal : ''})`;

  if (paper.aiSummary) {
    // Strip markdown headers and use as structured coverage info
    const summary = paper.aiSummary
      .replace(/^## .+$/gm, '')
      .replace(/\*\*/g, '')
      .replace(/^- /gm, '  - ')
      .trim();
    return `${header}\nCoverage:\n${summary}`;
  }

  if (paper.abstract) {
    return `${header}\nAbstract: ${paper.abstract.slice(0, 600)}${paper.abstract.length > 600 ? '...' : ''}`;
  }

  return `${header}\n(abstract not available)`;
}

export async function analyzeGaps(params: {
  sourceLabel: string;
  targetLabel: string;
  direction: string;
  papers: Paper[];
  existingGapDescriptions: string[];
}): Promise<GapSuggestion[]> {
  const { sourceLabel, targetLabel, direction, papers, existingGapDescriptions } = params;

  // Sort: papers with AI summary first, then with abstract, then title-only
  const sorted = [...papers].sort((a, b) => {
    const score = (p: Paper) => (p.aiSummary ? 2 : p.abstract ? 1 : 0);
    return score(b) - score(a);
  });
  const selected = sorted.slice(0, 15);

  const paperBlock = selected.map(buildPaperContext).join('\n\n---\n\n');

  const existingBlock = existingGapDescriptions.length > 0
    ? existingGapDescriptions.map((d) => `- ${d}`).join('\n')
    : '(없음)';

  const dirLabel = direction === 'forward' ? '→ (forward)' : '← (backward)';

  const prompt = `You are a research analyst identifying gaps in academic literature.

## Research Bridge
${sourceLabel} ${dirLabel} ${targetLabel}
This bridge represents studies examining the relationship between "${sourceLabel}" and "${targetLabel}".

## Papers on this bridge (${selected.length}개):

${paperBlock}

## Already identified gaps (중복 제안 금지):
${existingBlock}

## Analysis task:
Think step by step:

Step 1 — Coverage mapping: For each paper, identify what it covers across:
- Methodology (기법/도구)
- Material/Population (재료/대상/집단)
- Scale (실험실/파일럿/산업)
- Variables (독립변수 × 종속변수 조합)
- Mechanism (현상 기술 vs 메커니즘 설명)

Step 2 — Gap identification: What patterns of absence exist?
- Which methodology hasn't been applied to this topic?
- What populations/materials/conditions haven't been studied?
- What scale hasn't been explored?
- What variable combinations are missing?
- What mechanisms remain unexplained?

Step 3 — Prioritize 3–5 most significant, distinct gaps.

Return ONLY valid JSON array (no text outside the array):
[
  {
    "description": "...(한국어로. 구체적 연구 방향을 2~3문장으로. 어떤 연구가 필요한지 명확히)",
    "relatedPaperIds": ["paper-id-1"],
    "dimension": "방법론 | 대상/재료 | 스케일 | 측정변수 | 메커니즘 | 기타",
    "rationale": "...(한국어로. 왜 이 갭이 중요한지 한 줄)"
  }
]`;

  try {
    const result = await llmGenerateJSON<GapSuggestion[]>('deepSearch', [
      { role: 'user', content: prompt },
    ]);
    if (!Array.isArray(result)) return [];
    const valid = result.filter(
      (s) => s && typeof s.description === 'string' && typeof s.dimension === 'string',
    );
    return valid.filter((s) => !isDuplicate(s.description, existingGapDescriptions));
  } catch {
    return [];
  }
}
