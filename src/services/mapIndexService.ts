import { getGitHubConfig, base64ToUtf8, utf8ToBase64 } from './githubService';
import type { GitHubConfig } from './githubService';

const INDEX_PATH = 'data/maps-index.json';

export interface MapMeta {
  id: string;
  name: string;
  description?: string;
  pinHash: string;
  createdAt: string;
  updatedAt: string;
  stats: {
    islands: number;
    bridges: number;
    papers: number;
  };
}

export interface MapsIndex {
  maps: MapMeta[];
}

async function getFileSha(config: GitHubConfig, path: string): Promise<string | null> {
  const res = await fetch(
    `https://api.github.com/repos/${config.owner}/${config.repo}/contents/${path}?t=${Date.now()}`,
    { headers: { Authorization: `Bearer ${config.token}` } },
  );
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GitHub API error: ${res.status}`);
  const data = await res.json();
  return data.sha as string;
}

export async function loadMapsIndex(config: GitHubConfig): Promise<MapsIndex> {
  const res = await fetch(
    `https://api.github.com/repos/${config.owner}/${config.repo}/contents/${INDEX_PATH}?t=${Date.now()}`,
    { headers: { Authorization: `Bearer ${config.token}` } },
  );
  if (res.status === 404) return { maps: [] };
  if (!res.ok) throw new Error(`Failed to load maps index: ${res.status}`);
  const data = await res.json();
  const decoded = base64ToUtf8(data.content.replace(/\n/g, ''));
  return JSON.parse(decoded) as MapsIndex;
}

export async function saveMapsIndex(config: GitHubConfig, index: MapsIndex): Promise<void> {
  const content = utf8ToBase64(JSON.stringify(index, null, 2));
  const sha = await getFileSha(config, INDEX_PATH);

  const body: Record<string, string> = {
    message: 'Update maps index',
    content,
  };
  if (sha) body.sha = sha;

  const res = await fetch(
    `https://api.github.com/repos/${config.owner}/${config.repo}/contents/${INDEX_PATH}`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${config.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    },
  );
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.message || `Failed to save maps index: ${res.status}`);
  }
}

export async function hashPin(pin: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(pin);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function verifyPin(pin: string, storedHash: string): Promise<boolean> {
  const hash = await hashPin(pin);
  return hash === storedHash;
}

/** Load maps index using stored GitHub config. Returns null if not configured. */
export async function loadMapsIndexAuto(): Promise<MapsIndex | null> {
  const config = getGitHubConfig();
  if (!config) return null;
  return loadMapsIndex(config);
}
