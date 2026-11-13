// Discover mode storage: what each module answered, per car, so a sweep can
// stop and carry on later and the result can be sent back to be built in.
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ModuleGroup } from './obd/modules';
import { sensorsFor } from './obd/sensors';

export interface FoundDid {
  // Hex samples, oldest first (up to 6).
  samples: string[];
  // True once two samples differ: a live value.
  moves?: boolean;
  // The owner's own name for it, or the AI's guess.
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
