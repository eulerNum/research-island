import type { Paper, ResearchGap } from './types';
import { llmGenerate, llmGenerateJSON, llmChatWithTools, buildToolResultMessage, getLLMConfig } from './llmService';
import type { ToolDeclaration, ToolResult } from './llmService';
import { searchPapers } from './semanticScholarService';
import { deepSearch } from './deepSearchService';
import type { DeepSearchProgress } from './deepSearchService';

// ─── Types ─────────────────────────────────────────────────

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  paperCards?: PaperCard[];
  classifiedBridges?: { bridgeId: string; label: string }[];
}

export interface PaperCard {
  paper: Paper;
  relevance?: string;
  added: boolean;
}

/** Context passed to build the system prompt */
export interface ChatContext {
  entityType: 'bridge' | 'road';
  entityId: string;
  entityLabel: string;
  sourceLabel: string;
  targetLabel: string;
  direction: string;
  existingPapers: Paper[];
  gaps: ResearchGap[];
  allBridges: { id: string; sourceLabel: string; targetLabel: string; label: string }[];
  allRoads: { id: string; sourceLabel: string; targetLabel: string; label: string }[];
}

/** Callbacks for tool execution — wired to React state mutations */
export interface ToolCallbacks {
  onAddPaper: (paper: Paper) => string;
  onAddPaperToBridge: (paperId: string, bridgeId: string) => void;
  onAddPaperToRoad: (paperId: string, roadId: string) => void;
  onUpdatePaper: (paper: Paper) => void;
  onToolStatus: (status: string | null) => void;
  onDeepSearchProgress?: (progress: DeepSearchProgress) => void;
}

// ─── ApiMessage: our internal format ──────────────────────

export interface ApiMessage {
  role: 'user' | 'assistant';
  content: string;
}

// ─── SSE stream chunk types ────────────────────────────────

export type StreamChunk =
  | { type: 'text_delta'; text: string }
  | { type: 'tool_call_start'; name: string }
  | { type: 'tool_result'; name: string; papers?: Paper[]; summary?: string }
  | { type: 'deep_search_progress'; progress: DeepSearchProgress }
  | { type: 'classification'; bridges: { bridgeId: string; label: string }[] }
  | { type: 'done'; fullText: string; paperCards: PaperCard[] }
  | { type: 'error'; message: string };

// ─── Tool definitions (provider-neutral) ──────────────────

const TOOL_DECLARATIONS: ToolDeclaration[] = [
  {
    name: 'search_papers',
    description: 'Search Semantic Scholar for academic papers matching a query. Use this when the user asks to find papers related to a topic, bridge, or research question.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query for finding papers' },
        limit: { type: 'number', description: 'Max number of results (default 5)' },
      },
      required: ['query'],
    },
  },
  {
    name: 'add_paper',
    description: 'Add a specific paper to the current bridge/road. Call this when the user confirms they want to add a paper. The paper will also be auto-classified to other relevant bridges.',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        authors: { type: 'array', items: { type: 'string' } },
        year: { type: 'number' },
        journal: { type: 'string' },
        abstract: { type: 'string' },
        url: { type: 'string' },
        semantic_scholar_id: { type: 'string' },
      },
      required: ['title', 'authors', 'year'],
    },
  },
  {
    name: 'deep_search',
    description: 'Perform a deep 5-phase search for papers relevant to the current bridge/road. Use this when the user asks for thorough/deep search, or says "깊은 탐색", "자세히 찾아줘", "논문 많이 찾아줘". This takes longer (30-60 seconds) but finds more papers through citation chains, multi-angle keywords, recommendations, and author tracking.',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'summarize_paper',
    description: 'Generate an AI summary of a paper given its title and abstract.',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        authors: { type: 'array', items: { type: 'string' } },
        year: { type: 'number' },
        journal: { type: 'string' },
        abstract: { type: 'string' },
      },
      required: ['title'],
    },
  },
];

// ─── System prompt builder ─────────────────────────────────

export function buildSystemPrompt(ctx: ChatContext): string {
  const paperList = ctx.existingPapers
    .map((p) => `- "${p.title}" (${p.year}) — ${p.authors.slice(0, 2).join(', ')}${p.authors.length > 2 ? ' et al.' : ''}`)
    .join('\n') || '(없음)';

  const gapList = ctx.gaps
    .map((g) => `- ${g.description}`)
    .join('\n') || '(없음)';

  const bridgeList = ctx.allBridges
    .map((b) => `- [${b.id}] ${b.sourceLabel} → ${b.targetLabel}${b.label ? ` (${b.label})` : ''}`)
    .join('\n');

  const roadList = ctx.allRoads
    .map((r) => `- [${r.id}] ${r.sourceLabel} → ${r.targetLabel}${r.label ? ` (${r.label})` : ''}`)
    .join('\n');

  return `You are a research assistant embedded in an interactive research map application.
You help the user discover, evaluate, and organize academic papers.

IMPORTANT: Do NOT limit searches to any single discipline. The user's research map may span food science, psychology, neuroscience, design, HCI, marketing, and more. When searching for papers, actively look across disciplines. For example, if a bridge connects "emotion" and "visual elements", search psychology, neuroscience, design, and marketing — not just food science. Cross-disciplinary findings are highly valued.

## Current context
- Entity type: ${ctx.entityType}
- ${ctx.entityType === 'bridge' ? 'Bridge' : 'Road'}: "${ctx.sourceLabel}" → "${ctx.targetLabel}" (${ctx.direction})
- Label: "${ctx.entityLabel}"

## Papers already on this ${ctx.entityType}
${paperList}

## Research gaps noted
${gapList}

## All bridges in the map
${bridgeList}

## All roads in the map
${roadList}

## Your capabilities
1. **Search papers**: Use the search_papers tool to find papers on Semantic Scholar.
2. **Deep search**: Use deep_search for thorough multi-source search (S2 + OpenAlex + PubMed).
3. **Add papers**: When the user wants to add a paper, use the add_paper tool.
4. **Summarize papers**: Use summarize_paper to generate concise academic summaries.
5. **Free conversation**: Discuss research topics, explain concepts, suggest directions.

## Guidelines
- Respond in the same language the user writes in (Korean or English).
- When presenting search results, briefly explain each paper's relevance.
- When the user says "추가" or "add", use the add_paper tool.
- Keep responses concise but informative.
- Always consider cross-disciplinary papers. A bridge between two topics can be informed by research from ANY field.
- **IMPORTANT: After deep_search or search_papers, NEVER automatically call add_paper.** The search results will be shown as interactive cards with "추가" buttons. The user will decide which papers to add. Just summarize the results — do NOT add any papers unless the user explicitly asks.`;
}

// ─── Convert our messages to initial conversation format ──

function toInitialContents(apiMessages: ApiMessage[]): { role: string; parts: { text: string }[] }[] {
  return apiMessages.map((msg) => ({
    role: msg.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: msg.content }],
  }));
}

// ─── Tool execution ────────────────────────────────────────

interface ToolExecResult {
  content: string;
  papers?: Paper[];
  summary?: string;
}

async function executeTool(
  name: string,
  input: Record<string, unknown>,
  context: ChatContext,
  callbacks: ToolCallbacks,
): Promise<ToolExecResult> {
  switch (name) {
    case 'search_papers': {
      callbacks.onToolStatus('Searching Semantic Scholar...');
      try {
        const query = input.query as string;
        const limit = (input.limit as number) || 5;
        const papers = await searchPapers(query, limit);
        callbacks.onToolStatus(null);
        return {
          content: JSON.stringify(
            papers.map((p) => ({
              title: p.title,
              authors: p.authors,
              year: p.year,
              journal: p.journal,
              abstract: p.abstract?.slice(0, 300),
              url: p.url,
              semanticScholarId: p.semanticScholarId,
              citationCount: p.citationCount,
            })),
          ),
          papers,
        };
      } catch (e) {
        callbacks.onToolStatus(null);
        return { content: `Search error: ${(e as Error).message}` };
      }
    }

    case 'add_paper': {
      callbacks.onToolStatus('Adding paper...');
      const paper: Paper = {
        id: crypto.randomUUID(),
        title: input.title as string,
        authors: (input.authors as string[]) || [],
        year: (input.year as number) || new Date().getFullYear(),
        journal: (input.journal as string) || undefined,
        abstract: (input.abstract as string) || undefined,
        url: (input.url as string)
          || (input.semantic_scholar_id ? `https://www.semanticscholar.org/paper/${input.semantic_scholar_id}` : undefined),
        semanticScholarId: (input.semantic_scholar_id as string) || undefined,
        source: input.semantic_scholar_id ? 'semantic_scholar' : 'manual',
        createdAt: new Date().toISOString(),
      };

      const actualId = callbacks.onAddPaper(paper);

      if (context.entityType === 'bridge') {
        callbacks.onAddPaperToBridge(actualId, context.entityId);
      } else {
        callbacks.onAddPaperToRoad(actualId, context.entityId);
      }

      // Auto-classify to other bridges
      let classifiedBridges: { bridgeId: string; label: string }[] = [];
      try {
        classifiedBridges = await classifyPaperAcrossBridges(paper, context, callbacks);
      } catch {
        // non-fatal
      }

      callbacks.onToolStatus(null);

      const result: Record<string, unknown> = { success: true, paperId: actualId, addedTo: context.entityId };
      if (classifiedBridges.length > 0) {
        result.alsoClassifiedTo = classifiedBridges;
      }
      return { content: JSON.stringify(result) };
    }

    case 'deep_search': {
      callbacks.onToolStatus('Starting deep search...');
      try {
        const existingPaperIds = new Set(
          context.existingPapers.map((p) => p.semanticScholarId).filter((id): id is string => !!id),
        );

        const results = await deepSearch(
          {
            sourceLabel: context.sourceLabel,
            targetLabel: context.targetLabel,
            entityLabel: context.entityLabel,
            seedPapers: context.existingPapers,
            existingPaperIds,
          },
          (progress) => {
            callbacks.onToolStatus(`[Phase ${progress.phase}] ${progress.status}`);
            callbacks.onDeepSearchProgress?.(progress);
          },
        );

        callbacks.onToolStatus(null);

        const summary = results.map((r, i) =>
          `${i + 1}. "${r.paper.title}" (${r.paper.year}) — relevance: ${r.relevanceScore.toFixed(2)} — ${r.reason}`
        ).join('\n');

        return {
          content: `Deep search complete. Found ${results.length} relevant papers:\n${summary}`,
          papers: results.map((r) => r.paper),
        };
      } catch (e) {
        callbacks.onToolStatus(null);
        return { content: `Deep search error: ${(e as Error).message}` };
      }
    }

    case 'summarize_paper': {
      callbacks.onToolStatus('Generating summary...');
      try {
        const title = input.title as string;
        const abstract = (input.abstract as string) || '';
        const authors = (input.authors as string[]) || [];
        const year = input.year as number;
        const journal = (input.journal as string) || '';

        const prompt = `Summarize this academic paper in 3-5 sentences.
Cover: main research question, methodology, key findings, significance.
Concise and academic tone.

Title: ${title}
Authors: ${authors.join(', ')}
Year: ${year}
Journal: ${journal}
${abstract ? `Abstract: ${abstract}` : '(No abstract available)'}

Return ONLY the summary text.`;

        const summary = await llmGenerate('chat', [{ role: 'user', content: prompt }]);
        callbacks.onToolStatus(null);
        return { content: summary, summary };
      } catch (e) {
        callbacks.onToolStatus(null);
        return { content: `Summary error: ${(e as Error).message}` };
      }
    }

    default:
      return { content: `Unknown tool: ${name}` };
  }
}

// ─── Auto-classification ─────────────────────────────────

async function classifyPaperAcrossBridges(
  paper: Paper,
  context: ChatContext,
  callbacks: ToolCallbacks,
): Promise<{ bridgeId: string; label: string }[]> {
  const otherBridges = context.allBridges.filter((b) => b.id !== context.entityId);
  const otherRoads = context.allRoads.filter((r) => r.id !== context.entityId);
  if (otherBridges.length === 0 && otherRoads.length === 0) return [];

  const entityList = [
    ...otherBridges.map((b) => `bridge:${b.id} | ${b.sourceLabel} → ${b.targetLabel} | ${b.label}`),
    ...otherRoads.map((r) => `road:${r.id} | ${r.sourceLabel} → ${r.targetLabel} | ${r.label}`),
  ].join('\n');

  const prompt = `Given this paper:
Title: ${paper.title}
Abstract: ${paper.abstract ?? '(none)'}
Authors: ${paper.authors.join(', ')}
Year: ${paper.year}

And these research connections:
${entityList}

Which connections is this paper relevant to?
Return ONLY a JSON array: [{"type":"bridge"|"road","id":"..."}]
If none, return [].`;

  let classified: { type: string; id: string }[];
  try {
    classified = await llmGenerateJSON<{ type: string; id: string }[]>('chat', [{ role: 'user', content: prompt }]);
  } catch {
    return [];
  }

  const results: { bridgeId: string; label: string }[] = [];
  for (const item of classified) {
    if (item.type === 'bridge') {
      const bridge = context.allBridges.find((b) => b.id === item.id);
      if (bridge) {
        callbacks.onAddPaperToBridge(paper.id, item.id);
        results.push({ bridgeId: item.id, label: `${bridge.sourceLabel} → ${bridge.targetLabel}` });
      }
    } else if (item.type === 'road') {
      const road = context.allRoads.find((r) => r.id === item.id);
      if (road) {
        callbacks.onAddPaperToRoad(paper.id, item.id);
        results.push({ bridgeId: item.id, label: `${road.sourceLabel} → ${road.targetLabel}` });
      }
    }
  }

  return results;
}

// ─── Main chat function (provider-agnostic) ──────────────

export async function* streamChatMessage(
  apiMessages: ApiMessage[],
  context: ChatContext,
  callbacks: ToolCallbacks,
): AsyncGenerator<StreamChunk> {
  // Validate API key availability
  try {
    getLLMConfig();
  } catch {
    yield { type: 'error', message: 'AI API 키가 설정되지 않았습니다. AI 설정에서 키를 입력해주세요.' };
    return;
  }

  const system = buildSystemPrompt(context);
  const contents: unknown[] = toInitialContents(apiMessages);
  let fullText = '';
  const allPaperCards: PaperCard[] = [];

  // Tool use loop
  for (let round = 0; round < 5; round++) {
    let response;
    try {
      response = await llmChatWithTools('chat', contents, system, TOOL_DECLARATIONS);
    } catch (e) {
      yield { type: 'error', message: (e as Error).message };
      return;
    }

    // Yield text
    const roundText = response.textParts.join('');
    if (roundText) {
      fullText += roundText;
      yield { type: 'text_delta', text: roundText };
    }

    // If no function calls, we're done
    if (response.toolCalls.length === 0) break;

    // Add model response to conversation
    contents.push(response.rawContent);

    // Execute function calls and build responses
    const toolResults: ToolResult[] = [];

    for (const fc of response.toolCalls) {
      yield { type: 'tool_call_start', name: fc.name };

      const result = await executeTool(fc.name, fc.args, context, callbacks);

      toolResults.push({
        callId: fc.id,
        name: fc.name,
        content: result.content,
      });

      if (result.papers) {
        for (const p of result.papers) {
          allPaperCards.push({ paper: p, added: false });
        }
        yield { type: 'tool_result', name: fc.name, papers: result.papers };
      }
      if (result.summary) {
        yield { type: 'tool_result', name: fc.name, summary: result.summary };
      }
    }

    // Add function responses to conversation
    const toolResultMsg = buildToolResultMessage('chat', toolResults);
    contents.push(toolResultMsg);

    // Reset for next round
    fullText = '';
  }

  yield { type: 'done', fullText, paperCards: allPaperCards };
}

/** Get the API message format for building conversation history */
export function userMessage(text: string): ApiMessage {
  return { role: 'user', content: text };
}

export function assistantMessage(text: string): ApiMessage {
  return { role: 'assistant', content: text };
}
