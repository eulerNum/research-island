import type { GitHubConfig } from './githubService';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

function figurePath(paperId: string, index: number, ext: string): string {
  return `data/figures/${paperId}_${index}.${ext}`;
}

function extFromFile(file: File): string {
  const parts = file.name.split('.');
  return parts.length > 1 ? parts.pop()!.toLowerCase() : 'png';
}

async function getFileSha(config: GitHubConfig, path: string): Promise<string | null> {
  const res = await fetch(
    `https://api.github.com/repos/${config.owner}/${config.repo}/contents/${path}`,
    { headers: { Authorization: `Bearer ${config.token}` } },
  );
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GitHub API error: ${res.status}`);
  const data = await res.json();
  return data.sha as string;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Strip data URL prefix: "data:image/png;base64,..."
      resolve(result.split(',')[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export async function uploadFigure(
  config: GitHubConfig,
  paperId: string,
  file: File,
  index: number,
): Promise<string> {
  if (file.size > MAX_FILE_SIZE) {
    throw new Error(`File too large (max ${MAX_FILE_SIZE / 1024 / 1024}MB)`);
  }

  const ext = extFromFile(file);
  const path = figurePath(paperId, index, ext);
  const content = await fileToBase64(file);
  const sha = await getFileSha(config, path);

  const body: Record<string, string> = {
    message: `Add figure ${index} for paper ${paperId}`,
    content,
  };
  if (sha) body.sha = sha;

  const res = await fetch(
    `https://api.github.com/repos/${config.owner}/${config.repo}/contents/${path}`,
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
    throw new Error(err.message || `Figure upload failed: ${res.status}`);
  }

  const data = await res.json();
  return data.content.download_url as string;
}

export async function deleteFigure(
  config: GitHubConfig,
  url: string,
): Promise<void> {
  // Extract path from raw GitHub URL
  const match = url.match(/\/contents\/(.+?)(\?|$)/);
  if (!match) return;
  const path = match[1];
  const sha = await getFileSha(config, path);
  if (!sha) return;

  await fetch(
    `https://api.github.com/repos/${config.owner}/${config.repo}/contents/${path}`,
    {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${config.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message: `Delete figure`, sha }),
    },
  );
}
