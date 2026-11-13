// Sends what Caristini found on a car (sensor finder, Discover, settings learned)
// back to the developer, so it can be built into the next version for everyone.
//
// Route 1, automatic: a GitHub token with write access to the private findings
// repo only, pasted by the owner in Settings and kept in the phone's keychain.
// Route 2: an email with the file attached, ready to send.
// Route 3: the share sheet.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { File, Paths } from 'expo-file-system';
import * as MailComposer from 'expo-mail-composer';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import { getSecret } from './secrets';

const REPO = process.env.EXPO_PUBLIC_UPLOAD_REPO || 'Darkshadowgame/caristini-data';

export type SendResult = { via: 'github' | 'email' | 'share' | 'none'; detail: string };

export async function canSendAutomatically(): Promise<boolean> {
  return !!(await getSecret('githubToken'));
}

function base64(text: string): string {
  const bytes = unescape(encodeURIComponent(text));
  if (typeof btoa === 'function') return btoa(bytes);
  // Hermes has btoa; this is a fallback only.
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const n = (bytes.charCodeAt(i) << 16) | ((bytes.charCodeAt(i + 1) || 0) << 8) | (bytes.charCodeAt(i + 2) || 0);
    out += chars[(n >> 18) & 63] + chars[(n >> 12) & 63] + (i + 1 < bytes.length ? chars[(n >> 6) & 63] : '=') + (i + 2 < bytes.length ? chars[n & 63] : '=');
  }
  return out;
}

async function toGitHub(path: string, text: string, message: string): Promise<boolean> {
  const token = await getSecret('githubToken');
  if (!token) return false;
  const res = await fetch(`https://api.github.com/repos/${REPO}/contents/${path}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, content: base64(text) }),
  });
  // 422: a file of this name is already there (sent before, reply lost): done.
  if (res.status === 422) return true;
  if (!res.ok) {
    throw new Error(
      res.status === 401 || res.status === 403 || res.status === 404
        ? `GitHub refused the token (${res.status}). It needs write access to the ${REPO} repo.`
        : `GitHub said ${res.status}.`,
    );
  }
  return true;
}

async function toFile(name: string, text: string): Promise<string | null> {
  if (Platform.OS === 'web') return null;
  const f = new File(Paths.cache, name);
  if (f.exists) f.delete();
  f.create();
  await f.write(text);
  return f.uri;
}

// Findings that could not be sent are kept here and sent again later, so a
// long Learn my car or sensor search is never lost to a refused token or no signal.
const OUTBOX = 'caristini.outbox.v1';
export interface Outgoing {
  path: string;
  name: string;
  text: string;
  message: string;
  error: string;
  at: number;
}

export async function outbox(): Promise<Outgoing[]> {
  try {
    const raw = await AsyncStorage.getItem(OUTBOX);
    return raw ? (JSON.parse(raw) as Outgoing[]) : [];
  } catch {
    return [];
  }
}

async function saveOutbox(list: Outgoing[]): Promise<void> {
  await AsyncStorage.setItem(OUTBOX, JSON.stringify(list)).catch(() => undefined);
}

// Outbox changes run one after another, so two sends failing at the same
// moment cannot overwrite each other. The outbox keeps the newest 30 files and
// at most about 3 MB, so it cannot grow without end on a phone with no token.
const MAX_FILES = 30;
const MAX_CHARS = 3_000_000;
let outboxWork: Promise<unknown> = Promise.resolve();
function serial<T>(job: () => Promise<T>): Promise<T> {
  const run = outboxWork.then(job, job);
  outboxWork = run.catch(() => undefined);
  return run;
}
export function trimOutbox(list: Outgoing[]): Outgoing[] {
  let kept = list.slice(-MAX_FILES);
  while (kept.length > 1 && kept.reduce((n, o) => n + o.text.length, 0) > MAX_CHARS) kept = kept.slice(1);
  return kept;
}
function queue(o: Outgoing): Promise<void> {
  return serial(async () => saveOutbox(trimOutbox([...(await outbox()), o])));
}

// Sends what is waiting. Returns how many went, how many are left and the last error.
export function flushOutbox(): Promise<{ sent: number; left: number; error: string | null }> {
  return serial(flushNow);
}

async function flushNow(): Promise<{ sent: number; left: number; error: string | null }> {
  const list = await outbox();
  const left: Outgoing[] = [];
  let sent = 0;
  let error: string | null = null;
  for (const o of list) {
    try {
      if (await toGitHub(o.path, o.text, o.message)) sent++;
      else left.push({ ...o, error: (error = 'Automatic sending is not set up yet.') });
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
      left.push({ ...o, error });
    }
  }
  if (list.length) await saveOutbox(left);
  return { sent, left: left.length, error };
}

// Every waiting file through the share sheet (email, Files, AirDrop).
export async function shareOutbox(): Promise<number> {
  let n = 0;
  for (const o of await outbox()) {
    const uri = await toFile(o.name, o.text);
    if (uri && (await Sharing.isAvailableAsync())) {
      await Sharing.shareAsync(uri, { mimeType: 'application/json', dialogTitle: 'Send findings' });
      n++;
    }
  }
  return n;
}

// kind: short slug ('sensors', 'discover', 'learned'); vin: the car; data: any JSON.
export async function sendBack(kind: string, vin: string, data: unknown, opts: { email?: string; allowManual?: boolean } = {}): Promise<SendResult> {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const name = `${kind}-${vin.slice(-8)}-${stamp}.json`;
  const text = JSON.stringify({ app: 'Caristini', kind, vin, sentAt: new Date().toISOString(), data }, null, 1);
  const path = `findings/${vin}/${name}`;
  const message = `Findings from the app: ${kind} on ${vin}`;
  const keep = async (error: string): Promise<SendResult> => {
    await queue({ path, name, text, message, error, at: Date.now() });
    return { via: 'none', detail: 'Not sent yet. It is saved on this phone and goes by itself next time the app opens.' };
  };
  try {
    if (await toGitHub(path, text, message)) {
      // Anything left from before goes too, now that sending works.
      void flushOutbox().catch(() => undefined);
      return { via: 'github', detail: 'Sent. It will be built into the next version.' };
    }
  } catch (e) {
    if (!opts.allowManual) return keep(e instanceof Error ? e.message : String(e));
  }
  if (!opts.allowManual) return keep('Automatic sending is not set up yet.');
  const uri = await toFile(name, text);
  if (uri && (await MailComposer.isAvailableAsync().catch(() => false))) {
    const r = await MailComposer.composeAsync({
      recipients: opts.email ? [opts.email] : [],
      subject: `Caristini findings: ${kind} (${vin})`,
      body: 'Findings from Caristini, attached. Send this to Claude to build them into the app.',
      attachments: [uri],
    });
    return { via: 'email', detail: r.status === 'sent' ? 'Email sent.' : 'Email not sent.' };
  }
  if (uri && (await Sharing.isAvailableAsync())) {
    await Sharing.shareAsync(uri, { mimeType: 'application/json', dialogTitle: 'Send findings' });
    return { via: 'share', detail: 'Shared.' };
  }
  return { via: 'none', detail: 'No way to send from this device.' };
}
