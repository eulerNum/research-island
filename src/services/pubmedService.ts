import type { Paper } from './types';

/**
 * PubMed E-utilities — free (3 req/sec without key, 10 req/sec with key).
 * Docs: https://www.ncbi.nlm.nih.gov/books/NBK25497/
 */

const EUTILS_BASE = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils';

interface PubMedArticle {
  uid: string;
  title?: string;
  authors?: { name: string }[];
  pubdate?: string;
  source?: string; // journal
  fulljournalname?: string;
  elocationid?: string; // DOI
}

/** Search PubMed and return paper metadata */
export async function searchPubMed(
  query: string,
  limit = 15,
): Promise<Paper[]> {
  // Step 1: esearch — get PMIDs
  const searchParams = new URLSearchParams({
    db: 'pubmed',
    term: query,
    retmax: String(limit),
    retmode: 'json',
    sort: 'relevance',
  });

  const searchRes = await fetch(`${EUTILS_BASE}/esearch.fcgi?${searchParams}`);
  if (!searchRes.ok) return [];

  const searchJson = (await searchRes.json()) as {
    esearchresult?: { idlist?: string[] };
  };
  const pmids = searchJson.esearchresult?.idlist ?? [];
  if (pmids.length === 0) return [];

  // Step 2: esummary — get metadata for PMIDs
  const summaryParams = new URLSearchParams({
    db: 'pubmed',
    id: pmids.join(','),
    retmode: 'json',
  });

  const summaryRes = await fetch(`${EUTILS_BASE}/esummary.fcgi?${summaryParams}`);
  if (!summaryRes.ok) return [];

  const summaryJson = (await summaryRes.json()) as {
    result?: Record<string, PubMedArticle>;
  };

  if (!summaryJson.result) return [];

  const papers: Paper[] = [];

  for (const pmid of pmids) {
    const article = summaryJson.result[pmid];
    if (!article?.title) continue;

    // Extract year from pubdate (format: "2024 Jan 15" or "2024")
    const yearMatch = article.pubdate?.match(/(\d{4})/);
    const year = yearMatch ? parseInt(yearMatch[1], 10) : new Date().getFullYear();

    // Extract DOI from elocationid (format: "doi: 10.xxxx/yyyy")
    const doiMatch = article.elocationid?.match(/doi:\s*(10\.\S+)/i);
    const doi = doiMatch ? doiMatch[1] : undefined;

    papers.push({
      id: crypto.randomUUID(),
      title: article.title.replace(/\.$/, ''), // remove trailing period
      authors: (article.authors ?? []).map((a) => a.name),
      year,
      journal: article.fulljournalname ?? article.source,
      url: doi ? `https://doi.org/${doi}` : `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`,
      source: 'manual' as const,
      createdAt: new Date().toISOString(),
    });
  }

  return papers;
}
