// AI help through Claude, using the owner's own API key (typed in Settings or
// built in from the repo secret). Used for explaining faults, guessing unknown
// values from Discover, module research and the "Ask Caristini" chat.
//
// Plain HTTPS to the Messages API: the official TypeScript SDK's modules load
// in a circular order that the app's bundler (Metro) cannot start, which
// crashed the app at launch.
import { getSecret } from '../share/secrets';

export const MODEL = 'claude-opus-5-5';
const URL = 'https://api.anthropic.com/v1/messages';

export type ChatTurn = { role: 'user' | 'assistant'; content: string | unknown[] };

export async function hasClaude(): Promise<boolean> {
  return !!(await getSecret('claudeKey'));
}

const SYSTEM = [
  'You are the assistant inside Caristini, a personal car diagnostics app used with an ELM327 OBD2 adapter.',
  'Answer for a capable home mechanic in British English, short and direct, outcome first. Use digits for numbers.',
  'Be honest about uncertainty: say when something depends on the exact car or needs a workshop check. Never invent part numbers, coding bits or prices you do not know; give ranges and say they are estimates.',
  'Safety first: say plainly when a fault means the car should not be driven.',
].join(' ');

export interface ClaudeResponse {
  content: { type: string; text?: string }[];
  stop_reason: string | null;
}

// Error codes of web searches the API refused in this response (for example
// too_many_requests or max_uses_exceeded), so a caller can wait and retry.
export function searchErrors(res: ClaudeResponse): string[] {
  const out: string[] = [];
  for (const b of res.content as { type: string; content?: { type?: string; error_code?: string } }[]) {
    if (b.type === 'web_search_tool_result' && b.content?.type === 'web_search_tool_result_error' && b.content.error_code) out.push(b.content.error_code);
  }
  return out;
}

// One Messages API call. Refusals fall back to another model on the server.
export async function callClaude(body: Record<string, unknown>, timeoutMs = 90_000): Promise<ClaudeResponse> {
  const apiKey = await getSecret('claudeKey');
  if (!apiKey) throw new Error('Add your Claude API key in Settings > AI to use this.');
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  let res: Response;
  try {
    for (let attempt = 0; ; attempt++) {
      res = await fetch(URL, {
        method: 'POST',
        signal: ctrl.signal,
        headers: {
          'content-type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-beta': 'server-side-fallback-2026-07-01',
          // Needed when the request comes from a browser (the web preview).
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({ model: MODEL, fallbacks: 'default', ...body }),
      });
      // Busy or overloaded: try again twice with a pause.
      if ((res.status === 429 || res.status === 529 || res.status >= 500) && attempt < 2) {
        await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
        continue;
      }
      break;
    }
  } catch (e) {
    throw new Error(e instanceof Error && e.name === 'AbortError' ? 'Claude took too long to answer.' : 'No internet connection to Claude.');
  } finally {
    clearTimeout(timer);
  }
  if (res!.status === 401) throw new Error('The Claude API key was refused. Check it in Settings > AI.');
  if (res!.status === 403) throw new Error('This Claude API key is not allowed to use this model.');
  if (res!.status === 429) throw new Error('Claude is busy or the key has hit its limit. Try again in a minute.');
  if (res!.status === 400) {
    const err = (await res!.json().catch(() => null)) as { error?: { message?: string } } | null;
    const msg = err?.error?.message ?? '';
    if (/credit|balance/i.test(msg)) throw new Error('The Claude account behind this key has no credit left.');
    throw new Error(`Claude could not answer: ${msg || 'bad request'}.`);
  }
  if (!res!.ok) throw new Error(`Claude could not answer (${res!.status}).`);
  return (await res!.json()) as ClaudeResponse;
}

export const textOf = (r: ClaudeResponse) =>
  r.content
    .filter((b) => b.type === 'text' && b.text)
    .map((b) => b.text)
    .join('\n')
    .trim();

// One question, one answer. effort: low for quick look-ups, medium for chat.
export async function askClaude(prompt: string, opts: { maxTokens?: number; effort?: 'low' | 'medium' | 'high'; context?: string } = {}): Promise<string> {
  return chatClaude([{ role: 'user', content: prompt }], opts);
}

export async function chatClaude(messages: ChatTurn[], opts: { maxTokens?: number; effort?: 'low' | 'medium' | 'high'; context?: string } = {}): Promise<string> {
  const res = await callClaude({
    max_tokens: opts.maxTokens ?? 4000,
    output_config: { effort: opts.effort ?? 'low' },
    system: opts.context ? [{ type: 'text', text: SYSTEM }, { type: 'text', text: opts.context }] : SYSTEM,
    messages,
  });
  if (res.stop_reason === 'refusal') return 'Claude declined to answer this one.';
  return textOf(res) || 'No answer came back.';
}
