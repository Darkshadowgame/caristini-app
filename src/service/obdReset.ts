// Service reset over the OBD port. Nothing here is guessed: a reset is either
// recorded from another tool doing it on this car (Listen mode), learned by
// comparing the instrument cluster's values before and after another tool
// reset it, or taken from a public source and offered as a try.
//
// A reset is a short list of UDS steps sent to one module.

export type ResetStep =
  // Diagnostic session (10 xx). Programming (02) is never allowed.
  | { kind: 'session'; value: number }
  // Security access with key = seed + login code (27 03/04, VW style), or the
  // level the recording used.
  | { kind: 'login'; code: number; level?: number }
  // Write a data identifier (2E) with an exact value.
  | { kind: 'write'; did: string; value: string }
  // Start a routine (31 01) with optional data.
  | { kind: 'routine'; id: string; data?: string };

export type ResetSource = 'recorded' | 'compared' | 'public';

export interface ServiceReset {
  id: string;
  title: string;
  // Module id (for example vag-17) and its CAN request and reply IDs.
  module: string;
  tx: string;
  rx: string;
  steps: ResetStep[];
  source: ResetSource;
  learnedAt: string;
  // Values to read before and after, to show that the reset took.
  checks?: { did: string; before?: string; after?: string }[];
  note?: string;
}

const hex2 = (n: number) => n.toString(16).toUpperCase().padStart(2, '0');
const bytes = (hex: string) => (hex.match(/../g) ?? []).map((h) => parseInt(h, 16));
const hexOf = (b: number[]) => b.map(hex2).join('');

export function describeStep(s: ResetStep): string {
  switch (s.kind) {
    case 'session':
      return s.value === 0x03 ? 'Open the extended session (10 03)' : `Open session ${hex2(s.value)} (10 ${hex2(s.value)})`;
    case 'login':
      return `Log in with code ${String(s.code).padStart(5, '0')} (27 ${hex2(s.level ?? 3)})`;
    case 'write':
      return `Write value ${s.did}: ${s.value.match(/../g)?.join(' ') ?? ''}`;
    case 'routine':
      return `Start routine ${s.id}${s.data ? ` with ${s.data.match(/../g)?.join(' ')}` : ''} (31 01)`;
  }
}

// ---------------------------------------------------------------------------
// Recordings (Listen mode): "12.345 7140322F187" lines, ISO-TP rebuilt.

export interface Message {
  t: number;
  id: string;
  data: number[];
}

const LINE = /^(\d+\.\d+)\s+([0-9A-Fa-f]{3})([0-9A-Fa-f]*)$/;

// ISO-TP messages (single and multi-frame) from a recording, in order.
export function decodeRecording(text: string): Message[] {
  const out: Message[] = [];
  // A dropped frame (cheap adapters lose some while listening) must not let
  // the next one fill its place: a gap in the sequence drops the message.
  const open = new Map<string, { n: number; buf: number[]; next: number }>();
  for (const raw of text.split(/\r?\n/)) {
    const m = LINE.exec(raw.trim());
    if (!m) continue;
    const t = parseFloat(m[1]);
    const id = m[2].toUpperCase();
    const d = bytes(m[3].slice(0, Math.floor(m[3].length / 2) * 2));
    if (!d.length) continue;
    const pci = d[0] >> 4;
    if (pci === 0) {
      open.delete(id);
      const n = d[0] & 0x0f;
      if (n && d.length >= 1 + n) out.push({ t, id, data: d.slice(1, 1 + n) });
    } else if (pci === 1 && d.length >= 2) {
      open.set(id, { n: ((d[0] & 0x0f) << 8) | d[1], buf: d.slice(2), next: 1 });
    } else if (pci === 2) {
      const o = open.get(id);
      if (!o) continue;
      if ((d[0] & 0x0f) !== o.next) {
        open.delete(id);
        continue;
      }
      o.next = (o.next + 1) & 0x0f;
      o.buf.push(...d.slice(1));
      if (o.buf.length >= o.n) {
        out.push({ t, id, data: o.buf.slice(0, o.n) });
        open.delete(id);
      }
    }
  }
  return out;
}

// Services that must never be replayed from a recording: ECU reset,
// input/output control, flashing, and anything in the programming session.
const UNSAFE = new Set([0x11, 0x2f, 0x34, 0x35, 0x36, 0x37, 0x3d]);

export type FromRecording = { reset: ServiceReset } | { error: string };

// The steps another tool sent to one module, kept only where the module
// answered yes. Reads, fault requests and tester present are left out.
export function resetFromRecording(text: string, mod: { id: string; tx: string; rx: string; name: string }, at = new Date(), odometerKm?: number): FromRecording {
  const msgs = decodeRecording(text).filter((m) => m.id === mod.tx || m.id === mod.rx);
  // The recording's own date (first line), else the date given.
  const stamp = /listen (\d{4}-\d{2}-\d{2}T[^ ]+)/.exec(text)?.[1];
  const recDate = stamp && !Number.isNaN(Date.parse(stamp)) ? new Date(stamp) : at;
  const steps: ResetStep[] = [];
  let seed: { level: number; seed: number[] } | null = null;
  for (let i = 0; i < msgs.length; i++) {
    const q = msgs[i];
    if (q.id !== mod.tx) continue;
    // The module's answer: the next message from the module, skipping "busy, wait".
    let a: Message | undefined;
    for (let j = i + 1; j < msgs.length; j++) {
      const r = msgs[j];
      if (r.id === mod.tx) break;
      if (r.data[0] === 0x7f && r.data[2] === 0x78) continue;
      a = r;
      break;
    }
    const sid = q.data[0];
    // A yes must echo what was asked: the identifier for 2E, the routine for 31.
    const echo = sid === 0x2e ? 3 : sid === 0x31 ? 4 : sid === 0x10 || sid === 0x27 ? 2 : 1;
    const yes = !!a && a.data[0] === sid + 0x40 && q.data.slice(1, echo).every((b, k) => a!.data[1 + k] === b);
    if (UNSAFE.has(sid) && yes) return { error: `The recording contains a ${hex2(sid)} request (reset, output test or flashing), which Caristini does not replay.` };
    if (!yes) continue;
    if (sid === 0x10) {
      if (q.data[1] === 0x02) return { error: 'The recording opens the programming session, which Caristini does not replay.' };
      steps.push({ kind: 'session', value: q.data[1] });
    } else if (sid === 0x27) {
      const level = q.data[1];
      // Only the VW workshop login (27 03/04, 4-byte seed, key = seed + code)
      // can be worked out; other levels or makes use secret key methods.
      if (level !== 0x03 && level !== 0x04) return { error: `The recording logs in at level ${hex2(level)}, which Caristini does not replay.` };
      if (!mod.id.startsWith('vag-')) return { error: 'The recording logs in with a key method only the other tool knows, so it cannot be replayed.' };
      if (level === 0x03) {
        seed = { level, seed: a!.data.slice(2) };
        if (seed.seed.length !== 4) return { error: 'The login in the recording is not the 5-digit code kind, so it cannot be replayed.' };
      }
      else if (seed && seed.level === level - 1) {
        const key = q.data.slice(2);
        if (key.length !== seed.seed.length || !key.length) return { error: 'The login in the recording could not be read.' };
        let k = 0n;
        let s = 0n;
        for (const b of key) k = (k << 8n) | BigInt(b);
        for (const b of seed.seed) s = (s << 8n) | BigInt(b);
        const mod = 1n << BigInt(8 * key.length);
        const code = Number((((k - s) % mod) + mod) % mod);
        // VW login codes are 5 digits; anything else is a different key method.
        if (code > 99999) return { error: 'The recording uses a login method other than a 5-digit code, so it cannot be replayed.' };
        steps.push({ kind: 'login', code, level: seed.level });
        seed = null;
      }
    } else if (sid === 0x2e && q.data.length > 3) {
      const did = hexOf(q.data.slice(1, 3));
      const value = q.data.slice(3);
      // The workshop stamp is left out below; anything else holding the date or
      // the odometer would be wrong when written back at the next service.
      if (!/^F19[89]$/.test(did)) {
        if (holdsDate(value, recDate)) return { error: `Value ${did} in the recording holds the date of the reset, so writing it again later would be wrong. Learn it by compare instead.` };
        if (odometerKm != null && holdsDistance(value, odometerKm)) return { error: `Value ${did} in the recording holds the odometer, so writing it again later would be wrong.` };
      }
      steps.push({ kind: 'write', did, value: hexOf(value) });
    } else if (sid === 0x31 && q.data[1] === 0x01 && q.data.length >= 4) {
      steps.push({ kind: 'routine', id: hexOf(q.data.slice(2, 4)), ...(q.data.length > 4 ? { data: hexOf(q.data.slice(4)) } : {}) });
    }
  }
  // Writes of the workshop stamp (F198, F199) are the other tool's own record.
  const real = steps.filter((s) => s.kind === 'write' || s.kind === 'routine');
  if (!real.some((s) => s.kind === 'routine' || !/^F19[89]$/.test(s.did))) {
    return { error: `No write or routine to the ${mod.name.toLowerCase()} was accepted in this recording.` };
  }
  return {
    reset: {
      id: `rec-${at.getTime()}`,
      title: `Service reset (recorded ${at.toLocaleDateString('en-GB')})`,
      module: mod.id,
      tx: mod.tx,
      rx: mod.rx,
      steps: steps.filter((s) => !(s.kind === 'write' && /^F19[89]$/.test(s.did))),
      source: 'recorded',
      learnedAt: at.toISOString(),
    },
  };
}

// ---------------------------------------------------------------------------
// Compare: the cluster's values before and after another tool's reset.

export interface Change {
  did: string;
  before: string;
  after: string;
  // Why this value should not be written back later, if it should not.
  hold?: string;
}

// Values that hold the date or the distance of the reset would be wrong if
// written back at the next service, so they are held back.
export function changedValues(
  before: Record<string, string>,
  after: Record<string, string>,
  ctx: { date: Date; since?: Date; odometerKm?: number },
  moving: Set<string> = new Set(),
): Change[] {
  const out: Change[] = [];
  for (const did of Object.keys(before)) {
    const a = after[did];
    if (a == null || a === before[did]) continue;
    const c: Change = { did, before: before[did], after: a };
    if (a.length !== before[did].length) c.hold = 'Its length changed';
    else if (moving.has(did)) c.hold = 'It keeps changing on its own (a live value)';
    else if (datesBetween(ctx.since ?? ctx.date, ctx.date).some((d) => holdsDate(bytes(a), d))) c.hold = 'It holds the date';
    else if (ctx.odometerKm != null && holdsDistance(bytes(a), ctx.odometerKm)) c.hold = 'It holds the odometer reading';
    else if (ctx.odometerKm == null && mayBeDistance(bytes(a))) c.hold = 'It may hold a distance, and the odometer is not known to check';
    out.push(c);
  }
  return out;
}

const bcd = (n: number) => ((Math.floor(n / 10) % 10) << 4) | n % 10;

// Every day from one date to another (at most 31), for values saved before
// and read after a reset done on a different day.
export function datesBetween(from: Date, to: Date): Date[] {
  const out: Date[] = [];
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  while (d <= to && out.length < 31) {
    out.push(new Date(d));
    d.setDate(d.getDate() + 1);
  }
  return out.length ? out : [to];
}

export function holdsDate(b: number[], d: Date): boolean {
  const y = d.getFullYear() % 100;
  const yy = d.getFullYear();
  const m = d.getMonth() + 1;
  const day = d.getDate();
  const seqs = [
    [bcd(y), bcd(m), bcd(day)],
    [bcd(day), bcd(m), bcd(y)],
    [bcd(m), bcd(day), bcd(y)],
    [y, m, day],
    [day, m, y],
    [m, day, y],
    [yy >> 8, yy & 0xff, m, day],
    [bcd(Math.floor(yy / 100)), bcd(y), bcd(m), bcd(day)],
  ];
  if (seqs.some((s) => b.some((_, i) => s.every((x, k) => b[i + k] === x)))) return true;
  // Days since 1 Jan 2000 (or since 1970) as a 2 or 3 byte number.
  const days = [Math.floor((d.getTime() - Date.UTC(2000, 0, 1)) / 86400000), Math.floor(d.getTime() / 86400000)];
  for (let len = 2; len <= 3; len++)
    for (let i = 0; i + len <= b.length; i++) {
      const win = b.slice(i, i + len);
      for (const order of [win, [...win].reverse()]) {
        const n = order.reduce((v, x) => v * 256 + x, 0);
        if (days.some((x) => Math.abs(n - x) <= 1)) return true;
      }
    }
  return false;
}

// A 3 or 4 byte number big enough to be an odometer reading.
export function mayBeDistance(b: number[]): boolean {
  for (let len = 3; len <= 4; len++)
    for (let i = 0; i + len <= b.length; i++) {
      const win = b.slice(i, i + len);
      for (const order of [win, [...win].reverse()]) {
        const n = order.reduce((v, x) => v * 256 + x, 0);
        if (n >= 1000 && n <= 20000000) return true;
      }
    }
  return false;
}

// The odometer in km (or km x 10, or miles) as a 2 to 4 byte number, either
// byte order, within 100 km.
export function holdsDistance(b: number[], km: number): boolean {
  const targets = [km, km * 10, km / 10, km / 1.609344, (km / 1.609344) * 10];
  for (let len = 2; len <= 4; len++) {
    for (let i = 0; i + len <= b.length; i++) {
      const win = b.slice(i, i + len);
      for (const order of [win, [...win].reverse()]) {
        const n = order.reduce((v, x) => v * 256 + x, 0);
        if (n > 100 && targets.some((t) => Math.abs(n - t) <= Math.max(10, t * 0.002))) return true;
      }
    }
  }
  return false;
}

export function resetFromCompare(changes: Change[], mod: { id: string; tx: string; rx: string }, login: number | null, at = new Date()): ServiceReset | null {
  const use = changes.filter((c) => !c.hold);
  if (!use.length) return null;
  return {
    id: `cmp-${at.getTime()}`,
    title: `Service reset (learned by compare ${at.toLocaleDateString('en-GB')})`,
    module: mod.id,
    tx: mod.tx,
    rx: mod.rx,
    steps: [{ kind: 'session', value: 0x03 }, ...(login != null ? [{ kind: 'login' as const, code: login }] : []), ...use.map((c) => ({ kind: 'write' as const, did: c.did, value: c.after }))],
    source: 'compared',
    learnedAt: at.toISOString(),
    checks: changes.map((c) => ({ did: c.did, before: c.before, after: c.after })),
    note: changes.some((c) => c.hold) ? `Not written back: ${changes.filter((c) => c.hold).map((c) => `${c.did} (${c.hold!.toLowerCase()})`).join(', ')}.` : undefined,
  };
}

// Resets from public sources for this car (replica/service-reset-sources.md),
// offered as Try until one works on this car.
export function publicResets(v: { group: string; platform?: string | null }): ServiceReset[] {
  return PUBLIC.filter((p) => p.group === v.group && (!p.platforms || (!!v.platform && p.platforms.includes(v.platform)))).map((p) => p.reset);
}

// None yet: no public source gives the exact bytes for these cars (see
// replica/service-reset-sources.md). Bytes found in one project for a related
// cluster came from a disproved channel-to-DID rule and are not used.
const PUBLIC: { group: string; platforms?: string[]; reset: ServiceReset }[] = [];

// The instrument cluster module for a make, where service data lives.
export const CLUSTER: Record<string, string> = { vag: 'vag-17', ford: 'ford-ipc', mazda: 'mazda-ic' };

// Value ranges read before and after a reset (replica/service-reset-sources.md).
// VW clusters: 2260 and 2261 (distance and days to service, from the e-Up
// cluster at the same address) sit in 2200 to 22FF; adaptations in 0000 to 0FFF.
export const SERVICE_RANGES: [number, number][] = [
  [0x0000, 0x0fff],
  [0x2200, 0x22ff],
];
// Ford and Mazda engine computers: only the identifiers sources name for
// oil life (054B, 054C) and the Mazda oil data (0435, 0519, 053F, 0542), so
// nothing else in the engine computer is compared or written back.
export const ENGINE_SERVICE_RANGES: [number, number][] = [
  [0x0435, 0x0435],
  [0x0519, 0x0519],
  [0x053f, 0x053f],
  [0x0542, 0x0542],
  [0x054b, 0x054c],
];

export interface ResetTarget {
  module: string;
  label: string;
  ranges: [number, number][];
}

// Where a make keeps its service data, most likely first. On a Mazda
// Skyactiv-D the oil data reset after every oil change is in the engine
// computer; Ford's oil life is read there too.
export function resetTargets(group: string): ResetTarget[] {
  const cluster = CLUSTER[group] ? [{ module: CLUSTER[group], label: 'Instrument cluster', ranges: SERVICE_RANGES }] : [];
  const engine = group === 'ford' || group === 'mazda' ? [{ module: 'engine', label: 'Engine computer', ranges: ENGINE_SERVICE_RANGES }] : [];
  return [...engine, ...cluster];
}
