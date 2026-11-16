// Boost actual vs requested. Pressures are absolute, in mbar.
// SEAT Leon Cupra (BWJ, MED9.1): engine group 115 holds engine speed, load,
// boost requested and boost actual (replica/leon-groups.md, High confidence).
// Other cars: standard PID 70 (boost pressure control, SAE J1979) where the
// engine computer reports it; the view is hidden otherwise.
import type { LivePid } from '../obd/pids';

export const LEON_BOOST_GROUP = 115;
export const BOOST_PID = 0x70;
// Gap between actual and requested that counts as off target.
export const BOOST_TOLERANCE_MBAR = 150;

export interface BoostSample {
  at: number;
  rpm: number | null;
  requested: number;
  actual: number;
}

interface Cell {
  value: number | string;
  unit: string;
}

// Group 115 cells: 1 engine speed, 2 load, 3 boost requested, 4 boost actual.
// The unit comes from each cell's formula byte; anything but mbar is refused,
// in case this engine's software lays the group out differently.
export function leonBoost(cells: Cell[] | null | undefined): { rpm: number | null; requested: number; actual: number } | null {
  if (!cells || cells.length < 4) return null;
  const [rpm, , req, act] = cells;
  if (req.unit !== 'mbar' || act.unit !== 'mbar' || typeof req.value !== 'number' || typeof act.value !== 'number') return null;
  return { rpm: rpm.unit === 'rpm' && typeof rpm.value === 'number' ? rpm.value : null, requested: req.value, actual: act.value };
}

// PID 70 data bytes A to J. A: bit 0 commanded boost A reported, bit 1 boost
// sensor A reported. B-C commanded, D-E actual, each 1/32 kPa per bit.
export function decodePid70(d: number[]): { requested: number | null; actual: number | null } {
  if (d.length < 5) return { requested: null, actual: null };
  const kpa = (hi: number, lo: number) => (hi * 256 + lo) / 32;
  return {
    requested: d[0] & 0x01 ? kpa(d[1], d[2]) * 10 : null,
    actual: d[0] & 0x02 ? kpa(d[3], d[4]) * 10 : null,
  };
}

// PID 70 as two live values, so the normal reader can ask for it.
export const PID70_REQUESTED: LivePid = {
  pid: BOOST_PID,
  label: 'Boost requested',
  unit: 'mbar',
  group: 'Air and exhaust',
  bytes: 5,
  decimals: 0,
  decode: (d) => decodePid70(d).requested,
};
export const PID70_ACTUAL: LivePid = { ...PID70_REQUESTED, label: 'Boost actual', decode: (d) => decodePid70(d).actual };

export type BoostState = 'ok' | 'under' | 'over';

export function boostDeviation(requested: number, actual: number, tolerance = BOOST_TOLERANCE_MBAR): { diff: number; state: BoostState } {
  const diff = actual - requested;
  return { diff, state: diff < -tolerance ? 'under' : diff > tolerance ? 'over' : 'ok' };
}

// The largest shortfall and overshoot in the samples, for the summary line.
export function boostSummary(samples: BoostSample[]): { worstUnder: number; worstOver: number; peakActual: number | null } {
  let worstUnder = 0;
  let worstOver = 0;
  let peak: number | null = null;
  for (const s of samples) {
    const d = s.actual - s.requested;
    worstUnder = Math.min(worstUnder, d);
    worstOver = Math.max(worstOver, d);
    peak = peak == null ? s.actual : Math.max(peak, s.actual);
  }
  return { worstUnder, worstOver, peakActual: peak };
}

// Shown in kPa, the unit Live data uses for intake pressure (MAP), so both
// pages read the same: 1 kPa = 10 mbar.
export function mbarToKpa(mbar: number): number {
  return mbar / 10;
}

// "185 kPa", or with signed: "+12 kPa" / "−12 kPa" (a true minus sign).
export function kpaText(mbar: number, signed = false): string {
  const k = Math.round(mbarToKpa(mbar));
  const n = Math.abs(k).toLocaleString('en-GB');
  if (!signed) return `${k < 0 ? '−' : ''}${n} kPa`;
  return `${k > 0 ? '+' : k < 0 ? '−' : ''}${n} kPa`;
}

// Keeps the last n samples.
export function pushSample(list: BoostSample[], s: BoostSample, n = 120): BoostSample[] {
  const next = [...list, s];
  return next.length > n ? next.slice(next.length - n) : next;
}
