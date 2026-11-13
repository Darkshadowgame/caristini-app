// ELM327 client: setup, response parsing and the OBD2 requests the app uses.
// Command references: ELM327 datasheet (Elm Electronics) and SAE J1979 modes.
import { decodeDtc } from './dtc';
import { decodeReadiness, FREEZE_PIDS, LIVE_PIDS, LivePid, Monitor, pidInfo, supportedFromMask } from './pids';
import { ExtraValue } from './extras';
import { decodeSensor, HEADER_NAMES, replyHeader, SensorRow, sensorId, SensorValue } from './sensors';
import { ModuleDef, MODULES, modulesFor } from './modules';
import { AdapterTimeout, LinkLost, Transport } from './transport';
import { Route, RouteKind, routesOf } from './modules';
import { trafficLog } from './trafficLog';
import { vinInBytes } from '../vehicle/vin';
import { idsForNode, nodesFromBitmap, parseC6List, slotsFromTables } from './vagGateway';
import type { ServiceReset } from '../service/obdReset';
import { MAX_DIDS, soleAnswer, splitKnown } from './multiDid';
import { MeasuringCell, parseMeasuringBlock } from './tp20';
import { kwpFaults, parseGatewayList, parseKwpIdent, Tp20Coding, tp20Identity, tp20Name, tp20LeaveCommands, tp20ReadCoding, tp20WriteCoding, Tp20Module, Tp20Session, TP20_CANDIDATES } from './tp20';
import { cleanText, describeNrc, negativeCode, parseDtcReport, toHex, UdsFault } from './uds';

const ERRORS = ['NO DATA', 'UNABLE TO CONNECT', 'CAN ERROR', 'BUS ERROR', 'BUS INIT', 'STOPPED', 'BUFFER FULL', 'DATA ERROR', 'LV RESET', 'ACT ALERT', 'FB ERROR', 'LP ALERT', 'BUS BUSY'];
// Adapter faults that are not data: "ERR94", or a frame marked "<RX ERROR".
const ERROR_PATTERNS = [/^ERR\d+/i, /<\s*\w+\s*ERROR/i];

export class ObdError extends Error {}

// What each body module calls itself, to make sure a write over TP2.0 reaches
// the module meant (part number families and component names seen on VW cars).
const TP20_EXPECT: Record<string, RegExp> = {
  'vag-09': /907063|937049|937087|937085|BCM ?1|BCM PQ|J519|Bordnetz/i,
  'vag-46': /907064|959433|959434|BCM ?2|Komfort|comfort|J393/i,
  'vag-42': /959793|959701|959801|TSG ?FA|J386|driver/i,
  'vag-52': /959792|959702|959802|TSG ?BF|J387|passenger/i,
  'vag-17': /920|KOMBI|cluster/i,
};

export interface VehicleInfo {
  adapter: string;
  protocol: string;
  isCan: boolean;
  vin: string | null;
  milOn: boolean;
  storedCount: number;
  diesel: boolean;
  monitors: Monitor[];
}

export interface FreezeFrame {
  code: string | null;
  values: { pid: number; label: string; unit: string; value: number; decimals: number }[];
}

export interface FaultCodes {
  stored: string[];
  pending: string[];
  permanent: string[];
}

const PROTOCOLS: Record<string, string> = {
  '1': 'SAE J1850 PWM',
  '2': 'SAE J1850 VPW',
  '3': 'ISO 9141-2',
  '4': 'ISO 14230-4 KWP (5 baud init)',
  '5': 'ISO 14230-4 KWP (fast init)',
  '6': 'ISO 15765-4 CAN (11 bit, 500 kbaud)',
  '7': 'ISO 15765-4 CAN (29 bit, 500 kbaud)',
  '8': 'ISO 15765-4 CAN (11 bit, 250 kbaud)',
  '9': 'ISO 15765-4 CAN (29 bit, 250 kbaud)',
  A: 'SAE J1939 CAN',
  B: 'User CAN 1',
  C: 'User CAN 2',
};

// Turns raw adapter text into one byte array per ECU message.
// Handles ISO-TP multi-frame output ("014", "0: 49 02 01 ...", "1: ...").
export function parseMessages(raw: string, command: string): number[][] {
  const echo = command.replace(/\s/g, '').toUpperCase();
  const lines = raw
    .replace(/>/g, '')
    .split(/[\r\n]+/)
    .map((l) => l.trim())
    .filter((l) => l && !/^SEARCHING/i.test(l) && !/^BUS INIT.*OK/i.test(l) && l.replace(/\s/g, '').toUpperCase() !== echo);

  for (const l of lines) {
    const up = l.toUpperCase();
    if (up === '?') throw new ObdError(`The adapter did not understand "${command}".`);
    const hit = ERRORS.find((e) => up.startsWith(e));
    if (hit) throw new ObdError(hit === 'NO DATA' ? 'NO DATA' : `Adapter reported: ${l}`);
    if (ERROR_PATTERNS.some((re) => re.test(up))) throw new ObdError(`Adapter reported: ${l}`);
  }

  const messages: number[][] = [];
  const declared = new Map<number[], number>();
  let current: number[] | null = null;
  for (const l of lines) {
    const compact = l.replace(/\s/g, '');
    if (/^[0-9A-F]{3}$/i.test(compact)) {
      current = [];
      messages.push(current);
      declared.set(current, parseInt(compact, 16));
      continue;
    }
    const frame = compact.match(/^([0-9A-F]):([0-9A-F]*)$/i);
    if (frame) {
      // Frame 0 starts a message, unless a length line just started it.
      if (frame[1] === '0') {
        if (!current || current.length > 0) {
          current = [];
          messages.push(current);
        }
      } else if (!current) {
        current = [];
        messages.push(current);
      }
      current.push(...hexBytes(frame[2]));
      continue;
    }
    if (/^[0-9A-F]+$/i.test(compact)) {
      // A single-frame answer from another module can arrive between the
      // frames of a longer one: it does not end the longer message.
      messages.push(hexBytes(compact));
    }
  }
  // Drop the padding bytes on the last frame of a multi-frame reply.
  return messages.map((m) => (declared.has(m) ? m.slice(0, declared.get(m)) : m)).filter((m) => m.length > 0);
}

function hexBytes(hex: string): number[] {
  const out: number[] = [];
  for (let i = 0; i + 1 < hex.length; i += 2) out.push(parseInt(hex.slice(i, i + 2), 16));
  return out;
}

export type { ModuleDef } from './modules';
export { MODULES } from './modules';

const MODULES_BY_ID = new Map(MODULES.map((m) => [m.id, m]));

// Refusals that a change of diagnostic session can fix (see describeNrc).
const SESSION_REFUSAL = /not support|not in the right state|this mode/i;

export interface ModuleInfo {
  def: ModuleDef;
  responded: boolean;
  partNumber: string | null;
  software: string | null;
  vin: string | null;
}

export interface ModuleDetails extends ModuleInfo {
  // How the module answered.
  route?: RouteKind;
  hardware: string | null;
  systemName: string | null;
  serial: string | null;
  // VW long coding (DID 0600) as hex, read-only.
  coding: string | null;
}

export interface AdapterReport {
  id: string;
  device: string | null;
  stn: string | null;
  protocol: string;
  volts: number | null;
  // Command and reply time over the link, in ms.
  roundTrip: { avg: number; min: number; max: number };
  // Raw CAN mode (ATPB), needed for the older VW protocol (TP2.0).
  rawCan: boolean;
  // Ford/Mazda medium-speed bus (STN chips only).
  secondBus: boolean;
  // Reports itself as v1.5, the version most clones claim.
  clone: boolean;
}

export interface CodingWrite {
  // True when the module now holds exactly the new coding.
  ok: boolean;
  // When ok is false: whether the original coding was put back.
  restored: boolean;
  coding: number[] | null;
}

export interface ModuleFaults {
  def: ModuleDef;
  // How the module answered.
  route?: RouteKind;
  state: 'ok' | 'faults' | 'no-answer' | 'error';
  faults: UdsFault[];
  error?: string;
}

const ID_DIDS: { key: 'partNumber' | 'software' | 'vin'; did: string }[] = [
  { key: 'partNumber', did: 'F187' },
  { key: 'software', did: 'F189' },
  { key: 'vin', did: 'F190' },
];

// The sensor search asks one value per request (see probeSensors).
const SEARCH_LISTS = false;

export class ElmClient {
  private queue: Promise<unknown> = Promise.resolve();
  private isCan = true;
  private canElevenBit = true;
  private supported: Set<number> | null = null;
  // Protocol digit found at start-up (6 = 11-bit 500k CAN), restored after raw-mode work.
  private dp = '6';

  constructor(readonly transport: Transport) {}

  // Coding and setting values read on this connection, by Customise key, so
  // leaving and reopening Customise does not read every module again. Safe:
  // every write first reads the module's current value and stops if it differs.
  readonly sessionValues = new Map<string, number[]>();

  // ---- Routes: each module may answer on UDS, VW TP2.0 or a second CAN bus.
  private make: 'vag' | 'ford' | 'mazda' | 'other' = 'other';
  private platform: string | null = null;
  // Modules the gateway says use the older protocol, without a known address.
  private olderProtocol = new Set<string>();
  // Module ids the gateway says are fitted, when its list can be trusted
  // (PQ gateway list, MQB bitmap). Others are skipped to save time.
  private installed: Set<string> | null = null;

  private skipped(def: ModuleDef): boolean {
    return !!this.installed && this.make === 'vag' && !this.installed.has(def.id);
  }
  // Route that answered, per module id, for this connection.
  private winner = new Map<string, Route>();
  // Modules that answered on an earlier visit (saved per car). During a full
  // fault scan an address that has never answered gets one fixed wait of about
  // 0.3 s (6 times the UDS reply limit) and no slow retry; a module seen
  // before keeps the long wait, so a slow or busy module is never missed.
  private seenBefore = new Set<string>();
  private sweeping = false;
  // Raw CAN mode for the older VW protocol stays on between modules while a
  // sweep holds it (holdRaw), saving about 13 adapter commands per module.
  // Any other command takes the adapter out of it first (see command()).
  private rawCan = false;
  private inTp20 = false;
  private holdRaw = 0;
  rememberModules(ids: string[] | undefined): void {
    for (const id of ids ?? []) this.seenBefore.add(id);
  }
  // Routes found by asking the car (VW gateway list), per module id.
  private found = new Map<string, Route[]>();
  // Modules the gateway lists that Caristini has no definition for.
  private extraDefs: ModuleDef[] = [];
  private discovered = false;
  private tp20Usable = true;
  private stn: boolean | null = null;

  // The car's make decides which routes are worth trying (TP2.0 is VW group only).
  setMake(make: 'vag' | 'ford' | 'mazda' | 'other', platform: string | null = null) {
    this.make = make;
    this.platform = platform;
  }

  // STN-based adapters (OBDLink) can switch to the Ford/Mazda medium-speed bus.
  private async hasStn(): Promise<boolean> {
    if (this.stn == null) {
      const r = await this.command('STI', 1500).catch(() => '');
      this.stn = /STN/i.test(r);
    }
    return this.stn;
  }

  private async routesFor(def: ModuleDef): Promise<Route[]> {
    const fromCar = this.found.get(def.id) ?? [];
    // The fixed TP2.0 addresses come from PQ-era cars and early MLB (the 2012
    // A6's body modules answer only TP2.0); on MQB and MLB evo only addresses
    // the car's own gateway reported are used.
    const pqMap = !this.platform || /^PQ/.test(this.platform) || this.platform === 'MLB';
    const all = routesOf(def, fromCar).filter((r) => {
      if (r.via === 'tp20') return this.make === 'vag' && this.tp20Usable && (pqMap || fromCar.includes(r));
      return true;
    });
    const out: Route[] = [];
    for (const r of all) if (r.via !== 'mscan' || (await this.hasStn())) out.push(r);
    const w = this.winner.get(def.id);
    return w ? [w, ...out.filter((r) => JSON.stringify(r) !== JSON.stringify(w))] : out;
  }

  // Every module for the make: the fixed list plus any the gateway reported.
  async modulesForCar(group: 'vag' | 'ford' | 'mazda' | 'other'): Promise<ModuleDef[]> {
    if (group === 'vag') await this.discoverVag();
    const base = modulesFor(group);
    return [...base, ...this.extraDefs.filter((d) => !base.some((b) => b.id === d.id) && (group === 'vag' || d.id.startsWith('hdr-')))];
  }

  // Asks the car which modules it has, so modules missing from the fixed list
  // are scanned too and routes are known (replica/vag-sources.md section 1,
  // replica/leon-sources.md section 2). Everything here is a read.
  async discoverVag(): Promise<void> {
    if (this.discovered || this.make !== 'vag' || !this.supportsModules) return;
    this.discovered = true;
    const known = (code: string) => MODULES.find((m) => m.code === code && (m.groups.includes('vag') || m.groups.includes('all')));
    const addExtra = (d: ModuleDef) => {
      if (!this.extraDefs.some((e) => e.id === d.id) && !MODULES.some((m) => m.id === d.id)) this.extraDefs.push(d);
    };
    const tp20Routes = (map: Map<string, number>) => {
      for (const [code, address] of map) {
        const route: Route = { via: 'tp20', address };
        const def = known(code);
        if (def) this.found.set(def.id, [route]);
        else addExtra({ id: `vag-${code.toLowerCase()}`, name: `Module ${code}`, code, tx: '', rx: '', alt: [route], groups: ['vag'], source: "Listed by the car's gateway" });
      }
    };

    // UDS gateway (MQB, MLB).
    const gw = MODULES.find((m) => m.id === 'vag-19')!;
    // A gateway that says nothing at all (older PQ cars have no UDS gateway)
    // is not asked the other four lists, which saves several seconds.
    const t = await this.withModule(gw, async () => {
      const first = await this.fastDid('2A26', 1500);
      if (first === 'silent') return null;
      return {
        present: Array.isArray(first) ? first : null,
        slots: await this.readDid('2A2A'),
        ids: await this.readDid('2A2C'),
        protocols: await this.readDid('2A29'),
        c6: await this.readDid('04A1'),
      };
    }).catch(() => null);
    if (t) {
      if (t.present && t.present.length >= 16 && /^MQB/.test(this.platform ?? '')) {
        this.installed = new Set();
        for (const n of nodesFromBitmap(t.present)) {
          const ids = idsForNode(n);
          const def = ids && MODULES.find((m) => m.tx === ids.tx && m.groups.includes('vag'));
          if (def) this.installed.add(def.id);
          if (!ids || MODULES.some((m) => m.tx === ids.tx)) continue;
          this.installed.add(`vag-n${ids.tx.toLowerCase()}`);
          addExtra({ id: `vag-n${ids.tx.toLowerCase()}`, name: `Module at ${ids.tx}`, tx: ids.tx, rx: ids.rx, groups: ['vag'], source: "Listed by the car's gateway (2A26)" });
        }
      }
      if (t.slots) {
        for (const slot of slotsFromTables(t.slots, t.ids, t.protocols)) {
          const def = known(slot.code);
          // Older-protocol modules with no TP2.0 address yet are reported as such.
          if (slot.tp20 && !slot.uds) {
            if (def) this.olderProtocol.add(def.id);
            continue;
          }
          if (def || !slot.tx) continue;
          const tx = parseInt(slot.tx, 16);
          addExtra({ id: `vag-${slot.code.toLowerCase()}`, name: `Module ${slot.code}`, code: slot.code, tx: slot.tx, rx: (tx + 0x6a).toString(16).toUpperCase(), groups: ['vag'], source: "Listed by the car's gateway (2A2A, 2A2C)" });
        }
      }
      if (t.c6) tp20Routes(parseC6List(t.c6));
      if (t.present || t.slots || t.c6) return;
    }

    // TP2.0 gateway on 0x1F (PQ cars: 1A 9F; C6-era: 22 04A1).
    const list = await this.tp20(0x1f, (s) => s.request([0x1a, 0x9f]), false).catch(() => null);
    const pq = list ? parseGatewayList(list) : new Map<number, number>();
    if (pq.size) {
      const map = new Map([...pq].map(([n, a]) => [n.toString(16).toUpperCase().padStart(2, '0'), a] as [string, number]));
      tp20Routes(map);
      this.installed = new Set();
      for (const code of map.keys()) {
        const def = known(code);
        const id = def?.id ?? `vag-${code.toLowerCase()}`;
        this.installed.add(id);
        // Listed modules on a PQ gateway speak TP2.0: try that first.
        this.winner.set(id, { via: 'tp20', address: map.get(code)! });
      }
      return;
    }
    const c6 = await this.tp20(0x1f, (s) => s.request([0x22, 0x04, 0xa1])).catch(() => null);
    if (c6 && c6[0] === 0x62) tp20Routes(parseC6List(c6.slice(3)));
  }

  // Opens a TP2.0 channel, starts the KWP diagnostic session, runs fn, closes.
  // Null when no module answers at the address.
  private tp20<T>(address: number, fn: (s: Tp20Session) => Promise<T>, session = true): Promise<T | null> {
    return this.exclusive(() => this.tp20Inner(address, fn, session));
  }

  private async tp20Inner<T>(address: number, fn: (s: Tp20Session) => Promise<T>, session: boolean): Promise<T | null> {
    if (!this.tp20Usable) return null;
    const s = new Tp20Session((c, t) => this.send(c, t), this.dp);
    this.addressed = true;
    this.inTp20 = true;
    // Raw CAN is kept for the next module only after a clean conversation:
    // after an error or a failed channel, the next module sets it up again.
    let clean = false;
    try {
      if (!this.rawCan) {
        try {
          await s.enter();
          this.rawCan = true;
        } catch {
          // The adapter cannot do raw CAN: stop trying TP2.0 on this connection.
          this.tp20Usable = false;
          return null;
        }
      }
      if (!(await s.open(address).catch(() => false))) return null;
      try {
        if (session) {
          // Some body modules refuse 10 89 (a 2014 A7's 09 answered NRC 22) yet
          // answer reads and fault requests, so a refusal is not the end.
          const r = await s.request([0x10, 0x89]).catch(() => [0x7f]);
          if (r[0] !== 0x50) trafficLog.add('!', `TP2.0 0x${address.toString(16)}: session 10 89 refused, carrying on`);
        }
        const out = await fn(s);
        clean = true;
        return out;
      } finally {
        await s.close().catch(() => undefined);
      }
    } finally {
      this.inTp20 = false;
      if (!this.holdRaw || !this.rawCan || !clean) {
        await s.leave();
        this.rawCan = false;
        if (this.sweeping) await this.sweepTiming();
      }
      this.addressed = false;
    }
  }

  // Raw CAN off again, queued ahead of anything sent after this call.
  private releaseRaw(): Promise<void> {
    if (!this.rawCan) return Promise.resolve();
    this.rawCan = false;
    return this.chain(async () => {
      for (const c of tp20LeaveCommands(this.dp)) await this.sendNow(c, 1500).catch(() => undefined);
      if (this.sweeping) for (const c of ['ATAT0', 'ATST4B']) await this.sendNow(c, 1500).catch(() => undefined);
    });
  }

  // The sweep's fixed short wait (adaptive timing off).
  private async sweepTiming(): Promise<void> {
    await this.send('ATAT0').catch(() => undefined);
    await this.send('ATST4B').catch(() => undefined);
  }

  // Extra detail the module keeps for one fault (UDS 19 06 extended data and
  // 19 04 snapshot). Record layouts are maker-specific and not public, so the
  // records are returned raw, by record number.
  async readFaultDetails(def: ModuleDef, code: string): Promise<{ extended: string | null; snapshot: string | null }> {
    const dtc = dtcBytes(code);
    if (!dtc) throw new ObdError('This fault code cannot be sent back to the module.');
    const hex = toHex(dtc);
    return this.withModule(def, async () => {
      const ext = await this.uds(`1906${hex}FF`, 3000).catch(() => null);
      const snap = await this.uds(`1904${hex}FF`, 3000).catch(() => null);
      return { extended: ext && ext.length > 6 ? toHex(ext.slice(6)) : null, snapshot: snap && snap.length > 6 ? toHex(snap.slice(6)) : null };
    });
  }

  // A module by id, including ones the car's gateway reported.
  moduleById(id: string): ModuleDef | undefined {
    return MODULES.find((m) => m.id === id) ?? this.extraDefs.find((m) => m.id === id);
  }

  // How a module answered on this connection, once it has been read.
  routeOf(def: ModuleDef): RouteKind | null {
    return this.winner.get(def.id)?.via ?? null;
  }

  // Reads any UDS data identifier from a module, for the Workshop screen.
  // Returns the data bytes, or the module's refusal in plain words.
  async readRawDid(def: ModuleDef, did: string): Promise<{ data: number[] } | { error: string }> {
    const route = this.winner.get(def.id);
    const run = () =>
      this.withModule(def, async () => {
        try {
          const m = await this.uds(`22${did}`, 2500);
          return { data: m.slice(3) };
        } catch (e) {
          return { error: e instanceof Error ? e.message : String(e) };
        }
      }).catch((e) => ({ error: e instanceof Error ? e.message : String(e) }));
    return route?.via === 'mscan' ? this.onMsCan(run) : run();
  }

  // VW modules that answer over TP2.0 on this car. Probes each candidate once.
  async findTp20Modules(): Promise<ModuleDef[]> {
    if (this.make !== 'vag' || !this.supportsModules) return [];
    const defs = await this.modulesForCar('vag');
    const out: ModuleDef[] = [];
    this.holdRaw++;
    try {
      for (const def of defs) {
        const w = this.winner.get(def.id);
        if (w && w.via !== 'tp20') continue;
        for (const r of await this.routesFor(def)) {
          if (r.via !== 'tp20') continue;
          if (await this.tp20(r.address, async () => true)) {
            this.winner.set(def.id, r);
            out.push(def);
            break;
          }
        }
      }
    } finally {
      this.holdRaw--;
      await this.exclusive(() => this.releaseRaw());
    }
    return out;
  }

  private tp20Address(def: ModuleDef): number | null {
    const w = this.winner.get(def.id);
    return w?.via === 'tp20' ? w.address : null;
  }

  // KWP2000 measuring block (21 <group>), decoded with the public formula table.
  async readMeasuringBlock(def: ModuleDef, group: number): Promise<MeasuringCell[] | null> {
    const a = this.tp20Address(def);
    if (a == null) return null;
    return this.tp20(a, async (s) => parseMeasuringBlock(await s.request([0x21, group]).catch(() => []), group));
  }

  // Reads one group over and over on one open channel until keepGoing() is false.
  async watchMeasuringBlock(def: ModuleDef, group: number, onCells: (c: MeasuringCell[] | null) => void, keepGoing: () => boolean): Promise<void> {
    const a = this.tp20Address(def);
    if (a == null) return;
    await this.tp20(a, async (s) => {
      while (keepGoing()) onCells(parseMeasuringBlock(await s.request([0x21, group]).catch(() => []), group));
    });
  }

  // Reads every group from 1 to 255 once, to find values by their unit.
  async scanMeasuringBlocks(def: ModuleDef, onGroup: (group: number, cells: MeasuringCell[]) => void, onProgress?: (p: number) => void): Promise<void> {
    const a = this.tp20Address(def);
    if (a == null) return;
    await this.tp20(a, async (s) => {
      for (let g = 1; g <= 255; g++) {
        onProgress?.(g / 255);
        const cells = parseMeasuringBlock(await s.request([0x21, g], 1500).catch(() => []), g);
        if (cells?.length) onGroup(g, cells);
      }
    });
  }

  // Runs fn on the medium-speed bus (STN adapters), then returns to the main bus.
  // Known limit: the bus switch itself is not inside the module lock (the
  // module calls inside it take the lock), so with an STN adapter another
  // screen polling at the same moment could land on the second bus. Only STN
  // adapters reach this path.
  private async onMsCan<T>(fn: () => Promise<T>): Promise<T> {
    await this.command('STP53');
    try {
      return await fn();
    } finally {
      await this.command(`ATSP${this.dp}`).catch(() => undefined);
    }
  }

  private routeDef(def: ModuleDef, r: Route): ModuleDef {
    return r.via === 'uds' || r.via === 'mscan' ? { ...def, tx: r.tx, rx: r.rx } : def;
  }

  // Module scans need 11-bit CAN (most cars from about 2008).
  get supportsModules(): boolean {
    return this.isCan && this.canElevenBit;
  }

  // One command at a time: the ELM327 is strictly request then response.
  // Leaves raw CAN first when a sweep left it on and no TP2.0 talk is running.
  command(cmd: string, timeoutMs = 4000): Promise<string> {
    if (this.rawCan && !this.inTp20) void this.releaseRaw();
    return this.send(cmd, timeoutMs);
  }

  private send(cmd: string, timeoutMs = 4000): Promise<string> {
    return this.chain(() => this.sendNow(cmd, timeoutMs));
  }

  private chain<T>(job: () => Promise<T>): Promise<T> {
    const run = this.queue.then(job);
    this.queue = run.catch(() => undefined);
    return run;
  }

  private async sendNow(cmd: string, timeoutMs: number): Promise<string> {
    trafficLog.add('>', cmd);
    try {
      const reply = await this.transport.send(cmd, timeoutMs);
      trafficLog.add('<', reply);
      return reply;
    } catch (e) {
      trafficLog.add('!', e instanceof Error ? e.message : String(e));
      throw e;
    }
  }

  async request(cmd: string, timeoutMs = 4000): Promise<number[][]> {
    return parseMessages(await this.command(cmd, timeoutMs), cmd);
  }

  async initialise(): Promise<VehicleInfo> {
    const reset = await this.command('ATZ', 5000);
    const adapter = reset.replace(/>/g, '').split(/[\r\n]+/).map((s) => s.trim()).filter((s) => s && s !== 'ATZ').pop() ?? 'ELM327';
    for (const cmd of ['ATE0', 'ATL0', 'ATS0', 'ATH0', 'ATAT1', 'ATSP0']) await this.command(cmd);

    // The first request makes the adapter search for the car's protocol. A full
    // search through the older slow-start protocols can take over 15 seconds.
    try {
      await this.request('0100', 25000);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      throw new ObdError(
        msg === 'NO DATA' || msg.includes('UNABLE')
          ? 'The adapter could not talk to the car. Switch the ignition on (engine running or not) and try again.'
          : msg,
      );
    }

    const dp = (await this.command('ATDPN')).replace(/[>\s]/g, '').replace(/^A/i, '').toUpperCase();
    this.dp = dp || '6';
    this.isCan = ['6', '7', '8', '9', 'A', 'B', 'C'].includes(dp);
    this.canElevenBit = dp === '6' || dp === '8';
    const status = await this.readStatus();
    let vin: string | null = null;
    try {
      vin = await this.readVin();
    } catch {
      vin = null;
    }
    return { adapter, protocol: PROTOCOLS[dp] ?? `Protocol ${dp}`, isCan: this.isCan, vin, ...status };
  }

  // Mode 01 PID 01: check engine light (MIL) state and number of stored codes.
  // Bytes B to D hold the emissions readiness monitors (engine ECU reply used).
  async readStatus(): Promise<{ milOn: boolean; storedCount: number; diesel: boolean; monitors: Monitor[] }> {
    const msgs = await this.request('0101');
    let milOn = false;
    let storedCount = 0;
    let readiness: { diesel: boolean; monitors: Monitor[] } = { diesel: false, monitors: [] };
    for (const m of msgs) {
      if (m[0] === 0x41 && m[1] === 0x01 && m.length >= 3) {
        milOn = milOn || (m[2] & 0x80) !== 0;
        storedCount += m[2] & 0x7f;
        // Several units can answer; the engine ECU reports the most monitors.
        if (m.length >= 6) {
          const r = decodeReadiness(m[3], m[4], m[5]);
          if (r.monitors.length > readiness.monitors.length) readiness = r;
        }
      }
    }
    return { milOn, storedCount, ...readiness };
  }

  // Mode 02: the values the engine ECU saved when the first fault was stored.
  async readFreezeFrame(): Promise<FreezeFrame | null> {
    let code: string | null = null;
    try {
      for (const m of await this.request('020200')) {
        if (m[0] === 0x42 && m[1] === 0x02 && m.length >= 5) code = decodeDtc(m[3], m[4]);
      }
    } catch {
      return null;
    }
    if (!code) return null;
    const values: FreezeFrame['values'] = [];
    for (const pid of FREEZE_PIDS) {
      const p = pidInfo(pid);
      if (!p) continue;
      const cmd = `02${pid.toString(16).padStart(2, '0').toUpperCase()}00`;
      try {
        for (const m of await this.request(cmd)) {
          if (m[0] === 0x42 && m[1] === pid && m.length >= 3 + p.bytes) {
            values.push({ pid, label: p.label, unit: p.unit, decimals: p.decimals, value: p.decode(m.slice(3)) });
          }
        }
      } catch {
        // Not every value is stored in every freeze frame.
      }
    }
    return { code, values };
  }

  async readVin(): Promise<string | null> {
    const msgs = await this.request('0902', 6000);
    const chars: number[] = [];
    for (const m of msgs) {
      if (m[0] !== 0x49 || m[1] !== 0x02) continue;
      chars.push(...m.slice(3));
    }
    const vin = String.fromCharCode(...chars.filter((c) => c >= 0x30 && c <= 0x5a)).slice(-17);
    return vin.length === 17 ? vin : null;
  }

  // Older VW group engines may not answer the OBD VIN request (09 02); the
  // 2007 SEAT Leon Cupra connected without a VIN on 12 Nov 2026. Then the VIN
  // is asked from the engine and the instrument cluster: UDS 22 F190 (ISO
  // 14229 VIN identifier) on 7E0, and over VW TP2.0 the KWP2000 identification
  // requests 1A 90 (ISO 14230-3 option 0x90, VIN) and 1A 9B (VW
  // identification) at engine 0x01 and cluster 0x07. All are reads.
  async readVinFromModules(): Promise<string | null> {
    if (!this.supportsModules) return null;
    const engine = MODULES.find((m) => m.id === 'engine');
    if (engine) {
      const r = await this.withModule(engine, () => this.uds('22F190', 1500, true)).catch(() => null);
      const vin = r && r[0] === 0x62 ? vinInBytes(r.slice(3)) : null;
      if (vin) return vin;
    }
    for (const address of [0x01, 0x07]) {
      const vin = await this.tp20(address, async (s) => {
        for (const req of [[0x1a, 0x90], [0x1a, 0x9b]]) {
          const r = await s.request(req).catch(() => null);
          const found = r && r[0] === 0x5a ? vinInBytes(r.slice(2)) : null;
          if (found) return found;
        }
        return null;
      }).catch(() => null);
      if (vin) return vin;
    }
    return null;
  }

  private async readCodes(mode: '03' | '07' | '0A'): Promise<string[]> {
    const reply = 0x40 + parseInt(mode, 16);
    let msgs: number[][];
    try {
      msgs = await this.request(mode, 6000);
    } catch (e) {
      if (e instanceof ObdError && e.message === 'NO DATA') return [];
      throw e;
    }
    // An answer that could not be read is not "no faults".
    if (!msgs.length) throw new ObdError('The car answered but the reply could not be read. Run the check again.');
    const codes = new Set<string>();
    for (const m of msgs) {
      if (m[0] !== reply) continue;
      // CAN replies carry a count byte after the mode byte; older protocols do not.
      const start = this.isCan ? 2 : 1;
      for (let i = start; i + 1 < m.length; i += 2) {
        const code = decodeDtc(m[i], m[i + 1]);
        if (code) codes.add(code);
      }
    }
    return [...codes];
  }

  async readFaultCodes(): Promise<FaultCodes> {
    const stored = await this.readCodes('03');
    const pending = await this.readCodes('07');
    let permanent: string[] = [];
    try {
      permanent = await this.readCodes('0A');
    } catch {
      permanent = [];
    }
    return { stored, pending, permanent };
  }

  // Mode 04: clears stored and pending codes, freeze frame and readiness
  // monitors, and turns the check engine light off. Permanent codes stay.
  async clearFaultCodes(): Promise<void> {
    const raw = await this.command('04', 8000);
    if (!/44/.test(raw.replace(/\s/g, ''))) {
      throw new ObdError('The car did not confirm the clear. Make sure the ignition is on and the engine is off, then try again.');
    }
  }

  async supportedPids(): Promise<Set<number>> {
    if (this.supported) return this.supported;
    const all = new Set<number>();
    for (const base of [0x00, 0x20, 0x40, 0x60]) {
      const cmd = `01${base.toString(16).padStart(2, '0').toUpperCase()}`;
      let msgs: number[][] = [];
      try {
        msgs = await this.request(cmd);
      } catch {
        // If even the first list fails, do not cache: try again next time.
        if (base === 0x00) return all;
        break;
      }
      let next = false;
      for (const m of msgs) {
        if (m[0] === 0x41 && m[1] === base) {
          const list = supportedFromMask(base, m.slice(2, 6));
          list.forEach((p) => all.add(p));
          next = next || list.includes(base + 0x20);
        }
      }
      if (!next) break;
    }
    this.supported = all;
    return all;
  }

  async readLive(p: LivePid): Promise<number | null> {
    if (this.addressed) return null;
    const cmd = `01${p.pid.toString(16).padStart(2, '0').toUpperCase()}`;
    try {
      for (const m of await this.request(cmd)) {
        if (m[0] === 0x41 && m[1] === p.pid && m.length >= 2 + p.bytes) return p.decode(m.slice(2));
      }
    } catch {
      return null;
    }
    return null;
  }

  // Several standard values in one request (SAE J1979 allows up to 6 on CAN).
  // Each request is sized so every answer fits one CAN frame (6 data bytes):
  // with headers off, frames of 2 modules answering long replies at once
  // could not be told apart. Any value missing from the combined answer is
  // asked on its own; a car that answers combined requests with only one
  // value falls back to one value per request for the rest of the session.
  private multiPid: boolean | null = null;
  private static chunks(list: LivePid[]): LivePid[][] {
    const out: LivePid[][] = [];
    let cur: LivePid[] = [];
    let size = 0;
    for (const p of list) {
      if (cur.length && (size + 1 + p.bytes > 6 || cur.length === 6)) {
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
  async readLiveMany(list: LivePid[]): Promise<Map<number, number | null>> {
    const out = new Map<number, number | null>();
    if (this.addressed) return out;
    if (this.isCan && this.multiPid !== false && list.length > 1) {
      for (const chunk of ElmClient.chunks(list)) {
        if (chunk.length < 2) continue;
        const cmd = `01${chunk.map((p) => p.pid.toString(16).padStart(2, '0').toUpperCase()).join('')}`;
        let msgs: number[][] = [];
        try {
          msgs = await this.request(cmd);
        } catch (e) {
          if (e instanceof LinkLost) throw e;
        }
        let got = 0;
        for (const m of msgs) {
          if (m[0] !== 0x41) continue;
          let j = 1;
          while (j < m.length) {
            const p = chunk.find((x) => x.pid === m[j]);
            if (!p || j + 1 + p.bytes > m.length) break;
            if (!out.has(p.pid) || out.get(p.pid) == null) {
              out.set(p.pid, p.decode(m.slice(j + 1, j + 1 + p.bytes)));
              got++;
            }
            j += 1 + p.bytes;
          }
        }
        // Decide only from a real answer: an error or no answer decides nothing.
        if (this.multiPid == null && msgs.some((m) => m[0] === 0x41)) {
          const most = Math.max(...msgs.filter((m) => m[0] === 0x41).map((m) => m.length));
          if (got > 1) this.multiPid = true;
          else if (most <= 2 + Math.max(...chunk.map((p) => p.bytes))) this.multiPid = false;
        }
        if (this.addressed) return out;
      }
    }
    for (const p of list) {
      if (out.get(p.pid) != null) continue;
      if (this.addressed) break;
      out.set(p.pid, await this.readLive(p));
    }
    return out;
  }

  // Resolves when no module conversation holds the adapter. Always waits at
  // least a moment, so a polling loop can never spin without yielding.
  async whenIdle(): Promise<void> {
    await this.lockTail;
    do await new Promise((r) => setTimeout(r, 150));
    while (this.addressed);
  }

  async livePidsForCar(): Promise<LivePid[]> {
    const supported = await this.supportedPids();
    return LIVE_PIDS.filter((p) => supported.has(p.pid));
  }

  // Points the adapter at one module, runs fn, then restores OBD addressing.
  // By default the adapter sends its flow-control frame to the reply ID minus 8.
  // Modules where that is not the request ID (VW cluster 714/77E) need it set,
  // or multi-frame answers stall. Older clones may refuse the FC commands.
  async withModule<T>(def: ModuleDef, fn: () => Promise<T>, restore = true): Promise<T> {
    if (!this.isCan || !this.canElevenBit) throw new ObdError('Module access needs an 11-bit CAN car.');
    return this.exclusive(async () => {
      try {
        await this.address(def);
        return await fn();
      } finally {
        if (restore) await this.restoreObd();
      }
    });
  }

  // One module conversation at a time: a second screen (or the AI) waits
  // instead of re-pointing the adapter mid-sequence, which could send a
  // request, or a write, to the wrong module. Single commands stay queued
  // as before; this guards whole sequences.
  private lockTail: Promise<unknown> = Promise.resolve();
  private exclusive<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.lockTail.then(fn, fn);
    this.lockTail = run.catch(() => undefined);
    return run;
  }

  private restoreLocked(): Promise<void> {
    return this.exclusive(() => this.restoreObd());
  }

  // True while a module conversation holds the adapter (standard live values pause).
  get moduleBusy(): boolean {
    return this.addressed;
  }

  private fcCustom = false;
  // True while the adapter points at one module, so standard OBD requests
  // from other screens (live data) are held back.
  private addressed = false;

  private async address(def: ModuleDef): Promise<void> {
    this.addressed = true;
    this.curKey = `${def.tx}|${def.rx}`;
    await this.command(`ATSH${def.tx}`);
    await this.command(`ATCRA${def.rx}`);
    const custom = parseInt(def.rx, 16) - 8 !== parseInt(def.tx, 16);
    if (custom) {
      await this.command(`ATFCSH${def.tx}`).catch(() => undefined);
      if (!this.fcCustom) {
        await this.command('ATFCSD300000').catch(() => undefined);
        await this.command('ATFCSM1').catch(() => undefined);
      }
    } else if (this.fcCustom) {
      await this.command('ATFCSM0').catch(() => undefined);
    }
    this.fcCustom = custom;
  }

  private async restoreObd(): Promise<void> {
    await this.command('ATFCSM0').catch(() => undefined);
    this.fcCustom = false;
    await this.command('ATAR').catch(() => undefined);
    await this.command('ATSH7DF').catch(() => undefined);
    this.addressed = false;
    this.curKey = null;
  }

  // One UDS request to the module currently addressed.
  // The adapter stops listening after its own timeout (AT ST, about 200 ms by
  // default), so a module that is slow to build its answer, or that replies
  // "busy, wait" (7F xx 78), is asked again with the adapter's longest wait
  // (about 1 s per frame; each "wait" reply restarts it). "Busy, repeat
  // request" (7F xx 21) is retried after a short pause.
  async uds(req: string, timeoutMs = 2000, quick = false): Promise<number[]> {
    const service = parseInt(req.slice(0, 2), 16);
    let longWait = false;
    try {
      for (let attempt = 0; attempt < 4; attempt++) {
        let msgs: number[][];
        try {
          msgs = await this.request(req, longWait ? Math.max(timeoutMs, 10000) : timeoutMs);
        } catch (e) {
          if (e instanceof ObdError && e.message === 'NO DATA' && !longWait && !quick) {
            longWait = await this.setLongWait(true);
            if (longWait) continue;
          }
          throw e;
        }
        const positive = msgs.find((m) => m[0] === service + 0x40);
        if (positive) return positive;
        const codes = msgs.map((m) => negativeCode(m, service)).filter((c): c is number => c != null);
        const refusal = codes.find((c) => c !== 0x78 && c !== 0x21);
        if (refusal != null) throw new ObdError(describeNrc(refusal));
        if (codes.includes(0x21)) {
          await new Promise((r) => setTimeout(r, 300 * (attempt + 1)));
          continue;
        }
        // Only "busy, wait" came back: listen longer next time.
        if (!longWait) longWait = await this.setLongWait(true);
      }
    } finally {
      if (longWait) await this.setLongWait(false);
    }
    throw new ObdError('The module stayed busy. Try again with the engine off and the ignition on.');
  }

  // Longest adapter wait (AT ST FF with adaptive timing off) and back.
  private async setLongWait(on: boolean): Promise<boolean> {
    try {
      if (on) {
        await this.command('ATAT0');
        await this.command('ATSTFF');
      } else if (this.sweeping) {
        await this.command('ATST4B');
      } else {
        await this.command('ATST32');
        await this.command('ATAT1');
      }
      return on;
    } catch {
      return false;
    }
  }

  // After several modules fail in a row, check the adapter still answers.
  private async linkAlive(): Promise<boolean> {
    try {
      await this.restoreLocked();
      await this.request('0100', 4000);
      return true;
    } catch {
      return false;
    }
  }

  private async readDid(did: string, timeoutMs = 1500): Promise<number[] | null> {
    try {
      const m = await this.uds(`22${did}`, timeoutMs);
      return m[1] === parseInt(did.slice(0, 2), 16) && m[2] === parseInt(did.slice(2), 16) ? m.slice(3) : null;
    } catch {
      return null;
    }
  }

  // Fault memory of one module: UDS 19 02 with mask 0x2D (failed now, pending,
  // confirmed, failed since clear), as used by the dtcsweep tool for VW.
  async readModuleFaults(def: ModuleDef, restore = true): Promise<ModuleFaults> {
    if (this.skipped(def)) return { def, state: 'no-answer', faults: [], error: 'Not listed by the gateway' };
    let first: ModuleFaults | null = null;
    for (const r of await this.routesFor(def)) {
      let res: ModuleFaults;
      if (r.via === 'tp20') {
        const got = await this.tp20(r.address, async (s) => {
          const faults = kwpFaults(await s.request([0x18, 0x02, 0xff, 0x00])).map(kwpFault);
          return { def, ...withFaults(faults) } as ModuleFaults;
        }).catch((e): ModuleFaults => ({ def, state: 'error', faults: [], error: e instanceof Error ? e.message : String(e) }));
        res = got ?? { def, state: 'no-answer', faults: [] };
      } else if (r.via === 'mscan') {
        res = await this.onMsCan(() => this.udsFaults(this.routeDef(def, r), restore));
      } else {
        if (!def.tx) continue;
        res = await this.udsFaults(this.routeDef(def, r), restore);
      }
      res = { ...res, def, route: r.via };
      if (res.state === 'ok' || res.state === 'faults') {
        this.winner.set(def.id, r);
        return res;
      }
      // "Service not supported" on one route can mean the module speaks another.
      if (res.state === 'error' && !/not support/i.test(res.error ?? '')) {
        this.winner.set(def.id, r);
        return res;
      }
      first = first ?? (res.state === 'error' ? res : null);
    }
    if (restore) await this.restoreLocked();
    if (!first && this.olderProtocol.has(def.id)) {
      return { def, state: 'no-answer', faults: [], error: 'Uses the older VW protocol: see Older modules' };
    }
    return first ?? { def, state: 'no-answer', faults: [] };
  }

  private async udsFaults(def: ModuleDef, restore = true): Promise<ModuleFaults> {
    try {
      return await this.withModule(def, async (): Promise<ModuleFaults> => {
        try {
          // Modules the gateway lists as fitted always get the long wait.
          const listed = !!this.installed?.has(def.id) || this.found.has(def.id);
          const quick = this.sweeping && !listed && !this.seenBefore.has(def.id) && !this.winner.has(def.id);
          const m = await this.uds('19022D', 2500, quick);
          return { def, ...withFaults(parseDtcReport(m) ?? []) };
        } catch (e) {
          if ((e instanceof ObdError && e.message === 'NO DATA') || e instanceof AdapterTimeout) return { def, state: 'no-answer', faults: [] };
          return { def, state: 'error', faults: [], error: e instanceof Error ? e.message : String(e) };
        }
      }, restore);
    } catch (e) {
      return { def, state: 'error', faults: [], error: e instanceof Error ? e.message : String(e) };
    }
  }

  // Scans every known module for the maker in turn and reports each as it finishes.
  async scanAllFaults(
    group: 'vag' | 'ford' | 'mazda' | 'other',
    onModule?: (result: ModuleFaults, done: number, total: number, next?: ModuleDef) => void,
    cancelled?: () => boolean,
    // knownOnly: ask only modules that have answered on this car before (a
    // quick check); addresses that never answered are left for a full check.
    opts: { knownOnly?: boolean } = {},
  ): Promise<ModuleFaults[]> {
    // Modules that answered before go first, so real results show at once.
    // Among those, the newer-protocol ones first and the older-protocol ones
    // together after, so the adapter changes mode once, not at every module.
    const all = await this.modulesForCar(group);
    const older = (d: ModuleDef) => this.winner.get(d.id)?.via === 'tp20';
    const seen = all.filter((d) => this.seenBefore.has(d.id));
    const unseen = opts.knownOnly && seen.length >= 3 ? [] : all.filter((d) => !this.seenBefore.has(d.id));
    const defs = [...seen.filter((d) => !older(d)), ...seen.filter(older), ...unseen];
    const out: ModuleFaults[] = [];
    let failedInRow = 0;
    // Fixed short wait for the sweep (adaptive timing off), restored after.
    this.sweeping = await this.command('ATAT0')
      .then(() => this.command('ATST4B'))
      .then(() => true)
      .catch(() => false);
    // Older VW modules one after another share one raw CAN set-up.
    this.holdRaw++;
    try {
      for (let i = 0; i < defs.length; i++) {
        if (cancelled?.()) break;
        const r = await this.readModuleFaults(defs[i], false);
        out.push(r);
        if (r.state === 'ok' || r.state === 'faults') this.seenBefore.add(r.def.id);
        onModule?.(r, i + 1, defs.length, defs[i + 1]);
        failedInRow = r.state === 'error' ? failedInRow + 1 : 0;
        if (failedInRow >= 4) {
          if (!(await this.linkAlive())) throw new LinkLost('Lost contact with the adapter. Reconnect and run the check again.');
          failedInRow = 0;
        }
      }
    } finally {
      // Back to normal OBD addressing and the adapter's normal timing, inside
      // the module lock, whatever happened in the sweep.
      this.holdRaw--;
      this.sweeping = false;
      await this.exclusive(async () => {
        await this.releaseRaw();
        await this.restoreObd();
        await this.command('ATST32').catch(() => undefined);
        await this.command('ATAT1').catch(() => undefined);
      });
    }
    return out;
  }

  // How each module answered (newer protocol, older protocol and its address),
  // to save per car: the next connection tries that way first. Other ways are
  // still tried after it, so an out-of-date entry costs time, never a module.
  exportRoutes(): Record<string, Route> {
    return Object.fromEntries(this.winner);
  }
  rememberRoutes(routes: Record<string, Route> | undefined): void {
    for (const [id, r] of Object.entries(routes ?? {})) if (!this.winner.has(id)) this.winner.set(id, r);
  }

  // Module ids that answered on this connection or before, to save per car.
  get modulesSeen(): string[] {
    return [...this.seenBefore];
  }

  // UDS 14 FF FF FF: clears the whole fault memory of one module. Some modules
  // only accept it in the extended diagnostic session (10 03), so a refusal
  // that points at the session is retried there, then the default session
  // (10 01) is restored.
  async clearModuleFaults(def: ModuleDef): Promise<void> {
    const routes = await this.routesFor(def);
    const r = this.winner.get(def.id) ?? routes[0];
    if (!r) throw new ObdError('This module cannot be reached on this car.');
    if (r.via === 'tp20') {
      const res = await this.tp20(r.address, (s) => s.request([0x14, 0xff, 0x00]));
      if (!res) throw new ObdError('The module did not answer.');
      if (res[0] !== 0x54) throw new ObdError('The module did not confirm the clear.');
      return;
    }
    if (r.via === 'mscan') return this.onMsCan(() => this.udsClear(this.routeDef(def, r)));
    return this.udsClear(this.routeDef(def, r));
  }

  private async udsClear(def: ModuleDef): Promise<void> {
    await this.withModule(def, async () => {
      try {
        await this.uds('14FFFFFF', 5000);
      } catch (e) {
        if (!(e instanceof ObdError) || !SESSION_REFUSAL.test(e.message)) throw e;
        await this.uds('1003', 3000);
        try {
          await this.uds('14FFFFFF', 5000);
        } finally {
          await this.uds('1001', 3000).catch(() => undefined);
        }
      }
    });
  }

  // Reads part number, software version and VIN from each module that answers.
  // Read-only: service 22 in the default session.
  async scanModules(
    group: 'vag' | 'ford' | 'mazda' | 'other',
    onProgress?: (done: number, total: number) => void,
    onModule?: (m: ModuleDetails) => void,
  ): Promise<ModuleDetails[]> {
    if (!this.isCan || !this.canElevenBit) return [];
    const defs = await this.modulesForCar(group);
    const out: ModuleDetails[] = [];
    try {
      for (let i = 0; i < defs.length; i++) {
        onProgress?.(i, defs.length);
        const m = await this.readModuleDetails(defs[i], false);
        out.push(m);
        onModule?.(m);
      }
    } finally {
      await this.restoreLocked();
    }
    onProgress?.(defs.length, defs.length);
    return out;
  }

  // Identification of one module: part number, software, VIN, hardware,
  // system name, serial and VW long coding. All read-only.
  async readModuleDetails(def: ModuleDef, restore = true): Promise<ModuleDetails> {
    const empty: ModuleDetails = { def, responded: false, partNumber: null, software: null, vin: null, hardware: null, systemName: null, serial: null, coding: null };
    if (this.skipped(def)) return empty;
    for (const r of await this.routesFor(def)) {
      let info: ModuleDetails | null;
      if (r.via === 'tp20') {
        info = await this.tp20(r.address, async (s) => {
          const id = parseKwpIdent(await s.request([0x1a, 0x9b]).catch(() => []));
          const d: ModuleDetails = { ...empty, responded: true };
          if (id) {
            d.partNumber = id.partNumber;
            d.software = id.software;
            d.systemName = id.component;
            d.coding = id.coding != null ? id.coding.toString().padStart(7, '0') : null;
          } else {
            // Newer modules on the old channel answer the UDS identification numbers instead.
            const read = async (hi: number, lo: number) => {
              const m = await s.request([0x22, hi, lo], 2000).catch(() => [] as number[]);
              return m[0] === 0x62 && m[1] === hi && m[2] === lo ? cleanText(m.slice(3)) || null : null;
            };
            d.partNumber = await read(0xf1, 0x87);
            d.software = await read(0xf1, 0x89);
            d.hardware = await read(0xf1, 0x91);
            d.systemName = await read(0xf1, 0x97);
          }
          return d;
        }).catch(() => null);
      } else if (r.via === 'mscan') {
        info = await this.onMsCan(() => this.udsDetails(this.routeDef(def, r), restore));
      } else {
        if (!def.tx) continue;
        info = await this.udsDetails(this.routeDef(def, r), restore);
      }
      if (info?.responded) {
        this.winner.set(def.id, r);
        return { ...info, def, route: r.via };
      }
    }
    return empty;
  }

  private async udsDetails(def: ModuleDef, restore = true): Promise<ModuleDetails> {
    const info: ModuleDetails = { def, responded: false, partNumber: null, software: null, vin: null, hardware: null, systemName: null, serial: null, coding: null };
    try {
      await this.withModule(def, async () => {
        for (const { key, did } of ID_DIDS) {
          const v = await this.readDid(did);
          if (v) {
            info.responded = true;
            info[key] = cleanText(v);
          } else if (did === 'F187') {
            // No part number: the module is not fitted or not answering.
            return;
          }
        }
        if (!info.responded) return;
        const hw = await this.readDid('F191');
        info.hardware = hw ? cleanText(hw) : null;
        const name = await this.readDid('F197');
        info.systemName = name ? cleanText(name) : null;
        const serial = await this.readDid('F18C');
        info.serial = serial ? cleanText(serial) : null;
        const coding = await this.readDid('0600');
        info.coding = coding && coding.length ? toHex(coding) : null;
      }, restore);
    } catch {
      // Not addressable on this car.
    }
    return info;
  }

  // Reads maker-specific values, one module at a time. Values the car does
  // not answer are left out of the result.
  async readExtras(list: ExtraValue[], onProgress?: (done: number, total: number) => void): Promise<Record<string, number>> {
    const out: Record<string, number> = {};
    if (!this.supportsModules) return out;
    const byModule = new Map<string, ExtraValue[]>();
    for (const e of list) byModule.set(e.module, [...(byModule.get(e.module) ?? []), e]);
    let done = 0;
    try {
      for (const [id, values] of byModule) {
        const def = MODULES_BY_ID.get(id);
        if (!def) continue;
        await this.withModule(
          def,
          async () => {
            for (const e of values) {
              const bytes = await this.readDid(e.did);
              const v = bytes ? e.decode(bytes) : null;
              if (v != null && Number.isFinite(v) && v >= (e.min ?? 0) && (e.max == null || v <= e.max)) out[e.id] = v;
              onProgress?.(++done, list.length);
            }
          },
          false,
        ).catch(() => undefined);
      }
    } finally {
      await this.restoreLocked();
    }
    return out;
  }

  // One data identifier with a short wait, for sweeps: the bytes after the
  // identifier, 'refused' when the module answered no, 'silent' when nothing
  // came back. A module that says "busy, wait" gets the long wait.
  private async fastDid(did: string, timeoutMs = 800): Promise<number[] | 'refused' | 'silent'> {
    const hi = parseInt(did.slice(0, 2), 16);
    const lo = parseInt(did.slice(2), 16);
    let msgs: number[][];
    try {
      msgs = await this.request(`22${did}`, timeoutMs);
    } catch (e) {
      if (e instanceof LinkLost || e instanceof AdapterTimeout) throw e;
      return 'silent';
    }
    const pos = msgs.find((m) => m[0] === 0x62 && m[1] === hi && m[2] === lo);
    if (pos) {
      if (this.curKey) this.didLens.set(`${this.curKey}|${did}`, pos.length - 3);
      return pos.slice(3);
    }
    const codes = msgs.map((m) => negativeCode(m, 0x22));
    this.lastNrc = codes.find((c) => c != null) ?? null;
    if (codes.includes(0x78) || codes.includes(0x21)) return (await this.readDid(did, 3000)) ?? 'refused';
    return codes.some((c) => c != null) ? 'refused' : 'silent';
  }

  // Several identifiers per request (see multiDid.ts), per module on this
  // connection: data lengths from single reads, whether the module accepts a
  // list for live reads, and whether it follows the rules for a search.
  private curKey: string | null = null;
  private didLens = new Map<string, number>();
  private didSolo = new Set<string>();
  private multiLive = new Map<string, boolean>();
  private multiSearch = new Map<string, boolean>();
  private lastNrc: number | null = null;

  // How many of these identifiers, from the first, can go in one live read.
  private liveBatch(dids: string[]): number {
    const key = this.curKey;
    if (!key || this.multiLive.get(key) === false) return 1;
    let n = 0;
    for (const d of dids.slice(0, MAX_DIDS)) {
      const id = `${key}|${d}`;
      if (!this.didLens.has(id) || this.didSolo.has(id)) break;
      n++;
    }
    return n;
  }

  // One list request. A "busy, wait" (NRC 78) or "busy, repeat" (21) answer
  // is waited for here, so the late answer cannot land in the next request's
  // window. 'silent' when nothing came back.
  private async listRequest(dids: string[], timeoutMs: number): Promise<number[][] | 'silent'> {
    let msgs: number[][];
    try {
      msgs = await this.request(`22${dids.join('')}`, timeoutMs);
    } catch (e) {
      if (e instanceof LinkLost || e instanceof AdapterTimeout) throw e;
      return 'silent';
    }
    if (msgs.some((m) => m[0] === 0x62)) return msgs;
    const codes = msgs.map((m) => negativeCode(m, 0x22));
    if (!codes.includes(0x78) && !codes.includes(0x21)) return msgs;
    try {
      return [await this.uds(`22${dids.join('')}`, 3000)];
    } catch (e) {
      if (e instanceof LinkLost) throw e;
      // Still busy or refused after waiting: the caller asks one at a time.
      return [[0x7f, 0x22, 0x22]];
    }
  }

  // Identifiers already read one at a time, now in one request. Null when the
  // answer cannot be trusted; the caller then reads them one at a time.
  // 'silent' when nothing came back.
  private async readTogether(dids: string[], timeoutMs: number): Promise<Map<string, number[]> | null | 'silent'> {
    const key = this.curKey!;
    const msgs = await this.listRequest(dids, timeoutMs);
    if (msgs === 'silent') return 'silent';
    const pos = msgs.find((m) => m[0] === 0x62);
    if (pos) {
      const got = splitKnown(pos, dids, dids.map((d) => this.didLens.get(`${key}|${d}`)!));
      if (got) {
        this.multiLive.set(key, true);
        return got;
      }
      // A value whose length changes: read these one at a time from now on.
      for (const d of dids) this.didSolo.add(`${key}|${d}`);
      return null;
    }
    const codes = msgs.map((m) => negativeCode(m, 0x22)).filter((c): c is number => c != null);
    if (codes.some((c) => c === 0x11 || c === 0x12 || c === 0x13 || c === 0x31)) this.multiLive.set(key, false);
    return null;
  }

  // Before a search sends lists to a module, one test: a list of one
  // identifier it refused (NRC 31) and 2 it answered must come back as the 2
  // answered ones, each at the length it had alone. That catches a module
  // that refuses a whole list for one unknown identifier, reads only the
  // first, or stops after the first it knows. Those are asked one at a time.
  private async searchCheck(refused: string, good: [string, string]): Promise<boolean> {
    const key = this.curKey!;
    if (this.multiSearch.has(key)) return this.multiSearch.get(key)!;
    let ok = false;
    const list = [refused, ...good];
    let msgs: number[][] | 'silent';
    try {
      msgs = await this.listRequest(list, 1000);
    } catch (e) {
      if (e instanceof LinkLost) throw e;
      msgs = 'silent';
    }
    const pos = msgs === 'silent' ? undefined : msgs.find((m) => m[0] === 0x62);
    if (pos) {
      const got = splitKnown(pos, list, [0, ...good.map((d) => this.didLens.get(`${key}|${d}`) ?? -1)]);
      ok = !!got && got.size === 2 && good.every((d) => got.has(d));
    }
    this.multiSearch.set(key, ok);
    trafficLog.add('!', `Module ${key}: ${ok ? 'reads 3 values per request in searches' : 'one value per request'}`);
    return ok;
  }

  // A search list: each identifier with its data, 'refused', or missing when
  // it must be asked on its own. Null when the list could not be used.
  private async searchTogether(dids: string[], timeoutMs: number): Promise<Map<string, number[] | 'refused'> | null> {
    const key = this.curKey!;
    const msgs = await this.listRequest(dids, timeoutMs);
    if (msgs === 'silent') return null;
    const pos = msgs.find((m) => m[0] === 0x62);
    if (pos) {
      const one = soleAnswer(pos, dids);
      if (!one) return new Map();
      this.didLens.set(`${key}|${one.did}`, one.data.length);
      return new Map(dids.map((d) => [d, d === one.did ? one.data : 'refused'] as const));
    }
    const codes = msgs.map((m) => negativeCode(m, 0x22)).filter((c): c is number => c != null);
    if (codes.length && codes.every((c) => c === 0x31)) return new Map(dids.map((d) => [d, 'refused'] as const));
    if (codes.some((c) => c === 0x11 || c === 0x12 || c === 0x13)) this.multiSearch.set(key, false);
    return null;
  }

  private sensorDef(h: string, r: string): ModuleDef {
    return MODULES.find((m) => m.tx === h && m.rx === r) ?? { id: `hdr-${h}`, name: `Module ${h}`, tx: h, rx: r, groups: [], source: 'OBDb' };
  }

  // Sensor finder: asks the car for every candidate sensor, module by module.
  // A module that stays silent for its first few questions is skipped.
  // onFound gets each answering read with its bytes; returns the read keys found.
  async probeSensors(
    rows: SensorRow[],
    opts: {
      onProgress?: (done: number, total: number, module: string) => void;
      onFound?: (key: string, data: number[]) => void;
      // Every value asked and settled (answered, refused or silent), so a later
      // search on this car can skip it.
      onAsked?: (key: string) => void;
      cancelled?: () => boolean;
      skipKeys?: Set<string>;
    } = {},
  ): Promise<string[]> {
    const found: string[] = [];
    if (!this.supportsModules) return found;
    const byHeader = new Map<string, string[]>();
    for (const r of rows) {
      const k = `${r.h}|${replyHeader(r)}`;
      const list = byHeader.get(k) ?? [];
      if (!list.includes(r.d)) list.push(r.d);
      byHeader.set(k, list);
    }
    const total = [...byHeader.values()].reduce((n, l) => n + l.length, 0);
    let done = 0;
    try {
      for (const [k, dids] of byHeader) {
        if (opts.cancelled?.()) break;
        const [h, rx] = k.split('|');
        const def = this.sensorDef(h, rx);
        await this.withModule(
          def,
          async () => {
            let silent = 0;
            let answered = false;
            const name = HEADER_NAMES[h] ?? `Module ${h}`;
            const keep = (did: string, data: number[]) => {
              found.push(`${h}-${did}`);
              opts.onFound?.(`${h}-${did}`, data);
            };
            // 2 identifiers it answered and one it refused (NRC 31), for the
            // test before sending lists.
            const good: string[] = [];
            let refused: string | null = null;
            // Off: the owner wants every value asked on its own, so a module that
            // answers lists its own way cannot hide one. Live reads still use lists.
            let lists = SEARCH_LISTS && (this.multiSearch.get(k) ?? false);
            // Identifiers a list could not settle are then asked alone.
            let alone = 0;
            const ask = dids.filter((did) => !opts.skipKeys?.has(`${h}-${did}`));
            done += dids.length - ask.length;
            for (let i = 0; i < ask.length; ) {
              if (opts.cancelled?.()) break;
              if (SEARCH_LISTS && !lists && good.length >= 2 && refused && !this.multiSearch.has(k)) lists = await this.searchCheck(refused, [good[0], good[1]]);
              if (lists && !alone && ask.length - i > 1) {
                const batch = ask.slice(i, i + MAX_DIDS);
                opts.onProgress?.(done, total, name);
                let got: Map<string, number[] | 'refused'> | null;
                try {
                  got = await this.searchTogether(batch, 800);
                } catch (err) {
                  if (!(err instanceof AdapterTimeout)) throw err;
                  got = null;
                }
                // No usable answer to a list: one at a time for the rest of this module.
                if (!got || this.multiSearch.get(k) === false) lists = false;
                else answered = true;
                // Those it could not settle are asked one at a time below.
                const open = batch.filter((d) => !got?.has(d));
                alone = open.length;
                for (const d of batch) {
                  const v = got?.get(d);
                  if (v && v !== 'refused') keep(d, v);
                  if (v) opts.onAsked?.(`${h}-${d}`);
                }
                done += batch.length - open.length;
                ask.splice(i, batch.length, ...open);
                if (!open.length) continue;
              }
              const did = ask[i++];
              if (alone) alone--;
              opts.onProgress?.(done++, total, name);
              let got: number[] | 'refused' | 'silent';
              try {
                // A one-off search, saved per car: a longer wait once the module
                // has answered, so a slow value is not taken as missing.
                got = await this.fastDid(did, answered ? 1200 : 500);
              } catch (err) {
                // One slow Bluetooth reply is not the end of this module's search.
                if (!(err instanceof AdapterTimeout)) throw err;
                got = 'silent';
              }
              // Silent counts as asked only once the module is known to be there.
              if (got !== 'silent' || answered) opts.onAsked?.(`${h}-${did}`);
              if (got === 'silent') {
                if (!answered && ++silent >= 3) {
                  // 3 silent answers: before skipping the module, check it is
                  // not there at all (tester present). Any reply, even a
                  // refusal, means it is fitted, so every value is still asked.
                  const here = await this.request('3E00', 1000).then(
                    (m) => m.length > 0,
                    (e) => {
                      if (e instanceof LinkLost) throw e;
                      return false;
                    },
                  );
                  if (here) {
                    answered = true;
                    continue;
                  }
                  done += ask.length - i;
                  break;
                }
                continue;
              }
              answered = true;
              if (got === 'refused') {
                if (this.lastNrc === 0x31) refused = refused ?? did;
              } else {
                if (good.length < 2) good.push(did);
                keep(did, got);
              }
            }
          },
          false,
        ).catch((err) => {
          // A lost link must end the search, so it is not saved as complete.
          if (err instanceof LinkLost) throw err;
        });
      }
    } finally {
      await this.restoreLocked();
      opts.onProgress?.(total, total, '');
    }
    return found;
  }

  // True when the engine answers a standard request (ignition on, adapter in
  // its normal state). One repeat, so a single missed reply does not count.
  async carAwake(): Promise<boolean> {
    for (let i = 0; i < 2; i++) {
      const ok = await this.request('0100', 2500).then(
        (m) => m.some((x) => x[0] === 0x41),
        (e) => {
          if (e instanceof LinkLost) throw e;
          return false;
        },
      );
      if (ok) return true;
    }
    return false;
  }

  // Any car: asks every 11-bit diagnostic address (700 to 7F7) whether a
  // module is there, listening on every 7xx reply ID with headers on, so both
  // the usual layout (reply = request + 8) and the VW one (request + 6A) are
  // heard. Read-only: tester present only; those that answer are then asked
  // their name. About 0.3 s per address.
  async findAnyModules(opts: { onProgress?: (done: number, total: number) => void; onFound?: (def: ModuleDef) => void; cancelled?: () => boolean } = {}): Promise<ModuleDef[]> {
    const out: ModuleDef[] = [];
    if (!this.supportsModules) return out;
    const ids: number[] = [];
    // 700 is left out on VW group cars: a public source describes it as a
    // broadcast address there (replica/vag-sources.md), so every module would
    // answer it and it is not a module of its own.
    for (let tx = this.make === 'vag' ? 0x701 : 0x700; tx <= 0x7f7; tx++) if (tx !== 0x7df && !(tx >= 0x7e8 && tx <= 0x7ef)) ids.push(tx);
    const hits: { tx: string; rx: string }[] = [];
    await this.exclusive(async () => {
      this.addressed = true;
      try {
        // Fixed wait (adaptive timing off), so a slow reply cannot land in the
        // next address's window and be credited to the wrong request ID.
        for (const c of ['ATH1', 'ATCF700', 'ATCM700', 'ATAT0', 'ATST32']) await this.command(c).catch(() => undefined);
        for (const [i, tx] of ids.entries()) {
          if (opts.cancelled?.()) break;
          opts.onProgress?.(i, ids.length);
          const h = tx.toString(16).toUpperCase();
          // One slow reply to the header change skips this address, not the search.
          try {
            await this.command(`ATSH${h}`);
          } catch (e) {
            if (e instanceof LinkLost) throw e;
            continue;
          }
          let raw = '';
          const heard = new Set<string>();
          try {
            raw = await this.command('3E00', 2000);
          } catch (e) {
            if (e instanceof LinkLost) throw e;
            continue;
          }
          for (const line of raw.replace(/>/g, '').split(/[\r\n]+/)) {
            const m = /^(7[0-9A-F]{2})\s*([0-9A-F]{2})\s*([0-9A-F]{2})\s*([0-9A-F]{2})?/i.exec(line.trim().replace(/\s/g, ''));
            if (!m) continue;
            const rx = m[1].toUpperCase();
            const sid = parseInt(m[3], 16);
            const ok = sid === 0x7e || (sid === 0x7f && parseInt(m[4] ?? '0', 16) === 0x3e);
            if (ok && rx !== h) heard.add(rx);
          }
          // Several modules answering one address means a broadcast, not a module.
          const [rx] = [...heard];
          if (heard.size === 1 && !hits.some((x) => x.tx === h || x.rx === rx)) hits.push({ tx: h, rx });
        }
      } finally {
        // ATD resets filters and formatting on every ELM327 version (bare ATCRA
        // is v1.4b and later); then the start-up settings again.
        const reset = async () => {
          for (const c of ['ATD', 'ATE0', 'ATL0', 'ATS0', 'ATH0', 'ATAT1', `ATSP${this.dp}`]) await this.command(c).catch(() => undefined);
          this.fcCustom = false;
          await this.restoreObd();
        };
        await reset();
        // Proof the adapter is back to normal: the engine answers a standard
        // request. If not, the reset is done once more.
        if (!(await this.carAwake())) await reset();
      }
    });
    for (const { tx, rx } of hits) {
      if (opts.cancelled?.()) break;
      const known = MODULES.find((m) => m.tx === tx && m.rx === rx) ?? this.extraDefs.find((m) => m.tx === tx && m.rx === rx);
      let def: ModuleDef = known ?? { id: `hdr-${tx}`, name: `Module ${tx}`, tx, rx, groups: [], source: 'Found by probing' };
      if (!known) {
        // Ask its name: system name, then part number.
        const name = await this.withModule(def, async () => (await this.readDid('F197', 1200)) ?? (await this.readDid('F187', 1200))).catch(() => null);
        const text = name ? cleanText(name) : '';
        def = { ...def, name: text ? `${text} (${tx})` : def.name };
        if (!this.extraDefs.some((d) => d.id === def.id)) this.extraDefs.push(def);
      }
      out.push(def);
      opts.onFound?.(def);
    }
    opts.onProgress?.(ids.length, ids.length);
    return out;
  }

  // Discover mode: asks one module for every data identifier in the given
  // ranges and reports each that answers, so values no list knows yet can be
  // found on any car. Read-only. Stops early when the module goes quiet
  // (asleep or not fitted). onProgress gets the identifier just asked.
  async discoverDids(
    def: ModuleDef,
    ranges: [number, number][],
    opts: {
      startAt?: number;
      onProgress?: (did: number, done: number, total: number) => void;
      onFound?: (did: string, data: number[]) => void;
      cancelled?: () => boolean;
      // Identifiers already asked on this car (sensor search, earlier sweep).
      skip?: Set<string>;
    } = {},
  ): Promise<{ finished: boolean; lastDid: number | null }> {
    const total = ranges.reduce((n, [a, b]) => n + b - a + 1, 0);
    let done = 0;
    let last: number | null = null;
    let quiet = 0;
    let finished = true;
    await this.withModule(def, async () => {
      // Tester present first: a module that does not answer is skipped.
      const hello = await this.fastDid('F190', 1000).catch(() => 'silent' as const);
      if (hello === 'silent') {
        const tp = await this.request('3E00', 1000).catch(() => [] as number[][]);
        if (!tp.length) {
          finished = false;
          return;
        }
      }
      for (const [a, b] of ranges) {
        for (let d = a; d <= b; d++) {
          done++;
          if (opts.startAt != null && d < opts.startAt) continue;
          if (opts.cancelled?.()) {
            finished = false;
            return;
          }
          if (done % 8 === 0) opts.onProgress?.(d, done, total);
          const did = d.toString(16).toUpperCase().padStart(4, '0');
          if (opts.skip?.has(did)) continue;
          let got: number[] | 'refused' | 'silent';
          try {
            got = await this.fastDid(did, 600);
          } catch (err) {
            // One slow Bluetooth reply is not the end of the sweep.
            if (!(err instanceof AdapterTimeout)) throw err;
            got = 'silent';
          }
          last = d;
          if (got === 'silent') {
            if (++quiet >= 40) {
              finished = false;
              return;
            }
            continue;
          }
          quiet = 0;
          if (got !== 'refused') opts.onFound?.(did, got);
        }
      }
    });
    opts.onProgress?.(last ?? 0, total, total);
    return { finished, lastDid: last };
  }

  // A few quick reads of identifiers already found, to see which ones move.
  async sampleDids(def: ModuleDef, dids: string[], extended = false): Promise<Record<string, number[]>> {
    const out: Record<string, number[]> = {};
    await this.withModule(def, async () => {
      if (extended) await this.uds('1003', 3000).catch(() => undefined);
      try {
        for (const did of dids) {
          const got = await this.fastDid(did, 800);
          if (typeof got !== 'string') out[did] = got;
        }
      } finally {
        if (extended) await this.uds('1001', 3000).catch(() => undefined);
      }
    }).catch(() => undefined);
    return out;
  }

  // Current values of the given sensors (up to 3 identifiers per request once
  // each has been read alone; see multiDid.ts).
  // Where each module's next round of sensor reads starts.
  private sensorRound = new Map<string, number>();
  async readSensors(rows: SensorRow[], cancelled?: () => boolean): Promise<Record<string, SensorValue>> {
    const out: Record<string, SensorValue> = {};
    if (!this.supportsModules || !rows.length) return out;
    const byHeader = new Map<string, Map<string, SensorRow[]>>();
    for (const r of rows) {
      const k = `${r.h}|${replyHeader(r)}`;
      const m = byHeader.get(k) ?? new Map<string, SensorRow[]>();
      m.set(r.d, [...(m.get(r.d) ?? []), r]);
      byHeader.set(k, m);
    }
    try {
      for (const [k, dids] of byHeader) {
        if (cancelled?.()) break;
        const [h, rx] = k.split('|');
        await this.withModule(
          this.sensorDef(h, rx),
          async () => {
            // A module that stays silent twice is asleep: skip it this round.
            let silent = 0;
            // Start each round at a different identifier, so two that never
            // answer cannot hide the rest of this module's values.
            const order = [...dids];
            const turn = (this.sensorRound.get(k) ?? 0) % Math.max(1, order.length);
            this.sensorRound.set(k, turn + 1);
            const queue = [...order.slice(turn), ...order.slice(0, turn)];
            const put = (list: SensorRow[], data: number[]) => {
              for (const r of list) {
                const v = decodeSensor(r, data);
                if (v != null && (typeof v === 'string' || Number.isFinite(v))) out[sensorId(r)] = v;
              }
            };
            for (let i = 0; i < queue.length; i++) {
              if (cancelled?.() || silent >= 2) break;
              // Values read before, with known lengths, go up to 3 per request.
              const n = this.liveBatch(queue.slice(i).map(([d]) => d));
              if (n > 1) {
                const part = queue.slice(i, i + n);
                const together = await this.readTogether(part.map(([d]) => d), 1000);
                if (together === 'silent') {
                  // No answer to the list: if the first value answers alone, this
                  // module ignores lists, so it is read one at a time from now on.
                  const [d0, l0] = queue[i];
                  const one = await this.fastDid(d0, 1000);
                  if (one === 'silent') {
                    silent++;
                    continue;
                  }
                  this.multiLive.set(k, false);
                  silent = 0;
                  if (one !== 'refused') put(l0, one);
                  continue;
                }
                if (together) {
                  silent = 0;
                  for (const [d, list] of part) {
                    const data = together.get(d);
                    if (data) put(list, data);
                  }
                  i += n - 1;
                  continue;
                }
              }
              const [did, list] = queue[i];
              const got = await this.fastDid(did, 1000);
              if (got === 'silent') {
                silent++;
                continue;
              }
              silent = 0;
              if (got === 'refused') continue;
              put(list, got);
            }
          },
          false,
        ).catch(() => undefined);
      }
    } finally {
      await this.restoreLocked();
    }
    return out;
  }

  // How each TP2.0 module keeps its coding, learned when it is read.
  private tp20Coding = new Map<string, Tp20Coding>();

  // Current coding of one module, or null. UDS 22 0600 first; modules that only
  // answer VW TP2.0 are read over that channel (replica/kwp-write-sources.md).
  async readCoding(def: ModuleDef): Promise<number[] | null> {
    const w = this.winner.get(def.id);
    if (def.tx && w?.via !== 'tp20') {
      try {
        const c = await this.withModule(def, () => this.readDid('0600'));
        if (c && c.length) return c;
      } catch {
        // try TP2.0
      }
    }
    if (this.make !== 'vag') return null;
    for (const r of await this.routesFor(def)) {
      if (r.via !== 'tp20') continue;
      const got = await this.tp20(r.address, (s) => tp20ReadCoding(s), false).catch(() => null);
      if (got && got.coding.length) {
        this.winner.set(def.id, r);
        this.tp20Coding.set(def.id, { ...got, address: r.address });
        return got.coding;
      }
    }
    return null;
  }

  // Coding style of a module read earlier: 'uds', or for TP2.0 modules 'did'
  // (modern record over the old channel, proven on a real Carista log), 'long'
  // or 'short' (old KWP coding, unproven writes).
  codingStyle(def: ModuleDef): Tp20Coding['style'] | 'uds' | null {
    const c = this.tp20Coding.get(def.id);
    if (c) return c.style;
    return this.winner.get(def.id)?.via === 'tp20' ? null : 'uds';
  }

  // Writes coding to a TP2.0 module with the same safety net as UDS: compare,
  // write, read back, put the original back on a mismatch.
  private async writeTp20Coding(def: ModuleDef, info: Tp20Coding, before: number[], after: number[], loginCode?: number): Promise<CodingWrite> {
    const res = await this.tp20(
      info.address,
      async (s): Promise<CodingWrite> => {
        // The fixed addresses come partly from a single source: check the
        // module that answers is the one meant before writing anything.
        const expect = TP20_EXPECT[def.id];
        const who = expect ? await tp20Identity(s) : '';
        if (expect && who && !expect.test(who)) throw new ObdError(`The module at this address says it is "${who}", not ${def.name}. Nothing was changed.`);
        const now = await tp20ReadCoding(s);
        if (!now || toHex(now.coding) !== toHex(before)) throw new ObdError('The coding changed since it was read, or could not be read. Read it again, then retry. Nothing was changed.');
        const put = (value: number[]) => tp20WriteCoding(s, now, value, loginCode);
        const settle = () => (now.style !== 'did' ? s.idle(3000) : Promise.resolve());
        try {
          await put(after);
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          // A refusal means the module kept its coding. Anything else (a lost
          // answer) may have stored it: check before saying so.
          if (/^Refused/.test(msg)) throw new ObdError(`The module did not accept the change. ${msg} Nothing was changed.`);
          await settle();
          const seen = await tp20ReadCoding(s).catch(() => null);
          if (seen && toHex(seen.coding) === toHex(before)) throw new ObdError(`The module did not answer the change (${msg}) and kept its coding. Nothing was changed.`);
          if (seen && toHex(seen.coding) === toHex(after)) return { ok: true, restored: false, coding: seen.coding };
          await put(before).catch(() => undefined);
          await settle();
          const again = await tp20ReadCoding(s).catch(() => null);
          return { ok: false, restored: !!again && toHex(again.coding) === toHex(before), coding: again?.coding ?? null };
        }
        await settle();
        const back = await tp20ReadCoding(s);
        if (back && toHex(back.coding) === toHex(after)) return { ok: true, restored: false, coding: back.coding };
        await put(before).catch(() => undefined);
        await settle();
        const again = await tp20ReadCoding(s);
        return { ok: false, restored: !!again && toHex(again.coding) === toHex(before), coding: again?.coding ?? null };
      },
      false,
    );
    if (!res) throw new ObdError(`${def.name} did not open a channel. Nothing was changed.`);
    return res;
  }


  // Writes a module's long coding with a safety net. The sequence follows two
  // public tools (OVMS VW e-Up toolkit, openpilot vw_mqb_config):
  //   10 03 extended session; 22 0600 read and compare with what the user saw;
  //   2E F199 programming date and 2E F198 workshop code (some modules refuse
  //   the coding write without them); 2E 0600 new coding; 22 0600 read back.
  // A read-back that differs puts the original coding straight back.
  async writeCoding(def: ModuleDef, before: number[], after: number[], loginCode?: number): Promise<CodingWrite> {
    const tp = this.tp20Coding.get(def.id);
    if (tp && this.winner.get(def.id)?.via === 'tp20') {
      if (before.length !== after.length) throw new ObdError('The new value is a different length. Nothing was changed.');
      return this.writeTp20Coding(def, tp, before, after, loginCode);
    }
    return this.writeDid(def, '0600', before, after, loginCode);
  }

  // UDS security access as workshop tools use it for coding and adaptation:
  // 27 03 gives a seed, the key is (seed + login code) over the seed's length,
  // sent with 27 04 (replica/vcds-sources.md, High on MQB, Medium on MLB).
  // Level 27 11 is for flashing and is never used.
  private async login(code: number, level = 3): Promise<void> {
    const lv = level.toString(16).toUpperCase().padStart(2, '0');
    const r = await this.uds(`27${lv}`, 3000);
    const seed = r.slice(2);
    if (!seed.length) return; // An all-zero or empty seed means already unlocked.
    let key = 0n;
    for (const b of seed) key = (key << 8n) | BigInt(b);
    key = (key + BigInt(code)) % (1n << BigInt(8 * seed.length));
    const bytes: number[] = [];
    for (let i = seed.length - 1; i >= 0; i--) bytes.push(Number((key >> BigInt(8 * i)) & 0xffn));
    // The key goes once: sent again after the module accepted it, it would be
    // refused and look like a wrong code.
    let answer: number[] | 'unconfirmed';
    try {
      answer = await this.sendOnce(`27${(level + 1).toString(16).toUpperCase().padStart(2, '0')}${toHex(bytes)}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      throw new ObdError(`The login code was refused (${msg}). Modules allow one wrong code per ignition cycle: switch the ignition off and on before trying again.`);
    }
    if (answer === 'unconfirmed') throw new ObdError('The module did not answer the login in time. Switch the ignition off and on, then try again.');
  }

  // Writes one data identifier (coding 0600, or an adaptation value) with the
  // same safety as coding: extended session, read and compare the current
  // value, workshop stamp, write, read back, and put the old value back if the
  // module did not keep the new one. A login code is sent only if the module
  // asks for one.
  async writeDid(def: ModuleDef, did: string, before: number[], after: number[], loginCode?: number): Promise<CodingWrite> {
    if (before.length !== after.length) throw new ObdError('The new value is a different length. Nothing was changed.');
    return this.withModule(def, async (): Promise<CodingWrite> => {
      await this.uds('1003', 3000);
      try {
        const current = await this.readDid(did, 3000);
        if (!current) throw new ObdError('Could not read the current value. Nothing was changed.');
        if (toHex(current) !== toHex(before)) throw new ObdError('The value changed since it was read. Read it again, then retry. Nothing was changed.');
        const now = new Date();
        const bcd = (n: number) => (Math.floor(n / 10) << 4) | n % 10;
        await this.uds(`2EF199${toHex([bcd(now.getFullYear() % 100), bcd(now.getMonth() + 1), bcd(now.getDate())])}`, 3000).catch(() => undefined);
        const wsc = (await this.readDid('F1A5', 2000)) ?? (await this.readDid('F19A', 2000));
        if (wsc && wsc.length) await this.uds(`2EF198${toHex(wsc)}`, 3000).catch(() => undefined);
        const write = async (value: number[]) => {
          try {
            await this.uds(`2E${did}${toHex(value)}`, 6000);
          } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            if (!/security login/.test(msg)) throw e;
            if (loginCode == null) throw new ObdError('This module needs a security login code for this change. Nothing was changed.');
            await this.login(loginCode);
            await this.uds(`2E${did}${toHex(value)}`, 6000);
          }
        };
        try {
          await write(after);
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          if (/Nothing was changed|login code/.test(msg)) throw e;
          throw new ObdError(`The module did not accept the change: ${msg} Nothing was changed.`);
        }
        const back = await this.readDid(did, 3000);
        if (back && toHex(back) === toHex(after)) return { ok: true, restored: false, coding: back };
        // Read-back mismatch: restore the original.
        await write(before).catch(() => undefined);
        const again = await this.readDid(did, 3000);
        return { ok: false, restored: !!again && toHex(again) === toHex(before), coding: again };
      } finally {
        await this.uds('1001', 3000).catch(() => undefined);
      }
    });
  }

  // A request that must not go twice (a write, a routine, a login key): sent
  // once with the adapter's longest wait. "Busy, wait" (78) with no final
  // answer in that time, or no answer at all, is 'unconfirmed', never a
  // reason to send it again. "Busy, repeat" (21) means it was not done, so
  // it is sent again after a pause.
  private async sendOnce(req: string): Promise<number[] | 'unconfirmed'> {
    const service = parseInt(req.slice(0, 2), 16);
    const long = await this.setLongWait(true);
    try {
      for (let attempt = 0; attempt < 3; attempt++) {
        let msgs: number[][];
        try {
          msgs = await this.request(req, 12000);
        } catch (e) {
          if (e instanceof LinkLost) throw e;
          return 'unconfirmed';
        }
        const pos = msgs.find((m) => m[0] === service + 0x40);
        if (pos) return pos;
        const codes = msgs.map((m) => negativeCode(m, service)).filter((c): c is number => c != null);
        const refusal = codes.find((c) => c !== 0x78 && c !== 0x21);
        if (refusal != null) throw new ObdError(describeNrc(refusal));
        if (codes.includes(0x78) || !codes.includes(0x21)) return 'unconfirmed';
        await new Promise((r) => setTimeout(r, 300 * (attempt + 1)));
      }
      return 'unconfirmed';
    } finally {
      if (long) await this.setLongWait(false);
    }
  }

  // Service reset (src/service/obdReset.ts): runs the steps in order. Every
  // value written is read first and kept (a learned-by-compare reset writes
  // nothing it could not read first); if a step fails, the kept values are
  // put back after opening the session and logging in again. Writes,
  // routines and login keys are sent once only. For a learned-by-compare
  // reset a write counts only when it reads back as written; recorded resets
  // may write triggers the module clears itself, so the module's yes counts.
  async runServiceReset(
    reset: ServiceReset,
    onStep?: (i: number) => void,
  ): Promise<{ ok: boolean; restored: boolean; changed: boolean; routineRan: boolean; unkept: string[]; log: string[]; checks: Record<string, string | null> }> {
    const def: ModuleDef = this.moduleById(reset.module) ?? { id: reset.module, name: 'Instrument cluster', tx: reset.tx, rx: reset.rx, groups: [], source: 'Service reset' };
    const log: string[] = [];
    const kept: { did: string; value: number[] }[] = [];
    const unkept: string[] = [];
    let ok = false;
    let restored = false;
    // Something may have changed in the module (a write or routine was sent).
    let changed = false;
    let routineRan = false;
    const checks: Record<string, string | null> = {};
    const hex2 = (n: number) => n.toString(16).toUpperCase().padStart(2, '0');
    const session = reset.steps.find((x) => x.kind === 'session');
    const login = reset.steps.find((x) => x.kind === 'login');
    await this.withModule({ ...def, tx: reset.tx, rx: reset.rx }, async () => {
      try {
        for (const [i, s] of reset.steps.entries()) {
          onStep?.(i);
          if (s.kind === 'session') {
            if (s.value === 0x02) throw new ObdError('The programming session is never used.');
            await this.uds(`10${hex2(s.value)}`, 3000);
          } else if (s.kind === 'login') {
            if ((s.level ?? 3) !== 3) throw new ObdError('Only the workshop login level (27 03) is used.');
            await this.login(s.code, 3);
          } else if (s.kind === 'write') {
            const was = await this.readDid(s.did, 3000);
            if (!was) {
              if (reset.source === 'compared') throw new ObdError(`Value ${s.did} could not be read first, so it was not written.`);
              unkept.push(s.did);
            } else {
              if (was.length * 2 !== s.value.length) throw new ObdError(`Value ${s.did} is a different length on the car now, so it was not written.`);
              kept.push({ did: s.did, value: was });
            }
            changed = true;
            const r = await this.sendOnce(`2E${s.did}${s.value}`);
            const back = await this.readDid(s.did, 3000);
            if (r === 'unconfirmed' && (!back || toHex(back) !== s.value)) throw new ObdError(`The module did not confirm value ${s.did} in time.`);
            if (r !== 'unconfirmed' && toHex(r.slice(1, 3)) !== s.did) throw new ObdError(`The module answered for a different value than ${s.did}.`);
            if (reset.source === 'compared' && (!back || toHex(back) !== s.value)) throw new ObdError(`Value ${s.did} did not keep the new setting.`);
            log.push(`${s.did}: ${was ? toHex(was) : '(not readable)'} to ${back ? toHex(back) : '(not readable)'}`);
          } else {
            changed = true;
            routineRan = true;
            const r = await this.sendOnce(`3101${s.id}${s.data ?? ''}`);
            if (r === 'unconfirmed') throw new ObdError(`The module did not confirm routine ${s.id} in time. It may have run: check the service display before trying again.`);
            if (r[1] !== 0x01 || toHex(r.slice(2, 4)) !== s.id) throw new ObdError(`The module answered for a different routine than ${s.id}.`);
            log.push(`Routine ${s.id} done`);
          }
        }
        ok = true;
      } catch (e) {
        if (e instanceof LinkLost) throw e;
        log.push(e instanceof Error ? e.message : String(e));
        restored = unkept.length === 0 && !routineRan;
        if (kept.length) {
          // The session may have dropped: open it and log in again first.
          if (session?.kind === 'session') await this.uds(`10${hex2(session.value)}`, 3000).catch(() => undefined);
          if (login?.kind === 'login') await this.login(login.code, 3).catch(() => undefined);
          for (const k of [...kept].reverse()) {
            try {
              const r = await this.sendOnce(`2E${k.did}${toHex(k.value)}`);
              const back = await this.readDid(k.did, 3000);
              if (!back || toHex(back) !== toHex(k.value)) restored = false;
              else if (r === 'unconfirmed') log.push(`${k.did} put back (confirmed by reading it back)`);
            } catch {
              restored = false;
            }
          }
        }
      } finally {
        for (const c of reset.checks ?? []) {
          const r = await this.readDid(c.did, 2000);
          checks[c.did] = r ? toHex(r) : null;
        }
        await this.uds('1001', 3000).catch(() => undefined);
      }
    });
    return { ok, restored: ok ? false : restored, changed, routineRan, unkept, log, checks };
  }

  // Reads a range of data identifiers quickly (one short try each) and
  // reports the ones the module answers. Used to find adaptation values
  // without label files: read, change a setting, read again, compare.
  async sweepDids(
    def: ModuleDef,
    from: number,
    to: number,
    opts: { extended?: boolean; onProgress?: (p: number) => void; onFound?: (did: string, data: number[]) => void; cancelled?: () => boolean } = {},
  ): Promise<Record<string, string>> {
    const out: Record<string, string> = {};
    await this.withModule(def, async () => {
      if (opts.extended) await this.uds('1003', 3000);
      try {
        for (let d = from; d <= to; d++) {
          if (opts.cancelled?.()) break;
          if ((d - from) % 16 === 0) opts.onProgress?.((d - from) / (to - from + 1));
          const did = d.toString(16).toUpperCase().padStart(4, '0');
          let msgs: number[][];
          try {
            msgs = await this.request(`22${did}`, 400);
          } catch {
            continue;
          }
          const m = msgs.find((x) => x[0] === 0x62 && x[1] === d >> 8 && x[2] === (d & 0xff));
          if (m) {
            out[did] = toHex(m.slice(3));
            opts.onFound?.(did, m.slice(3));
          }
        }
      } finally {
        if (opts.extended) await this.uds('1001', 3000).catch(() => undefined);
      }
    });
    opts.onProgress?.(1);
    return out;
  }

  // Experimental deep scan of VW group modules that use TP2.0 + KWP2000.
  // Probes each address with a channel setup; modules that answer are asked
  // for their faults. Nothing is changed in the car.
  // Holds the adapter for the whole raw session, so other screens wait.
  deepScan(...args: Parameters<ElmClient['deepScanInner']>): ReturnType<ElmClient['deepScanInner']> {
    return this.exclusive(() => this.deepScanInner(...args)) as ReturnType<ElmClient['deepScanInner']>;
  }

  async deepScanInner(
    addresses: number[] = TP20_CANDIDATES,
    onProgress?: (done: number, total: number) => void,
    onModule?: (m: Tp20Module) => void,
  ): Promise<Tp20Module[]> {
    if (!this.supportsModules) return [];
    // Addresses already reached as a named module are not probed again.
    const used = new Set([...this.winner.values()].flatMap((r) => (r.via === 'tp20' ? [r.address] : [])));
    addresses = addresses.filter((a) => !used.has(a));
    const s = new Tp20Session((c, t) => this.command(c, t), this.dp);
    const out: Tp20Module[] = [];
    this.addressed = true;
    try {
      await s.enter();
      for (let i = 0; i < addresses.length; i++) {
        onProgress?.(i, addresses.length);
        const address = addresses[i];
        let opened = false;
        try {
          opened = await s.open(address);
        } catch {
          opened = false;
        }
        if (!opened) continue;
        const m: Tp20Module = { address, faults: [] };
        try {
          const start = await s.request([0x10, 0x89]);
          if (start[0] !== 0x50) throw new ObdError('The module refused a diagnostic session.');
          m.faults = kwpFaults(await s.request([0x18, 0x02, 0xff, 0x00]));
          const id = parseKwpIdent(await s.request([0x1a, 0x9b]).catch(() => []));
          if (id) {
            m.part = id.partNumber;
            m.component = id.component;
          }
        } catch (e) {
          m.error = e instanceof Error ? e.message : String(e);
        } finally {
          await s.close().catch(() => undefined);
        }
        m.moduleId = this.linkTp20(address);
        out.push(m);
        onModule?.(m);
      }
      onProgress?.(addresses.length, addresses.length);
    } finally {
      await s.leave();
      this.addressed = false;
    }
    return out;
  }

  // A module the deep scan reached: tie its address to the named module that
  // uses it, or to a new "address" entry, so Customise, Workshop and coding
  // reads go straight there. Engine and gearbox keep their usual route.
  linkTp20(address: number): string {
    const route: Route = { via: 'tp20', address };
    const def = [...MODULES, ...this.extraDefs].find(
      (d) => (d.groups.includes('vag') || d.groups.includes('all')) && routesOf(d, this.found.get(d.id) ?? []).some((r) => r.via === 'tp20' && r.address === address),
    );
    const id = def?.id ?? `vag-at${address.toString(16).padStart(2, '0')}`;
    if (!def) this.extraDefs.push({ id, name: tp20Name(address), tx: '', rx: '', alt: [route], groups: ['vag'], source: 'Found by the deep scan' });
    if (!def?.groups.includes('all')) {
      const known = this.found.get(id) ?? [];
      if (!known.some((r) => r.via === 'tp20' && r.address === address)) this.found.set(id, [...known, route]);
      if (!this.winner.has(id)) this.winner.set(id, route);
    }
    return id;
  }

  // Modules an earlier deep scan found on this car, linked again on connect.
  rememberDeep(found: { address: number }[] | undefined): void {
    if (this.make !== 'vag') return;
    for (const f of found ?? []) this.linkTp20(f.address);
  }

  // Clears the fault memory of one TP2.0 module (KWP 14 FF 00).
  // Holds the adapter for the whole raw session, so other screens wait.
  clearTp20(...args: Parameters<ElmClient['clearTp20Inner']>): ReturnType<ElmClient['clearTp20Inner']> {
    return this.exclusive(() => this.clearTp20Inner(...args)) as ReturnType<ElmClient['clearTp20Inner']>;
  }

  async clearTp20Inner(address: number): Promise<void> {
    const s = new Tp20Session((c, t) => this.command(c, t), this.dp);
    this.addressed = true;
    try {
      await s.enter();
      if (!(await s.open(address))) throw new ObdError('The module did not answer.');
      try {
        await s.request([0x10, 0x89]);
        const r = await s.request([0x14, 0xff, 0x00]);
        if (r[0] !== 0x54) throw new ObdError('The module did not confirm the clear.');
      } finally {
        await s.close().catch(() => undefined);
      }
    } finally {
      await s.leave();
      this.addressed = false;
    }
  }

  // Listen mode: the adapter silently records CAN frames another tool (VCDS,
  // Carista) sends on the same port through a Y-splitter. 'all' records
  // everything; 'diag' keeps IDs 700 to 7FF (busy Ford and Mazda buses).
  // Afterwards the adapter is put back as Caristini set it up.
  get canListen(): boolean {
    return !!this.transport.stream && this.isCan;
  }

  // Holds the adapter for the whole raw session, so other screens wait.
  listen(...args: Parameters<ElmClient['listenInner']>): ReturnType<ElmClient['listenInner']> {
    return this.exclusive(() => this.listenInner(...args)) as ReturnType<ElmClient['listenInner']>;
  }

  async listenInner(filter: 'all' | 'diag', onLine: (line: string) => void, until: Promise<void>): Promise<'stopped' | 'ended'> {
    if (!this.transport.stream) throw new ObdError('This adapter link cannot stream.');
    this.addressed = true;
    let tail = '';
    try {
      for (const c of ['ATCAF0', 'ATH1', 'ATS0', 'ATCSM1', ...(filter === 'diag' ? ['ATCF700', 'ATCM700'] : ['ATCRA'])]) {
        await this.command(c).catch(() => undefined);
      }
      const run = this.queue.then(() =>
        this.transport.stream!(
          'ATMA',
          (text) => {
            const parts = (tail + text).split(/[\r\n]+/);
            tail = parts.pop() ?? '';
            for (const p of parts) if (p.trim()) onLine(p.trim());
          },
          until,
        ),
      );
      this.queue = run.catch(() => undefined);
      return await run;
    } finally {
      if (tail.trim()) onLine(tail.trim());
      // ATD resets filters and formatting; then the start-up settings again.
      for (const c of ['ATD', 'ATCRA', 'ATE0', 'ATL0', 'ATS0', 'ATH0', 'ATAT1', `ATSP${this.dp}`, 'ATSH7DF']) {
        await this.command(c).catch(() => undefined);
      }
      this.fcCustom = false;
      this.addressed = false;
    }
  }

  // Adapter check: what the adapter is, how fast it answers over this link, and
  // which of Caristini's protocols it supports. Changes nothing in the car;
  // the only setting touched (protocol B options) is used by TP2.0 alone.
  async checkAdapter(): Promise<AdapterReport> {
    const clean = (r: string) => r.replace(/>/g, '').replace(/\s+/g, ' ').trim();
    const id = clean(await this.command('ATI').catch(() => ''));
    const device = clean(await this.command('AT@1').catch(() => ''));
    const sti = clean(await this.command('STI', 1500).catch(() => ''));
    const stn = /STN/i.test(sti);
    const times: number[] = [];
    for (let i = 0; i < 15; i++) {
      const t0 = Date.now();
      await this.command('ATI').catch(() => undefined);
      times.push(Date.now() - t0);
    }
    const pb = clean(await this.command('ATPBC001').catch(() => '?'));
    const volts = await this.batteryVoltage();
    const avg = times.reduce((a, b) => a + b, 0) / times.length;
    return {
      id,
      device: device && !/\?/.test(device) ? device : null,
      stn: stn ? sti : null,
      protocol: (await this.command('ATDP').then(clean).catch(() => '')) || 'unknown',
      volts,
      roundTrip: { avg: Math.round(avg), min: Math.min(...times), max: Math.max(...times) },
      rawCan: !/\?/.test(pb),
      secondBus: stn,
      clone: /v1\.5/i.test(id),
    };
  }

  // Battery voltage at the OBD port, measured by the adapter (ATRV).
  async batteryVoltage(): Promise<number | null> {
    try {
      const raw = await this.command('ATRV', 2000);
      const m = raw.match(/(\d+(?:\.\d+)?)\s*V/i);
      // Under 5 V is no reading (an adapter not powered from the car).
      return m && Number(m[1]) >= 5 ? Number(m[1]) : null;
    } catch {
      return null;
    }
  }

  close(): Promise<void> {
    return this.transport.close();
  }
}

// The 3 bytes a module uses for a fault code: 'P0011B5' or maker-numbered '0000F3'.
export function dtcBytes(code: string): number[] | null {
  if (/^[0-9A-F]{6}$/.test(code)) return code.match(/../g)!.map((h) => parseInt(h, 16));
  const m = /^([PCBU])([0-3])([0-9A-F])([0-9A-F]{2})([0-9A-F]{2})$/.exec(code);
  if (!m) return null;
  const letter = 'PCBU'.indexOf(m[1]);
  return [(letter << 6) | (parseInt(m[2], 16) << 4) | parseInt(m[3], 16), parseInt(m[4], 16), parseInt(m[5], 16)];
}

// KWP2000 fault records (VW 5-digit number and status byte) shown like UDS faults.
function kwpFault(f: { code: string; status: number }): UdsFault {
  return { code: f.code, base: '', failureType: 0, status: f.status, state: 'stored', warningLamp: false, kwp: true };
}

function withFaults(faults: UdsFault[]): { state: 'ok' | 'faults'; faults: UdsFault[] } {
  return { state: faults.length ? 'faults' : 'ok', faults };
}
