// Several Mode 01 values in one request (SAE J1979 allows up to 6 on CAN).
// Pure helpers for ElmClient.readLiveMany, kept here so they can be tested
// without an adapter.
import type { LivePid } from './pids';

export const MAX_PIDS_PER_REQUEST = 6;
// Data bytes in one CAN frame after the mode byte (single frame, headers off).
const FRAME_BYTES = 6;

// Splits the list so every answer fits one CAN frame: with headers off,
// frames of 2 modules answering long replies at once could not be told apart.
export function chunkPids<T extends Pick<LivePid, 'bytes'>>(list: T[]): T[][] {
  const out: T[][] = [];
  let cur: T[] = [];
  let size = 0;
  for (const p of list) {
    if (cur.length && (size + 1 + p.bytes > FRAME_BYTES || cur.length === MAX_PIDS_PER_REQUEST)) {
      out.push(cur);
      cur = [];
      size = 0;
    }
    cur.push(p);
    size += 1 + p.bytes;
  }
  if (cur.length) out.push(cur);
  return out;
}

export function batchCommand(chunk: Pick<LivePid, 'pid'>[]): string {
  return `01${chunk.map((p) => p.pid.toString(16).padStart(2, '0').toUpperCase()).join('')}`;
}

// Reads every value of a combined answer: 41 then PID, data, PID, data...
// One message per answering module. Stops at a PID that was not asked or at
// data cut short. A later non-null answer replaces a null one (an O2 sensor
// with no reading from one module, a value from another).
export function parseBatch(msgs: number[][], chunk: LivePid[]): { values: Map<number, number | null>; got: number } {
  const values = new Map<number, number | null>();
  let got = 0;
  for (const m of msgs) {
    if (m[0] !== 0x41) continue;
    let j = 1;
    while (j < m.length) {
      const p = chunk.find((x) => x.pid === m[j]);
      if (!p || j + 1 + p.bytes > m.length) break;
      if (!values.has(p.pid) || values.get(p.pid) == null) {
        values.set(p.pid, p.decode(m.slice(j + 1, j + 1 + p.bytes)));
        got++;
      }
      j += 1 + p.bytes;
    }
  }
  return { values, got };
}

// Whether this car answers combined requests. true: it gave more than one
// value. false: it answered with no more than one value's worth of data, so
// it only reads the first PID. null: nothing to go on (no answer or an error),
// so decide later.
export function batchVerdict(msgs: number[][], chunk: Pick<LivePid, 'bytes'>[], got: number): boolean | null {
  const answers = msgs.filter((m) => m[0] === 0x41);
  if (!answers.length) return null;
  if (got > 1) return true;
  const most = Math.max(...answers.map((m) => m.length));
  if (most <= 2 + Math.max(...chunk.map((p) => p.bytes))) return false;
  return null;
}
