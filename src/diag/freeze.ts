// Freeze frames (service 02): the values the engine saved when a fault was
// stored. Service 02 takes the same PIDs as service 01 with the same meaning,
// plus a frame number; PID 02 is the code that caused the frame (Wikipedia,
// "OBD-II PIDs", Service 02). Values with a standard formula in src/obd/pids.ts
// are decoded with name and unit; the rest are shown raw. Reads only.
import { decodeDtc } from '../obd/dtc';
import { FREEZE_PIDS, pidInfo, supportedFromMask } from '../obd/pids';

export interface FreezeValue {
  pid: number;
  label: string;
  // Decoded value with unit, or the raw bytes when no standard formula is known.
  text: string;
  raw: string;
  decoded: boolean;
  // The number and unit behind text, so the screen can show it in the
  // owner's units (speed in mph, temperature in °F).
  value?: number;
  unit?: string;
  decimals?: number;
}

// The value in the owner's units, through a converter such as toUserUnits.
export function freezeText(v: FreezeValue, convert: (value: number, unit: string) => { value: number; unit: string }): string {
  if (!v.decoded || v.value == null || !v.unit) return v.text;
  const c = convert(v.value, v.unit);
  return `${c.value.toFixed(v.decimals ?? 0)} ${c.unit}`;
}

export interface FreezeFrameRead {
  frame: number;
  code: string;
  values: FreezeValue[];
}

export type Requester = { request(cmd: string, timeoutMs?: number): Promise<number[][]> };

const hex2 = (n: number) => n.toString(16).toUpperCase().padStart(2, '0');
const hexBytes = (b: number[]) => b.map(hex2).join(' ');

// Service 01 PID 03, fuel system status (Wikipedia, "OBD-II PIDs", PID 03 table).
const FUEL_STATUS: Record<number, string> = {
  0: 'Engine off',
  1: 'Open loop, engine still cold',
  2: 'Closed loop, using oxygen sensor feedback',
  4: 'Open loop, engine load or fuel cut on deceleration',
  8: 'Open loop, system failure',
  16: 'Closed loop, fault in the feedback system',
};

// PIDs that only describe the frame or list support: not shown as values.
const SKIP = new Set([0x00, 0x02, 0x20, 0x40, 0x60, 0x80, 0xa0, 0xc0]);

// One PID's data bytes (after 42 PID frame) as a named value.
export function decodeFreezeValue(pid: number, data: number[]): FreezeValue {
  const raw = hexBytes(data);
  if (pid === 0x03 && data.length) {
    const text = FUEL_STATUS[data[0]];
    if (text) return { pid, label: 'Fuel system status', text, raw, decoded: true };
  }
  const p = pidInfo(pid);
  if (p && data.length >= p.bytes) {
    const v = p.decode(data.slice(0, p.bytes));
    if (v != null && Number.isFinite(v)) return { pid, label: p.label, text: `${v.toFixed(p.decimals)}${p.unit ? ` ${p.unit}` : ''}`, raw, decoded: true, value: v, unit: p.unit, decimals: p.decimals };
  }
  return { pid, label: `PID ${hex2(pid)}`, text: raw || 'No data', raw, decoded: false };
}

// The answer to "02 PID FF" (42 PID FF data...): the data bytes, or null.
// Only a reply for the frame asked counts, except for frame 0, where a reply
// with another frame byte is still the only frame the car keeps.
export function freezeData(msgs: number[][], pid: number, frame: number): number[] | null {
  const ok = msgs.filter((m) => m[0] === 0x42 && m[1] === pid && m.length >= 4);
  const m = ok.find((x) => x[2] === frame) ?? (frame === 0 ? ok[0] : undefined);
  return m ? m.slice(3) : null;
}

async function ask(client: Requester, pid: number, frame: number): Promise<number[] | null> {
  try {
    return freezeData(await client.request(`02${hex2(pid)}${hex2(frame)}`), pid, frame);
  } catch {
    return null;
  }
}

// Which PIDs this frame holds: from the support masks 00, 20, 40 (and on),
// or the usual set when the car does not answer the mask.
export async function framePids(client: Requester, frame: number): Promise<number[]> {
  const out: number[] = [];
  let base = 0;
  while (base <= 0xa0) {
    const d = await ask(client, base, frame);
    if (!d || d.length < 4) break;
    const list = supportedFromMask(base, d.slice(0, 4));
    out.push(...list);
    if (!list.includes(base + 0x20)) break;
    base += 0x20;
  }
  return out.length ? out.filter((p) => !SKIP.has(p)) : FREEZE_PIDS;
}

// Reads frame 0 and, on CAN cars, any further frames the engine kept (up to
// maxFrames). A frame that repeats the code of an earlier one ends the list.
export async function readFreezeFrames(client: Requester, opts: { isCan: boolean; maxFrames?: number }): Promise<FreezeFrameRead[]> {
  const frames: FreezeFrameRead[] = [];
  const max = opts.isCan ? (opts.maxFrames ?? 3) : 1;
  for (let frame = 0; frame < max; frame++) {
    const d = await ask(client, 0x02, frame);
    const code = d && d.length >= 2 ? decodeDtc(d[0], d[1]) : null;
    if (!code || frames.some((f) => f.code === code)) break;
    const values: FreezeValue[] = [];
    for (const pid of await framePids(client, frame)) {
      const data = await ask(client, pid, frame);
      if (data && data.length) values.push(decodeFreezeValue(pid, data));
    }
    // Named values first, raw ones after.
    values.sort((a, b) => Number(b.decoded) - Number(a.decoded));
    frames.push({ frame, code, values });
  }
  return frames;
}
