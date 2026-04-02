import type { ResearchMap } from './types';

const CONFIG_KEY = 'github-config';
const LEGACY_FILE_PATH = 'data/research-map.json';

function mapFilePath(mapId: string): string {
  return `data/maps/${mapId}.json`;
}

/** GitHub contents API URL with cache-busting timestamp */
function contentsUrl(config: GitHubConfig, path: string): string {
  return `https://api.github.com/repos/${config.owner}/${config.repo}/contents/${path}?t=${Date.now()}`;
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
  const res = await fetch(contentsUrl(config, path), {
    headers: { Authorization: `Bearer ${config.token}` },
  });
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

const BLOB_SAVE_THRESHOLD = 1 * 1024 * 1024; // 1 MB — switch to Git Data API above this

export async function saveToGitHub(
  config: GitHubConfig,
  map: ResearchMap,
  mapId?: string,
): Promise<void> {
  const filePath = mapId ? mapFilePath(mapId) : LEGACY_FILE_PATH;
  const jsonStr = JSON.stringify(map, null, 2);

  if (jsonStr.length > BLOB_SAVE_THRESHOLD) {
    await saveViaGitDataApi(config, filePath, jsonStr, mapId);
  } else {
    await saveViaContentsApi(config, filePath, jsonStr, mapId);
  }
}

/** Small files: use Contents API PUT (simple, single request) */
async function saveViaContentsApi(
  config: GitHubConfig,
  filePath: string,
  jsonStr: string,
  mapId?: string,
): Promise<void> {
  const content = utf8ToBase64(jsonStr);

  const doPut = async (sha: string | null): Promise<{ res: Response; result: Record<string, unknown> | null }> => {
    const putBody: Record<string, string> = {
      message: `Update map ${mapId ?? 'legacy'}`,
      content,
    };
    if (sha) putBody.sha = sha;
    const r = await fetch(contentsUrl(config, filePath), {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${config.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(putBody),
    });
    const d = await r.json().catch(() => null);
    return { res: r, result: d };
  };

  let remoteSha: string | null;
  try {
    remoteSha = await getFileSha(config, filePath);
  } catch {
    throw new Error('GitHub 연결 실패 — 네트워크를 확인하세요.');
  }

  let res: Response;
  let result: Record<string, unknown> | null;
  try {
    ({ res, result } = await doPut(remoteSha));
  } catch {
    throw new Error('GitHub 저장 실패 — 네트워크를 확인하세요.');
  }

  // 409 = SHA changed between getFileSha and PUT — retry once with fresh SHA
  if (res.status === 409) {
    const latestSha = await getFileSha(config, filePath);
    try {
      ({ res, result } = await doPut(latestSha));
    } catch {
      throw new Error('GitHub 저장 실패 — 네트워크를 확인하세요.');
    }
  }

  if (!res.ok) {
    throw new Error((result?.message as string) || `GitHub save failed: ${res.status}`);
  }
}

/** Large files: use Git Data API (blob → tree → commit → update ref) */
async function saveViaGitDataApi(
  config: GitHubConfig,
  filePath: string,
  jsonStr: string,
  mapId?: string,
): Promise<void> {
  const apiBase = `https://api.github.com/repos/${config.owner}/${config.repo}`;
  const headers = {
    Authorization: `Bearer ${config.token}`,
    'Content-Type': 'application/json',
  };
  const branch = 'main';

  // 1. Create blob
  const blobRes = await fetch(`${apiBase}/git/blobs`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ content: utf8ToBase64(jsonStr), encoding: 'base64' }),
  });
  if (!blobRes.ok) throw new Error(`GitHub 저장 실패 — Blob 생성 오류: ${blobRes.status}`);
  const { sha: blobSha } = await blobRes.json();

  // 2. Get current branch ref
  const refRes = await fetch(`${apiBase}/git/refs/heads/${branch}?t=${Date.now()}`, { headers });
  if (!refRes.ok) throw new Error(`GitHub 저장 실패 — 브랜치 조회 오류: ${refRes.status}`);
  const refData = await refRes.json();
  const latestCommitSha = refData.object.sha;

  // 3. Create tree with new blob
  const treeRes = await fetch(`${apiBase}/git/trees`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      base_tree: latestCommitSha,
      tree: [{ path: filePath, mode: '100644', type: 'blob', sha: blobSha }],
    }),
  });
  if (!treeRes.ok) throw new Error(`GitHub 저장 실패 — Tree 생성 오류: ${treeRes.status}`);
  const { sha: treeSha } = await treeRes.json();

  // 4. Create commit
  const commitRes = await fetch(`${apiBase}/git/commits`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      message: `Update map ${mapId ?? 'legacy'}`,
      tree: treeSha,
      parents: [latestCommitSha],
    }),
  });
  if (!commitRes.ok) throw new Error(`GitHub 저장 실패 — Commit 생성 오류: ${commitRes.status}`);
  const { sha: commitSha } = await commitRes.json();

  // 5. Update branch ref
  const updateRefRes = await fetch(`${apiBase}/git/refs/heads/${branch}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ sha: commitSha }),
  });
  if (!updateRefRes.ok) throw new Error(`GitHub 저장 실패 — Ref 업데이트 오류: ${updateRefRes.status}`);
}

export async function loadFromGitHub(
  config: GitHubConfig,
  mapId?: string,
): Promise<ResearchMap> {
  const filePath = mapId ? mapFilePath(mapId) : LEGACY_FILE_PATH;
  let res: Response;
  try {
    res = await fetch(contentsUrl(config, filePath), {
      headers: { Authorization: `Bearer ${config.token}` },
    });
  } catch {
    throw new Error('GitHub 로드 실패 — 네트워크를 확인하세요.');
  }
  if (res.status === 409) {
    throw new Error('GitHub 레포 충돌 — GitHub에서 레포 상태를 확인하세요.');
  }
  if (!res.ok) throw new Error(`GitHub load failed: ${res.status}`);
  const data = await res.json();

  // GitHub Contents API returns content: null for files > 1MB.
  // Use Git Blob API instead (raw.githubusercontent.com doesn't support CORS with auth).
  if (!data.content && data.sha) {
    const blobRes = await fetch(
      `https://api.github.com/repos/${config.owner}/${config.repo}/git/blobs/${data.sha}?t=${Date.now()}`,
      { headers: { Authorization: `Bearer ${config.token}` } },
    );
    if (!blobRes.ok) throw new Error(`GitHub blob download failed: ${blobRes.status}`);
    const blob = await blobRes.json();
    const decoded = base64ToUtf8(blob.content.replace(/\n/g, ''));
    if (!decoded) throw new Error('Decoded blob content is empty');
    return JSON.parse(decoded) as ResearchMap;
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
  const res = await fetch(contentsUrl(config, filePath), {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${config.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ message: `Delete map ${mapId}`, sha }),
  });
  if (!res.ok) throw new Error(`GitHub delete failed: ${res.status}`);
}
