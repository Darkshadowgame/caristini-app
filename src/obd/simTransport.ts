import { fordSensors, mazdaSensors, vagSensors } from '../data/sensors';
// A pretend car and ELM327 adapter, so every screen can be used without a car.
// It answers in the same text format a real adapter uses (headers and spaces
// off, ISO-TP multi-frame output on CAN).
import { encodeDtc } from './dtc';
import { Transport } from './transport';

export interface DemoCar {
  id: string;
  label: string;
  vin: string;
  diesel: boolean;
  // Ignition on, engine off (rpm 0): lets the demo car accept coding changes.
  engineOff?: boolean;
  modules: Record<string, SimModule>;
  // Raw answers to maker-specific DIDs, per module request ID.
  extras?: Record<string, Record<string, number[]>>;
  // TP2.0 / KWP2000 modules by TP2.0 address: 16-bit fault numbers and status bytes.
  tp20?: Record<number, Tp20Sim>;
  // The engine does not answer the OBD VIN request (09 02); tests only.
  noObdVin?: boolean;
  // TP2.0 addresses that answer KWP 1A 90 with the VIN; tests only.
  vinAt?: number[];
}

// A module that speaks KWP2000 over VW TP2.0.
interface Tp20Sim {
  // 16-bit fault numbers and status bytes.
  faults: [number, number][];
  part?: string;
  sw?: string;
  component?: string;
  coding?: number;
  // Measuring blocks: group -> [formula, a, b] cells, flattened.
  groups?: Record<number, number[]>;
  // Gateway only: installed modules as [workshop address, TP2.0 address].
  list?: [number, number][];
  // Coding over TP2.0: modern record (22/2E 06 00, as Carista writes it) or old
  // KWP long coding (1A 9A / 3B 9A). Hex.
  didCoding?: string;
  longCoding?: string;
}

interface SimModule {
  part: string;
  sw: string;
  hw?: string;
  name?: string;
  coding?: string;
  // 7-character UDS fault codes (or 6 hex digits for maker numbering) with their status byte.
  faults?: [string, number][];
  // Answers fault reads with "busy, wait" (7F 19 78) until the adapter listens longer.
  slow?: boolean;
  // Answers the first N fault reads with "busy, repeat" (7F 19 21).
  busyFirst?: number;
  // Refuses 14 FF FF FF in the default session (7F 14 11).
  clearNeedsSession?: boolean;
  // Accepts coding writes but keeps the old coding (to test the auto-restore).
  ignoresWrites?: boolean;
  // Reading several identifiers in one request: refused outright ('none'), or
  // refused when any one is unknown ('strict'), as some modules do.
  // 'first' answers only the first identifier of a list.
  multiDid?: 'none' | 'strict' | 'first';
  // Routines (31 01 id) in the extended session, with the values each sets.
  routines?: Record<string, Record<string, string>>;
  // Adaptation values by data identifier (hex), readable with 22 and writable with 2E.
  dids?: Record<string, string>;
  // Login code the module wants (27 03/04, key = seed + code) before adaptation writes.
  login?: number;
}

// Made-up VINs with real maker prefixes, so per-car filtering can be tried.
export const DEMO_CARS: DemoCar[] = [
  {
    id: 'vw',
    label: 'VW Golf VII, petrol',
    vin: 'WVWZZZAUZHW000001',
    diesel: false,
    modules: {
      '7E0': { part: '04E906016DE', sw: '0003', hw: '04E907309A', name: 'R4 1.4l TSI', coding: '0100000000', faults: [['P042000', 0x2f], ['U102600', 0x28]], clearNeedsSession: true },
      '7E1': { part: '0CW300041', sw: '1211', hw: '0CW300041', name: 'DQ200-MQB', faults: [['P071600', 0x28], ['P171E00', 0x08]], slow: true },
      '714': { part: '5G1920740A', sw: '0404', hw: '5G1920740A', name: 'KOMBI', coding: '2D0F00290A0000', faults: [['U111300', 0x28]] },
      '710': { part: '5Q0907530M', sw: '2178', hw: '5Q0907530C', name: 'GW MQB High', coding: '0300000000000000' },
      '713': { part: '5Q0614517AA', sw: '0012', hw: '5Q0614517R', name: 'ESC MQB', faults: [['U111300', 0x28]] },
      '752': { part: '5Q0907801E', sw: '0510', name: 'EPB', faults: [['U111300', 0x28]] },
      '712': { part: '5Q0909144R', sw: '3003', name: 'EPS MQB' },
      '715': { part: '5Q0959655BJ', sw: '0753', name: 'AIRBAG VW20', busyFirst: 2 },
      '746': { part: '5G0907044BN', sw: '0402', name: 'CLIMATRONIC', faults: [['0000F3', 0x09]] },
      '74A': { part: '5Q4959593C', sw: '0018', name: 'DCU FL', faults: [['B116A14', 0x28]] },
    },
    extras: {
      '714': { '2203': [0x01, 0x81, 0xcd], '202F': [0x94] },
      '7E0': { '295A': [0x01, 0x81, 0xc9] },
      '715': { '2353': [0], '2354': [0], '2355': [0], '2356': [0], '2357': [0] },
    },
  },
  {
    id: 'a6',
    label: 'Audi A6 C7, diesel',
    vin: 'WAUZZZ4G1CN000001',
    diesel: true,
    engineOff: true,
    modules: {
      '7E0': { part: '03L906018LB', sw: '9978', name: 'R4 2.0l TDI', faults: [['P0011B5', 0x28]], clearNeedsSession: true },
      '7E1': { part: '4G0927155T', sw: '0005', name: 'MULTITRONIC', faults: [['P071600', 0x28], ['P174100', 0x08]], slow: true },
      '714': { part: '4G8920950K', sw: '0209', name: 'KOMBI', coding: '1303080000000000000000', dids: { '0123': '01', '0456': '0032', '0700': '00003A98' }, login: 20103, routines: { '0E10': { '0700': '00000000' } } },
      '710': { part: '4H0907468D', sw: '0080', name: 'GW-BCM2' },
      '715': { part: '4G0959655P', sw: '0060', name: 'AIRBAG', busyFirst: 2 },
      '746': { part: '4G0820043AB', sw: '0350', name: 'KLIMA', faults: [['0000F3', 0x09], ['000183', 0x09]] },
      '752': { part: '4H0907801E', sw: '0410', name: 'EPB' },
    },
    extras: {
      // Gateway tables (MLB): slot -> address word, protocol bits, request ID.
      '710': {
        '2A2A': [0x01, 0x17, 0x09, 0x46, 0x42, 0x08, 0x00],
        '2A29': [0x01, 0x01, 0x02, 0x02, 0x02, 0x01, 0x00],
        '2A2C': [0, 0, 0x07, 0x14, 0, 0, 0, 0, 0, 0, 0x07, 0x46, 0, 0],
      },
    },
    tp20: {
      // TP2.0 logical addresses: 09 = 0x20, 46 = 0x21, 42 = 0x22 (kwp-write-sources F25).
      0x20: { faults: [[256, 0x23], [471, 0x24]], part: '4H0907063BA', sw: '0100', component: 'BCM1 2.0', didCoding: '0A1C00103F0000200402000000000000' },
      0x21: { faults: [], part: '4H0907064BG', sw: '0333', component: 'BCM2 2.0', didCoding: '0004001100000C000000000000000000' },
      0x22: { faults: [[2123, 0x23]], part: '4G8959793E', sw: '0212', component: 'TSG FA', didCoding: '010814204001620002080002' },
    },
  },
  {
    // PQ35: no UDS modules; the engine answers standard OBD2, the rest TP2.0 only.
    id: 'leon',
    label: 'SEAT Leon Cupra, petrol',
    vin: 'VSSZZZ1PZ7R000001',
    diesel: false,
    engineOff: true,
    modules: {},
    tp20: {
      0x01: {
        faults: [[16684, 0x23]],
        part: '1P0907115AA',
        sw: '0040',
        component: '2.0l R4/4V TFSI',
        coding: 11,
        // Group 115: rpm, load, boost specified and actual (mbar).
        groups: { 115: [0x01, 0xc8, 0x4b, 0x21, 0x64, 0x50, 0x12, 0xfa, 0xc8, 0x12, 0xfa, 0xbe] },
      },
      0x03: { faults: [], part: '1K0907379AC', sw: '0101', component: 'ESP MK60EC1' },
      0x20: { faults: [], part: '1K0937049N', sw: '0050', component: 'BCM PQ35 H', longCoding: '0F1A0000001C0006080000000003000104000100000000000000000000' },
      0x05: { faults: [[532, 0x24]], part: '1P0909605', sw: '0080', component: 'Airbag VW10' },
      0x07: { faults: [], part: '1P0920823A', sw: '0040', component: 'KOMBI+WEGFAHRSP VDO', coding: 1802 },
      0x09: { faults: [], part: '1K0909144J', sw: '3501', component: 'EPS_ZFLS Kl.142' },
      // Gateway: lists engine, ABS, airbag, cluster (TP2.0 0x07), steering.
      0x1f: {
        faults: [],
        part: '1K0907530L',
        sw: '0060',
        component: 'J533 Gateway',
        list: [
          [0x01, 0x01],
          [0x03, 0x03],
          [0x15, 0x05],
          [0x17, 0x07],
          [0x44, 0x09],
        ],
      },
    },
  },
  {
    // Focus ST Mk3: the cluster sits on the second bus, so 720 does not answer.
    id: 'ford',
    label: 'Ford Focus ST, petrol',
    vin: 'WF05XXGCC5F000001',
    diesel: false,
    modules: {
      '7E0': { part: 'DEMO-12A650-ST', sw: 'AB' },
      '726': { part: 'DEMO-14A073-ST', sw: 'BF' },
      '760': { part: 'DEMO-2C405-ST', sw: 'AC', faults: [['C003A28', 0x28]] },
      '737': { part: 'DEMO-14B321-ST', sw: 'AA' },
      '730': { part: 'DEMO-3F964-ST', sw: 'AD' },
    },
    extras: {
      '726': { DD01: [0x01, 0x8c, 0x2a], '4028': [0x50], '4029': [0x3c], '402A': [0x8c], '4027': [0x01, 0x2c], '4090': [0x1f, 0xf4] },
      '7E0': { DD01: [0x01, 0x8c, 0x2a], '054B': [0x56], '033E': [0x1c, 0x00], '0353': [0x0b, 0x80], '0461': [0x0b, 0x10], '0462': [0x20, 0x00] },
    },
  },
  {
    // Mazda6 GJ 2.2 diesel: rear body module is on the second bus.
    id: 'mazda',
    label: 'Mazda6, diesel',
    vin: 'JMZGJ62S600000001',
    diesel: true,
    modules: {
      '7E0': { part: 'DEMO-18881-D', sw: 'K' },
      '760': { part: 'DEMO-437A0', sw: 'B' },
      '720': { part: 'DEMO-55430', sw: 'C' },
      '726': { part: 'DEMO-675Y0', sw: 'A' },
      '731': { part: 'DEMO-67SS0', sw: 'A' },
    },
    extras: {
      '7E0': {
        DD01: [0x01, 0x6f, 0x30],
        '1310': [0x33, 0x00],
        '1305': [0x2e, 0xe0],
        F470: [0x00, 0x0c, 0x80, 0x0d, 0x00],
        '042C': [0x01, 0xa9],
        '044B': [0x01, 0x40],
        '0380': [0x00],
        '0432': [0x00, 0x82],
        '0434': [0x00, 0x00, 0x0f, 0x94],
      },
      '726': { '402A': [0x31, 0x9c] },
    },
  },
];
const SUPPORTED = [
  0x01, 0x04, 0x05, 0x06, 0x07, 0x0b, 0x0c, 0x0d, 0x0e, 0x0f, 0x10, 0x11, 0x14, 0x15, 0x1f, 0x20,
  0x21, 0x2e, 0x2f, 0x30, 0x31, 0x33, 0x3c, 0x40, 0x42, 0x43, 0x44, 0x45, 0x46, 0x49, 0x4c, 0x4d, 0x4e, 0x5c,
];

function toBytes(text: string): number[] {
  return text.split('').map((c) => c.charCodeAt(0));
}

function hexToBytes(h: string): number[] {
  const out: number[] = [];
  for (let i = 0; i + 1 < h.length; i += 2) out.push(parseInt(h.slice(i, i + 2), 16));
  return out;
}

function hex(n: number): string {
  return n.toString(16).toUpperCase().padStart(2, '0');
}

// Formats a reply the way an ELM327 prints CAN frames with headers off.
function frames(bytes: number[]): string {
  if (bytes.length <= 7) return bytes.map(hex).join('');
  const lines = [bytes.length.toString(16).toUpperCase().padStart(3, '0')];
  lines.push(`0:${bytes.slice(0, 6).map(hex).join('')}`);
  let idx = 1;
  for (let i = 6; i < bytes.length; i += 7, idx++) {
    lines.push(`${(idx % 16).toString(16).toUpperCase()}:${bytes.slice(i, i + 7).map(hex).join('').padEnd(14, '0')}`);
  }
  return lines.join('\r');
}

function mask(base: number): number[] {
  const out = [0, 0, 0, 0];
  for (const p of SUPPORTED) {
    const i = p - base - 1;
    if (i >= 0 && i < 32) out[i >> 3] |= 0x80 >> (i & 7);
  }
  return out;
}

export class SimTransport implements Transport {
  readonly kind = 'simulated' as const;
  readonly label: string;
  private header = '7DF';
  // Raw CAN mode (protocol B, headers on) and the open TP2.0 channel.
  private raw = false;
  private cra = '';
  private channel: { address: number; tx: string; seq: number } | null = null;
  private longWait = false;
  // Routines run, so tests can check none ran twice.
  routinesRun = 0;
  private headers = false;
  private session: Record<string, number> = {};
  private unlocked: Record<string, boolean> = {};
  private static SEED = 0x12345678;
  private busyCount: Record<string, number> = {};
  private stored = ['P0420', 'P0171', 'P0300'];
  private pending = ['P0171'];
  private permanent = ['P0420'];
  private started = Date.now();
  private monitorsIncomplete = 0x04; // evaporative system not yet complete
  private freeze: Record<number, number[]> | null = {
    0x02: [0x04, 0x20],
    0x0c: [0x0b, 0xb8],
    0x0d: [72],
    0x05: [128],
    0x04: [140],
    0x06: [150],
    0x07: [158],
    0x0b: [62],
    0x0f: [55],
    0x11: [60],
  };
  private clearedAt = 0;
  private closed = false;

  private car: DemoCar;

  // delayMs mimics the time a real adapter takes per reply (0 in tests).
  constructor(car: DemoCar = DEMO_CARS[0], private delayMs = 60) {
    // A copy, so clearing faults in one session does not change the demo data.
    this.car = JSON.parse(JSON.stringify(car)) as DemoCar;
    this.label = `Demo car (${car.label})`;
    if (car.diesel) this.monitorsIncomplete = 0x40; // particulate filter not yet complete
  }

  async send(command: string): Promise<string> {
    if (this.closed) throw new Error('Simulated adapter is disconnected.');
    if (this.delayMs) await new Promise((r) => setTimeout(r, this.delayMs * (0.6 + Math.random() * 0.8)));
    return `${this.answer(command.replace(/\s/g, '').toUpperCase())}\r\r>`;
  }

  async close(): Promise<void> {
    this.closed = true;
  }

  // Monitor mode for the demo: a VCDS-like exchange with the cluster, repeated.
  async stream(command: string, onText: (text: string) => void, until: Promise<void>): Promise<'stopped' | 'ended'> {
    if (command !== 'ATMA') return 'ended';
    const script = ['714031003', '77E065003003201F4', '7140322F187', '77E100E62F1873447', '7142134473839323039', '77E2135304B202020', '7140322F187'];
    let stop = false;
    until.then(() => {
      stop = true;
    });
    let i = 0;
    while (!stop) {
      await new Promise((r) => setTimeout(r, 150));
      onText(`${script[i % script.length]}\r`);
      i++;
    }
    return 'stopped';
  }

  private answer(cmd: string): string {
    if (cmd === 'ATSPB') {
      this.raw = true;
      return 'OK';
    }
    if (/^ATSP[0-9A]$/.test(cmd) && cmd !== 'ATSPB') {
      this.raw = false;
      this.channel = null;
      return 'OK';
    }
    if (cmd.startsWith('ATCRA')) {
      this.cra = cmd.slice(5);
      return 'OK';
    }
    if (this.raw && !cmd.startsWith('AT')) return this.rawFrame(cmd);
    if (cmd === 'ATZ') return '\r\rELM327 v2.2';
    if (cmd === 'ATDPN') return 'A6';
    if (cmd.startsWith('ATSH')) {
      this.header = cmd.slice(4);
      return 'OK';
    }
    if (cmd === 'ATD') {
      this.headers = false;
      this.cra = '';
      return 'OK';
    }
    if (cmd === 'ATH1' || cmd === 'ATH0') {
      this.headers = cmd === 'ATH1';
      return 'OK';
    }
    if (cmd === 'ATSTFF') {
      this.longWait = true;
      return 'OK';
    }
    if (cmd === 'ATST32') {
      this.longWait = false;
      return 'OK';
    }
    if (cmd === '1003' || cmd === '1001') return this.sessionChange(cmd === '1003' ? 3 : 1);
    if (cmd === 'ATI') return 'ELM327 v2.2';
    if (cmd === 'AT@1') return 'Caristini demo adapter';
    if (cmd === 'ATDP') return 'ISO 15765-4 (CAN 11/500)';
    if (cmd === 'ATRV') return `${(13.9 + Math.random() * 0.4).toFixed(1)}V`;
    if (cmd.startsWith('AT')) return 'OK';
    if (cmd.startsWith('22')) return this.uds(cmd.slice(2));
    // Fault details (extended data / snapshot): one demo record each.
    if ((cmd.startsWith('1906') || cmd.startsWith('1904')) && this.car.modules[this.header]) {
      return frames([0x59, parseInt(cmd.slice(2, 4), 16), ...hexToBytes(cmd.slice(4, 10)), 0x28, 0x01, 0x03, 0x00, 0x2a]);
    }
    if (cmd === '3E00') {
      if (!this.car.modules[this.header]) return 'NO DATA';
      if (!this.headers) return '7E00';
      // Reply ID: request + 8 for the engine range and non-VW cars, + 6A on VW.
      const tx = parseInt(this.header, 16);
      const vw = /^(WVW|WAU|VSS|WV1|WV2|TMB)/.test(this.car.vin);
      const rx = (tx >= 0x7e0 && tx <= 0x7e7) || !vw ? tx + 8 : tx + 0x6a;
      return `${rx.toString(16).toUpperCase()}027E00`;
    }
    if (cmd.startsWith('19')) return this.dtcReport();
    if (cmd === '14FFFFFF') return this.clearModule();
    if (cmd.startsWith('2E')) return this.write(cmd.slice(2));
    if (cmd.startsWith('3101')) return this.routine(cmd.slice(4, 8));
    if (cmd === '2703' || cmd.startsWith('2704')) return this.securityAccess(cmd);
    if (this.header !== '7DF') return 'NO DATA';

    const mode = cmd.slice(0, 2);
    if (mode === '01') {
      // Several PIDs in one request (up to 6 on CAN): one combined answer.
      const pids = (cmd.slice(2).match(/../g) ?? []).map((h) => parseInt(h, 16));
      if (pids.length <= 1) return this.mode01(pids[0]);
      const body = pids.flatMap((p) => this.mode01Data(p) ?? []);
      return body.length ? frames([0x41, ...body]) : 'NO DATA';
    }
    if (mode === '03') return this.codes(0x43, this.stored);
    if (mode === '07') return this.codes(0x47, this.pending);
    if (mode === '0A') return this.codes(0x4a, this.permanent);
    if (mode === '02') {
      const d = this.freeze?.[parseInt(cmd.slice(2, 4), 16)];
      return d ? frames([0x42, parseInt(cmd.slice(2, 4), 16), 0x00, ...d]) : 'NO DATA';
    }
    if (mode === '04') {
      this.stored = [];
      this.pending = [];
      this.freeze = null;
      this.monitorsIncomplete = this.car.diesel ? 0xeb : 0x65; // every monitor resets on a clear
      this.clearedAt = Date.now();
      return '44';
    }
    if (cmd === '0902' && !this.car.noObdVin) return frames([0x49, 0x02, 0x01, ...toBytes(this.car.vin)]);
    return 'NO DATA';
  }

  // UDS 22 with one or several identifiers (ISO 14229-1: unsupported ones
  // are left out of the answer; none supported gives NRC 31).
  private uds(dids: string): string {
    const mod = this.car.modules[this.header];
    if (!mod) return 'NO DATA';
    const list = dids.match(/.{4}/g) ?? [];
    if (list.length > 1 && mod.multiDid === 'none') return '7F2213';
    if (list.length > 1 && mod.multiDid === 'first') list.splice(1);
    const parts = list.map((d) => this.didData(d));
    if (list.length > 1 && mod.multiDid === 'strict' && parts.some((p) => !p)) return '7F2231';
    const body = list.flatMap((d, i) => (parts[i] ? [parseInt(d.slice(0, 2), 16), parseInt(d.slice(2), 16), ...parts[i]!] : []));
    return body.length ? frames([0x62, ...body]) : '7F2231';
  }

  private didData(did: string): number[] | null {
    const mod = this.car.modules[this.header];
    if (!mod) return null;
    const adaptation = mod.dids?.[did];
    if (adaptation != null) return hexToBytes(adaptation);
    const extra = this.car.extras?.[this.header]?.[did];
    if (extra) return extra;
    if (did === '0600') return mod.coding ? hexToBytes(mod.coding) : null;
    if (did === 'F1A5') return [0x00, 0x00, 0x00, 0x00, 0x00, 0x00];
    const value: Record<string, string | undefined> = {
      F187: `${mod.part}   `,
      F189: mod.sw,
      F190: this.car.vin,
      F191: mod.hw,
      F197: mod.name,
      F18C: mod.hw ? `S${mod.part.slice(0, 6)}0001` : undefined,
    };
    const v = value[did];
    if (v) return toBytes(v);
    // Maker sensors: about a third of the known ones answer, plus a few
    // unknown identifiers for Discover mode. Values drift with time.
    const h = simHash(`${this.header}${did}`);
    const n = parseInt(did, 16);
    const known = simKnown().has(`${this.header}-${did}`);
    if (known && h % 100 < 35) return simValueBytes(this.header, did, h);
    if (!known && n >= 0x1000 && n < 0x3000 && h % 100 < 2) {
      const t = Math.floor(Date.now() / 1000);
      const bytes = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => (i === 1 && h % 3 === 0 ? (h + t) & 0xff : (h >> (i % 4)) & 0xff));
      return bytes;
    }
    return null;
  }

  private dtcReport(): string {
    const mod = this.car.modules[this.header];
    if (!mod) return 'NO DATA';
    const seen = this.busyCount[this.header] ?? 0;
    if (mod.busyFirst && seen < mod.busyFirst) {
      this.busyCount[this.header] = seen + 1;
      return '7F1921';
    }
    const bytes = (mod.faults ?? []).flatMap(([code, status]) =>
      code.length === 6 ? [...hexToBytes(code), status] : [...encodeDtc(code.slice(0, 5)), parseInt(code.slice(5), 16), status],
    );
    const answer = frames([0x59, 0x02, 0xff, ...bytes]);
    if (mod.slow) return this.longWait ? `7F1978\r${answer}` : '7F1978';
    return answer;
  }

  // UDS 2E: coding (0600), programming date (F199) and workshop code (F198).
  private write(body: string): string {
    const mod = this.car.modules[this.header];
    if (!mod) return 'NO DATA';
    if (this.session[this.header] !== 3) return '7F2E7F';
    const did = body.slice(0, 4);
    if (did === '0600') {
      if (!mod.coding) return '7F2E31';
      const next = body.slice(4);
      if (next.length !== mod.coding.length) return '7F2E13';
      if (!mod.ignoresWrites) mod.coding = next;
    } else if (mod.dids?.[did] != null) {
      if (mod.login && !this.unlocked[this.header]) return '7F2E33';
      const next = body.slice(4);
      if (next.length !== mod.dids[did].length) return '7F2E13';
      if (!mod.ignoresWrites) mod.dids[did] = next;
    } else if (!/^F19[89]$/.test(did)) {
      return '7F2E31';
    }
    return `6E${did}`;
  }

  // UDS 27 03 / 27 04 in the extended session: key = seed + login code.
  private securityAccess(cmd: string): string {
    const mod = this.car.modules[this.header];
    if (!mod) return 'NO DATA';
    if (this.session[this.header] !== 3) return '7F277F';
    if (cmd === '2703') return `6703${SimTransport.SEED.toString(16).toUpperCase().padStart(8, '0')}`;
    const key = parseInt(cmd.slice(4), 16);
    const want = (SimTransport.SEED + (mod.login ?? 0)) % 2 ** 32;
    if (key !== want) return '7F2735';
    this.unlocked[this.header] = true;
    return '6704';
  }

  // One raw CAN frame in TP2.0 mode. Replies carry the 3-digit header.
  // Frames of a multi-frame TP2.0 request, until its last frame arrives.
  private rxBuf: number[] | null = null;

  private rawFrame(cmd: string): string {
    const hexOf = (b: number[]) => b.map((x) => x.toString(16).toUpperCase().padStart(2, '0')).join('');
    const body = cmd.length % 2 ? cmd.slice(0, -1) : cmd;
    const data = hexToBytes(body);
    if (this.header === '200') {
      const address = data[0];
      const mods = this.car.tp20;
      if (!mods || !(address in mods) || data[1] !== 0xc0) return 'NO DATA';
      const tx = 0x740 + Object.keys(mods).map(Number).indexOf(address);
      this.channel = { address, tx: tx.toString(16).toUpperCase(), seq: 0 };
      return `${(0x200 + address).toString(16).toUpperCase()}${hexOf([0x00, 0xd0, 0x00, 0x03, tx & 0xff, tx >> 8, 0x01])}`;
    }
    const ch = this.channel;
    if (!ch || this.header !== ch.tx) return 'NO DATA';
    const op = data[0] >> 4;
    // Multi-frame request: op 2 frames are held until the last (op 1) frame.
    if (op === 2) {
      this.rxBuf = [...(this.rxBuf ?? []), ...data.slice(1)];
      return 'NO DATA';
    }
    let whole = data;
    if (op === 1 && this.rxBuf) {
      whole = [data[0], ...this.rxBuf, ...data.slice(1)];
      this.rxBuf = null;
    }
    if (data[0] === 0xa0 || data[0] === 0xa3) return `300${hexOf([0xa1, 0x0f, 0x8a, 0xff, 0x4a, 0xff])}`;
    if (data[0] === 0xa8) {
      this.channel = null;
      return '300A8';
    }
    if (op === 0xb) return 'NO DATA';
    if (op !== 1) return 'NO DATA';
    const payload = whole.slice(3, 3 + ((whole[1] << 8) | whole[2]));
    const ack = `300B${((data[0] + 1) & 0x0f).toString(16).toUpperCase()}`;
    const mod = this.car.tp20![ch.address];
    const faults = mod.faults;
    const text = (s: string | undefined, n: number) => [...(s ?? '').padEnd(n, ' ').slice(0, n)].map((c) => c.charCodeAt(0));
    let reply: number[];
    if (payload[0] === 0x10) reply = [0x50, payload[1]];
    else if (payload[0] === 0x18) reply = [0x58, faults.length, ...faults.flatMap(([n, st]) => [n >> 8, n & 0xff, st])];
    else if (payload[0] === 0x14) {
      mod.faults = [];
      reply = [0x54, 0xff, 0x00];
    } else if (payload[0] === 0x22 && payload[1] === 0x06 && payload[2] === 0x00 && mod.didCoding) {
      reply = [0x62, 0x06, 0x00, ...hexToBytes(mod.didCoding)];
    } else if (payload[0] === 0x22 && payload[1] === 0xf1 && [0x87, 0x89, 0x97].includes(payload[2]) && mod.didCoding) {
      const v = payload[2] === 0x87 ? mod.part : payload[2] === 0x89 ? mod.sw : mod.component;
      reply = [0x62, 0xf1, payload[2], ...text(v, (v ?? '').length)];
    } else if (payload[0] === 0x22 && payload[1] === 0xf1 && payload[2] === 0xa5 && mod.didCoding) {
      reply = [0x62, 0xf1, 0xa5, 0x00, 0x05, 0xf3, 0xc7, 0xe7, 0x19];
    } else if (payload[0] === 0x2e && payload[1] === 0xf1 && payload[2] === 0x99) {
      reply = [0x7f, 0x2e, 0x31];
    } else if (payload[0] === 0x2e && payload[1] === 0xf1 && payload[2] === 0x98 && mod.didCoding) {
      reply = [0x6e, 0xf1, 0x98];
    } else if (payload[0] === 0x2e && payload[1] === 0x06 && payload[2] === 0x00 && mod.didCoding) {
      const value = payload.slice(3);
      if (value.length !== mod.didCoding.length / 2) reply = [0x7f, 0x2e, 0x13];
      else {
        mod.didCoding = hexOf(value);
        reply = [0x6e, 0x06, 0x00];
      }
    } else if (payload[0] === 0x1a && payload[1] === 0x9a && mod.longCoding) {
      const c = hexToBytes(mod.longCoding);
      reply = [0x5a, 0x9a, 0x01, 0xdc, 0x5a, 0x10, 0x00, 0xbf, ...text(mod.sw, 4), 0x10, c.length + 1, ...c, 0xff];
    } else if (payload[0] === 0x3b && payload[1] === 0x9a && mod.longCoding) {
      // 3B 9A <WSC 6> <SW 4> 10 <N+1> <coding N> FF
      const n = payload[13] - 1;
      const c = payload.slice(14, 14 + n);
      if (payload[12] !== 0x10 || c.length !== mod.longCoding.length / 2 || payload[14 + n] !== 0xff) reply = [0x7f, 0x3b, 0x12];
      else {
        mod.longCoding = hexOf(c);
        reply = [0x7b, 0x9a];
      }
    } else if (payload[0] === 0x1a && payload[1] === 0x90) {
      reply = this.car.vinAt?.includes(ch.address) ? [0x5a, 0x90, ...text(this.car.vin, 17)] : [0x7f, 0x1a, 0x12];
    } else if (payload[0] === 0x1a && payload[1] === 0x9b && mod.part) {
      if (mod.didCoding) reply = [0x7f, 0x1a, 0x11];
      else {
        const c = mod.coding ?? 0;
        const type = mod.longCoding ? 0x10 : 0x03;
        const short = mod.longCoding ? [0, 0, 0] : [(c >> 16) & 0xff, (c >> 8) & 0xff, c & 0xff];
        reply = [0x5a, 0x9b, ...text(mod.part, 12), ...text(mod.sw, 4), type, ...short, 0x01, 0xdc, 0x5a, 0x10, 0x00, 0xbf, ...text(mod.component, 20)];
      }
    } else if (payload[0] === 0x1a && payload[1] === 0x9f && mod.list) {
      const recs = mod.list.flatMap(([n, a]) => [n, a, 0x00, 0x01]);
      reply = [0x5a, 0x9f, recs.length + 1, ...recs, 0xff];
    } else if (payload[0] === 0x21 && mod.groups?.[payload[1]]) reply = [0x61, payload[1], ...mod.groups[payload[1]]];
    else reply = [0x7f, payload[0], payload[0] === 0x21 ? 0x31 : 0x11];
    // Module frames: first carries the length, later ones 7 bytes; last asks for an ACK.
    const msg = [reply.length >> 8, reply.length & 0xff, ...reply];
    const chunks: number[][] = [msg.slice(0, 7)];
    for (let i = 7; i < msg.length; i += 7) chunks.push(msg.slice(i, i + 7));
    const lines = chunks.map((c, i) => {
      const last = i === chunks.length - 1;
      const seq = ch.seq;
      ch.seq = (ch.seq + 1) & 0x0f;
      return `300${hexOf([(last ? 0x10 : 0x20) | seq, ...c])}`;
    });
    return [ack, ...lines].join('\r');
  }

  // Demo service routine: sets its values, as a cluster's reset would.
  private routine(id: string): string {
    const mod = this.car.modules[this.header];
    if (!mod) return 'NO DATA';
    const effect = mod.routines?.[id];
    if (!effect) return '7F3131';
    if (this.session[this.header] !== 3) return '7F317F';
    if (mod.login && !this.unlocked[this.header]) return '7F3133';
    for (const [did, value] of Object.entries(effect)) if (mod.dids) mod.dids[did] = value;
    this.routinesRun++;
    // As a real cluster: "busy, wait" first; the answer comes within the long wait.
    return this.longWait ? `7F3178\r7101${id}00` : '7F3178';
  }

  private sessionChange(n: number): string {
    if (!this.car.modules[this.header]) return 'NO DATA';
    this.session[this.header] = n;
    if (n === 1) this.unlocked[this.header] = false;
    return n === 3 ? '5003003201F4' : '5001003201F4';
  }

  private clearModule(): string {
    const mod = this.car.modules[this.header];
    if (!mod) return 'NO DATA';
    if (mod.clearNeedsSession && this.session[this.header] !== 3) return '7F1411';
    mod.faults = [];
    if (this.header === '7E0') {
      this.stored = [];
      this.pending = [];
    }
    return '54';
  }

  private codes(reply: number, list: string[]): string {
    if (list.length === 0) return frames([reply, 0x00]);
    return frames([reply, list.length, ...list.flatMap(encodeDtc)]);
  }

  private mode01Table(): Record<number, number[]> {
    const t = (Date.now() - this.started) / 1000;
    const wave = (period: number) => (Math.sin((t * 2 * Math.PI) / period) + 1) / 2;
    const rpm = this.car.engineOff ? 0 : Math.round((800 + 2200 * wave(9)) * 4);
    const two = (v: number) => [(v >> 8) & 0xff, v & 0xff];
    const sinceClear = this.clearedAt ? (Date.now() - this.clearedAt) / 1000 : 4 * 3600;
    const temp = Math.min(90, 20 + t * 2);
    const data: Record<number, number[]> = {
      0x00: mask(0x00),
      0x20: mask(0x20),
      0x40: mask(0x40),
      0x01: this.car.diesel
        ? [(this.stored.length ? 0x80 : 0) | this.stored.length, 0x0f, 0xeb, this.monitorsIncomplete]
        : [(this.stored.length ? 0x80 : 0) | this.stored.length, 0x07, 0x65, this.monitorsIncomplete],
      0x04: [Math.round(40 + 120 * wave(7))],
      0x05: [Math.round(40 + temp)],
      0x06: [Math.round(128 + 10 * Math.sin(t * 3))],
      0x07: [this.stored.includes('P0171') ? 147 : 131],
      0x0b: [Math.round(35 + 60 * wave(7))],
      0x0c: two(rpm),
      0x0d: [Math.round(30 + 50 * wave(23))],
      0x0e: [Math.round((10 + 20 * wave(7) + 64) * 2)],
      0x0f: [62],
      0x10: two(Math.round((3 + 25 * wave(9)) * 100)),
      0x11: [Math.round(20 + 90 * wave(7))],
      0x14: [Math.round(200 * (0.1 + 0.8 * wave(1.3))), 0xff],
      0x15: [Math.round(200 * 0.65), 0xff],
      0x1f: two(Math.round(t)),
      0x21: two(this.stored.length ? 37 : 0),
      0x2e: [Math.round(255 * 0.12)],
      0x2f: [Math.round(255 * 0.62)],
      0x30: [this.clearedAt ? 0 : 12],
      0x31: two(Math.round(this.clearedAt ? sinceClear / 60 : 420)),
      0x33: [101],
      0x3c: two(Math.round((420 + 150 * wave(11) + 40) * 10)),
      0x42: two(Math.round((13.9 + 0.3 * wave(5)) * 1000)),
      0x43: two(Math.round(60 + 80 * wave(7))),
      0x44: two(Math.round(32768 * (1 + 0.02 * Math.sin(t)))),
      0x45: [Math.round(15 + 80 * wave(7))],
      0x46: [52],
      0x49: [Math.round(40 + 120 * wave(7))],
      0x4c: [Math.round(20 + 90 * wave(7))],
      0x4d: two(this.stored.length ? 55 : 0),
      0x4e: two(Math.round(sinceClear / 60)),
      0x5c: [Math.round(40 + Math.max(15, temp - 8))],
    };
    return data;
  }

  private mode01Data(pid: number): number[] | null {
    const d = this.mode01Table()[pid];
    return d ? [pid, ...d] : null;
  }

  private mode01(pid: number): string {
    const d = this.mode01Data(pid);
    return d ? frames([0x41, ...d]) : 'NO DATA';
  }
}

let known: Set<string> | null = null;
function simKnown(): Set<string> {
  if (!known) known = new Set([...vagSensors(), ...fordSensors(), ...mazdaSensors()].map((r) => `${r.h}-${r.d}`));
  return known;
}
function simHash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619) >>> 0;
  return h;
}

// Believable demo values for known sensors: each signal in the answer gets a
// typical reading for its unit, encoded with its own scale and position.
const TYPICAL: Record<string, number> = { '°C': 82, '°F': 180, rpm: 820, 'km/h': 0, '%': 24, V: 14.1, bar: 1.2, kPa: 101, km: 203450, h: 3400, s: 120, Nm: 45, g: 9, 'g/s': 12, mm: 1.5, L: 38 };
let rowsByKey: Map<string, SensorRowLite[]> | null = null;
type SensorRowLite = { b: number; l: number; s?: 1; e?: 1; m?: number; v?: number; a?: number; u: string; lo?: number; hi?: number };
function simValueBytes(header: string, did: string, h: number): number[] {
  if (!rowsByKey) {
    rowsByKey = new Map();
    for (const r of [...vagSensors(), ...fordSensors(), ...mazdaSensors()]) {
      const k = `${r.h}-${r.d}`;
      rowsByKey.set(k, [...(rowsByKey.get(k) ?? []), r]);
    }
  }
  const rows = rowsByKey.get(`${header}-${did}`) ?? [];
  const len = Math.max(2, ...rows.map((r) => Math.ceil((r.b + r.l) / 8)));
  const out = new Array(len).fill(0);
  const drift = Math.sin(Date.now() / 4000 + (h % 7)) * 0.03;
  for (const r of rows) {
    const lo = r.lo ?? 0;
    const hi = r.hi ?? lo + 100;
    let target = TYPICAL[r.u] ?? lo + (hi - lo) * 0.05;
    target = Math.min(hi, Math.max(lo, target * (1 + drift)));
    let raw = Math.round(((target - (r.a ?? 0)) * (r.v ?? 1)) / (r.m ?? 1));
    const max = 2 ** r.l;
    if (raw < 0) raw = r.s ? max + raw : 0;
    raw = Math.max(0, Math.min(max - 1, raw));
    // Write big-endian bits at r.b, then swap bytes for least-significant-first values.
    const start = Math.floor(r.b / 8);
    const count = Math.ceil(r.l / 8);
    for (let i = 0; i < r.l; i++) {
      const bit = (raw >> (r.l - 1 - i)) & 1;
      const pos = r.b + i;
      if (bit) out[pos >> 3] |= 1 << (7 - (pos % 8));
    }
    if (r.e && r.l > 8) {
      const part = out.slice(start, start + count).reverse();
      out.splice(start, count, ...part);
    }
  }
  return out;
}
