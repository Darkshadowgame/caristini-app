// Demo car answers for services 06 and 09, so the Emissions self-tests page works
// in demo mode. Made-up numbers in the standard layouts (see service06.ts and
// service09.ts for the layouts and their sources).

// Monitor ID, test ID, unit and scaling ID, value, minimum, maximum.
type DemoTest = [number, number, number, number, number, number];
const TESTS: DemoTest[] = [
  [0x01, 0x05, 0x10, 72, 0, 120], // oxygen sensor B1S1: rich to lean switch time, ms
  [0x01, 0x06, 0x10, 64, 0, 120], // lean to rich switch time, ms
  [0x02, 0x85, 0x0b, 612, 450, 0xffff], // a maker test, scaled in volts
  [0x21, 0x83, 0x24, 38, 0, 120], // catalyst bank 1, maker test, counts
  [0xa1, 0x0b, 0x24, 2, 0, 0xffff], // misfire, general
  [0xa2, 0x0c, 0x24, 0, 0, 0xffff], // misfire, cylinder 1
  [0xa3, 0x0c, 0x24, 7, 0, 0xffff], // misfire, cylinder 2
  [0xe1, 0x91, 0x50, 0x0123, 0, 0x0400], // a maker monitor with a unit ID not in the table
];

const mids = [...new Set(TESTS.map((t) => t[0]))];

// Support mask for base (00, 20 ...): listed monitors, plus the next base when
// any monitor lies beyond it.
function mask(base: number): number[] {
  const out = [0, 0, 0, 0];
  const set = (n: number) => {
    const i = n - base - 1;
    if (i >= 0 && i < 32) out[i >> 3] |= 0x80 >> (i & 7);
  };
  mids.forEach(set);
  if (mids.some((m) => m > base + 0x20)) set(base + 0x20);
  return out;
}

const word = (n: number) => [(n >> 8) & 0xff, n & 0xff];

export function demoMode06(cmd: string): number[] | null {
  const mid = parseInt(cmd.slice(2, 4), 16);
  if (mid % 0x20 === 0) return mid <= 0xe0 && mids.some((m) => m > mid) ? [0x46, mid, ...mask(mid)] : null;
  const tests = TESTS.filter((t) => t[0] === mid);
  if (!tests.length) return null;
  return [0x46, ...tests.flatMap(([m, tid, uas, v, lo, hi]) => [m, tid, uas, ...word(v), ...word(lo), ...word(hi)])];
}

const text = (s: string, len: number) => [...s].map((c) => c.charCodeAt(0)).concat(Array(Math.max(0, len - s.length)).fill(0)).slice(0, len);

export function demoMode09(cmd: string, diesel: boolean): number[] | null {
  const pid = parseInt(cmd.slice(2, 4), 16);
  const ipt = diesel ? 0x0b : 0x08;
  if (pid === 0x00) {
    // 02 VIN, 04 calibration ID, 06 CVN, 0A unit name and the counters.
    const out = [0, 0, 0, 0];
    for (const p of [0x02, 0x04, 0x06, ipt, 0x0a]) out[(p - 1) >> 3] |= 0x80 >> ((p - 1) & 7);
    return [0x49, 0x00, ...out];
  }
  if (pid === 0x04) return [0x49, 0x04, 0x01, ...text('DEMOCAL0001', 16)];
  if (pid === 0x06) return [0x49, 0x06, 0x01, 0x1a, 0x2b, 0x3c, 0x4d];
  if (pid === 0x0a) return [0x49, 0x0a, 0x01, ...text('ECM-EngineControl', 20)];
  if (pid === ipt) {
    const counts = diesel
      ? [120, 340, 40, 110, 0, 0, 0, 0, 22, 110, 50, 110, 60, 110, 70, 110, 0, 0]
      : [120, 340, 45, 110, 0, 0, 60, 110, 0, 0, 30, 100, 0, 0, 12, 95];
    return [0x49, pid, counts.length, ...counts.flatMap(word)];
  }
  return null;
}
