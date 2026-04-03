import type { Paper } from './types';
import { llmGenerateJSON } from './llmService';
import {
  searchPapers,
  getPaperReferences,
  getPaperCitations,
  getRecommendations,
} from './semanticScholarService';
import { searchOpenAlex, getCitedBy as oaCitedBy, searchByVenue } from './openAlexService';
import { searchPubMed } from './pubmedService';

// ─── Types ─────────────────────────────────────────────────

export interface DeepSearchContext {
  sourceLabel: string;
  targetLabel: string;
  entityLabel: string;
  seedPapers: Paper[];
  existingPaperIds: Set<string>;
}

export interface DeepSearchScores {
  topical: number;
  methodological: number;
  directApplicability: number;
  reviewValue: number;
}

export interface DeepSearchResult {
  paper: Paper;
  phase: number;
  scores: DeepSearchScores;
  relevanceScore: number; // weighted average
  reason: string;
  filterLog?: string[];
}

export interface DeepSearchProgress {
  phase: number;
  phaseName: string;
  status: string;
  found: number;
  total: number;
}

// ─── Helpers ───────────────────────────────────────────────

function dedup(papers: Paper[], existing: Set<string>): Paper[] {
  const seen = new Set<string>();
  const results: Paper[] = [];
  for (const p of papers) {
    if (p.semanticScholarId && existing.has(p.semanticScholarId)) continue;
    const key = p.semanticScholarId ?? `${p.title.toLowerCase().trim()}|${p.year}`;
    if (seen.has(key)) continue;
    seen.add(key);
    results.push(p);
  }
  return results;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function collectS2Ids(papers: Paper[]): Set<string> {
  return new Set(papers.map((p) => p.semanticScholarId).filter((id): id is string => !!id));
}

function weightedScore(s: DeepSearchScores): number {
  return s.directApplicability * 0.4 + s.topical * 0.3 + s.methodological * 0.2 + s.reviewValue * 0.1;
}

/** Extract keywords from bridge labels for lexical overlap check */
function extractKeywords(ctx: DeepSearchContext): Set<string> {
  const text = `${ctx.sourceLabel} ${ctx.targetLabel} ${ctx.entityLabel}`.toLowerCase();
  const words = text.split(/\s+/).filter((w) => w.length > 2);
  return new Set(words);
}

/** Score a paper's lexical overlap with bridge keywords */
function lexicalOverlap(paper: Paper, keywords: Set<string>): number {
  const text = `${paper.title} ${paper.abstract ?? ''}`.toLowerCase();
  let hits = 0;
  for (const kw of keywords) {
    if (text.includes(kw)) hits++;
  }
  return keywords.size > 0 ? hits / keywords.size : 0;
}

// ─── Phase 0: Query Framing + Pseudo-seed ──────────────────

interface QueryFraming {
  concepts: string[];
  synonyms: string[];
  domainTags: string[];
  queries: { broad: string; exact: string; method: string; crossDomain: string };
}

async function phase0PseudoSeed(
  ctx: DeepSearchContext,
  existingIds: Set<string>,
  onProgress: (p: DeepSearchProgress) => void,
): Promise<{ seeds: Paper[]; framing: QueryFraming }> {
  onProgress({ phase: 0, phaseName: 'Query Framing', status: 'AI가 핵심 개념 + 검색어 생성 중...', found: 0, total: 0 });

  // Ask Gemini to frame the research question
  const framingPrompt = `You are a cross-disciplinary research expert.

Given this research connection:
- Source: "${ctx.sourceLabel}"
- Target: "${ctx.targetLabel}"
- Relationship: "${ctx.entityLabel}"

Extract and return a JSON object (no markdown):
{
  "concepts": ["core concept 1", "core concept 2", "core concept 3"],
  "synonyms": ["synonym/related term for each concept"],
  "domainTags": ["relevant fields: e.g., psychology, neuroscience, HCI, food science, marketing"],
  "queries": {
    "broad": "broad search query covering the general relationship",
    "exact": "precise query with specific technical terms",
    "method": "query focused on methods/measurements used to study this",
    "crossDomain": "query that looks for this pattern in a completely different domain"
  }
}`;

  let framing: QueryFraming;
  try {
    framing = await llmGenerateJSON<QueryFraming>('deepSearch', [{ role: 'user', content: framingPrompt }]);
  } catch {
    framing = {
      concepts: [ctx.sourceLabel, ctx.targetLabel],
      synonyms: [],
      domainTags: [],
      queries: {
        broad: `${ctx.sourceLabel} ${ctx.targetLabel}`,
        exact: `"${ctx.sourceLabel}" "${ctx.targetLabel}" relationship`,
        method: `${ctx.sourceLabel} ${ctx.targetLabel} measurement method`,
        crossDomain: `${ctx.sourceLabel} ${ctx.targetLabel} cross-disciplinary`,
      },
    };
  }

  // Search all 4 queries across 3 sources
  const allQueries = Object.values(framing.queries);
  const allPapers: Paper[] = [];

  for (let i = 0; i < allQueries.length; i++) {
    const q = allQueries[i];
    onProgress({
      phase: 0, phaseName: 'Query Framing',
      status: `[${i + 1}/4] "${q.slice(0, 40)}..." — S2+OA+PM`,
      found: allPapers.length, total: allPapers.length,
    });

    const [s2, oa, pm] = await Promise.allSettled([
      searchPapers(q, 15),
      searchOpenAlex(q, 15),
      searchPubMed(q, 10),
    ]);

    if (s2.status === 'fulfilled') allPapers.push(...s2.value);
    if (oa.status === 'fulfilled') allPapers.push(...oa.value);
    if (pm.status === 'fulfilled') allPapers.push(...pm.value);
    await delay(300);
  }

  const unique = dedup(allPapers, existingIds);

  // Select pseudo-seeds: score by citation + recency + diversity
  const currentYear = new Date().getFullYear();
  const scored = unique.map((p) => {
    const citScore = Math.min((p.citationCount ?? 0) / 100, 1);
    const recencyScore = Math.max(0, 1 - (currentYear - p.year) / 20);
    const isReview = (p.title.toLowerCase().includes('review') || p.title.toLowerCase().includes('survey')) ? 0.3 : 0;
    return { paper: p, score: citScore * 0.4 + recencyScore * 0.4 + isReview * 0.2 };
  });
  scored.sort((a, b) => b.score - a.score);

  // Take top 12, ensuring source diversity (no more than 5 from same journal)
  const seeds: Paper[] = [];
  const journalCount = new Map<string, number>();
  for (const { paper } of scored) {
    const j = paper.journal ?? 'unknown';
    const count = journalCount.get(j) ?? 0;
    if (count >= 5) continue;
    journalCount.set(j, count + 1);
    seeds.push(paper);
    if (seeds.length >= 12) break;
  }

  onProgress({ phase: 0, phaseName: 'Query Framing', status: `완료 — ${unique.length}편 중 ${seeds.length}편 pseudo-seed 선정`, found: seeds.length, total: unique.length });

  return { seeds, framing };
}

// ─── Phase 1: Citation Expansion ───────────────────────────

async function phase1CitationExpansion(
  seeds: Paper[],
  existingIds: Set<string>,
  onProgress: (p: DeepSearchProgress) => void,
): Promise<Paper[]> {
  onProgress({ phase: 1, phaseName: '인용 네트워크', status: '시드 논문의 참고문헌/인용 수집 중...', found: 0, total: 0 });

  const s2Ids = seeds.map((p) => p.semanticScholarId).filter((id): id is string => !!id);
  const dois = seeds.map((p) => p.url).filter((u): u is string => !!u && u.includes('doi.org'))
    .map((u) => u.replace('https://doi.org/', ''));

  if (s2Ids.length === 0 && dois.length === 0) {
    onProgress({ phase: 1, phaseName: '인용 네트워크', status: 'ID 없음 — 건너뜀', found: 0, total: 0 });
    return [];
  }

  const allPapers: Paper[] = [];

  // S2 references + citations (max 3 seeds)
  for (let i = 0; i < s2Ids.length && i < 3; i++) {
    onProgress({ phase: 1, phaseName: '인용 네트워크', status: `[S2 ${i + 1}/${Math.min(s2Ids.length, 3)}] refs+cites`, found: allPapers.length, total: allPapers.length });
    const [refs, cites] = await Promise.allSettled([
      getPaperReferences(s2Ids[i], 15),
      getPaperCitations(s2Ids[i], 15),
    ]);
    if (refs.status === 'fulfilled') allPapers.push(...refs.value);
    if (cites.status === 'fulfilled') allPapers.push(...cites.value);
    await delay(300);
  }

  // OpenAlex cited_by (max 3 DOIs)
  for (let i = 0; i < dois.length && i < 3; i++) {
    onProgress({ phase: 1, phaseName: '인용 네트워크', status: `[OA ${i + 1}/${Math.min(dois.length, 3)}] cited_by`, found: allPapers.length, total: allPapers.length });
    const cited = await oaCitedBy(dois[i], 15);
    allPapers.push(...cited);
    await delay(100);
  }

  const unique = dedup(allPapers, existingIds);
  onProgress({ phase: 1, phaseName: '인용 네트워크', status: `완료 — ${unique.length}편`, found: unique.length, total: unique.length });
  return unique;
}

// ─── Phase 2: Multi-query Retrieval ────────────────────────

async function phase2MultiQuery(
  framing: QueryFraming,
  ctx: DeepSearchContext,
  existingIds: Set<string>,
  onProgress: (p: DeepSearchProgress) => void,
): Promise<Paper[]> {
  onProgress({ phase: 2, phaseName: '다각도 검색', status: '동의어 + 분야별 쿼리로 검색 중...', found: 0, total: 0 });

  // Generate additional queries using synonyms and domain tags
  const additionalQueries: string[] = [];
  for (const syn of framing.synonyms.slice(0, 2)) {
    additionalQueries.push(`${syn} ${ctx.targetLabel}`);
  }
  for (const domain of framing.domainTags.slice(0, 2)) {
    additionalQueries.push(`${ctx.sourceLabel} ${ctx.targetLabel} ${domain}`);
  }

  const allQueries = [...Object.values(framing.queries), ...additionalQueries].slice(0, 6);
  const allPapers: Paper[] = [];

  for (let i = 0; i < allQueries.length; i++) {
    const q = allQueries[i];
    onProgress({ phase: 2, phaseName: '다각도 검색', status: `[${i + 1}/${allQueries.length}] "${q.slice(0, 35)}"`, found: allPapers.length, total: allPapers.length });

    const [s2, oa, pm] = await Promise.allSettled([
      searchPapers(q, 10),
      searchOpenAlex(q, 10),
      searchPubMed(q, 10),
    ]);
    if (s2.status === 'fulfilled') allPapers.push(...s2.value);
    if (oa.status === 'fulfilled') allPapers.push(...oa.value);
    if (pm.status === 'fulfilled') allPapers.push(...pm.value);
    await delay(300);
  }

  const unique = dedup(allPapers, existingIds);
  onProgress({ phase: 2, phaseName: '다각도 검색', status: `완료 — ${unique.length}편`, found: unique.length, total: unique.length });
  return unique;
}

// ─── Phase 3: Recommendation + Venue Tracing ───────────────

async function phase3RecommendAndVenue(
  seeds: Paper[],
  allCandidates: Paper[],
  ctx: DeepSearchContext,
  existingIds: Set<string>,
  onProgress: (p: DeepSearchProgress) => void,
): Promise<Paper[]> {
  onProgress({ phase: 3, phaseName: '추천 + 저널 추적', status: 'S2 추천 + 빈출 저널 검색 중...', found: 0, total: 0 });

  const allPapers: Paper[] = [];

  // S2 Recommendations
  const s2Ids = [...collectS2Ids(seeds), ...collectS2Ids(allCandidates.slice(0, 5))];
  const uniqueS2Ids = [...new Set(s2Ids)].slice(0, 5);
  if (uniqueS2Ids.length > 0) {
    onProgress({ phase: 3, phaseName: '추천 + 저널 추적', status: 'S2 추천 API 호출 중...', found: 0, total: 0 });
    const recommended = await getRecommendations(uniqueS2Ids, 15);
    allPapers.push(...recommended);
    await delay(200);
  }

  // Venue tracing: find top journals from candidates
  const journalCount = new Map<string, number>();
  for (const p of [...seeds, ...allCandidates]) {
    if (p.journal) {
      journalCount.set(p.journal, (journalCount.get(p.journal) ?? 0) + 1);
    }
  }
  const topJournals = [...journalCount.entries()]
    .filter(([, count]) => count >= 3)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([name]) => name);

  const searchTopic = `${ctx.sourceLabel} ${ctx.targetLabel}`;
  for (let i = 0; i < topJournals.length; i++) {
    onProgress({ phase: 3, phaseName: '추천 + 저널 추적', status: `[저널] ${topJournals[i].slice(0, 30)}...`, found: allPapers.length, total: allPapers.length });
    const venuePapers = await searchByVenue(topJournals[i], searchTopic, 10);
    allPapers.push(...venuePapers);
    await delay(200);
  }

  const unique = dedup(allPapers, existingIds);
  onProgress({ phase: 3, phaseName: '추천 + 저널 추적', status: `완료 — ${unique.length}편`, found: unique.length, total: unique.length });
  return unique;
}

// ─── Phase 4: Cheap Compression ────────────────────────────

interface CompressedPaper {
  paper: Paper;
  filterLog: string[];
}

function phase4CheapCompression(
  candidates: Paper[],
  ctx: DeepSearchContext,
  onProgress: (p: DeepSearchProgress) => void,
): CompressedPaper[] {
  const before = candidates.length;
  onProgress({ phase: 4, phaseName: '사전 필터', status: `${before}편 후보 압축 중...`, found: 0, total: before });

  const keywords = extractKeywords(ctx);
  const currentYear = new Date().getFullYear();
  const oldestSeedYear = ctx.seedPapers.length > 0
    ? Math.min(...ctx.seedPapers.map((p) => p.year))
    : currentYear - 20;
  const yearCutoff = Math.min(oldestSeedYear, currentYear - 20);

  // Step 1: Year filter
  let filtered = candidates.map((paper) => {
    const log: string[] = [];
    if (paper.year < yearCutoff) {
      log.push(`year_filter: ${paper.year} < ${yearCutoff}`);
    }
    return { paper, filterLog: log };
  });
  filtered = filtered.filter((f) => f.filterLog.length === 0 || !f.filterLog.some((l) => l.startsWith('year_filter')));

  // Step 2: Lexical overlap (remove papers with < 10% keyword overlap)
  filtered = filtered.filter((f) => {
    const overlap = lexicalOverlap(f.paper, keywords);
    if (overlap < 0.1 && keywords.size > 3) {
      f.filterLog.push(`low_overlap: ${(overlap * 100).toFixed(0)}%`);
      return false;
    }
    return true;
  });

  // Step 3: Source diversity cap (40% max per source/journal)
  const maxPerJournal = Math.ceil(filtered.length * 0.4);
  const journalCounts = new Map<string, number>();
  filtered = filtered.filter((f) => {
    const j = f.paper.journal ?? 'unknown';
    const count = journalCounts.get(j) ?? 0;
    if (count >= maxPerJournal) {
      f.filterLog.push(`journal_cap: ${j} exceeded ${maxPerJournal}`);
      return false;
    }
    journalCounts.set(j, count + 1);
    return true;
  });

  // Step 4: Review cap (30% max)
  const maxReviews = Math.ceil(filtered.length * 0.3);
  let reviewCount = 0;
  filtered = filtered.filter((f) => {
    const title = f.paper.title.toLowerCase();
    const isReview = title.includes('review') || title.includes('survey') || title.includes('meta-analysis');
    if (isReview) {
      reviewCount++;
      if (reviewCount > maxReviews) {
        f.filterLog.push('review_cap');
        return false;
      }
    }
    return true;
  });

  const after = filtered.length;
  onProgress({ phase: 4, phaseName: '사전 필터', status: `완료 — ${before}편 → ${after}편 (${before - after}편 제거)`, found: after, total: before });

  return filtered;
}

// ─── Phase 5: LLM Abstract Rerank (4-dimensional) ─────────

async function phase5LLMRerank(
  candidates: CompressedPaper[],
  ctx: DeepSearchContext,
  onProgress: (p: DeepSearchProgress) => void,
): Promise<DeepSearchResult[]> {
  const total = candidates.length;
  onProgress({ phase: 5, phaseName: 'LLM 평가', status: `${total}편 4차원 평가 중...`, found: 0, total });

  if (total === 0) return [];

  const BATCH_SIZE = 15;
  const allResults: DeepSearchResult[] = [];

  for (let batch = 0; batch * BATCH_SIZE < total; batch++) {
    const chunk = candidates.slice(batch * BATCH_SIZE, (batch + 1) * BATCH_SIZE);

    const paperList = chunk.map((c, i) => (
      `[${i}] "${c.paper.title}" (${c.paper.year}) — ${c.paper.authors.slice(0, 2).join(', ')}${c.paper.authors.length > 2 ? ' et al.' : ''}${c.paper.journal ? ` [${c.paper.journal}]` : ''}${c.paper.abstract ? `\n    Abstract: ${c.paper.abstract.slice(0, 250)}` : ''}`
    )).join('\n');

    const prompt = `You are a cross-disciplinary research expert.

Research connection:
- Source: "${ctx.sourceLabel}"
- Target: "${ctx.targetLabel}"
- Relationship: "${ctx.entityLabel}"

Candidate papers:
${paperList}

Evaluate each paper on 4 dimensions (0-1 scale):
- topical: How closely does the paper's topic match this research connection?
- methodological: Does it use relevant methods that could apply to studying this connection?
- directApplicability: Can findings be directly applied or referenced for this connection?
- reviewValue: Is it a useful review/survey that provides background context?

Return ONLY a JSON array (no markdown):
[{"index":0,"topical":0.8,"methodological":0.6,"directApplicability":0.9,"reviewValue":0.2,"reason":"한국어 1문장 설명"}]

Only include papers where at least one dimension score >= 0.4. Omit clearly irrelevant papers.`;

    try {
      const evaluated = await llmGenerateJSON<{
        index: number; topical: number; methodological: number;
        directApplicability: number; reviewValue: number; reason: string;
      }[]>('deepSearch', [{ role: 'user', content: prompt }]);

      for (const item of evaluated) {
        if (item.index < 0 || item.index >= chunk.length) continue;
        const scores: DeepSearchScores = {
          topical: item.topical ?? 0,
          methodological: item.methodological ?? 0,
          directApplicability: item.directApplicability ?? 0,
          reviewValue: item.reviewValue ?? 0,
        };
        const ws = weightedScore(scores);
        if (ws >= 0.3) {
          allResults.push({
            paper: chunk[item.index].paper,
            phase: 5,
            scores,
            relevanceScore: ws,
            reason: item.reason ?? '',
            filterLog: chunk[item.index].filterLog,
          });
        }
      }
    } catch {
      for (const c of chunk) {
        allResults.push({
          paper: c.paper, phase: 5,
          scores: { topical: 0.5, methodological: 0.5, directApplicability: 0.5, reviewValue: 0.3 },
          relevanceScore: 0.5, reason: '평가 실패 — 직접 확인 필요',
          filterLog: c.filterLog,
        });
      }
    }

    onProgress({ phase: 5, phaseName: 'LLM 평가', status: `${Math.min((batch + 1) * BATCH_SIZE, total)}/${total}편 완료`, found: allResults.length, total });

    if ((batch + 1) * BATCH_SIZE < total) await delay(1000);
  }

  allResults.sort((a, b) => b.relevanceScore - a.relevanceScore);
  onProgress({ phase: 5, phaseName: 'LLM 평가', status: `완료 — ${allResults.length}편 선별`, found: allResults.length, total });
  return allResults;
}

// ─── Phase 6: Iterative Refinement ─────────────────────────

async function phase6IterativeRefinement(
  firstResults: DeepSearchResult[],
  ctx: DeepSearchContext,
  existingIds: Set<string>,
  onProgress: (p: DeepSearchProgress) => void,
): Promise<Paper[]> {
  // Check trigger condition: too few results or single-domain dominance
  if (firstResults.length >= 10) {
    const journals = firstResults.slice(0, 15).map((r) => r.paper.journal ?? '');
    const uniqueJournals = new Set(journals.filter(Boolean));
    const dominantJournal = journals.filter(Boolean).length > 0 &&
      uniqueJournals.size <= 3 && journals.length > 8;

    if (!dominantJournal) {
      onProgress({ phase: 6, phaseName: '반복 탐색', status: '1차 결과 충분 — 스킵', found: 0, total: 0 });
      return [];
    }
  }

  onProgress({ phase: 6, phaseName: '반복 탐색', status: '1차 결과 분석 → 보완 쿼리 생성 중...', found: 0, total: 0 });

  // Ask Gemini to analyze gaps and generate supplementary queries
  const topTitles = firstResults.slice(0, 10).map((r) => `- "${r.paper.title}" (${r.paper.journal ?? 'N/A'})`).join('\n');

  const prompt = `You are a research expert. Here are the top results from a literature search about "${ctx.sourceLabel}" → "${ctx.targetLabel}":

${topTitles}

These results may be biased toward certain fields or perspectives.
Generate 2-3 NEW search queries that would find papers from DIFFERENT angles, disciplines, or methodologies not well represented above.

Return ONLY a JSON array of strings:
["new query 1", "new query 2"]`;

  let newQueries: string[];
  try {
    newQueries = await llmGenerateJSON<string[]>('deepSearch', [{ role: 'user', content: prompt }]);
  } catch {
    return [];
  }

  const allPapers: Paper[] = [];
  for (let i = 0; i < newQueries.length && i < 3; i++) {
    onProgress({ phase: 6, phaseName: '반복 탐색', status: `[2차 ${i + 1}/${newQueries.length}] "${newQueries[i].slice(0, 35)}"`, found: allPapers.length, total: allPapers.length });

    const [s2, oa, pm] = await Promise.allSettled([
      searchPapers(newQueries[i], 10),
      searchOpenAlex(newQueries[i], 10),
      searchPubMed(newQueries[i], 8),
    ]);
    if (s2.status === 'fulfilled') allPapers.push(...s2.value);
    if (oa.status === 'fulfilled') allPapers.push(...oa.value);
    if (pm.status === 'fulfilled') allPapers.push(...pm.value);
    await delay(300);
  }

  const unique = dedup(allPapers, existingIds);
  onProgress({ phase: 6, phaseName: '반복 탐색', status: `완료 — ${unique.length}편 추가 발견`, found: unique.length, total: unique.length });
  return unique;
}

// ─── Main Deep Search v2 ───────────────────────────────────

export async function deepSearch(
  ctx: DeepSearchContext,
  onProgress: (p: DeepSearchProgress) => void,
): Promise<DeepSearchResult[]> {
  const existingIds = new Set(ctx.existingPaperIds);
  for (const p of ctx.seedPapers) {
    if (p.semanticScholarId) existingIds.add(p.semanticScholarId);
  }

  // Phase 0: Query framing + pseudo-seed (or use real seeds)
  let seeds: Paper[];
  let framing: QueryFraming;

  if (ctx.seedPapers.length > 0) {
    onProgress({ phase: 0, phaseName: 'Query Framing', status: `기존 시드 ${ctx.seedPapers.length}편 사용`, found: ctx.seedPapers.length, total: ctx.seedPapers.length });
    seeds = ctx.seedPapers;

    // Still generate framing for Phase 2 queries
    try {
      const result = await phase0PseudoSeed(ctx, existingIds, () => {});
      framing = result.framing;
    } catch {
      framing = {
        concepts: [ctx.sourceLabel, ctx.targetLabel],
        synonyms: [],
        domainTags: [],
        queries: {
          broad: `${ctx.sourceLabel} ${ctx.targetLabel}`,
          exact: `"${ctx.sourceLabel}" "${ctx.targetLabel}"`,
          method: `${ctx.sourceLabel} ${ctx.targetLabel} method`,
          crossDomain: `${ctx.sourceLabel} ${ctx.targetLabel} cross-disciplinary`,
        },
      };
    }
  } else {
    const result = await phase0PseudoSeed(ctx, existingIds, onProgress);
    seeds = result.seeds;
    framing = result.framing;
  }

  // Phase 1: Citation expansion
  const phase1 = await phase1CitationExpansion(seeds, existingIds, onProgress);
  const ids1 = new Set([...existingIds, ...collectS2Ids(phase1)]);

  // Phase 2: Multi-query retrieval
  const phase2 = await phase2MultiQuery(framing, ctx, ids1, onProgress);
  const ids2 = new Set([...ids1, ...collectS2Ids(phase2)]);

  // Phase 3: Recommendation + venue tracing
  const phase3 = await phase3RecommendAndVenue(seeds, [...phase1, ...phase2], ctx, ids2, onProgress);

  // Combine all candidates
  const allRaw = dedup([...phase1, ...phase2, ...phase3], ctx.existingPaperIds);

  // Phase 4: Cheap compression
  const compressed = phase4CheapCompression(allRaw, ctx, onProgress);

  // Phase 5: LLM abstract rerank
  const ranked = await phase5LLMRerank(compressed, ctx, onProgress);

  // Phase 6: Iterative refinement (conditional)
  const iterPapers = await phase6IterativeRefinement(ranked, ctx, new Set([...ids2, ...collectS2Ids(allRaw)]), onProgress);

  if (iterPapers.length > 0) {
    // Compress and rerank the new papers too
    const iterCompressed = phase4CheapCompression(iterPapers, ctx, () => {});
    const iterRanked = await phase5LLMRerank(iterCompressed, ctx, () => {});

    // Merge with first results, re-sort
    const merged = [...ranked, ...iterRanked];
    merged.sort((a, b) => b.relevanceScore - a.relevanceScore);

    // Dedup by title
    const seen = new Set<string>();
    const final: DeepSearchResult[] = [];
    for (const r of merged) {
      const key = r.paper.title.toLowerCase().trim();
      if (seen.has(key)) continue;
      seen.add(key);
      final.push(r);
    }
    return final;
  }

  return ranked;
}
