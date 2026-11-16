// Value picker helpers: text search over the standard values and named sets
// of values saved per car.
import type { LivePid } from '../obd/pids';

export interface ValueSet {
  name: string;
  pids: number[];
}

// Matches every word of the query against the name, group and unit, and the
// PID number in hex ("0C" or "010C"). "fuel trim" finds all four trims.
export function matchesQuery(p: Pick<LivePid, 'pid' | 'label' | 'group' | 'unit'>, query: string): boolean {
  const words = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  const hex = p.pid.toString(16).padStart(2, '0');
  const hay = `${p.label} ${p.group} ${p.unit} ${hex} 01${hex}`.toLowerCase();
  return words.every((w) => hay.includes(w));
}

export function filterPids<T extends Pick<LivePid, 'pid' | 'label' | 'group' | 'unit'>>(list: T[], query: string): T[] {
  return list.filter((p) => matchesQuery(p, query));
}

// Saves a set under its name (same name, case aside, replaces it), newest first.
export function saveSet(sets: ValueSet[], name: string, pids: number[]): ValueSet[] {
  const clean = name.trim().replace(/\s+/g, ' ');
  if (!clean || !pids.length) return sets;
  return [{ name: clean, pids: [...pids] }, ...sets.filter((s) => s.name.toLowerCase() !== clean.toLowerCase())];
}

export function removeSet(sets: ValueSet[], name: string): ValueSet[] {
  return sets.filter((s) => s.name !== name);
}

// A saved set on this car: only the values the car reports, in saved order.
export function loadSet(set: ValueSet, available: number[]): number[] {
  const ok = new Set(available);
  return set.pids.filter((p) => ok.has(p));
}
