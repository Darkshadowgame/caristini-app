// Decoders for the VW group gateway's installed-module tables, so a scan can
// ask the car which modules it has. Formats and confidence: replica/vag-sources.md
// section 1 (UDS gateway 0x710 on MQB and MLB) and replica/leon-sources.md
// section 2 (TP2.0 gateway 0x1F on PQ cars). All of these are reads.

const hex3 = (n: number) => n.toString(16).toUpperCase().padStart(3, '0');
const hex2 = (n: number) => n.toString(16).toUpperCase().padStart(2, '0');

// MQB: 22 2A26 (present) or 22 04A3 (coded) returns a 32-byte bitmap; bit n,
// least significant bit first, is node n (High, three sources).
export function nodesFromBitmap(bytes: number[]): number[] {
  const out: number[] = [];
  bytes.forEach((b, i) => {
    for (let bit = 0; bit < 8; bit++) if (b & (1 << bit)) out.push(i * 8 + bit);
  });
  return out;
}

// Node to 11-bit UDS IDs: 0x76 to 0x7F is the OBD window (7E0 + n - 0x76, reply +8);
// 0x01 to 0x09 and 0xE0 to 0xF7 are 29-bit only, and node 00 is unexplained.
export function idsForNode(n: number): { tx: string; rx: string } | null {
  if (n === 0 || (n >= 0x01 && n <= 0x09) || (n >= 0xe0 && n <= 0xf7) || n > 0xff) return null;
  if (n >= 0x76 && n <= 0x7f) {
    const tx = 0x7e0 + (n - 0x76);
    return { tx: hex3(tx), rx: hex3(tx + 8) };
  }
  const tx = 0x700 + n;
  return { tx: hex3(tx), rx: hex3(tx + 0x6a) };
}

export interface GatewaySlot {
  // Workshop address word, for example '17'.
  code: string;
  // UDS request ID from 2A2C, when the gateway gives one.
  tx: string | null;
  // 2A29 protocol bits: bit 0 UDS, bit 1 TP2.0.
  uds: boolean;
  tp20: boolean;
}

// MLB: 22 2A2A (slot -> address word), 22 2A2C (slot -> u16 request ID) and
// 22 2A29 (slot -> protocol bits). 2A2A is the gateway's slot table, not proof
// that a module is fitted, so slots are treated as candidates to try.
export function slotsFromTables(addresses: number[], ids: number[] | null, protocols: number[] | null): GatewaySlot[] {
  const out: GatewaySlot[] = [];
  const seen = new Set<string>();
  addresses.forEach((a, i) => {
    if (!a) return;
    const code = hex2(a);
    if (seen.has(code)) return;
    seen.add(code);
    const id = ids && ids.length >= i * 2 + 2 ? (ids[i * 2] << 8) | ids[i * 2 + 1] : 0;
    const p = protocols?.[i] ?? 0;
    out.push({ code, tx: id ? hex3(id) : null, uds: (p & 0x01) !== 0, tp20: (p & 0x02) !== 0 });
  });
  return out;
}

// A6 C6-style gateway list (22 04A1): 4-byte records [address word, TP2.0
// logical address, status, bus]; status 00 = not fitted (Medium, one capture).
export function parseC6List(data: number[]): Map<string, number> {
  const out = new Map<string, number>();
  for (let i = 0; i + 3 < data.length; i += 4) {
    const [code, address, status] = data.slice(i, i + 3);
    if (!code || !status) continue;
    out.set(hex2(code), address);
  }
  return out;
}
