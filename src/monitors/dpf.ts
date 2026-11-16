// DPF monitor for the diesels: pure logic, tested in __tests__/monitors.test.ts.
//
// Standard values (any diesel that lists them in its Mode 01 support list):
// - PID 7A "DPF differential pressure", bank 1, and 7B, bank 2, 7 data bytes
//   (Wikipedia OBD-II PIDs, market-research source [53]; focus-st-sources FS24).
//   Wikipedia gives no byte layout. The layout used here, byte A = support
//   bits and bytes B-C = signed pressure / 100 kPa, is the one mazda6-sources
//   section 4 gives for the Mazda PCM's F47A (Z8, Medium), which carries the
//   same value. Inlet and outlet pressure bytes are not decoded.
// - PID 7C (DPF temperature) is listed with 9 bytes but its byte layout was
//   not found, so it is not read.
// Maker values:
// - Mazda6 2.2 Skyactiv-D: regeneration running 0380, count 0432, distance
//   since last regeneration 0434, soot load 042C and target 044B, pressure
//   F47A (mazda6-sources section 4, Medium; scales Low). Decoders are the
//   ones in src/obd/extras.ts.
// - Audi A6 C7 2.0 TDI: regeneration status and distance identifiers were not
//   found (market-research section 3 row 4). The VW soot and ash values in
//   extras.ts come from other 2.0 TDI engines (T6 forum) and show only if the
//   car answers.
// - Ford: no Ford DPF DID found (focus-st-sources section 5).
// - Any car: the sensors Find my car's sensors (or Learn my car) found on it
//   under "Diesel filter and exhaust" are read too, by their own names.
import { EXTRAS, ExtraValue } from '../obd/extras';
import type { LivePid } from '../obd/pids';
import { categoryOf, type SensorRow } from '../obd/sensors';

const s16 = (hi: number, lo: number) => ((hi << 8) | lo) - (hi & 0x80 ? 0x10000 : 0);

// Data bytes after "41 7A" (or "41 7B"): signed(B*256+C)/100 kPa. Byte A
// holds support bits; bit 0 says the pressure difference is supported
// (Wikipedia "OBD-II PIDs", service 01 PID 7A). Without it, B-C mean nothing.
export function decodeDpfDelta(d: number[]): number | null {
  if (d.length < 3 || !(d[0] & 0x01)) return null;
  return s16(d[1], d[2]) / 100;
}

export const DPF_PIDS: LivePid[] = [
  { pid: 0x7a, label: 'DPF pressure difference (bank 1)', unit: 'kPa', group: 'Air and exhaust', bytes: 3, decimals: 2, decode: decodeDpfDelta },
  { pid: 0x7b, label: 'DPF pressure difference (bank 2)', unit: 'kPa', group: 'Air and exhaust', bytes: 3, decimals: 2, decode: decodeDpfDelta },
];

// What the monitor reads for a car.
export interface DpfPlan {
  // Standard PIDs this car lists as supported.
  standard: LivePid[];
  // Maker values to try (shown only if the car answers).
  maker: ExtraValue[];
  // Maker value giving regeneration on / off, if known for this car.
  regen: ExtraValue | null;
  // The car's own sensors under "Diesel filter and exhaust" that it answered.
  found: SensorRow[];
  // Plain lines for values that are not known for this car.
  notKnown: string[];
}

// Names of the car's own sensors that stand in for each value.
const REGEN_RE = /\bregenerat\w*\b.*\b(status|active|request|running|in progress)\b|\b(status|active)\b.*\bregenerat/i;
const DIST_RE = /\b(distance|km|mileage)\b.*\b(since|after)\b.*\bregenerat|\bregenerat\w*\b.*\bdistance\b/i;
const DP_RE = /\b(differential|delta) pressure\b|\bpressure (difference|differential|drop)\b/i;

// The car's found sensors that belong on the DPF monitor.
// Only values about the particulate filter itself (the wider category also
// holds lambda, EGR, catalyst and odometer rows), never petrol-filter values,
// and one row per address.
const DPF_ONLY_RE = /soot|particulate|DPF|regenerat|differential pressure|ash (mass|load)/i;
export function dpfSensors(found: SensorRow[]): SensorRow[] {
  const seen = new Set<string>();
  return found.filter((r) => {
    if (categoryOf(r) !== 'Diesel filter and exhaust' || !DPF_ONLY_RE.test(r.n) || /petrol/i.test(r.n)) return false;
    const k = `${r.h}-${r.d}-${r.b ?? 0}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

export function dpfPlan(group: string, supported: Set<number>, foundRows: SensorRow[] = []): DpfPlan {
  const standard = DPF_PIDS.filter((p) => supported.has(p.pid));
  const maker = EXTRAS.filter((e) => e.group === group && e.category === 'Diesel particulate filter');
  const regen = maker.find((e) => e.id.endsWith('-regen')) ?? null;
  const found = dpfSensors(foundRows);
  const has = (suffix: string) => maker.some((e) => e.id.endsWith(suffix));
  const named = (re: RegExp) => found.some((r) => re.test(r.n));
  const notKnown: string[] = [];
  if (!regen && !named(REGEN_RE)) notKnown.push('Regeneration status: not known for this car.');
  if (!has('-regen-dist') && !named(DIST_RE)) notKnown.push('Distance since last regeneration: not known for this car.');
  if (!standard.length && !has('-dpf-dp') && !named(DP_RE)) notKnown.push('Pressure difference: this car does not list the standard value, and no maker value is known.');
  return { standard, maker, regen, found, notKnown };
}

// Regeneration events seen while the monitor is open.
export interface RegenEvent {
  start: number;
  end?: number;
}

// Adds one regeneration on/off reading at time t. Starts an event on the
// change to on, closes it on the change to off. Unknown readings change nothing.
export function trackRegen(events: RegenEvent[], on: boolean | null, t: number): RegenEvent[] {
  if (on == null) return events;
  const open = events.length && events[events.length - 1].end == null ? events[events.length - 1] : null;
  if (on && !open) return [...events, { start: t }];
  if (!on && open) return [...events.slice(0, -1), { ...open, end: t }];
  return events;
}

export function regenMinutes(e: RegenEvent, now: number): number {
  return ((e.end ?? now) - e.start) / 60000;
}
