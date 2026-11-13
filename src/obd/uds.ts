// UDS (ISO 14229-1) helpers: fault codes from service 19, identification
// data from service 22, and the text forms the app shows.
import { decodeDtc } from './dtc';

export interface UdsFault {
  // 7 characters: the SAE code plus the failure type byte, for example U111300.
  code: string;
  // The SAE part alone (U1113), used for library lookups.
  base: string;
  failureType: number;
  status: number;
  state: 'active' | 'stored' | 'pending' | 'intermittent';
  warningLamp: boolean;
  // A VW KWP2000 fault: code is the 5-digit decimal fault number.
  kwp?: boolean;
}

// ISO 14229-1 DTC status bits.
const TEST_FAILED = 0x01;
const PENDING = 0x04;
const CONFIRMED = 0x08;
const FAILED_SINCE_CLEAR = 0x20;
const WARNING_LAMP = 0x80;

export function formatUdsDtc(b1: number, b2: number, b3: number): string | null {
  const base = decodeDtc(b1, b2);
  if (!base && b3 === 0) return null;
  // First two bytes zero: the maker's own fault number, not an SAE code.
  if (!base) return toHex([b1, b2, b3]);
  return `${base}${b3.toString(16).toUpperCase().padStart(2, '0')}`;
}

// True for a maker-numbered fault (6 hex digits), false for an SAE-style code.
export function isMakerNumbered(code: string): boolean {
  return /^[0-9A-F]{6}$/.test(code);
}

export function faultState(status: number): UdsFault['state'] {
  if (status & TEST_FAILED) return 'active';
  if (status & CONFIRMED) return 'stored';
  if (status & PENDING) return 'pending';
  return 'intermittent';
}

// Response to 19 02 <mask>: 59 02 <availability mask> then 4 bytes per fault
// (3 DTC bytes and a status byte).
export function parseDtcReport(msg: number[]): UdsFault[] | null {
  if (msg[0] !== 0x59 || msg[1] !== 0x02) return null;
  const out: UdsFault[] = [];
  const seen = new Set<string>();
  for (let i = 3; i + 3 < msg.length; i += 4) {
    const code = formatUdsDtc(msg[i], msg[i + 1], msg[i + 2]);
    const status = msg[i + 3];
    // Skip entries whose only bits say a test has not run yet.
    if (!code || (status & 0x2d) === 0 || seen.has(code)) continue;
    seen.add(code);
    out.push({
      code,
      base: isMakerNumbered(code) ? '' : code.slice(0, 5),
      failureType: msg[i + 2],
      status,
      state: faultState(status),
      warningLamp: (status & WARNING_LAMP) !== 0,
    });
  }
  return out;
}

export function wasSeenSinceClear(status: number): boolean {
  return (status & FAILED_SINCE_CLEAR) !== 0;
}

// Negative response: 7F <service> <code>.
export function negativeCode(msg: number[], service: number): number | null {
  return msg[0] === 0x7f && msg[1] === service ? (msg[2] ?? 0) : null;
}

// Plain-English versions of the ISO 14229 negative response codes.
const NRC: Record<number, string> = {
  0x10: 'The module turned the request down.',
  0x11: 'The module does not support this.',
  0x12: 'The module does not support this option.',
  0x13: 'The module did not accept the message format.',
  0x21: 'The module was busy.',
  0x22: 'The car is not in the right state for this. Try with the engine off and the ignition on.',
  0x31: 'The module does not have this value.',
  0x33: 'The module needs a security login for this.',
  0x35: 'The security login was wrong.',
  0x72: 'The module could not save the change.',
  0x78: 'The module is still working.',
  0x7e: 'The module does not allow this in this mode.',
  0x7f: 'The module does not allow this in this mode.',
};

export function describeNrc(code: number): string {
  return NRC[code] ?? `The module refused (code ${code.toString(16).toUpperCase().padStart(2, '0')}).`;
}

// Identification strings arrive padded with spaces (VW part numbers are 11
// characters plus an index, space-filled per opendbc), NUL or 0xFF.
export function cleanText(bytes: number[]): string | null {
  const b = [...bytes];
  while (b.length && (b[b.length - 1] === 0x00 || b[b.length - 1] === 0xff || b[b.length - 1] === 0x20)) b.pop();
  const text = String.fromCharCode(...b.filter((x) => x >= 0x20 && x < 0x7f)).trim();
  return text || null;
}

export function toHex(bytes: number[]): string {
  return bytes.map((x) => x.toString(16).toUpperCase().padStart(2, '0')).join('');
}

// Failure type byte meanings, SAE J2012-DA (the third DTC byte).
const FAILURE_TYPES: Record<number, string> = {
  0x00: 'No sub-type information',
  0x01: 'General electrical failure',
  0x02: 'General signal failure',
  0x04: 'System internal failure',
  0x08: 'Bus signal or message failure',
  0x11: 'Circuit short to ground',
  0x12: 'Circuit short to battery',
  0x13: 'Circuit open',
  0x14: 'Circuit short to ground or open',
  0x15: 'Circuit short to battery or open',
  0x16: 'Circuit voltage below threshold',
  0x17: 'Circuit voltage above threshold',
  0x1c: 'Circuit voltage out of range',
  0x1d: 'Circuit current out of range',
  0x29: 'Signal invalid',
  0x31: 'No signal',
  0x41: 'General checksum failure',
  0x42: 'General memory failure',
  0x49: 'Internal electronic failure',
  0x4b: 'Over temperature',
  0x54: 'Missing calibration',
  0x55: 'Not configured',
  0x62: 'Signal compare failure',
  0x64: 'Signal plausibility failure',
  0x71: 'Actuator stuck',
  0x72: 'Actuator stuck open',
  0x73: 'Actuator stuck closed',
  0x81: 'Invalid serial data received',
  0x82: 'Alive or sequence counter incorrect',
  0x86: 'Signal invalid',
  0x87: 'Missing message',
  0x88: 'Bus off',
  0x92: 'Performance or incorrect operation',
  0x94: 'Unexpected operation',
  0x96: 'Component internal failure',
  0x98: 'Component or system over temperature',
  0x03: 'FM or PWM failure',
  0x05: 'System programming failure',
  0x06: 'Algorithm based failure',
  0x07: 'Mechanical failure',
  0x09: 'Component failure',
  0x18: 'Circuit current below threshold',
  0x19: 'Circuit current above threshold',
  0x1a: 'Circuit resistance below threshold',
  0x1b: 'Circuit resistance above threshold',
  0x1e: 'Circuit resistance out of range',
  0x1f: 'Circuit intermittent',
  0x23: 'Signal stuck low',
  0x24: 'Signal stuck high',
  0x26: 'Signal rate of change below threshold',
  0x27: 'Signal rate of change above threshold',
  0x2f: 'Signal erratic',
  0x36: 'Signal frequency too low',
  0x37: 'Signal frequency too high',
  0x44: 'Data memory failure',
  0x45: 'Program memory failure',
  0x46: 'Calibration memory failure',
  0x47: 'Watchdog or safety processor failure',
  0x4a: 'Incorrect component installed',
  0x51: 'Not programmed',
  0x52: 'Not activated',
  0x53: 'Deactivated',
  0x56: 'Invalid or incompatible configuration',
  0x61: 'Signal calculation failure',
  0x63: 'Circuit or component protection time-out',
  0x74: 'Actuator slipping',
  0x77: 'Commanded position not reachable',
  0x7b: 'Low fluid level',
  0x84: 'Signal below allowed range',
  0x85: 'Signal above allowed range',
  0x8f: 'Erratic',
  0x93: 'No operation',
  0x97: 'Operation obstructed or blocked',
};

export function describeFailureType(ftb: number): string | null {
  return FAILURE_TYPES[ftb] ?? null;
}

export const STATE_LABEL: Record<UdsFault['state'], string> = {
  active: 'Active now',
  stored: 'Stored',
  pending: 'Pending',
  intermittent: 'Intermittent',
};
