// Service 09: vehicle information. Calibration IDs (PID 04), calibration
// verification numbers (CVN, PID 06), in-use performance counters (PID 08
// petrol, PID 0B diesel) and the unit's name (PID 0A). Reads only.
//
// Source for the PIDs and the counter order: Wikipedia, "OBD-II PIDs",
// Service 09 (https://en.wikipedia.org/wiki/OBD-II_PIDs): PID 04 up to 16
// ASCII characters per calibration ID, PID 06 4 bytes per CVN, PID 08 and 0B
// pairs of 2-byte counters in the order listed below, PID 0A 20 ASCII
// characters padded with nulls.
// On CAN each reply is 49 PID count data...; on older protocols each message
// is 49 PID sequence data... with 4 data bytes. Both put data from byte 3 on.
import { supportedFromMask } from '../obd/pids';

const hex2 = (n: number) => n.toString(16).toUpperCase().padStart(2, '0');

// In-use performance tracking, counter order (Wikipedia, Service 09 PID 08).
export const SPARK_COUNTERS = [
  'OBDCOND', 'IGNCNTR', 'CATCOMP1', 'CATCOND1', 'CATCOMP2', 'CATCOND2', 'O2SCOMP1', 'O2SCOND1', 'O2SCOMP2', 'O2SCOND2',
  'EGRCOMP', 'EGRCOND', 'AIRCOMP', 'AIRCOND', 'EVAPCOMP', 'EVAPCOND', 'SO2SCOMP1', 'SO2SCOND1', 'SO2SCOMP2', 'SO2SCOND2',
];
// Compression ignition (Wikipedia, Service 09 PID 0B).
export const DIESEL_COUNTERS = [
  'OBDCOND', 'IGNCNTR', 'HCCATCOMP', 'HCCATCOND', 'NCATCOMP', 'NCATCOND', 'NADSCOMP', 'NADSCOND', 'PMCOMP', 'PMCOND',
  'EGSCOMP', 'EGSCOND', 'EGRCOMP', 'EGRCOND', 'BPCOMP', 'BPCOND', 'FUELCOMP', 'FUELCOND',
];

// Plain names for the monitor part of each counter pair (COMP / COND).
const MONITOR: Record<string, string> = {
  CAT1: 'Catalyst bank 1',
  CAT2: 'Catalyst bank 2',
  O2S1: 'Oxygen sensor bank 1',
  O2S2: 'Oxygen sensor bank 2',
  EGR: 'EGR and valve timing',
  AIR: 'Secondary air',
  EVAP: 'Evaporative system',
  SO2S1: 'Rear oxygen sensor bank 1',
  SO2S2: 'Rear oxygen sensor bank 2',
  HCCAT: 'NMHC catalyst',
  NCAT: 'NOx catalyst',
  NADS: 'NOx adsorber',
  PM: 'Particulate filter',
  EGS: 'Exhaust gas sensor',
  BP: 'Boost pressure',
  FUEL: 'Fuel system',
};

export interface InUseRatio {
  monitor: string;
  // Times the test finished, and times its driving conditions were met.
  completed: number;
  conditions: number;
  ratio: number | null;
}

export interface InUse {
  kind: 'petrol' | 'diesel';
  // Drives that met the general conditions (OBDCOND) and engine starts (IGNCNTR).
  obdConditions: number | null;
  ignitions: number | null;
  ratios: InUseRatio[];
}

export function parseInUse(words: number[], kind: 'petrol' | 'diesel'): InUse {
  const names = kind === 'diesel' ? DIESEL_COUNTERS : SPARK_COUNTERS;
  const val = new Map<string, number>();
  names.forEach((n, i) => {
    if (i < words.length) val.set(n, words[i]);
  });
  const ratios: InUseRatio[] = [];
  for (const n of names) {
    const m = n.match(/^(.+)COMP(\d?)$/);
    if (!m) continue;
    const comp = val.get(n);
    const cond = val.get(`${m[1]}COND${m[2]}`);
    if (comp == null || cond == null) continue;
    ratios.push({ monitor: MONITOR[`${m[1]}${m[2]}`] ?? n, completed: comp, conditions: cond, ratio: cond ? comp / cond : null });
  }
  return { kind, obdConditions: val.get('OBDCOND') ?? null, ignitions: val.get('IGNCNTR') ?? null, ratios };
}

// Data bytes of each answering unit (CAN: one message each) or of all
// messages joined (older protocols: one unit, several messages).
export function payloads(msgs: number[][], pid: number, isCan: boolean): number[][] {
  const mine = msgs.filter((m) => m[0] === 0x49 && m[1] === pid && m.length > 3);
  if (isCan) return mine.map((m) => m.slice(3));
  return mine.length ? [mine.flatMap((m) => m.slice(3, 7))] : [];
}

const ascii = (b: number[]) =>
  String.fromCharCode(...b.filter((c) => c >= 0x20 && c < 0x7f))
    .trim();

// Calibration IDs: 16 characters each, nulls as padding.
export function parseCalIds(data: number[]): string[] {
  const out: string[] = [];
  for (let i = 0; i < data.length; i += 16) {
    const s = ascii(data.slice(i, i + 16));
    if (s) out.push(s);
  }
  return out;
}

// CVNs: 4 bytes each, shown as 8 hex digits.
export function parseCvns(data: number[]): string[] {
  const out: string[] = [];
  for (let i = 0; i + 4 <= data.length; i += 4) out.push(data.slice(i, i + 4).map(hex2).join(''));
  return out;
}

export function parseWords(data: number[]): number[] {
  const out: number[] = [];
  for (let i = 0; i + 2 <= data.length; i += 2) out.push(data[i] * 256 + data[i + 1]);
  return out;
}

export interface UnitInfo {
  name: string | null;
  calIds: string[];
  cvns: string[];
  inUse: InUse | null;
}

export interface Mode09Read {
  supported: number[];
  units: UnitInfo[];
}

export type Requester = { request(cmd: string, timeoutMs?: number): Promise<number[][]> };

async function ask(client: Requester, cmd: string): Promise<number[][]> {
  try {
    return await client.request(cmd, 6000);
  } catch {
    return [];
  }
}

// Reads the supported PIDs, then each of 04, 06, 08 or 0B, and 0A. With
// several units answering on CAN, the n-th answer to each PID is taken as the
// n-th unit (headers are off, so the units are not named otherwise).
export async function readMode09(client: Requester, opts: { isCan: boolean; diesel: boolean }): Promise<Mode09Read> {
  const supported = new Set<number>();
  for (const m of await ask(client, '0900')) if (m[0] === 0x49 && m[1] === 0x00 && m.length >= 6) supportedFromMask(0, m.slice(m.length - 4)).forEach((p) => supported.add(p));
  // A car that does not list its support is still asked for the basics.
  const has = (pid: number) => !supported.size || supported.has(pid);
  const units: UnitInfo[] = [];
  const unit = (i: number) => (units[i] ??= { name: null, calIds: [], cvns: [], inUse: null });
  if (has(0x04)) payloads(await ask(client, '0904'), 0x04, opts.isCan).forEach((d, i) => (unit(i).calIds = parseCalIds(d)));
  if (has(0x06)) payloads(await ask(client, '0906'), 0x06, opts.isCan).forEach((d, i) => (unit(i).cvns = parseCvns(d)));
  // Petrol or diesel counters, whichever the car lists (or the engine type).
  const ipt = supported.has(0x0b) && !supported.has(0x08) ? 0x0b : supported.has(0x08) ? 0x08 : opts.diesel ? 0x0b : 0x08;
  if (supported.has(ipt)) {
    payloads(await ask(client, `09${hex2(ipt)}`), ipt, opts.isCan).forEach((d, i) => (unit(i).inUse = parseInUse(parseWords(d), ipt === 0x0b ? 'diesel' : 'petrol')));
  }
  if (supported.has(0x0a)) payloads(await ask(client, '090A'), 0x0a, opts.isCan).forEach((d, i) => (unit(i).name = ascii(d) || null));
  return { supported: [...supported].sort((a, b) => a - b), units: units.filter(Boolean) };
}
