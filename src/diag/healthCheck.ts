// The health check, shared by the Health check screen and Learn my car, so
// both save the same History entry and car fields: Car tab, "See N faults",
// Lookup, the PDF report and the MOT check all read what this saves.
// Everything here is a read: nothing is cleared or written in the car.
import { addHistory, HistoryFault, loadHistory, updateHistory } from '../history';
import type { ElmClient, FaultCodes, ModuleDef, ModuleFaults } from '../obd/elm';
import { extrasFor } from '../obd/extras';
import type { Monitor } from '../obd/pids';
import { Tp20Module, tp20Name, TP20_CANDIDATES } from '../obd/tp20';
import type { Vehicle } from '../vehicle/garage';
import { extraObdCodes, faultMeaning } from './faults';
import { FreezeFrameRead, readFreezeFrames } from './freeze';
import { diffScans, previousFull, ScanDiff } from './scanDiff';

export const ENGINE_OBD = 'Engine (OBD2)';

export interface GarageLike {
  latest(vin: string): Vehicle | undefined;
  update(vin: string, patch: Partial<Vehicle>): Promise<void>;
}

export type CarStatus = { milOn: boolean; monitors: Monitor[]; diesel?: boolean };

export interface HealthCheckOpts {
  client: ElmClient;
  vin: string;
  garage: GarageLike;
  isCan: boolean;
  // Quick: only the modules this car has answered on before.
  quick?: boolean;
  // Read the odometer at the end (Learn my car reads it in its own step).
  odometer?: boolean;
  // Look for older VW modules (TP2.0) when this car has never been searched.
  olderSearch?: boolean;
  // Search again even though the car was searched before (Learn my car's full
  // read every 30 days), leaving out addresses that never answered.
  olderAgain?: boolean;
  olderSkip?: number[];
  // Module ids that never answered on this car: not asked (a module that
  // answered before is always asked).
  skipModules?: Set<string>;
  // The engine light and self-tests; the screens pass the connection's own
  // read so the Car tab updates too.
  readStatus?: () => Promise<CarStatus | null>;
  cancelled?: () => boolean;
  // Where the check is, in words ("the freeze frames").
  onStep?: (what: string | null) => void;
  onObd?: (codes: FaultCodes, freeze: FreezeFrameRead[], error: string | null) => void;
  onModule?: (r: ModuleFaults, done: number, total: number, next?: ModuleDef) => void;
  // After the History entry is saved, before the older-module search.
  onSaved?: (r: HealthCheckResult) => void;
  onOlderStart?: () => void;
  onOlderProgress?: (done: number, total: number) => void;
  onOlderModule?: (m: Tp20Module) => void;
}

export interface HealthCheckResult {
  volts: number | null;
  codes: FaultCodes;
  obdRead: boolean;
  obdError: string | null;
  freeze: FreezeFrameRead[];
  status: CarStatus | null;
  results: ModuleFaults[];
  withModules: boolean;
  answered: number;
  // Every fault code counted, and the same faults with module and meaning.
  codesCounted: string[];
  logged: HistoryFault[];
  read: string[];
  noAnswer: boolean;
  stopped: boolean;
  odometerKm?: number;
  historyId: string | null;
  diff: ScanDiff | null;
  // The older-module search, when it ran.
  older: Tp20Module[] | null;
  olderError: string | null;
  // Asked and not answering, never seen before: module ids, and older-protocol
  // addresses from the older-module search.
  silentModules: string[];
  silentOlder: number[];
}

const sayError = (e: unknown) => (e instanceof Error ? e.message : String(e));

// The name an older module goes by in fault lists.
export function olderName(client: Pick<ElmClient, 'moduleById'>, m: Pick<Tp20Module, 'address' | 'moduleId'>): string {
  return (m.moduleId && client.moduleById(m.moduleId)?.name) || tp20Name(m.address);
}

// Older modules found by a search, saved on the car so Customise, Workshop and
// the next health check know them.
export async function saveOlderModules(garage: GarageLike, vin: string, found: Tp20Module[]): Promise<void> {
  const at = Date.now();
  const fresh = found.filter((m) => m.moduleId && !m.error).map((m) => ({ address: m.address, moduleId: m.moduleId!, part: m.part ?? null, component: m.component ?? null, faults: m.faults.length, at }));
  const kept = (garage.latest(vin)?.deepFound ?? []).filter((d) => !fresh.some((f) => f.address === d.address));
  await garage.update(vin, { deepFound: [...kept, ...fresh].sort((a, b) => a.address - b.address) });
}

// Adds older modules found after a check was saved to that check: its History
// entry (faults, modules read and answered) and, for a check that ran to the
// end, the car's saved fault list. Modules the check already read are skipped.
export async function addOlderToCheck(
  opts: { client: Pick<ElmClient, 'moduleById'>; garage: GarageLike; vin: string; brand?: string | null },
  check: Pick<HealthCheckResult, 'historyId' | 'logged' | 'read' | 'answered' | 'codesCounted' | 'stopped' | 'noAnswer'>,
  found: Tp20Module[],
): Promise<{ logged: HistoryFault[]; read: string[]; answered: number; codesCounted: string[] }> {
  const fresh = found.filter((m) => !m.error && !check.read.includes(olderName(opts.client, m)));
  const names = fresh.map((m) => olderName(opts.client, m));
  const extra: HistoryFault[] = fresh.flatMap((m) => m.faults.map((f) => ({ module: olderName(opts.client, m), code: f.code, text: faultMeaning(f.code, { module: olderName(opts.client, m), brand: opts.brand }).title })));
  const logged = [...check.logged, ...extra];
  const read = [...check.read, ...names];
  const answered = check.answered + names.length;
  const codesCounted = [...check.codesCounted, ...extra.map((f) => f.code)];
  if (!fresh.length) return { logged, read, answered, codesCounted };
  if (check.historyId) {
    // The saved line says the same count as the result: "7 modules answered".
    const said = `${answered} module${answered === 1 ? '' : 's'} answered`;
    const before = (await loadHistory(opts.vin)).find((e) => e.id === check.historyId)?.detail;
    const detail = before && /^\d+ modules? answered/.test(before) ? before.replace(/^\d+ modules? answered/, said) : undefined;
    await updateHistory(check.historyId, {
      faults: logged,
      read,
      modules: answered,
      title: titleFor(logged.length, check.noAnswer && answered === 0),
      ...(check.noAnswer && answered > 0 ? { noAnswer: false, detail: said } : detail ? { detail } : {}),
    });
  }
  if (!check.stopped) await opts.garage.update(opts.vin, { lastCodes: codesCounted, lastCheckedAt: Date.now() });
  return { logged, read, answered, codesCounted };
}

const titleFor = (faults: number, noAnswer: boolean) => (faults ? `${faults} fault${faults === 1 ? '' : 's'} found` : noAnswer ? 'No control module answered' : 'No faults found');

export async function runHealthCheck(o: HealthCheckOpts): Promise<HealthCheckResult> {
  const { client, vin, garage } = o;
  const step = o.onStep ?? (() => undefined);
  const halted = () => !!o.cancelled?.();
  const vehicle = garage.latest(vin);
  const group = vehicle?.group ?? 'other';
  const withModules = client.supportsModules && group !== 'other';

  step('the battery and engine light');
  const volts = await client.batteryVoltage().catch(() => null);
  if (volts != null) await garage.update(vin, { battery: { volts, at: Date.now(), from: 'Health check' } });
  step('the engine emissions codes');
  // A bad reply here must not stop the module check that follows.
  let obdError: string | null = null;
  const codes = await client.readFaultCodes().catch((e) => {
    obdError = sayError(e);
    return { stored: [], pending: [], permanent: [] } as FaultCodes;
  });
  const obdRead = obdError == null;
  step('the freeze frames');
  const freeze = await readFreezeFrames(client, { isCan: o.isCan }).catch(() => [] as FreezeFrameRead[]);
  const status = await (o.readStatus ?? (() => client.readStatus()))().catch(() => null);
  o.onObd?.(codes, freeze, obdError);

  // Saved count matches the one shown: module faults, plus the engine's
  // standard codes that no module reported.
  const codesCounted: string[] = [];
  const logged: HistoryFault[] = [];
  // The modules read, so the comparison with the last check knows which
  // faults could have been seen.
  const read: string[] = obdRead ? [ENGINE_OBD] : [];
  const results: ModuleFaults[] = [];
  const seenBefore = new Set(vehicle?.modulesSeen ?? []);
  const silentModules: string[] = [];
  const silentOlder: number[] = [];
  let answered = 0;
  if (withModules && !halted()) {
    client.rememberModules(vehicle?.modulesSeen);
    step('the control modules');
    await client.scanAllFaults(
      group,
      (r, done, total, next) => {
        results.push(r);
        // Remembered as silent only on a clean NO DATA from a module not known
        // on this connection; a Bluetooth stall or a module identified earlier
        // in the run is asked again next time.
        if (r.state === 'no-answer' && !r.timedOut && !seenBefore.has(r.def.id) && !client.knowsModule(r.def.id)) silentModules.push(r.def.id);
        codesCounted.push(...r.faults.map((f) => f.code));
        logged.push(...r.faults.map((f) => ({ module: r.def.name, code: f.code, text: faultMeaning(f.code, { module: r.def.name, brand: vehicle?.brand }).title })));
        if (r.state === 'ok' || r.state === 'faults') {
          answered++;
          read.push(r.def.name);
        }
        o.onModule?.(r, done, total, next);
      },
      halted,
      { knownOnly: o.quick, skip: o.skipModules },
    );
  }
  // The engine's standard codes count too, each once: a code a module
  // already reported (P0300 as VW 16684) is not counted again.
  const extra = extraObdCodes(codesCounted, [...codes.stored, ...codes.pending]);
  codesCounted.push(...extra);
  logged.push(...extra.map((c) => ({ module: ENGINE_OBD, code: c, text: faultMeaning(c, { module: ENGINE_OBD }).title })));
  // The odometer too, so service reminders and History have the distance.
  let odometerKm = vehicle?.odometerKm;
  if (o.odometer !== false && group !== 'other' && !halted()) {
    step('the odometer');
    const km = await readOdometer(client, group).catch(() => null);
    if (km != null) {
      odometerKm = km;
      await garage.update(vin, { odometerKm: km, odometerAt: Date.now() });
    }
  }
  const stopped = halted();
  // No control module answered: saved like any other check, but marked, so
  // it is not read as "no faults".
  const noAnswer = withModules && answered === 0 && !stopped;
  const milOn = status?.milOn ?? vehicle?.lastMilOn ?? false;
  const light = milOn ? '; engine light on' : '';
  const at = Date.now();
  const before = previousFull(await loadHistory(vin), { at, vin });
  const diff = diffScans(before, { faults: logged, read });
  const historyId = await addHistory({
    vin,
    at,
    kind: 'scan',
    title: titleFor(logged.length, noAnswer),
    detail: noAnswer ? `No control module answered; only the engine's standard codes were read${light}` : withModules ? `${answered} module${answered === 1 ? '' : 's'} answered${light}` : `Engine computer only${light}`,
    faults: logged,
    modules: answered,
    complete: !stopped,
    noAnswer,
    read,
    odometerKm,
  });
  const fresh = garage.latest(vin);
  // A check that ran to the end replaces the saved result; one stopped early
  // stays in History only, so leaving the screen part-way never hides
  // faults an earlier full check found.
  await garage.update(vin, {
    ...(stopped ? {} : { lastCodes: [...codesCounted], lastMilOn: milOn, lastCheckedAt: Date.now() }),
    ...(withModules ? { modulesSeen: client.modulesSeen, routes: client.exportRoutes() } : {}),
    // A full check counts only when the car was answering (the engine did).
    ...(withModules && !o.quick && !stopped && answered >= 1 ? { fullChecks: (fresh?.fullChecks ?? 0) + 1, fullCheckAt: Date.now() } : {}),
  });
  const result: HealthCheckResult = {
    volts,
    codes,
    obdRead,
    obdError,
    freeze,
    status,
    results,
    withModules,
    answered,
    codesCounted,
    logged,
    read,
    noAnswer,
    stopped,
    odometerKm,
    historyId,
    diff,
    older: null,
    olderError: null,
    silentModules,
    silentOlder,
  };
  o.onSaved?.(result);

  // First check on a VW group car: also look for older-protocol modules once.
  // They are saved on the car and read with the rest after that; what they
  // hold is added to this check's History entry and saved fault list.
  if (o.olderSearch && withModules && group === 'vag' && !stopped && !halted() && (!garage.latest(vin)?.deepFound || o.olderAgain)) {
    o.onOlderStart?.();
    step('the older VW modules');
    try {
      const addresses = TP20_CANDIDATES.filter((a) => !o.olderSkip?.includes(a));
      const found = await client.deepScan(addresses, o.onOlderProgress, o.onOlderModule, (a) => silentOlder.push(a));
      await saveOlderModules(garage, vin, found);
      const added = await addOlderToCheck({ client, garage, vin, brand: vehicle?.brand }, result, found);
      Object.assign(result, added, { older: found });
      await garage.update(vin, { modulesSeen: client.modulesSeen, routes: client.exportRoutes() });
    } catch (e) {
      result.olderError = sayError(e);
    }
  }
  step(null);
  return result;
}

// The odometer from the car's maker values (km), or null when it gave none.
export async function readOdometer(client: ElmClient, group: 'vag' | 'ford' | 'mazda' | 'other'): Promise<number | null> {
  const distance = extrasFor(group).filter((e) => e.category === 'Distance');
  if (!distance.length) return null;
  const odo = await client.readExtras(distance).catch(() => ({}) as Record<string, number>);
  const first = distance.find((e) => odo[e.id] != null);
  return first ? odo[first.id] : null;
}
