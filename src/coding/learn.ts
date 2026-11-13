// Learn from Carista (or the car's own menus): Caristini saves module values,
// the owner changes one setting elsewhere, and Caristini reads again. The bytes
// that changed become a switch for this car. Nothing is guessed: the values
// come from the owner's own car.
//
// Values are keyed by module id for long coding (DID 0600), or by
// "moduleId:DID" for any other data identifier found by a deep compare.

// Key -> value as hex.
export type Snapshot = Record<string, string>;

export interface LearnedPart {
  module: string;
  // Data identifier when not the long coding.
  did?: string;
  // Value length when learned; the switch is only offered at this length.
  length: number;
  byte: number;
  // Bits the other tool changed in this byte.
  mask: number;
  // Those bits when the setting is on (as set by the other tool) and off (as before).
  on: number;
  off: number;
  // The module's part number when learned, so the setting can be offered on
  // another car with the same module (src/coding/shared.ts).
  part?: string;
}

export interface LearnedSetting {
  id: string;
  title: string;
  learnedAt: string;
  parts: LearnedPart[];
  // Login code the module asked for when this was learned, if any.
  login?: number;
}

export const fromHex = (hex: string): number[] => (hex.match(/../g) ?? []).map((h) => parseInt(h, 16));

export const partKey = (p: { module: string; did?: string }) => (p.did ? `${p.module}:${p.did}` : p.module);

export function splitKey(key: string): { module: string; did?: string } {
  const [module, did] = key.split(':');
  return did ? { module, did } : { module };
}

// What changed between two snapshots. Values missing from either side, or
// whose length changed, are not comparable and are reported apart.
export function diffSnapshots(before: Snapshot, after: Snapshot): { parts: LearnedPart[]; skipped: string[] } {
  const parts: LearnedPart[] = [];
  const skipped: string[] = [];
  for (const key of Object.keys(before)) {
    const a = after[key];
    if (a == null) continue;
    const x = fromHex(before[key]);
    const y = fromHex(a);
    if (x.length !== y.length) {
      skipped.push(key);
      continue;
    }
    for (let i = 0; i < x.length; i++) {
      const mask = x[i] ^ y[i];
      if (mask) parts.push({ ...splitKey(key), length: x.length, byte: i, mask, on: y[i] & mask, off: x[i] & mask });
    }
  }
  return { parts, skipped };
}

// Keys (module, or module:DID) a setting touches.
export const learnedKeys = (s: LearnedSetting) => [...new Set(s.parts.map(partKey))];
export const learnedModules = (s: LearnedSetting) => [...new Set(s.parts.map((p) => p.module))];

// On when every changed bit holds the value the other tool set.
export function learnedIsOn(s: LearnedSetting, values: Record<string, number[] | null>): boolean {
  return s.parts.every((p) => {
    const c = values[partKey(p)];
    return !!c && (c[p.byte] & p.mask) === p.on;
  });
}

// Offered only when every value it touches answers with the learned length.
export function learnedReady(s: LearnedSetting, values: Record<string, number[] | null>): boolean {
  return s.parts.every((p) => values[partKey(p)]?.length === p.length);
}

// New value for one key with the setting on or off; other bits unchanged.
export function withLearned(s: LearnedSetting, key: string, value: number[], on: boolean): number[] {
  const next = [...value];
  for (const p of s.parts) {
    if (partKey(p) !== key) continue;
    next[p.byte] = ((next[p.byte] & ~p.mask) | (on ? p.on : p.off)) & 0xff;
  }
  return next;
}
