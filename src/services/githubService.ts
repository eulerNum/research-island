import type { ResearchMap } from './types';

const CONFIG_KEY = 'github-config';
const FILE_PATH = 'data/research-map.json';

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
): Promise<string | null> {
  const res = await fetch(
    `https://api.github.com/repos/${config.owner}/${config.repo}/contents/${FILE_PATH}`,
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
): Promise<void> {
  const content = btoa(
    unescape(encodeURIComponent(JSON.stringify(map, null, 2))),
  );
  const sha = await getFileSha(config);

  const body: Record<string, string> = {
    message: 'Update research map data',
    content,
  };
  if (sha) body.sha = sha;

  const res = await fetch(
    `https://api.github.com/repos/${config.owner}/${config.repo}/contents/${FILE_PATH}`,
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
): Promise<ResearchMap> {
  const res = await fetch(
    `https://api.github.com/repos/${config.owner}/${config.repo}/contents/${FILE_PATH}`,
    { headers: { Authorization: `Bearer ${config.token}` } },
  );
  if (!res.ok) throw new Error(`GitHub load failed: ${res.status}`);
  const data = await res.json();
  const decoded = decodeURIComponent(escape(atob(data.content.replace(/\n/g, ''))));
  return JSON.parse(decoded) as ResearchMap;
}
