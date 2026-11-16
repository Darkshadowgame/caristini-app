// Fuel trim and lambda view (petrol cars). Trims are the engine computer's
// fuel correction in %: plus means it adds fuel (it sees a lean mixture),
// minus means it takes fuel away (rich). Bands are a common rule of thumb,
// not a maker limit: within 10 % is normal, 10 to 20 % is worth watching,
// beyond 20 % many engines set a lean or rich fault code.
export const TRIM_OK = 10;
export const TRIM_WATCH = 20;

export type TrimBand = 'ok' | 'watch' | 'high';

export function trimBand(pct: number | null | undefined): TrimBand | null {
  if (pct == null || !Number.isFinite(pct)) return null;
  const a = Math.abs(pct);
  return a <= TRIM_OK ? 'ok' : a <= TRIM_WATCH ? 'watch' : 'high';
}

// Short plus long term: the whole correction the engine is making now.
export function trimTotal(short: number | null | undefined, long: number | null | undefined): number | null {
  if (short == null && long == null) return null;
  return (short ?? 0) + (long ?? 0);
}

export function trimDirection(pct: number | null | undefined): 'adding' | 'removing' | 'none' | null {
  if (pct == null || !Number.isFinite(pct)) return null;
  if (Math.abs(pct) < 1) return 'none';
  return pct > 0 ? 'adding' : 'removing';
}

// Where a trim sits on a bar from -scale to +scale: 0 left, 0.5 middle, 1 right.
export function trimPosition(pct: number, scale = 25): number {
  return Math.min(1, Math.max(0, (pct + scale) / (2 * scale)));
}

export interface BankPids {
  bank: 1 | 2;
  short: number;
  long: number;
  // Lambda sensors: wide-band first (ratio), else the front narrow-band (volts).
  lambda: number[];
  o2Front: number;
  o2Rear: number;
}

export const BANKS: BankPids[] = [
  { bank: 1, short: 0x06, long: 0x07, lambda: [0x34, 0x24], o2Front: 0x14, o2Rear: 0x15 },
  { bank: 2, short: 0x08, long: 0x09, lambda: [0x38, 0x28], o2Front: 0x18, o2Rear: 0x19 },
];

export const COMMANDED_LAMBDA = 0x44;

// Every PID the trim view may read, for the banks the car reports trims for.
export function trimPids(supported: Set<number> | number[]): { banks: BankPids[]; pids: number[] } {
  const has = supported instanceof Set ? supported : new Set(supported);
  const banks = BANKS.filter((b) => has.has(b.short) || has.has(b.long));
  const pids = new Set<number>();
  for (const b of banks) {
    for (const p of [b.short, b.long, ...b.lambda, b.o2Front, b.o2Rear]) if (has.has(p)) pids.add(p);
  }
  if (banks.length && has.has(COMMANDED_LAMBDA)) pids.add(COMMANDED_LAMBDA);
  return { banks, pids: [...pids] };
}

export function bandWords(b: TrimBand | null): string {
  return b === 'ok' ? 'Normal' : b === 'watch' ? 'Worth watching' : b === 'high' ? 'High' : 'No reading';
}
