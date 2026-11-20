// DPF regenerations seen by the monitor, kept per car on the phone, and the
// owner's words for where a DPF value comes from.
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { RegenEvent } from './dpf';

const KEY = 'caristini.dpfRegens.v1';
export const MAX_REGENS = 50;

// Saved and newly seen regenerations as one list, oldest first: one entry per
// start time, the newer copy winning (it has the end time), the last 50 kept.
export function mergeRegens(saved: RegenEvent[], seen: RegenEvent[]): RegenEvent[] {
  const byStart = new Map<number, RegenEvent>();
  for (const e of [...saved, ...seen]) byStart.set(e.start, e.end != null || !byStart.get(e.start)?.end ? e : byStart.get(e.start)!);
  return [...byStart.values()].sort((a, b) => a.start - b.start).slice(-MAX_REGENS);
}

async function all(): Promise<Record<string, RegenEvent[]>> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Record<string, RegenEvent[]>) : {};
  } catch {
    return {};
  }
}

export async function loadRegens(vin: string): Promise<RegenEvent[]> {
  return (await all())[vin] ?? [];
}

export async function saveRegens(vin: string, seen: RegenEvent[]): Promise<RegenEvent[]> {
  const list = await all();
  const next = mergeRegens(list[vin] ?? [], seen);
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify({ ...list, [vin]: next }));
  } catch {
    // Storage unavailable: the list still shows while the page is open.
  }
  return next;
}

// A value's source in the owner's words. The research files behind the values
// are named in the code (mazda6-sources Z5 capture); the page says what they are.
export function ownerSource(source: string | undefined): string {
  const s = (source ?? '').trim();
  if (!s) return '';
  if (/^mazda6-sources\b/i.test(s)) return 'Mazda6 research notes';
  if (/^vag-sources\b/i.test(s)) return 'VW group research notes';
  if (/^focus-st-sources\b/i.test(s)) return 'Focus ST research notes';
  // Public lists and forums keep their name; a file name in brackets is dropped.
  return s.replace(/\s*\((?:mazda6|vag|focus-st)-sources[^)]*\)/i, '');
}
