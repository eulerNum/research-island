import type { Paper } from './types';
import { llmGenerate } from './llmService';

/** Generate a 3-5 sentence summary of a paper. */
export async function summarizePaper(paper: Paper): Promise<string> {
  const abstractSection = paper.abstract
    ? `Abstract:\n${paper.abstract}`
    : '(No abstract available — summarize based on title and metadata only)';

  const prompt = `You are a research assistant. Summarize the following academic paper in 3-5 sentences.
Cover: (1) main research question, (2) methodology, (3) key findings, (4) significance.
Write in English, concise and academic tone.

Title: ${paper.title}
Authors: ${paper.authors.join(', ')}
Year: ${paper.year}
Journal: ${paper.journal ?? 'Unknown'}
${abstractSection}

Return ONLY the summary text, no formatting or headers.`;

  return llmGenerate('summary', [{ role: 'user', content: prompt }], { maxTokens: 512 });
}
