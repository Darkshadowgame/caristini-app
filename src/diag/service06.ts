// Service 06: on-board monitoring test results. Reads only.
//
// Sources for every table in this file (no meaning here is made up):
// - Monitor IDs (OBDMIDs): python-OBD, obd/commands.py, the Mode 6 command
//   list (MONITOR_O2_B1S1 = 0601 and so on).
//   https://github.com/brendan-w/python-OBD/blob/master/obd/commands.py
// - Test IDs 01 to 0C: python-OBD, obd/codes.py, TEST_IDS.
//   https://github.com/brendan-w/python-OBD/blob/master/obd/codes.py
// - Unit and scaling IDs: python-OBD, obd/UnitsAndScaling.py, UAS_IDS.
//   https://github.com/brendan-w/python-OBD/blob/master/obd/UnitsAndScaling.py
// - Reply layout on CAN: python-OBD, obd/decoders.py, monitor() and
//   parse_monitor_test(): after the 46 byte, blocks of 9 bytes: monitor ID,
//   test ID, unit and scaling ID, value (2 bytes), minimum (2), maximum (2).
// python-OBD follows SAE J1979; the J1979 text itself was not read.
// Test IDs 80 to FE are defined by the maker and not public: shown raw.
// Cars that do not use CAN answer service 06 in an older maker layout: shown raw.
import { supportedFromMask } from '../obd/pids';

const hex2 = (n: number) => n.toString(16).toUpperCase().padStart(2, '0');

// Monitor ID names (python-OBD commands.py, Mode 6).
const sensors = (start: number, what: string): Record<number, string> => {
  const out: Record<number, string> = {};
  for (let b = 0; b < 4; b++) for (let s = 0; s < 4; s++) out[start + b * 4 + s] = `${what} bank ${b + 1} sensor ${s + 1}`;
  return out;
};
const banks = (start: number, what: string, n = 4): Record<number, string> => {
  const out: Record<number, string> = {};
  for (let b = 0; b < n; b++) out[start + b] = `${what} bank ${b + 1}`;
  return out;
};
export const MONITOR_NAMES: Record<number, string> = {
  ...sensors(0x01, 'Oxygen sensor'),
  ...banks(0x21, 'Catalyst'),
  ...banks(0x31, 'EGR'),
  ...banks(0x35, 'Variable valve timing'),
  0x39: 'Evaporative system, 0.150 inch leak (cap off)',
  0x3a: 'Evaporative system, 0.090 inch leak',
  0x3b: 'Evaporative system, 0.040 inch leak',
  0x3c: 'Evaporative system, 0.020 inch leak',
  0x3d: 'Purge flow',
  ...sensors(0x41, 'Oxygen sensor heater'),
  ...banks(0x61, 'Heated catalyst'),
  0x71: 'Secondary air 1',
  0x72: 'Secondary air 2',
  0x73: 'Secondary air 3',
  0x74: 'Secondary air 4',
  ...banks(0x81, 'Fuel system'),
  0x85: 'Boost pressure control bank 1',
  // python-OBD names this MONITOR_BOOST_PRESSURE_B2 (its description says bank 1).
  0x86: 'Boost pressure control bank 2',
  0x90: 'NOx adsorber bank 1',
  0x91: 'NOx adsorber bank 2',
  0x98: 'NOx catalyst bank 1',
  0x99: 'NOx catalyst bank 2',
  0xa1: 'Misfire, general data',
  ...Object.fromEntries(Array.from({ length: 12 }, (_, i) => [0xa2 + i, `Misfire, cylinder ${i + 1}`])),
  0xb0: 'Particulate filter bank 1',
  0xb1: 'Particulate filter bank 2',
};

// Standard test IDs (python-OBD codes.py, TEST_IDS).
export const TEST_NAMES: Record<number, string> = {
  0x01: 'Rich to lean sensor threshold voltage',
  0x02: 'Lean to rich sensor threshold voltage',
  0x03: 'Low sensor voltage for switch time calculation',
  0x04: 'High sensor voltage for switch time calculation',
  0x05: 'Rich to lean sensor switch time',
  0x06: 'Lean to rich sensor switch time',
  0x07: 'Minimum sensor voltage for test cycle',
  0x08: 'Maximum sensor voltage for test cycle',
  0x09: 'Time between sensor transitions',
  0x0a: 'Sensor period',
  0x0b: 'Average misfire counts for last ten driving cycles',
  0x0c: 'Misfire counts for last or current driving cycle',
};

// Unit and scaling IDs (python-OBD UnitsAndScaling.py, UAS_IDS): scale per
// bit, unit, offset. IDs 81 and up are signed (two's complement).
type Uas = { scale: number; unit: string; offset?: number; bool?: boolean };
export const UAS: Record<number, Uas> = {
  0x01: { scale: 1, unit: '' },
  0x02: { scale: 0.1, unit: '' },
  0x03: { scale: 0.01, unit: '' },
  0x04: { scale: 0.001, unit: '' },
  0x05: { scale: 0.0000305, unit: '' },
  0x06: { scale: 0.000305, unit: '' },
  0x07: { scale: 0.25, unit: 'rpm' },
  0x08: { scale: 0.01, unit: 'km/h' },
  0x09: { scale: 1, unit: 'km/h' },
  0x0a: { scale: 0.122, unit: 'mV' },
  0x0b: { scale: 0.001, unit: 'V' },
  0x0c: { scale: 0.01, unit: 'V' },
  0x0d: { scale: 0.00390625, unit: 'mA' },
  0x0e: { scale: 0.001, unit: 'A' },
  0x0f: { scale: 0.01, unit: 'A' },
  0x10: { scale: 1, unit: 'ms' },
  0x11: { scale: 100, unit: 'ms' },
  0x12: { scale: 1, unit: 's' },
  0x13: { scale: 1, unit: 'mΩ' },
  0x14: { scale: 1, unit: 'Ω' },
  0x15: { scale: 1, unit: 'kΩ' },
  0x16: { scale: 0.1, unit: '°C', offset: -40 },
  0x17: { scale: 0.01, unit: 'kPa' },
  0x18: { scale: 0.0117, unit: 'kPa' },
  0x19: { scale: 0.079, unit: 'kPa' },
  0x1a: { scale: 1, unit: 'kPa' },
  0x1b: { scale: 10, unit: 'kPa' },
  0x1c: { scale: 0.01, unit: '°' },
  0x1d: { scale: 0.5, unit: '°' },
  0x1e: { scale: 0.0000305, unit: '' },
  0x1f: { scale: 0.05, unit: '' },
  0x20: { scale: 0.00390625, unit: '' },
  0x21: { scale: 1, unit: 'mHz' },
  0x22: { scale: 1, unit: 'Hz' },
  0x23: { scale: 1, unit: 'kHz' },
  0x24: { scale: 1, unit: 'counts' },
  0x25: { scale: 1, unit: 'km' },
  0x26: { scale: 0.1, unit: 'mV/ms' },
  0x27: { scale: 0.01, unit: 'g/s' },
  0x28: { scale: 1, unit: 'g/s' },
  0x29: { scale: 0.25, unit: 'Pa/s' },
  0x2a: { scale: 0.001, unit: 'kg/h' },
  0x2b: { scale: 1, unit: 'counts' },
  0x2c: { scale: 0.01, unit: 'g' },
  0x2d: { scale: 0.01, unit: 'mg' },
  0x2e: { scale: 1, unit: '', bool: true },
  0x2f: { scale: 0.01, unit: '%' },
  0x30: { scale: 0.001526, unit: '%' },
  0x31: { scale: 0.001, unit: 'L' },
  0x32: { scale: 0.0000305, unit: 'in' },
  0x33: { scale: 0.00024414, unit: '' },
  0x34: { scale: 1, unit: 'min' },
  0x35: { scale: 10, unit: 'ms' },
  0x36: { scale: 0.01, unit: 'g' },
  0x37: { scale: 0.1, unit: 'g' },
  0x38: { scale: 1, unit: 'g' },
  0x39: { scale: 0.01, unit: '%', offset: -327.68 },
  0x3a: { scale: 0.001, unit: 'g' },
  0x3b: { scale: 0.0001, unit: 'g' },
  0x3c: { scale: 0.1, unit: 'µs' },
  0x3d: { scale: 0.01, unit: 'mA' },
  0x3e: { scale: 0.00006103516, unit: 'mm²' },
  0x3f: { scale: 0.01, unit: 'L' },
  0x40: { scale: 1, unit: 'ppm' },
  0x41: { scale: 0.01, unit: 'µA' },
  0x81: { scale: 1, unit: '' },
  0x82: { scale: 0.1, unit: '' },
  0x83: { scale: 0.01, unit: '' },
  0x84: { scale: 0.001, unit: '' },
  0x85: { scale: 0.0000305, unit: '' },
  0x86: { scale: 0.000305, unit: '' },
  0x87: { scale: 1, unit: 'ppm' },
  0x8a: { scale: 0.122, unit: 'mV' },
  0x8b: { scale: 0.001, unit: 'V' },
  0x8c: { scale: 0.01, unit: 'V' },
  0x8d: { scale: 0.00390625, unit: 'mA' },
  0x8e: { scale: 0.001, unit: 'A' },
  0x90: { scale: 1, unit: 'ms' },
  0x96: { scale: 0.1, unit: '°C' },
  0x99: { scale: 0.1, unit: 'kPa' },
  0x9c: { scale: 0.01, unit: '°' },
  0x9d: { scale: 0.5, unit: '°' },
  0xa8: { scale: 1, unit: 'g/s' },
  0xa9: { scale: 0.25, unit: 'Pa/s' },
  0xad: { scale: 0.01, unit: 'mg' },
  0xae: { scale: 0.1, unit: 'mg' },
  0xaf: { scale: 0.01, unit: '%' },
  0xb0: { scale: 0.003052, unit: '%' },
  0xb1: { scale: 2, unit: 'mV/s' },
  0xfc: { scale: 0.01, unit: 'kPa' },
  0xfd: { scale: 0.001, unit: 'kPa' },
  0xfe: { scale: 0.25, unit: 'Pa' },
};

export function monitorName(mid: number): string {
  if (MONITOR_NAMES[mid]) return MONITOR_NAMES[mid];
  return mid >= 0xe1 ? `Maker monitor ${hex2(mid)}` : `Monitor ${hex2(mid)}`;
}

export function testName(tid: number): { name: string; known: boolean } {
  if (TEST_NAMES[tid]) return { name: TEST_NAMES[tid], known: true };
  return { name: tid >= 0x80 ? `Maker test ${hex2(tid)} (meaning not public)` : `Test ${hex2(tid)} (meaning not in Caristini)`, known: false };
}

export interface ScaledValue {
  value: number;
  text: string;
}

const decimalsFor = (scale: number) => (scale >= 1 ? 0 : Math.min(5, Math.ceil(-Math.log10(scale) - 1e-9)));

// A 2-byte value with its unit and scaling ID; null when the ID is not known.
export function scale(uasId: number, hi: number, lo: number): ScaledValue | null {
  const u = UAS[uasId];
  if (!u) return null;
  let raw = hi * 256 + lo;
  if (uasId >= 0x80 && raw >= 0x8000) raw -= 0x10000;
  if (u.bool) return { value: raw ? 1 : 0, text: raw ? 'Yes' : 'No' };
  const value = raw * u.scale + (u.offset ?? 0);
  const text = `${value.toFixed(decimalsFor(u.scale))}${u.unit ? ` ${u.unit}` : ''}`;
  return { value, text };
}

export interface TestResult {
  mid: number;
  monitor: string;
  tid: number;
  test: string;
  testKnown: boolean;
  uasId: number;
  // null: unit and scaling ID not in the table, so the numbers are raw.
  value: ScaledValue | null;
  min: ScaledValue | null;
  max: ScaledValue | null;
  raw: string;
  // Value inside its limits; null when it cannot be said (raw values).
  pass: boolean | null;
}

// One CAN reply to "06 MID": 46, then blocks of 9 bytes.
export function parseMode06(msg: number[]): TestResult[] {
  if (msg[0] !== 0x46) return [];
  const d = msg.slice(1);
  const out: TestResult[] = [];
  for (let i = 0; i + 9 <= d.length; i += 9) {
    const [mid, tid, uasId, v1, v2, n1, n2, x1, x2] = d.slice(i, i + 9);
    // Support masks (MID 00, 20, 40 ...) are not results.
    if (mid % 0x20 === 0) continue;
    const value = scale(uasId, v1, v2);
    const min = scale(uasId, n1, n2);
    const max = scale(uasId, x1, x2);
    const t = testName(tid);
    // Limits compared as scaled numbers, so signed values compare right.
    const pass = value && min && max ? value.value >= min.value && value.value <= max.value : null;
    out.push({ mid, monitor: monitorName(mid), tid, test: t.name, testKnown: t.known, uasId, value, min, max, raw: d.slice(i, i + 9).map(hex2).join(' '), pass });
  }
  return out;
}

// Supported monitor IDs from the replies to 06 00, 06 20 ... (46 MID A B C D).
export function supportedMids(base: number, msgs: number[][]): number[] {
  const out = new Set<number>();
  for (const m of msgs) if (m[0] === 0x46 && m[1] === base && m.length >= 6) supportedFromMask(base, m.slice(2, 6)).forEach((p) => out.add(p));
  return [...out].sort((a, b) => a - b);
}

export type Requester = { request(cmd: string, timeoutMs?: number): Promise<number[][]> };

export interface Mode06Read {
  // CAN layout decoded; otherwise raw lines only.
  decoded: boolean;
  results: TestResult[];
  raw: string[];
  supported: number[];
}

async function ask(client: Requester, cmd: string): Promise<number[][]> {
  try {
    return await client.request(cmd, 4000);
  } catch {
    return [];
  }
}

// Reads every supported monitor on CAN cars; on older protocols, the answer
// to 06 00 is kept raw. onProgress: monitors read so far and how many.
export async function readMode06(client: Requester, opts: { isCan: boolean; onProgress?: (done: number, total: number) => void }): Promise<Mode06Read> {
  if (!opts.isCan) {
    const msgs = await ask(client, '0600');
    return { decoded: false, results: [], raw: msgs.map((m) => m.map(hex2).join(' ')), supported: [] };
  }
  const supported: number[] = [];
  for (let base = 0; base <= 0xe0; base += 0x20) {
    const list = supportedMids(base, await ask(client, `06${hex2(base)}`));
    supported.push(...list.filter((m) => m % 0x20 !== 0));
    if (!list.includes(base + 0x20)) break;
  }
  const results: TestResult[] = [];
  const raw: string[] = [];
  for (let i = 0; i < supported.length; i++) {
    opts.onProgress?.(i, supported.length);
    for (const m of await ask(client, `06${hex2(supported[i])}`)) {
      const r = parseMode06(m);
      if (r.length) results.push(...r);
      else raw.push(m.map(hex2).join(' '));
    }
  }
  opts.onProgress?.(supported.length, supported.length);
  return { decoded: true, results, raw, supported };
}
