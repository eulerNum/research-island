import type { Paper } from './types';

const BASE_URL = 'https://api.semanticscholar.org/graph/v1';
const FIELDS = 'title,authors,year,abstract,citationCount,url,externalIds';

interface S2Author {
  name: string;
}

interface S2Paper {
  paperId: string;
  title: string;
  authors: S2Author[];
  year: number;
  abstract: string | null;
  citationCount: number;
  url: string;
  externalIds?: Record<string, string>;
}

function toPaper(s2: S2Paper): Paper {
  return {
    id: crypto.randomUUID(),
    semanticScholarId: s2.paperId,
    title: s2.title,
    authors: s2.authors.map((a) => a.name),
    year: s2.year,
    abstract: s2.abstract ?? undefined,
    citationCount: s2.citationCount,
    url: s2.url,
    source: 'semantic_scholar',
    createdAt: new Date().toISOString(),
  };
}

export async function searchPapers(
  query: string,
  limit = 10,
): Promise<Paper[]> {
  const params = new URLSearchParams({
    query,
    fields: FIELDS,
    limit: String(limit),
  });

  const res = await fetch(`${BASE_URL}/paper/search?${params}`);
  if (!res.ok) {
    throw new Error(`Semantic Scholar API error: ${res.status}`);
  }

  const json = (await res.json()) as { data: S2Paper[] };
  return json.data.map(toPaper);
}

export async function getPaperById(paperId: string): Promise<Paper> {
  const res = await fetch(`${BASE_URL}/paper/${paperId}?fields=${FIELDS}`);
  if (!res.ok) {
    throw new Error(`Semantic Scholar API error: ${res.status}`);
  }

  const json = (await res.json()) as S2Paper;
  return toPaper(json);
}

// ─── Deep Search Endpoints ─────────────────────────────────

interface S2CitationRef {
  citedPaper?: S2Paper;
  citingPaper?: S2Paper;
}

/** Get papers referenced by a given paper */
export async function getPaperReferences(
  paperId: string,
  limit = 20,
): Promise<Paper[]> {
  const params = new URLSearchParams({ fields: FIELDS, limit: String(limit) });
  const res = await fetch(`${BASE_URL}/paper/${paperId}/references?${params}`);
  if (!res.ok) return []; // graceful fallback

  const json = (await res.json()) as { data: S2CitationRef[] };
  return (json.data ?? [])
    .filter((d) => d.citedPaper?.title)
    .map((d) => toPaper(d.citedPaper!));
}

/** Get papers that cite a given paper */
export async function getPaperCitations(
  paperId: string,
  limit = 20,
): Promise<Paper[]> {
  const params = new URLSearchParams({ fields: FIELDS, limit: String(limit) });
  const res = await fetch(`${BASE_URL}/paper/${paperId}/citations?${params}`);
  if (!res.ok) return [];

  const json = (await res.json()) as { data: S2CitationRef[] };
  return (json.data ?? [])
    .filter((d) => d.citingPaper?.title)
    .map((d) => toPaper(d.citingPaper!));
}

/** Get recommended papers based on seed paper IDs */
export async function getRecommendations(
  paperIds: string[],
  limit = 10,
): Promise<Paper[]> {
  if (paperIds.length === 0) return [];

  const res = await fetch('https://api.semanticscholar.org/recommendations/v1/papers/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      positivePaperIds: paperIds.slice(0, 5), // API limit
      negativePaperIds: [],
      fields: FIELDS,
      limit,
    }),
  });
  if (!res.ok) return [];

  const json = (await res.json()) as { recommendedPapers: S2Paper[] };
  return (json.recommendedPapers ?? []).map(toPaper);
}

/** Get papers by a specific author */
export async function getAuthorPapers(
  authorId: string,
  limit = 10,
): Promise<Paper[]> {
  const params = new URLSearchParams({ fields: FIELDS, limit: String(limit) });
  const res = await fetch(`${BASE_URL}/author/${authorId}/papers?${params}`);
  if (!res.ok) return [];

  const json = (await res.json()) as { data: S2Paper[] };
  return (json.data ?? []).map(toPaper);
}

/** Extract S2 author IDs from paper results (for Phase 4 author tracking) */
export function extractAuthorIds(papers: Paper[]): Map<string, number> {
  // We can't get author IDs from toPaper() since we don't store them.
  // This is a limitation — we'd need to refetch paper details.
  // For now, return empty. Phase 4 will use author name search instead.
  void papers;
  return new Map();
}

/** Search for author by name and get their papers */
export async function searchAuthorPapers(
  authorName: string,
  limit = 5,
): Promise<Paper[]> {
  const params = new URLSearchParams({ query: authorName, limit: '1' });
  const res = await fetch(`${BASE_URL}/author/search?${params}`);
  if (!res.ok) return [];

  const json = (await res.json()) as { data: { authorId: string }[] };
  if (!json.data?.[0]?.authorId) return [];

  return getAuthorPapers(json.data[0].authorId, limit);
}
