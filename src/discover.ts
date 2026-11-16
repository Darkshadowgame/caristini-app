// Discover mode storage: what each module answered, per car, so a sweep can
// stop and carry on later and the result can be sent back to be built in.
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ModuleGroup } from './obd/modules';
import { sensorsFor } from './obd/sensors';
import { durationText } from './timeText';

export interface FoundDid {
  // Hex samples, oldest first (up to 6).
  samples: string[];
  // True once two samples differ: a live value.
  moves?: boolean;
  // The owner's own name for it; guess is kept from data saved by older versions.
  label?: string;
  guess?: string;
}

export interface DiscoverModule {
  id: string;
  name: string;
  tx: string;
  rx: string;
  // Next identifier to ask (resume point) and whether the sweep finished.
  nextDid?: number;
  finished?: boolean;
  silent?: boolean;
  // The quick explore (blocks around known values) has run on this module.
  quickDone?: boolean;
  // Where Learn my car's quick sweep stopped short; the next run carries on.
  learnNext?: number;
  // The ranges learnNext belongs to; a resume point from other ranges is not used.
  learnRanges?: string;
  // The ranges Learn my car swept to the end: not swept again until a full read.
  learnDone?: string;
  found: Record<string, FoundDid>;
}

// Quick explore: the blocks of 256 value numbers that hold values already
// known for this module (public lists, the owner's other cars, findings sent
// back), plus F400 to F4FF, where makers keep live values. Values sit in
// clusters, so this is where most are, at a small part of the full list.
export function quickRanges(knownDids: string[]): [number, number][] {
  const blocks = new Set<number>([0xf400]);
  for (const d of knownDids) {
    const n = parseInt(d, 16);
    if (Number.isFinite(n)) blocks.add(n & 0xff00);
  }
  return [...blocks].sort((a, b) => a - b).map((b) => [b, b + 0xff] as [number, number]);
}

// One quick explore for Learn my car and Unknown values: the blocks around
// values already known for the module. F400 to F4FF is swept on the engine
// (7E0) only: on other modules it held copies of standard OBD values (Mazda6
// 2016 scan, 14 Nov 2026).
export function quickExploreRanges(tx: string, knownDids: string[]): [number, number][] {
  return quickRanges(knownDids).filter(([a]) => tx === '7E0' || a !== 0xf400);
}

// Both screens keep the quick explore's progress in the same fields
// (learnNext, learnRanges, learnDone), so either carries on where the other
// stopped. quickDone and finished are from older versions and the full explore.
export function quickDone(m: DiscoverModule | undefined, key: string): boolean {
  // A module that was silent during an older quick explore was saved as done:
  // it is asked again.
  return !!m && (m.learnDone === key || (!!m.quickDone && !m.silent) || !!m.finished);
}

export function quickResume(m: DiscoverModule | undefined, key: string): number | undefined {
  return m && m.learnRanges === key ? m.learnNext : undefined;
}

// The module after a quick explore: finished, cut short (carries on from the
// next value) or silent (tried again next time).
export function afterQuick(m: DiscoverModule, key: string, swept: { finished: boolean; lastDid?: number | null }): DiscoverModule {
  const done = swept.finished || swept.lastDid == null;
  const silent = !swept.finished && swept.lastDid == null && !Object.keys(m.found).length;
  return {
    ...m,
    learnNext: done ? undefined : swept.lastDid! + 1,
    learnRanges: done ? undefined : key,
    learnDone: swept.finished ? key : undefined,
    silent: silent || undefined,
  };
}

// What Unknown values shows for a module, from the one store both screens
// write: values found by either, and older VW modules' value groups.
export function exploreStatus(
  m: DiscoverModule | undefined,
  // older: the module speaks the older VW protocol, so its values are read
  // in value groups; groupsDone: every group was read; groupsStarted: a read
  // stopped part-way and carries on.
  opts: { key?: string; older?: boolean; groups?: Record<string, string[]>; groupsDone?: boolean; groupsStarted?: boolean } = {},
): { text: string; state: 'done' | 'partial' | 'silent' | 'none' } {
  const groups = Object.values(opts.groups ?? {}).filter((u) => u.length);
  if (opts.older || groups.length) {
    const values = groups.reduce((n, u) => n + u.length, 0);
    const text = `${values} value${values === 1 ? '' : 's'} in ${groups.length} value group${groups.length === 1 ? '' : 's'}`;
    if (opts.groupsDone) return { text: groups.length ? text : 'Value groups read: none hold values', state: 'done' };
    if (groups.length || opts.groupsStarted) return { text: `${text}, carries on`, state: 'partial' };
    return { text: 'Value groups not read yet', state: 'none' };
  }
  const n = Object.keys(m?.found ?? {}).length;
  const moving = Object.values(m?.found ?? {}).filter((f) => f.moves).length;
  const found = `${n} value${n === 1 ? '' : 's'}, ${moving} moving`;
  if (m?.finished) return { text: `Full explore done: ${found}`, state: 'done' };
  if (m?.silent && !n) return { text: 'Did not answer', state: 'silent' };
  if (m && quickDone(m, opts.key ?? '')) return { text: n ? `Quick explore done: ${found}` : 'Quick explore done: nothing found', state: 'done' };
  if (m && (m.learnNext != null || m.nextDid != null)) return { text: `${n} found so far, carries on`, state: 'partial' };
  if (n) return { text: found, state: 'partial' };
  return { text: 'Not explored yet', state: 'none' };
}

export interface Discovery {
  vin: string;
  started: number;
  updated: number;
  modules: Record<string, DiscoverModule>;
  sentAt?: number;
}

// Where maker values usually live, per maker. The full 0000 to FFFF space is
// 65,536 questions per module, far too slow over Bluetooth; these ranges hold
// the measured values in every public list (OBDb, Ford and VW tool exports).
export const DISCOVER_RANGES: Record<ModuleGroup | 'other', [number, number][]> = {
  vag: [
    [0x0100, 0x04ff],
    [0x1000, 0x2fff],
    [0x3800, 0x3fff],
    [0x4000, 0x42ff],
    [0xf400, 0xf4ff],
  ],
  ford: [
    [0x0300, 0x06ff],
    [0x1000, 0x1fff],
    [0x4000, 0x40ff],
    [0xdd00, 0xddff],
    [0xf400, 0xf4ff],
  ],
  mazda: [
    [0x0300, 0x06ff],
    [0x1000, 0x1fff],
    [0x4000, 0x40ff],
    [0xdd00, 0xddff],
    [0xf400, 0xf4ff],
  ],
  all: [
    [0x0100, 0x06ff],
    [0x1000, 0x2fff],
    [0xf400, 0xf4ff],
  ],
  other: [
    [0x0100, 0x06ff],
    [0x1000, 0x2fff],
    [0xf400, 0xf4ff],
  ],
};

export const rangeSize = (r: [number, number][]) => r.reduce((n, [a, b]) => n + b - a + 1, 0);

const key = (vin: string) => `caristini.discover.${vin}`;

export async function loadDiscovery(vin: string): Promise<Discovery> {
  try {
    const raw = await AsyncStorage.getItem(key(vin));
    if (raw) return JSON.parse(raw) as Discovery;
  } catch {
    // fall through
  }
  return { vin, started: Date.now(), updated: Date.now(), modules: {} };
}

export async function saveDiscovery(d: Discovery): Promise<void> {
  try {
    await AsyncStorage.setItem(key(d.vin), JSON.stringify({ ...d, updated: Date.now() }));
  } catch {
    // Storage unavailable
  }
}

export function addSample(f: FoundDid | undefined, hex: string): FoundDid {
  const samples = [...(f?.samples ?? []), hex].slice(-6);
  return { ...f, samples, moves: f?.moves || new Set(samples).size > 1 };
}

// What a known list calls this identifier on this module, if anything.
export function knownName(group: ModuleGroup | 'other' | undefined, tx: string, did: string): string | null {
  const r = sensorsFor(group).find((s) => s.h === tx && s.d === did);
  return r ? r.n : null;
}

// Plain readings of unknown bytes, to help guess what a value is.
export function readings(hex: string): string[] {
  const b = (hex.match(/../g) ?? []).map((h) => parseInt(h, 16));
  const out: string[] = [];
  if (b.length >= 1) out.push(`${b[0]} as a number`, `${b[0] - 40} °C if a temperature`);
  if (b.length >= 2) {
    const u16 = b[0] * 256 + b[1];
    out.push(`${u16} as a 2-byte number`, `${(u16 / 10).toFixed(1)} at 0.1 steps`);
  }
  if (b.length >= 3 && b.length <= 4) out.push(`${b.reduce((n, x) => n * 256 + x, 0)} as a ${b.length}-byte number`);
  const text = b.map((x) => (x >= 0x20 && x < 0x7f ? String.fromCharCode(x) : '')).join('');
  if (text.replace(/\s/g, '').length >= 4 && text.length >= b.length * 0.8) out.unshift(`Text: "${text.trim()}"`);
  return out;
}

// The modules to offer for exploring: those that answered the last health
// check (modulesSeen), plus any explored before. With no check yet, all.
export function modulesToExplore<T extends { id: string }>(defs: T[], seen: string[] | undefined, disc: Discovery | null | undefined): T[] {
  if (!seen?.length) return defs;
  return defs.filter((d) => seen.includes(d.id) || Object.keys(disc?.modules[d.id]?.found ?? {}).length > 0);
}

// Seconds a full explore takes for one module: about 70 ms a value number.
export const fullSeconds = (perModule: number) => perModule * 0.07;

// "about 14 minutes", "about 3 hours", "about 2 hours 50 minutes", "about 30
// seconds": the app's one duration wording (src/timeText.ts).
export function aboutTime(seconds: number): string {
  return `about ${durationText(seconds)}`;
}
