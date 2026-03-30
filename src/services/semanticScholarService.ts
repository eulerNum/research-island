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
