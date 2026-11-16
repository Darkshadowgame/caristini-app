// Knock and timing monitor: pure logic, tested in __tests__/monitors.test.ts.
//
// Sources:
// - Group 020 on the 2007 SEAT Leon Cupra (BWJ, Bosch MED9.1): fields 1 to 4
//   are knock retard for cylinders 1 to 4 in degrees crank angle (High:
//   replica/leon-groups.md, "001 to 020" table, sources SC1 Leon log, AP1,
//   RT1, AZ1, AW1). Group 003 field 4 is ignition timing and group 115 is
//   boost requested and actual (both High, same note).
// - Degree formulas 3, 4, 9 and 27 from the public formula table in
//   replica/leon-sources.md section 4.2 (P4 blafusel; formula 4 agreed by P1).
//   Which of them the MED9.1 uses for group 020 is not documented, so all four
//   are decoded and any other formula is treated as "not degrees".
// - Guide figure: retard above 3 degrees is forum opinion, not a maker figure
//   (replica/market-research-2026-11-15.md section 4 and section 3 row 3,
//   source [48] Audizine "timing pull under boost", snippet). The 0 to 12
//   degree range in the same note comes from other VAG engines, so it is only
//   mentioned in help, not used as a limit.
// - Sign: leon-groups.md does not say whether retard is shown as a positive or
//   negative number, so the size of the value is used.
// - Ford Focus ST: knock and octane adjust need Ford identifiers that were not
//   found (market-research section 3 row 3; focus-st-sources section 5 has no
//   knock DID). Timing advance is the standard PID 0E (SAE J1979, Wikipedia
//   OBD-II PIDs, source [53]).
import type { MeasuringCell } from '../obd/tp20';

export const KNOCK_GROUP = 20;
// Related groups shown with 020 (leon-groups.md, High): 003 rpm, air mass,
// throttle, ignition timing; 115 rpm, load, boost requested, boost actual.
export const KNOCK_RELATED = [3, 115];
// Forum guide, see the header. Applied to one cylinder, and to how far one
// cylinder pulls beyond the highest of the others.
export const KNOCK_GUIDE_DEG = 3;
export const KNOCK_GUIDE_SOURCE = 'Owner forum guide (Audizine), not a SEAT figure';

// Decodes a degree value from a measuring cell. Cells with formulas the
// app's table does not know arrive as raw a*256+b, so a and b are recovered.
export function cellDegrees(c: MeasuringCell): number | null {
  if (c.unit === '°' || c.unit === 'deg' || c.unit === '°CA') return typeof c.value === 'number' ? c.value : null;
  if (typeof c.value !== 'number') return null;
  const a = Math.floor(c.value / 256);
  const b = c.value % 256;
  if (c.known) return null;
  switch (c.formula) {
    case 0x03:
      return 0.002 * a * b;
    case 0x04:
      // BTDC when b <= 127, ATDC above (P4); P11 gives the signed form.
      return (b - 127) * 0.01 * a;
    case 0x09:
      return (b - 127) * 0.02 * a;
    case 0x1b:
      return Math.abs(b - 128) * 0.01 * a;
    default:
      return null;
  }
}

// Knock retard per cylinder from group 020: size in degrees, or null when a
// field is missing or not in degrees.
export function retardsFrom(cells: MeasuringCell[] | null): (number | null)[] {
  if (!cells) return [];
  return cells.slice(0, 4).map((c) => {
    const d = cellDegrees(c);
    return d == null ? null : Math.abs(d);
  });
}

export type KnockLevel = 'ok' | 'watch' | 'warn' | 'none';

export interface KnockAssessment {
  level: KnockLevel;
  // Highest retard and its cylinder (1-based).
  worst: number | null;
  worstCylinder: number | null;
  // Highest minus lowest of the cylinders read.
  spread: number | null;
  // Cylinder that pulls at least the guide figure more than every other one.
  outlier: number | null;
  // Cylinders over the guide figure (1-based).
  over: number[];
}

// The spread rule: a cylinder is an outlier when its retard exceeds the
// highest of the other cylinders by the guide figure or more. Any retard at
// all is "watch"; over the guide or an outlier is "warn".
export function assessKnock(retards: (number | null)[], guide = KNOCK_GUIDE_DEG): KnockAssessment {
  const read = retards.map((r, i) => ({ r, cyl: i + 1 })).filter((x): x is { r: number; cyl: number } => x.r != null && Number.isFinite(x.r));
  if (!read.length) return { level: 'none', worst: null, worstCylinder: null, spread: null, outlier: null, over: [] };
  const worst = read.reduce((m, x) => (x.r > m.r ? x : m), read[0]);
  const least = Math.min(...read.map((x) => x.r));
  let outlier: number | null = null;
  if (read.length >= 2) {
    const othersMax = Math.max(...read.filter((x) => x.cyl !== worst.cyl).map((x) => x.r));
    if (worst.r - othersMax >= guide) outlier = worst.cyl;
  }
  const over = read.filter((x) => x.r > guide).map((x) => x.cyl);
  const level: KnockLevel = over.length || outlier != null ? 'warn' : worst.r > 0 ? 'watch' : 'ok';
  return { level, worst: worst.r, worstCylinder: worst.cyl, spread: worst.r - least, outlier, over };
}

// Running totals for one monitoring session.
export interface KnockSession {
  samples: number;
  // Peak retard per cylinder (index 0 = cylinder 1).
  peak: number[];
  // Samples where each cylinder was the outlier, and over the guide figure.
  outlierCount: number[];
  overCount: number[];
  // Samples with any retard at all.
  withRetard: number;
}

export function newKnockSession(cylinders = 4): KnockSession {
  return { samples: 0, peak: Array(cylinders).fill(0), outlierCount: Array(cylinders).fill(0), overCount: Array(cylinders).fill(0), withRetard: 0 };
}

export function addKnockSample(s: KnockSession, retards: (number | null)[], guide = KNOCK_GUIDE_DEG): KnockSession {
  const a = assessKnock(retards, guide);
  if (a.level === 'none') return s;
  const peak = s.peak.map((p, i) => Math.max(p, retards[i] ?? 0));
  const outlierCount = s.outlierCount.map((n, i) => n + (a.outlier === i + 1 ? 1 : 0));
  const overCount = s.overCount.map((n, i) => n + (a.over.includes(i + 1) ? 1 : 0));
  return { samples: s.samples + 1, peak, outlierCount, overCount, withRetard: s.withRetard + (a.worst! > 0 ? 1 : 0) };
}

// The session summary in one plain line.
export function sessionVerdict(s: KnockSession, guide = KNOCK_GUIDE_DEG): { level: KnockLevel; text: string } {
  if (!s.samples) return { level: 'none', text: 'No readings yet.' };
  const peakAll = assessKnock(s.peak, guide);
  const repeat = s.outlierCount.findIndex((n) => n === Math.max(...s.outlierCount));
  if (s.outlierCount[repeat] > 0) {
    return { level: 'warn', text: `Cylinder ${repeat + 1} pulled timing ${guide}° or more beyond the others in ${s.outlierCount[repeat]} of ${s.samples} readings.` };
  }
  if (peakAll.over.length) return { level: 'warn', text: `Peak retard ${peakAll.worst!.toFixed(1)}° on cylinder ${peakAll.worstCylinder}, over the ${guide}° guide.` };
  if (s.withRetard) return { level: 'watch', text: `Some retard seen (peak ${peakAll.worst!.toFixed(1)}° on cylinder ${peakAll.worstCylinder}), within the ${guide}° guide.` };
  return { level: 'ok', text: `No knock retard in ${s.samples} readings.` };
}

// What the monitor can show for a car.
export type KnockSupport =
  | { kind: 'groups' }
  | { kind: 'diesel' }
  | { kind: 'timing-only'; why: string }
  | { kind: 'none'; why: string };

export function knockSupport(v: { group: string; fuel: 'Petrol' | 'Diesel' | null } | null | undefined, diesel: boolean): KnockSupport {
  if (diesel || v?.fuel === 'Diesel') return { kind: 'diesel' };
  if (v?.group === 'vag') return { kind: 'groups' };
  if (v?.group === 'ford') return { kind: 'timing-only', why: 'Knock and octane values for the Focus ST are not known: the Ford identifiers have not been found.' };
  return { kind: 'timing-only', why: 'Knock values for this car are not known.' };
}
