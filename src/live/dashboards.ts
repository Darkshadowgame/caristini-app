// Dashboard pages per car: each page has its own values and tile style.
import type { LivePid } from '../obd/pids';

export type TileStyle = 'gauge' | 'bar' | 'number' | 'graph';

export const TILE_STYLES: { id: TileStyle; label: string }[] = [
  { id: 'number', label: 'Number' },
  { id: 'gauge', label: 'Dial' },
  { id: 'bar', label: 'Bar' },
  { id: 'graph', label: 'Graph' },
];

export interface DashPage {
  id: string;
  name: string;
  style: TileStyle;
  pids: number[];
}

export const MAX_TILES = 8;
export const MAX_PAGES = 6;

// Speed, engine speed, coolant and intake pressure.
export const DEFAULT_SLOTS = [0x0d, 0x0c, 0x05, 0x0b];
// Second page on a new car: engine speed, load, intake air and timing.
const SECOND_PAGE = [0x0c, 0x04, 0x0f, 0x0e];

let seq = 0;
export function pageId(now = Date.now()): string {
  seq = (seq + 1) % 1000;
  return `p${now.toString(36)}${seq}`;
}

// Swaps values the car does not report for the next spare one it does.
export function fitSlots(wanted: number[], supported: number[], spares: number[]): number[] {
  const ok = new Set(supported);
  const left = spares.filter((p) => ok.has(p) && !wanted.includes(p));
  return wanted.map((p) => (ok.has(p) ? p : (left.shift() ?? p)));
}

export function defaultPages(supported: number[], spares: number[]): DashPage[] {
  return [{ id: 'main', name: 'Main', style: 'number', pids: fitSlots(DEFAULT_SLOTS, supported, spares) }];
}

// The car's saved pages, or the default page. Pages saved empty get the defaults.
export function pagesForCar(saved: DashPage[] | undefined, supported: number[], spares: number[]): DashPage[] {
  const ok = (saved ?? []).filter((p) => p && Array.isArray(p.pids) && p.pids.length);
  return ok.length ? ok : defaultPages(supported, spares);
}

export function addPage(pages: DashPage[], supported: number[], spares: number[], now = Date.now()): DashPage[] {
  if (pages.length >= MAX_PAGES) return pages;
  const base = pages.length === 1 ? SECOND_PAGE : DEFAULT_SLOTS;
  return [...pages, { id: pageId(now), name: `Page ${pages.length + 1}`, style: 'gauge', pids: fitSlots(base, supported, spares) }];
}

export function updatePage(pages: DashPage[], id: string, patch: Partial<Omit<DashPage, 'id'>>): DashPage[] {
  return pages.map((p) => (p.id === id ? { ...p, ...patch, pids: (patch.pids ?? p.pids).slice(0, MAX_TILES) } : p));
}

// Always keeps one page.
export function removePage(pages: DashPage[], id: string): DashPage[] {
  const next = pages.filter((p) => p.id !== id);
  return next.length ? next : pages;
}

// Adds a tile (repeating the last value, which the owner then changes) or
// removes the last one; 1 to 8 tiles.
export function resizePage(page: DashPage, count: number, supported: number[]): DashPage {
  const n = Math.max(1, Math.min(MAX_TILES, count));
  const pids = page.pids.slice(0, n);
  const spare = supported.filter((p) => !pids.includes(p));
  while (pids.length < n) pids.push(spare.shift() ?? pids[pids.length - 1]);
  return { ...page, pids };
}

// Dial and bar ranges, in the car's own units. Values outside clamp to the ends.
const RANGES: Record<number, [number, number]> = {
  0x0c: [0, 7000],
  0x0d: [0, 240],
  0x05: [0, 130],
  0x5c: [0, 150],
  0x0f: [-20, 80],
  0x46: [-20, 50],
  0x0b: [0, 250],
  0x33: [70, 110],
  0x0e: [-20, 50],
  0x10: [0, 250],
  0x06: [-25, 25],
  0x07: [-25, 25],
  0x08: [-25, 25],
  0x09: [-25, 25],
  0x2d: [-100, 100],
  0x44: [0.6, 1.4],
  0x24: [0.6, 1.4],
  0x28: [0.6, 1.4],
  0x34: [0.6, 1.4],
  0x38: [0.6, 1.4],
  0x42: [10, 16],
  0x3c: [0, 1000],
  0x5e: [0, 40],
  0x61: [0, 100],
  0x62: [0, 100],
};

export function rangeFor(p: Pick<LivePid, 'pid' | 'unit'>, seen?: { min: number; max: number } | null): [number, number] | null {
  const fixed = RANGES[p.pid];
  if (fixed) return fixed;
  if (p.unit === '%') return [0, 100];
  if (p.unit === 'V') return [0, 1.1];
  if (seen && seen.max > seen.min) return [Math.min(0, seen.min), seen.max];
  return null;
}

// 0 to 1 along the range.
export function fraction(v: number, range: [number, number]): number {
  const [lo, hi] = range;
  if (hi <= lo) return 0;
  return Math.min(1, Math.max(0, (v - lo) / (hi - lo)));
}

// Shift light: on at or above the set engine speed. 0 or unset: off.
export function shiftLightOn(rpm: number | null | undefined, at: number | null | undefined, wasOn = false): boolean {
  if (!at || at <= 0 || rpm == null) return false;
  // Comes on at the set speed and goes off only 150 rpm below it, so holding
  // the engine near the set speed does not flicker the light (and the buzz).
  return wasOn ? rpm >= at - SHIFT_HYSTERESIS_RPM : rpm >= at;
}
export const SHIFT_HYSTERESIS_RPM = 150;

// Shift light speed typed by the owner: 0 when empty (off), null when it is
// not a number from 1000 to 12000 rpm.
export const SHIFT_MIN_RPM = 1000;
export const SHIFT_MAX_RPM = 12000;
export function shiftRpmFrom(text: string): number | null {
  const s = text.trim().replace(',', '.');
  if (!s) return 0;
  if (!/^\d*\.?\d+$/.test(s)) return null;
  const n = Number(s);
  return n < SHIFT_MIN_RPM || n > SHIFT_MAX_RPM ? null : Math.round(n);
}

// The Shift light button says whether it is set.
export function shiftLabel(rpm: number): string {
  return rpm > 0 ? `Shift light ${rpm}` : 'Shift light';
}
