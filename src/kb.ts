// Caristini knowledge base: what the AI researched (fuse layouts, modifications,
// coding settings, procedures, notes) and what owners added, per make, model
// and platform. Kept on the phone for offline use and shared through the
// caristini repo (kb/entries/<make>/<id>.json), so it reaches every install
// on its next start and can be folded into the app's own lists later.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ALL_ITEMS, CodingItem } from './coding/items';
import { FUSE_CARS } from './data/fuses';
import { githubReady, listFiles, readFile, writeFile } from './share/github';

export type KbKind = 'fuse' | 'modification' | 'setting' | 'sensor' | 'procedure' | 'module' | 'note';

export interface KbEntry {
  id: string;
  kind: KbKind;
  car: { make: string; model?: string; platform?: string; years?: string };
  title: string;
  body: string;
  // Structured data where it applies, e.g. a setting's module/byte/bit.
  data?: Record<string, unknown>;
  sources: { label: string; url: string }[];
  addedBy: 'ai' | 'owner';
  at: number;
}

export const KB_KIND_LABEL: Record<KbKind, string> = {
  fuse: 'Fuses',
  modification: 'Modifications',
  setting: 'Settings',
  sensor: 'Sensors',
  procedure: 'How-to',
  module: 'Modules',
  note: 'Notes',
};

const KEY = 'caristini.kb.v1';
const SHAS = 'caristini.kb.shas.v1';
let listeners: (() => void)[] = [];

export async function loadKb(): Promise<KbEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as KbEntry[]) : [];
  } catch {
    return [];
  }
}

async function storeKb(list: KbEntry[]): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    // storage unavailable
  }
  listeners.forEach((l) => l());
}

export function onKb(fn: () => void): () => void {
  listeners.push(fn);
  return () => {
    listeners = listeners.filter((l) => l !== fn);
  };
}

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50);

// Saves an entry on the phone and, when the token is there, in the repo.
export async function saveKb(e: Omit<KbEntry, 'id' | 'at'>): Promise<{ entry: KbEntry; shared: boolean; error?: string }> {
  const entry: KbEntry = { ...e, id: `${slug(e.car.make)}-${slug(e.car.model ?? 'all')}-${e.kind}-${slug(e.title)}`, at: Date.now() };
  const list = await loadKb();
  await storeKb([entry, ...list.filter((x) => x.id !== entry.id)]);
  if (!(await githubReady())) return { entry, shared: false };
  try {
    await writeFile(`kb/entries/${slug(e.car.make)}/${entry.id}.json`, JSON.stringify(entry, null, 1), `Knowledge: ${entry.title} (${e.car.make} ${e.car.model ?? ''})`.trim());
    return { entry, shared: true };
  } catch (err) {
    return { entry, shared: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// Pulls new and changed entries from the repo (by file sha, so unchanged files
// are not fetched again). Returns how many came in.
export async function syncKb(): Promise<number> {
  if (!(await githubReady())) return 0;
  const files = await listFiles('kb/entries/');
  let shas: Record<string, string> = {};
  try {
    shas = JSON.parse((await AsyncStorage.getItem(SHAS)) ?? '{}');
  } catch {
    shas = {};
  }
  const list = await loadKb();
  let added = 0;
  for (const f of files) {
    if (!f.path.endsWith('.json') || shas[f.path] === f.sha) continue;
    const text = await readFile(f.path).catch(() => null);
    if (!text) continue;
    try {
      const e = JSON.parse(text) as KbEntry;
      if (!e.id || !e.title) continue;
      const i = list.findIndex((x) => x.id === e.id);
      if (i >= 0) list[i] = e;
      else list.unshift(e);
      shas[f.path] = f.sha;
      added++;
    } catch {
      // skip a broken file
    }
  }
  if (added) await storeKb(list);
  try {
    await AsyncStorage.setItem(SHAS, JSON.stringify(shas));
  } catch {
    // ignore
  }
  return added;
}

const norm = (s?: string | null) => (s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');

// Entries that fit a car: same make, and model or platform matching or unset.
export function kbForCar(list: KbEntry[], v: { brand: string; model: string; platform: string | null }): KbEntry[] {
  return list.filter((e) => {
    if (norm(e.car.make) !== norm(v.brand) && !(norm(e.car.make) === 'vag' && /audi|vw|volkswagen|seat|skoda|cupra/i.test(v.brand))) return false;
    if (e.car.model && norm(v.model) && !norm(v.model).includes(norm(e.car.model)) && !norm(e.car.model).includes(norm(v.model))) {
      return !!e.car.platform && norm(e.car.platform) === norm(v.platform);
    }
    return true;
  });
}

// Settings saved in the knowledge base with an exact module/byte/bit become
// unconfirmed Customise settings (offered through Try mode).
export function kbSettings(list: KbEntry[]): CodingItem[] {
  return list
    .filter((e) => e.kind === 'setting' && e.data && typeof e.data.module === 'string' && typeof e.data.byte === 'number' && Array.isArray(e.data.bits))
    .map((e) => ({
      id: `kb-${e.id}`,
      title: e.title.slice(0, 60),
      summary: e.body.slice(0, 200),
      category: 'Comfort' as CodingItem['category'],
      platforms: e.car.platform ? [e.car.platform] : [],
      module: e.data!.module as string,
      byte: e.data!.byte as number,
      bits: (e.data!.bits as number[]).filter((b) => b >= 0 && b <= 7),
      confidence: 'low' as const,
      note: 'From the shared knowledge base (AI research). Unconfirmed: try it, and Caristini puts it back if nothing changes.',
      sources: e.sources,
    }));
}

// Search across the knowledge base and the app's own lists.
export function searchEverything(list: KbEntry[], v: { brand: string; model: string; platform: string | null; vin?: string; year?: number | null }, query: string, kind?: KbKind): string[] {
  const q = query.toLowerCase().split(/\s+/).filter(Boolean);
  const hit = (s: string) => q.every((w) => s.toLowerCase().includes(w));
  const out: string[] = [];
  for (const e of kbForCar(list, v)) {
    if (kind && e.kind !== kind) continue;
    if (!q.length || hit(`${e.title} ${e.body} ${e.kind}`)) out.push(`[knowledge base, ${KB_KIND_LABEL[e.kind]}] ${e.title}: ${e.body.slice(0, 400)}${e.sources[0] ? ` (source: ${e.sources[0].url})` : ''}`);
  }
  if (!kind || kind === 'setting') {
    for (const i of ALL_ITEMS) {
      if (v.platform && !i.platforms.includes(v.platform)) continue;
      if (!q.length || hit(`${i.title} ${i.summary} ${i.category}`)) out.push(`[built-in setting ${i.id}] ${i.title}: ${i.summary} (module ${i.module}, byte ${i.byte}, bit ${i.bits.join('+')}, ${i.confidence})`);
    }
  }
  if (!kind || kind === 'fuse') {
    for (const car of FUSE_CARS) {
      if (norm(car.brand) !== norm(v.brand)) continue;
      for (const box of car.boxes) {
        for (const f of box.fuses) {
          const line = `${box.name} (${box.location}) fuse ${f.id}: ${f.fn}${f.amps ? ` (${f.amps.join('/')} A)` : ''}`;
          if (q.length && hit(line)) out.push(`[built-in fuses, ${car.title}] ${line}`);
        }
      }
    }
  }
  return out.slice(0, 60);
}
