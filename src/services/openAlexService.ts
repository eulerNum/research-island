import type { Paper } from './types';

/**
 * OpenAlex API — free academic metadata (100k requests/day).
 * Docs: https://docs.openalex.org
 */

const BASE_URL = 'https://api.openalex.org';
const MAILTO = 'research-island-map@example.com'; // polite pool for better rate limits

interface OAWork {
  id: string;
  doi?: string;
  title?: string;
  publication_year?: number;
  cited_by_count?: number;
  primary_location?: {
    source?: { display_name?: string };
  };
  authorships?: { author: { id: string; display_name: string } }[];
  abstract_inverted_index?: Record<string, number[]>;
}

/** Reconstruct abstract from inverted index */
function reconstructAbstract(inverted: Record<string, number[]> | undefined): string | undefined {
  if (!inverted) return undefined;
  const words: [number, string][] = [];
  for (const [word, positions] of Object.entries(inverted)) {
    for (const pos of positions) {
      words.push([pos, word]);
    }
  }
  words.sort((a, b) => a[0] - b[0]);
  const text = words.map(([, w]) => w).join(' ');
  return text || undefined;
}

function toPaper(work: OAWork): Paper | null {
  if (!work.title) return null;
  return {
    id: crypto.randomUUID(),
    title: work.title,
    authors: (work.authorships ?? []).map((a) => a.author.display_name),
    year: work.publication_year ?? new Date().getFullYear(),
    journal: work.primary_location?.source?.display_name,
    abstract: reconstructAbstract(work.abstract_inverted_index),
    citationCount: work.cited_by_count,
    url: work.doi ? `https://doi.org/${work.doi.replace('https://doi.org/', '')}` : undefined,
    source: 'manual' as const,
    createdAt: new Date().toISOString(),
  };
}

/** Search OpenAlex works by query */
export async function searchOpenAlex(
  query: string,
  limit = 15,
): Promise<Paper[]> {
  const params = new URLSearchParams({
    search: query,
    per_page: String(limit),
    mailto: MAILTO,
  });

  const res = await fetch(`${BASE_URL}/works?${params}`);
  if (!res.ok) return [];

  const json = (await res.json()) as { results: OAWork[] };
  return (json.results ?? [])
    .map(toPaper)
    .filter((p): p is Paper => p !== null);
}

/** Get works that cite a given DOI */
export async function getCitedBy(
  doi: string,
  limit = 15,
): Promise<Paper[]> {
  const cleanDoi = doi.replace('https://doi.org/', '');
  const params = new URLSearchParams({
    filter: `cites:https://doi.org/${cleanDoi}`,
    per_page: String(limit),
    mailto: MAILTO,
  });

  const res = await fetch(`${BASE_URL}/works?${params}`);
  if (!res.ok) return [];

  const json = (await res.json()) as { results: OAWork[] };
  return (json.results ?? [])
    .map(toPaper)
    .filter((p): p is Paper => p !== null);
}

/** Search works within a specific journal/venue by source name + topic query */
export async function searchByVenue(
  venueName: string,
  query: string,
  limit = 10,
): Promise<Paper[]> {
  // Use OpenAlex source filter combined with search
  const params = new URLSearchParams({
    search: query,
    filter: `primary_location.source.display_name.search:${venueName}`,
    per_page: String(limit),
    mailto: MAILTO,
  });

  const res = await fetch(`${BASE_URL}/works?${params}`);
  if (!res.ok) return [];

  const json = (await res.json()) as { results: OAWork[] };
  return (json.results ?? [])
    .map(toPaper)
    .filter((p): p is Paper => p !== null);
}

/** Get references of a given DOI */
export async function getReferences(
  doi: string,
  limit = 15,
): Promise<Paper[]> {
  const cleanDoi = doi.replace('https://doi.org/', '');
  const params = new URLSearchParams({
    filter: `cited_by:https://doi.org/${cleanDoi}`,
    per_page: String(limit),
    mailto: MAILTO,
  });

  const res = await fetch(`${BASE_URL}/works?${params}`);
  if (!res.ok) return [];

  const json = (await res.json()) as { results: OAWork[] };
  return (json.results ?? [])
    .map(toPaper)
    .filter((p): p is Paper => p !== null);
}
