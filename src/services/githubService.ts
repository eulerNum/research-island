import type { ResearchMap } from './types';

const CONFIG_KEY = 'github-config';
const LEGACY_FILE_PATH = 'data/research-map.json';

function mapFilePath(mapId: string): string {
  return `data/maps/${mapId}.json`;
}

export interface GitHubConfig {
  token: string;
  owner: string;
  repo: string;
}

export function getGitHubConfig(): GitHubConfig | null {
  const raw = localStorage.getItem(CONFIG_KEY);
  if (!raw) return null;
  return JSON.parse(raw) as GitHubConfig;
}

export function setGitHubConfig(config: GitHubConfig): void {
  localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
}

async function getFileSha(
  config: GitHubConfig,
  path: string,
): Promise<string | null> {
  const res = await fetch(
    `https://api.github.com/repos/${config.owner}/${config.repo}/contents/${path}`,
    { headers: { Authorization: `Bearer ${config.token}` } },
  );
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GitHub API error: ${res.status}`);
  const data = await res.json();
  return data.sha as string;
}

/** Encode a UTF-8 string to base64, handling large payloads safely. */
export function utf8ToBase64(str: string): string {
  const bytes = new TextEncoder().encode(str);
  // Build binary string in chunks to avoid call-stack overflow on large data
  const CHUNK = 8192;
  let binary = '';
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

/** Decode a base64 string to UTF-8, handling large payloads safely. */
export function base64ToUtf8(b64: string): string {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

export async function saveToGitHub(
  config: GitHubConfig,
  map: ResearchMap,
  mapId?: string,
): Promise<void> {
  const filePath = mapId ? mapFilePath(mapId) : LEGACY_FILE_PATH;
  const jsonStr = JSON.stringify(map, null, 2);
  const content = utf8ToBase64(jsonStr);
  const sha = await getFileSha(config, filePath);

  const body: Record<string, string> = {
    message: `Update map ${mapId ?? 'legacy'}`,
    content,
  };
  if (sha) body.sha = sha;

  const res = await fetch(
    `https://api.github.com/repos/${config.owner}/${config.repo}/contents/${filePath}`,
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
    throw new Error(err.message || `GitHub save failed: ${res.status}`);
  }
}

export async function loadFromGitHub(
  config: GitHubConfig,
  mapId?: string,
): Promise<ResearchMap> {
  const filePath = mapId ? mapFilePath(mapId) : LEGACY_FILE_PATH;
  const res = await fetch(
    `https://api.github.com/repos/${config.owner}/${config.repo}/contents/${filePath}`,
    { headers: { Authorization: `Bearer ${config.token}` } },
  );
  if (!res.ok) throw new Error(`GitHub load failed: ${res.status}`);
  const data = await res.json();

  // GitHub Contents API returns content: null for files > 1MB.
  // In that case, download via the raw download_url or git blob API.
  if (!data.content && data.download_url) {
    const rawRes = await fetch(data.download_url, {
      headers: { Authorization: `Bearer ${config.token}` },
    });
    if (!rawRes.ok) throw new Error(`GitHub raw download failed: ${rawRes.status}`);
    const text = await rawRes.text();
    if (!text) throw new Error('GitHub returned empty file content');
    return JSON.parse(text) as ResearchMap;
  }

  if (!data.content) {
    throw new Error('GitHub returned no file content (file may be too large or empty)');
  }

  const decoded = base64ToUtf8(data.content.replace(/\n/g, ''));
  if (!decoded) throw new Error('Decoded content is empty');
  return JSON.parse(decoded) as ResearchMap;
}

export async function deleteFromGitHub(
  config: GitHubConfig,
  mapId: string,
): Promise<void> {
  const filePath = mapFilePath(mapId);
  const sha = await getFileSha(config, filePath);
  if (!sha) return;
  const res = await fetch(
    `https://api.github.com/repos/${config.owner}/${config.repo}/contents/${filePath}`,
    {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${config.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message: `Delete map ${mapId}`, sha }),
    },
  );
  if (!res.ok) throw new Error(`GitHub delete failed: ${res.status}`);
}
