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

export async function saveToGitHub(
  config: GitHubConfig,
  map: ResearchMap,
  mapId?: string,
): Promise<void> {
  const filePath = mapId ? mapFilePath(mapId) : LEGACY_FILE_PATH;
  const content = btoa(
    unescape(encodeURIComponent(JSON.stringify(map, null, 2))),
  );
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
  const decoded = decodeURIComponent(escape(atob(data.content.replace(/\n/g, ''))));
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
