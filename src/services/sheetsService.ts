import type { Paper } from './types';

const SHEETS_CONFIG_KEY = 'sheets-webhook-config';

export interface SheetsConfig {
  pushUrl: string;
  pullUrl: string;
}

export function getSheetsConfig(): SheetsConfig | null {
  const raw = localStorage.getItem(SHEETS_CONFIG_KEY);
  if (!raw) return null;
  return JSON.parse(raw) as SheetsConfig;
}

export function setSheetsConfig(config: SheetsConfig): void {
  localStorage.setItem(SHEETS_CONFIG_KEY, JSON.stringify(config));
}

export async function syncToSheets(webhookUrl: string, papers: Paper[]): Promise<void> {
  const rows = papers.map((p) => ({
    id: p.id,
    title: p.title,
    authors: p.authors.join('; '),
    year: p.year,
    journal: p.journal ?? '',
    abstract: p.abstract ?? '',
    comment: p.comment ?? '',
    url: p.url ?? '',
    source: p.source,
    createdAt: p.createdAt,
    semanticScholarId: p.semanticScholarId ?? '',
  }));

  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ papers: rows }),
  });

  if (!res.ok) {
    throw new Error(`Sheets push failed: ${res.status}`);
  }
}

export async function syncFromSheets(webhookUrl: string): Promise<Paper[]> {
  const res = await fetch(webhookUrl);
  if (!res.ok) {
    throw new Error(`Sheets pull failed: ${res.status}`);
  }
  const data = await res.json();
  const rows: Record<string, string>[] = data.papers ?? data;

  return rows.map((row) => ({
    id: row.id || crypto.randomUUID().slice(0, 8),
    title: row.title || '',
    authors: (row.authors || '').split(';').map((a: string) => a.trim()).filter(Boolean),
    year: parseInt(row.year, 10) || new Date().getFullYear(),
    journal: row.journal || undefined,
    abstract: row.abstract || undefined,
    comment: row.comment || undefined,
    url: row.url || undefined,
    source: (row.source as Paper['source']) || 'n8n_import',
    createdAt: row.createdAt || new Date().toISOString(),
    semanticScholarId: row.semanticScholarId || undefined,
  }));
}

/** Merge remote papers into local, dedup by semanticScholarId or title+year */
export function reconcilePapers(local: Paper[], remote: Paper[]): Paper[] {
  const merged = [...local];
  for (const rp of remote) {
    const exists = merged.some(
      (lp) =>
        (rp.semanticScholarId && lp.semanticScholarId === rp.semanticScholarId) ||
        (lp.title === rp.title && lp.year === rp.year),
    );
    if (!exists) {
      merged.push(rp);
    }
  }
  return merged;
}
