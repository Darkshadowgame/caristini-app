// VW Transport Protocol 2.0 with KWP2000 on top, for VW group modules that do
// not speak UDS (on the 2012 Audi A6 C7: central electronics, comfort, doors).
// Frame layouts, the setup and parameter exchange, ACK rules and the ELM327
// recipe (protocol B, variable DLC, headers on) are from the sources listed in
// replica/tp20-sources.md (VAG Blocks, OVMS, OBDScanner, OBDCracker, rusEFI).
// Experimental: the TP2.0 addresses of MLB modules are not published, so the
// scan probes likely addresses. Reads and clears faults only.
import { ObdError } from './elm';
import { Transport } from './transport';

export interface Tp20Fault {
  // VW 5-digit fault number (16-bit DTC in decimal), as workshop tools show it.
  code: string;
  status: number;
}

export interface Tp20Module {
  address: number;
  faults: Tp20Fault[];
  error?: string;
  // Identification (1A 9B) and the module this address belongs to.
  part?: string | null;
  component?: string | null;
  moduleId?: string;
}

const hex2 = (n: number) => n.toString(16).toUpperCase().padStart(2, '0');
const hex3 = (n: number) => n.toString(16).toUpperCase().padStart(3, '0');

interface Frame {
  id: number;
  data: number[];
}

// Parses adapter lines with headers on and spaces off: "3001000025089".
export function parseRawFrames(raw: string): Frame[] {
  return raw
    .replace(/>/g, '')
    .split(/[\r\n]+/)
    .map((l) => l.replace(/\s/g, '').toUpperCase())
    .filter((l) => /^[0-9A-F]{3}([0-9A-F]{2})*$/.test(l) && l.length >= 5)
    .map((l) => {
      const data: number[] = [];
      for (let i = 3; i + 1 < l.length; i += 2) data.push(parseInt(l.slice(i, i + 2), 16));
      return { id: parseInt(l.slice(0, 3), 16), data };
    });
}

// Likely TP2.0 addresses: the VW address words for the modules seen on MLB
// cars (two answered on a 2014 A7), then the logical addresses listed for a
// 2007 VW on the PQ platform (engine 01, gearbox 02, airbag 05, gateway 1F, 4F).
// Back from raw CAN to normal OBD on the given protocol.
export const tp20LeaveCommands = (protocol: string) => ['ATCFC1', 'ATH0', `ATSP${protocol}`, 'ATAT1', 'ATST32', 'ATAR', 'ATSH7DF'];

export const TP20_CANDIDATES = [
  0x20, 0x21, 0x22, 0x23, 0x07, 0x2c, 0x01, 0x02, 0x03, 0x05, 0x09, 0x1f, 0x52,
  0x46, 0x42, 0x62, 0x72, 0x36, 0x06, 0x47, 0x56, 0x5f, 0x15, 0x16, 0x17, 0x19, 0x08, 0x4f,
];

export class Tp20Session {
  private txSeq = 0;
  private rx = 0;
  private tx = 0;
  // Sequence number of the last module frame read. The module repeats a frame
  // when our ACK is late (it waits 100 ms); a repeat is ACKed again, not read twice.
  private lastRx = -1;

  constructor(
    private send: Transport['send'],
    // Protocol digit to return to afterwards (6 for 11-bit 500k CAN).
    private protocol: string,
  ) {}

  private async cmd(c: string, timeout = 1500): Promise<string> {
    const raw = await this.send(c, timeout);
    if (/\?/.test(raw.replace(/>/g, '').trim())) throw new ObdError(`The adapter does not support ${c}.`);
    return raw;
  }

  // Raw CAN with variable frame length, headers on (VAG Blocks recipe).
  async enter(): Promise<void> {
    for (const c of ['ATPBC001', 'ATSPB', 'ATH1', 'ATAT0', 'ATST19', 'ATCFC0']) await this.cmd(c);
  }

  async leave(): Promise<void> {
    for (const c of tp20LeaveCommands(this.protocol)) {
      await this.send(c, 1500).catch(() => undefined);
    }
  }

  private async frames(c: string, timeout = 1500): Promise<Frame[]> {
    let raw: string;
    try {
      raw = await this.send(c, timeout);
    } catch {
      return [];
    }
    return parseRawFrames(raw).filter((f) => f.id === this.rx || (f.id & 0xf00) === 0x200);
  }

  // Channel setup on 0x200; true when a module answers at this address.
  async open(address: number): Promise<boolean> {
    this.txSeq = 0;
    this.lastRx = -1;
    await this.cmd('ATSH200');
    await this.cmd(`ATCRA${hex3(0x200 + address)}`);
    let busy = 0;
    for (let attempt = 0; attempt < 2 + busy; attempt++) {
      // Trailing 1: return after the first reply frame.
      const reply = (await this.frames(`${hex2(address)}C00010000301` + '1', 800)).find((f) => f.id === 0x200 + address);
      if (!reply) continue;
      const d = reply.data;
      // D7 "temporarily not available", D8 "no resources now": wait, ask again
      // (up to 4 times, about 3 s in all). D6 "not supported" is final.
      if ((d[1] === 0xd7 || d[1] === 0xd8) && busy < 4) {
        busy++;
        await new Promise((r) => setTimeout(r, 300 * busy));
        continue;
      }
      if (d[1] !== 0xd0 || (d[3] >> 4) !== 0 || (d[5] >> 4) !== 0) return false;
      this.rx = ((d[3] & 0x07) << 8) | d[2];
      this.tx = ((d[5] & 0x07) << 8) | d[4];
      await this.cmd(`ATSH${hex3(this.tx)}`);
      await this.cmd(`ATCRA${hex3(this.rx)}`);
      const params = await this.frames('A00F8AFF32FF1', 800);
      return params.some((f) => f.id === this.rx && f.data[0] === 0xa1);
    }
    return false;
  }

  // Waits while keeping the channel open (the module drops it after about a
  // second of silence): a keep-alive every 500 ms.
  async idle(ms: number): Promise<void> {
    const end = Date.now() + ms;
    while (Date.now() < end) {
      await this.frames('A3', 400);
      await new Promise((r) => setTimeout(r, Math.min(500, Math.max(0, end - Date.now()))));
    }
  }

  async close(): Promise<void> {
    await this.frames('A8', 500);
  }

  // One KWP2000 request and its complete answer, ACKing as the module asks.
  async request(payload: number[], waitMs = 5000): Promise<number[]> {
    // The first frame carries the length and 5 bytes, later frames 7 bytes.
    // Frames before the last (op 2) want no ACK; the last (op 1) does. A real
    // Carista adapter log paces them about 130 ms apart (replica/kwp-write-sources.md F27).
    const msg = [(payload.length >> 8) & 0xff, payload.length & 0xff, ...payload];
    const chunks: number[][] = [msg.slice(0, 7)];
    for (let i = 7; i < msg.length; i += 7) chunks.push(msg.slice(i, i + 7));
    let queue: Frame[] = [];
    for (let i = 0; i < chunks.length; i++) {
      const last = i === chunks.length - 1;
      const frame = [(last ? 0x10 : 0x20) | this.txSeq, ...chunks[i]];
      this.txSeq = (this.txSeq + 1) & 0x0f;
      if (last) queue = await this.frames(frame.map(hex2).join(''));
      else {
        await this.frames(frame.map(hex2).join(''), 400);
        await new Promise((r) => setTimeout(r, 30));
      }
    }
    const body: number[] = [];
    let length = -1;
    let deadline = Date.now() + waitMs;
    while (Date.now() < deadline) {
      while (queue.length) {
        const f = queue.shift()!;
        if (f.id !== this.rx || !f.data.length) continue;
        const op = f.data[0] >> 4;
        const seq = f.data[0] & 0x0f;
        // ACKs, channel tests and parameter frames carry no message data.
        if (op > 3) continue;
        const ack = () => this.frames(`B${((seq + 1) & 0x0f).toString(16).toUpperCase()}`, 600);
        if (seq === this.lastRx) {
          if (op === 0 || op === 1) queue.push(...(await ack()));
          continue;
        }
        this.lastRx = seq;
        if (length < 0) {
          length = ((f.data[1] << 8) | f.data[2]) & 0x0fff;
          body.push(...f.data.slice(3));
        } else {
          body.push(...f.data.slice(1));
        }
        // ACK with the next sequence number; sending it also listens for more frames.
        if (op === 0 || op === 1) queue.push(...(await ack()));
        if ((op === 1 || op === 3) && length >= 0 && body.length >= length) {
          const message = body.slice(0, length);
          body.length = 0;
          length = -1;
          // KWP "busy, wait": keep listening for the real answer, with a fresh wait.
          if (message[0] === 0x7f && message[2] === 0x78) {
            deadline = Date.now() + Math.max(waitMs, 3000);
            continue;
          }
          return message;
        }
      }
      // Keep the channel alive and give the adapter a chance to hear the module.
      queue.push(...(await this.frames('A3', 600)));
    }
    throw new ObdError('The module did not finish its answer.');
  }
}

export function kwpFaults(msg: number[]): Tp20Fault[] {
  if (msg[0] !== 0x58) return [];
  const n = msg[1] ?? 0;
  const out: Tp20Fault[] = [];
  for (let i = 0; i < n; i++) {
    const at = 2 + i * 3;
    if (at + 2 >= msg.length) break;
    const dtc = (msg[at] << 8) | msg[at + 1];
    out.push({ code: dtc.toString().padStart(5, '0'), status: msg[at + 2] });
  }
  return out;
}

// TP2.0 logical addresses are not always the workshop address numbers (on PQ
// cars 0x09 is power steering), so the scan names modules by address only.
// TP2.0 logical address to the VW address word workshop tools show
// (replica/kwp-write-sources.md F25: 09 = 0x20 confirmed on two cars).
export const TP20_WORD: Record<number, string> = { 0x01: '01', 0x02: '02', 0x03: '03', 0x05: '15', 0x07: '17', 0x09: '44', 0x1f: '19', 0x20: '09', 0x21: '46', 0x22: '42', 0x23: '52', 0x2c: '08', 0x52: '56' };
const TP20_LABEL: Record<string, string> = { '01': 'Engine', '02': 'Gearbox', '03': 'ABS', '08': 'Climate', '09': 'Central electronics', '15': 'Airbags', '17': 'Instrument cluster', '19': 'Gateway', '42': "Driver's door", '44': 'Power steering', '46': 'Comfort system', '52': "Passenger's door", '56': 'Radio' };
export const tp20Name = (address: number) => {
  const w = TP20_WORD[address];
  return w ? `${w} · ${TP20_LABEL[w]}` : `Address ${address.toString(16).toUpperCase().padStart(2, '0')}`;
};

// KWP2000 identification (1A 9B), offsets from the 9B echo (leon-sources 3.1):
// part number 12 ASCII, software 4 ASCII, coding type 1, coding 3 (short
// coding when type is 03), workshop record 6, component text 20.
export interface KwpIdent {
  partNumber: string | null;
  software: string | null;
  component: string | null;
  // Short coding as a number, only when the type byte says 3-byte coding.
  coding: number | null;
  raw: number[];
}

const ascii = (b: number[]) =>
  String.fromCharCode(...b.filter((x) => x >= 0x20 && x < 0x7f))
    .replace(/\s+/g, ' ')
    .trim() || null;

export function parseKwpIdent(msg: number[]): KwpIdent | null {
  if (msg[0] !== 0x5a || msg[1] !== 0x9b) return null;
  const d = msg.slice(1);
  return {
    partNumber: ascii(d.slice(1, 13)),
    software: ascii(d.slice(13, 17)),
    coding: d[17] === 0x03 && d.length >= 21 ? ((d[18] << 16) | (d[19] << 8) | d[20]) & 0x7fffff : null,
    component: d.length >= 47 ? ascii(d.slice(27, 47)) : null,
    raw: msg,
  };
}

// Gateway installed-module list (1A 9F on TP2.0 address 0x1F, leon-sources 2.1):
// length-prefixed blocks; block 1 holds 4-byte records [workshop address,
// TP2.0 address, unknown, status], present when status bit 0 is set.
export function parseGatewayList(msg: number[]): Map<number, number> {
  const out = new Map<number, number>();
  if (msg[0] !== 0x5a || msg[1] !== 0x9f) return out;
  const data = msg.slice(2);
  const len = data[0];
  if (!len || len === 0xff) return out;
  const block = data.slice(1, len);
  for (let i = 0; i + 3 < block.length; i += 4) {
    const [number, address, , status] = block.slice(i, i + 4);
    if (!status || address === 0x13 || !(status & 0x01)) continue;
    out.set(number, address);
  }
  return out;
}

// Measuring blocks (21 <group> -> 61 <group> [formula a b] x n). Formulas
// rated High or Medium in leon-sources 4.2; any other formula shows raw.
export interface MeasuringCell {
  formula: number;
  value: number | string;
  unit: string;
  known: boolean;
}

const FORMULAS: Record<number, [(a: number, b: number) => number | string, string]> = {
  0x01: [(a, b) => 0.2 * a * b, 'rpm'],
  0x02: [(a, b) => a * 0.002 * b, '%'],
  0x05: [(a, b) => a * (b - 100) * 0.1, '°C'],
  0x06: [(a, b) => 0.001 * a * b, 'V'],
  0x07: [(a, b) => 0.01 * a * b, 'km/h'],
  0x10: [(a, b) => (b & a).toString(2).padStart(8, '0'), 'bits'],
  0x11: [(a, b) => String.fromCharCode(a, b), ''],
  0x12: [(a, b) => 0.04 * a * b, 'mbar'],
  0x15: [(a, b) => 0.001 * a * b, 'V'],
  0x16: [(a, b) => 0.001 * a * b, 'ms'],
  0x17: [(a, b) => (b / 256) * a, '%'],
  0x1a: [(a, b) => b - a, '°C'],
  0x21: [(a, b) => (a === 0 ? 100 * b : (100 * b) / a), '%'],
  0x22: [(a, b) => (b - 128) * 0.01 * a, 'kW'],
  0x23: [(a, b) => 0.01 * a * b, 'l/h'],
  0x24: [(a, b) => a * 2560 + b * 10, 'km'],
  0x36: [(a, b) => a * 256 + b, 'count'],
  0x37: [(a, b) => (a * b) / 200, 's'],
  0x60: [(a, b) => 0.1 * a * b, 'mbar'],
};

export function parseMeasuringBlock(msg: number[], group: number): MeasuringCell[] | null {
  if (msg[0] !== 0x61 || msg[1] !== group) return null;
  const cells: MeasuringCell[] = [];
  for (let i = 2; i + 2 < msg.length; i += 3) {
    const [f, a, b] = msg.slice(i, i + 3);
    if (f === 0x25 && a === 0 && b === 0) continue;
    const known = FORMULAS[f];
    cells.push(known ? { formula: f, value: known[0](a, b), unit: known[1], known: true } : { formula: f, value: a * 256 + b, unit: 'raw', known: false });
  }
  return cells;
}

// ---- Coding over TP2.0 (replica/kwp-write-sources.md, "What the app should send").
// 'did': the module answers 22 06 00 inside the TP2.0 channel and takes
//   2E F1 99 date, 2E F1 98 workshop code, 2E 06 00 coding, with no session or
//   login (a real Carista ELM327 log on a VW Polo body module; High there).
// 'long': old KWP long coding, 1A 9A read, 3B 9A write (Low: no write capture).
// 'short': old KWP 3-byte coding in 1A 9B, 3B 9A write (Low on TP2.0).
export interface Tp20Coding {
  style: 'did' | 'long' | 'short';
  coding: number[];
  address: number;
  sw?: number[];
  wsc?: number[];
}

export type Tp20CodingRead = Omit<Tp20Coding, 'address'>;

export async function tp20ReadCoding(s: Tp20Session): Promise<Tp20CodingRead | null> {
  let r = await s.request([0x22, 0x06, 0x00]).catch(() => null);
  // A late answer to an earlier write (6E / 7B) can arrive first: read again.
  if (r && (r[0] === 0x6e || r[0] === 0x7b)) r = await s.request([0x22, 0x06, 0x00]).catch(() => null);
  if (r && r[0] === 0x62 && r[1] === 0x06 && r[2] === 0x00 && r.length > 3) return { style: 'did', coding: r.slice(3) };
  const id = await s.request([0x1a, 0x9b]).catch(() => null);
  if (!id || id[0] !== 0x5a || id[1] !== 0x9b) return null;
  // Offsets count the 9B echo as 0, so offset n is id[n + 1].
  const at = (n: number) => id[n + 1];
  const sw = id.slice(14, 18);
  const wsc = id.slice(22, 28);
  if (at(17) === 0x03) return { style: 'short', coding: id.slice(19, 22), sw, wsc };
  if (at(17) === 0x10) {
    await s.request([0x10, 0x89]).catch(() => undefined);
    const lc = await s.request([0x1a, 0x9a]).catch(() => null);
    if (!lc || lc[0] !== 0x5a || lc[1] !== 0x9a) return null;
    const body = lc.slice(2);
    if (body[10] !== 0x10) return null;
    const len = body[11];
    const coding = body.slice(12, 12 + len - 1);
    return coding.length ? { style: 'long', coding, sw, wsc } : null;
  }
  return null;
}

export async function tp20WriteCoding(s: Tp20Session, info: Tp20CodingRead, value: number[], loginCode?: number): Promise<void> {
  const ok = (r: number[], sid: number) => r[0] === sid + 0x40;
  const refusedForLogin = (r: number[]) => r[0] === 0x7f && (r[2] === 0x33 || r[2] === 0x22);
  if (info.style === 'did') {
    const now = new Date();
    const bcd = (n: number) => (Math.floor(n / 10) << 4) | n % 10;
    // Date: a refusal (7F 2E 31) is normal and harmless.
    await s.request([0x2e, 0xf1, 0x99, bcd(now.getFullYear() % 100), bcd(now.getMonth() + 1), bcd(now.getDate())]).catch(() => undefined);
    const wsc = await s.request([0x22, 0xf1, 0xa5]).catch(() => null);
    if (wsc && wsc[0] === 0x62 && wsc.length >= 9) {
      const r = await s.request([0x2e, 0xf1, 0x98, ...wsc.slice(3, 9)]).catch(() => [0x7f, 0x2e, 0x00]);
      if (refusedForLogin(r) && loginCode != null) {
        await unlock(s, loginCode);
        await s.request([0x2e, 0xf1, 0x98, ...wsc.slice(3, 9)]).catch(() => undefined);
      }
    }
    let w = await s.request([0x2e, 0x06, 0x00, ...value], 8000);
    if (refusedForLogin(w) && loginCode != null) {
      await unlock(s, loginCode);
      w = await s.request([0x2e, 0x06, 0x00, ...value], 8000);
    }
    if (!ok(w, 0x2e)) throw new ObdError(describeKwp(w));
    return;
  }
  if (!info.wsc || info.wsc.length !== 6 || !info.sw || info.sw.length !== 4) throw new ObdError('The module did not give its workshop code.');
  await s.request([0x10, 0x89]).catch(() => undefined);
  const record = info.style === 'long' ? [0x10, value.length + 1, ...value, 0xff] : [0x03, ...value.slice(0, 3)];
  let w = await s.request([0x3b, 0x9a, ...info.wsc, ...info.sw, ...record], 8000);
  if (w[0] === 0x7f && w[2] === 0x33 && loginCode != null) {
    await unlock(s, loginCode);
    w = await s.request([0x3b, 0x9a, ...info.wsc, ...info.sw, ...record], 8000);
  }
  if (!ok(w, 0x3b)) throw new ObdError(describeKwp(w));
}

// KWP security access: key = seed + login code over the seed's length.
async function unlock(s: Tp20Session, code?: number): Promise<void> {
  if (code == null) throw new ObdError('This module needs a security login code.');
  await s.request([0x10, 0x89]).catch(() => undefined);
  const seed = await s.request([0x27, 0x03]);
  if (seed[0] !== 0x67) throw new ObdError(describeKwp(seed));
  const bytes = seed.slice(2);
  let n = BigInt(0);
  for (const b of bytes) n = n * BigInt(256) + BigInt(b);
  const mod = BigInt(2) ** BigInt(8 * bytes.length);
  let key = (n + BigInt(code)) % mod;
  const out: number[] = [];
  for (let i = 0; i < bytes.length; i++) {
    out.unshift(Number(key % BigInt(256)));
    key = key / BigInt(256);
  }
  const r = await s.request([0x27, 0x04, ...out]);
  if (r[0] !== 0x67) throw new ObdError('The login code was not accepted.');
}

function describeKwp(r: number[]): string {
  if (r[0] !== 0x7f) return 'Unexpected answer.';
  const why: Record<number, string> = { 0x11: 'not supported', 0x12: 'not supported in this form', 0x22: 'conditions not right (ignition on, engine off)', 0x31: 'value out of range', 0x33: 'security login needed', 0x72: 'could not save' };
  return `Refused: ${why[r[2]] ?? `code ${r[2]?.toString(16)}`}.`;
}

// Who answered at a TP2.0 address: part number and component text, from the
// old KWP identification or the newer data numbers. Empty when neither answers.
export async function tp20Identity(s: Tp20Session): Promise<string> {
  const id = parseKwpIdent(await s.request([0x1a, 0x9b]).catch(() => []));
  if (id) return [id.partNumber, id.component].filter(Boolean).join(' ');
  const read = async (lo: number) => {
    const m = await s.request([0x22, 0xf1, lo]).catch(() => [] as number[]);
    return m[0] === 0x62 ? String.fromCharCode(...m.slice(3).filter((b) => b >= 0x20 && b < 0x7f)).trim() : '';
  };
  return [await read(0x87), await read(0x97)].filter(Boolean).join(' ');
}
