// Small GitHub contents client for the Caristini repo: the knowledge base and
// findings live there, so what one car or one AI search learns reaches every
// install without a new build. Uses the repo-scoped token (built in from the
// CARISTINI_UPLOAD_TOKEN secret, or pasted in Settings).
import { getSecret } from './secrets';

export const REPO = process.env.EXPO_PUBLIC_UPLOAD_REPO || 'Darkshadowgame/caristini-data';
const API = `https://api.github.com/repos/${REPO}`;

async function token(): Promise<string | null> {
  return await getSecret('githubToken');
}

export async function githubReady(): Promise<boolean> {
  return !!(await token());
}

async function call(path: string, init: RequestInit = {}, accept = 'application/vnd.github+json'): Promise<Response> {
  const t = await token();
  if (!t) throw new Error('The knowledge base needs the GitHub token (set up in the build, or pasted in Settings).');
  return fetch(`${API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${t}`, Accept: accept, 'X-GitHub-Api-Version': '2022-11-28', ...(init.body ? { 'Content-Type': 'application/json' } : {}) },
  });
}

function b64(text: string): string {
  return btoa(unescape(encodeURIComponent(text)));
}

// Every file under a folder, with its blob sha (one request for the whole tree).
export async function listFiles(prefix: string): Promise<{ path: string; sha: string }[]> {
  const res = await call('/git/trees/HEAD?recursive=1');
  if (!res.ok) throw new Error(`GitHub said ${res.status}.`);
  const data = (await res.json()) as { tree: { path: string; type: string; sha: string }[] };
  return data.tree.filter((e) => e.type === 'blob' && e.path.startsWith(prefix)).map((e) => ({ path: e.path, sha: e.sha }));
}

export async function readFile(path: string): Promise<string | null> {
  const res = await call(`/contents/${encodeURI(path)}`, {}, 'application/vnd.github.raw');
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GitHub said ${res.status}.`);
  return res.text();
}

async function currentSha(path: string): Promise<string | undefined> {
  const res = await call(`/contents/${encodeURI(path)}`);
  if (!res.ok) return undefined;
  return ((await res.json()) as { sha?: string }).sha;
}

// Creates or replaces one file with a commit.
export async function writeFile(path: string, text: string, message: string): Promise<void> {
  const sha = await currentSha(path);
  const res = await call(`/contents/${encodeURI(path)}`, { method: 'PUT', body: JSON.stringify({ message, content: b64(text), ...(sha ? { sha } : {}) }) });
  if (!res.ok) throw new Error(res.status === 401 || res.status === 403 ? 'The GitHub token was refused.' : `GitHub said ${res.status}.`);
}
