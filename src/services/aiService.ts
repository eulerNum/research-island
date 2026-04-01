import type { Paper, Bridge, Road, ResearchGap } from './types';

const CONFIG_KEY = 'claude-api-config';

export interface ClaudeConfig {
  apiKey: string;
}

export function getClaudeConfig(): ClaudeConfig | null {
  const raw = localStorage.getItem(CONFIG_KEY);
  if (!raw) return null;
  return JSON.parse(raw) as ClaudeConfig;
}

export function setClaudeConfig(config: ClaudeConfig): void {
  localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
}

export interface AISuggestion {
  title: string;
  authors: string[];
  year: number;
  journal?: string;
  url?: string;
  relevance: string; // one-sentence explanation
  addressesGap?: string; // which gap it addresses
}

function buildPrompt(
  sourceLabel: string,
  targetLabel: string,
  entityLabel: string,
  existingPapers: Paper[],
  gaps: ResearchGap[],
): string {
  const existingTitles = existingPapers.map((p) => `- ${p.title} (${p.year})`).join('\n') || '(none)';
  const gapDescs = gaps.map((g) => `- ${g.description}`).join('\n') || '(none)';

  return `You are a food science research assistant specializing in sensory science.

Context:
- Research bridge: "${sourceLabel}" → "${targetLabel}"
- Bridge description: "${entityLabel}"
- Existing papers on this bridge:
${existingTitles}
- Research gaps noted:
${gapDescs}

Task:
1. Search for academic papers that investigate the relationship between "${sourceLabel}" (as input) and "${targetLabel}" (as output/result).
2. Focus on papers that describe experimental methods, analytical frameworks, or validated hypotheses for this input→output process.
3. Exclude papers already listed above.
4. For each suggested paper, provide:
   - Title, Authors (comma-separated), Year, Journal
   - DOI link (if known)
   - One-sentence explanation of how it contributes to this bridge
   - Which research gap (if any) it partially addresses

Return EXACTLY in this JSON format (no markdown, no extra text):
[
  {
    "title": "Paper Title",
    "authors": ["Author1", "Author2"],
    "year": 2024,
    "journal": "Journal Name",
    "url": "https://doi.org/...",
    "relevance": "One sentence about contribution",
    "addressesGap": "Gap description or null"
  }
]

Return up to 5 most relevant papers, ranked by relevance to this bridge. Return only the JSON array.`;
}

export async function suggestPapers(
  config: ClaudeConfig,
  entity: Bridge | Road,
  sourceLabel: string,
  targetLabel: string,
  existingPapers: Paper[],
  gaps: ResearchGap[],
): Promise<AISuggestion[]> {
  const prompt = buildPrompt(
    sourceLabel,
    targetLabel,
    entity.label ?? '',
    existingPapers,
    gaps,
  );

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': config.apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2048,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      (err as { error?: { message?: string } }).error?.message ??
        `Claude API error: ${res.status}`,
    );
  }

  const data = await res.json();
  const text: string = data.content?.[0]?.text ?? '[]';

  // Extract JSON from response (handle possible markdown wrapping)
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) return [];

  const parsed = JSON.parse(jsonMatch[0]) as AISuggestion[];
  return parsed;
}

/** Generate a 3-5 sentence summary of a paper using Claude Haiku. */
export async function summarizePaper(
  config: ClaudeConfig,
  paper: Paper,
): Promise<string> {
  const abstractSection = paper.abstract
    ? `Abstract:\n${paper.abstract}`
    : '(No abstract available — summarize based on title and metadata only)';

  const prompt = `You are a food science research assistant. Summarize the following academic paper in 3-5 sentences.
Cover: (1) main research question, (2) methodology, (3) key findings, (4) significance.
Write in English, concise and academic tone.

Title: ${paper.title}
Authors: ${paper.authors.join(', ')}
Year: ${paper.year}
Journal: ${paper.journal ?? 'Unknown'}
${abstractSection}

Return ONLY the summary text, no formatting or headers.`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': config.apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      (err as { error?: { message?: string } }).error?.message ??
        `Claude API error: ${res.status}`,
    );
  }

  const data = await res.json();
  return (data.content?.[0]?.text ?? '').trim();
}
