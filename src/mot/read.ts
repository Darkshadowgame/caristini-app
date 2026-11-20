// MOT check: reading the car. Everything here is a read: the engine light and
// codes (Mode 01 PID 01, Modes 03 and 07), the battery voltage, and the fault
// memory of the modules whose warning lamps or lamps the MOT checks. Nothing
// is cleared or written.
import type { HistoryEntry } from '../history';
import type { ElmClient } from '../obd/elm';
import { faultText } from '../obd/faultText';
import { ModuleDef, modulesFor } from '../obd/modules';
import { CarFault, CarRead, MOT_MODULE_IDS } from './rules';

type Group = 'vag' | 'ford' | 'mazda' | 'other';

// A health check this recent can stand in for reading the modules again.
export const REUSE_MS = 60 * 60 * 1000;

export function recentHealthCheck(entry: HistoryEntry | null | undefined, now = Date.now()): HistoryEntry | null {
  if (!entry || entry.kind !== 'scan' || entry.complete === false || entry.noAnswer) return null;
  return now - entry.at < REUSE_MS ? entry : null;
}

// A health check that can stand in for a car read at any age: it ran to the
// end and a module answered.
export function completeHealthCheck(entry: HistoryEntry | null | undefined): HistoryEntry | null {
  if (!entry || entry.kind !== 'scan' || entry.complete === false || entry.noAnswer) return null;
  return entry;
}

// When the car's data in an MOT read was read from the car: the health check
// it came from, or the read itself.
export function readTakenAt(read: Pick<CarRead, 'at' | 'from' | 'healthCheckAt'>): number {
  return read.from === 'health-check' && read.healthCheckAt ? read.healthCheckAt : read.at;
}

// The health check to use in place of the MOT's car read: a complete one that
// is newer than the read, so a fault cleared or found since is not missed.
// With no read yet, only a recent one is used by itself (recentHealthCheck).
export function newerHealthCheck(read: Pick<CarRead, 'at' | 'from' | 'healthCheckAt'> | null, last: HistoryEntry | null | undefined, now = Date.now()): HistoryEntry | null {
  if (!read) return recentHealthCheck(last, now);
  const check = completeHealthCheck(last);
  return check && check.at > readTakenAt(read) ? check : null;
}

// "4 minutes ago", "3 hours ago", "2 days ago".
export function ageText(at: number, now = Date.now()): string {
  const min = Math.max(0, Math.floor((now - at) / 60000));
  if (min < 1) return 'just now';
  if (min < 60) return `${min} minute${min === 1 ? '' : 's'} ago`;
  const hours = Math.floor(min / 60);
  if (hours < 48) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  return `${days} days ago`;
}

// The age of the car read, for the top of the MOT check.
export function readAgeLine(read: Pick<CarRead, 'at' | 'from' | 'healthCheckAt' | 'by'>, now = Date.now()): string {
  const what = read.from === 'health-check' && read.healthCheckAt ? 'From the health check' : read.by === 'learn' ? 'From Learn my car' : 'Car read';
  return `${what} ${ageText(readTakenAt(read), now)}`;
}

// The modules to ask: those with MOT-checked lamps or lamp circuits. Once a
// car's modules are known (3 or more answered before), only those are asked.
export function motModules(defs: ModuleDef[], seen?: string[]): ModuleDef[] {
  const known = (seen?.length ?? 0) >= 3 ? new Set(seen) : null;
  return defs.filter((d) => MOT_MODULE_IDS.includes(d.id) && (d.id === 'engine' || !known || known.has(d.id)));
}

// A recent health check's faults, by module name, as MOT input.
export function fromHealthCheck(entry: HistoryEntry, group: Group, live: { milOn: boolean | null; volts: number | null; monitorsIncomplete: number | null }, seen?: string[]): CarRead {
  const defs = modulesFor(group);
  const faults: CarFault[] = (entry.faults ?? []).map((f) => ({
    module: f.module,
    moduleId: f.module === 'Engine (OBD2)' ? 'engine' : defs.find((d) => d.name === f.module)?.id,
    code: f.code,
    text: f.text,
  }));
  return {
    at: Date.now(),
    from: 'health-check',
    healthCheckAt: entry.at,
    milOn: live.milOn,
    stored: [],
    pending: [],
    // The health check already added the OBD2 codes when the engine module was not read.
    engineModuleRead: true,
    faults,
    volts: live.volts,
    modulesAsked: entry.modules ?? 0,
    modulesAnswered: entry.modules ?? 0,
    // MOT modules this car has that the health check did not read.
    notRead: entry.read && (seen?.length ?? 0) >= 3 ? motModules(defs, seen).filter((d) => d.id !== 'engine' && !entry.read!.includes(d.name)).map((d) => d.name) : [],
    monitorsIncomplete: live.monitorsIncomplete,
    complete: true,
  };
}

export async function readCarForMot(
  client: ElmClient,
  group: Group,
  opts: { seen?: string[]; onStep?: (what: string, done: number, total: number) => void; cancelled?: () => boolean } = {},
): Promise<CarRead> {
  const step = opts.onStep ?? (() => undefined);
  step('the engine light', 0, 1);
  const status = await client.readStatus().catch(() => null);
  step('the engine codes', 0, 1);
  const codes = await client.readFaultCodes().catch(() => ({ stored: [] as string[], pending: [] as string[], permanent: [] as string[] }));
  const volts = await client.batteryVoltage().catch(() => null);
  const faults: CarFault[] = [];
  const notRead: string[] = [];
  let asked = 0;
  let answered = 0;
  let engineRead = false;
  let stopped = false;
  if (client.supportsModules && group !== 'other') {
    client.rememberModules(opts.seen);
    // On VW group cars this asks the gateway which modules are fitted first.
    const all = await client.modulesForCar(group).catch(() => modulesFor(group));
    const defs = motModules(all, opts.seen);
    for (let i = 0; i < defs.length; i++) {
      if (opts.cancelled?.()) {
        stopped = true;
        break;
      }
      const def = defs[i];
      step(def.name, i, defs.length);
      const r = await client.readModuleFaults(def).catch(() => ({ def, state: 'error' as const, faults: [], error: 'No reply' }));
      asked++;
      if (r.state === 'ok' || r.state === 'faults') {
        answered++;
        if (def.id === 'engine') engineRead = true;
      }
      // Not answering: on VW group cars the gateway listed it as fitted, and on
      // others the car answered it before, so it must not count as passing.
      else if (r.state === 'error' || group === 'vag' || opts.seen?.includes(def.id)) notRead.push(def.name);
      for (const f of r.faults) {
        faults.push({ module: def.name, moduleId: def.id, code: f.code, text: f.kwp ? faultText(f.code) : faultText(f.base || f.code), state: f.kwp ? undefined : f.state, warningLamp: f.warningLamp });
      }
    }
  }
  return {
    at: Date.now(),
    from: 'read',
    milOn: status ? status.milOn : null,
    stored: codes.stored,
    pending: codes.pending,
    engineModuleRead: engineRead,
    faults,
    volts,
    modulesAsked: asked,
    modulesAnswered: answered,
    notRead,
    monitorsIncomplete: status ? status.monitors.filter((m) => m.state === 'incomplete').length : null,
    complete: !stopped,
  };
}
