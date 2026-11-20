// Learn my car: one button that reads the car, in order, and saves each result
// where its own screen reads it (Health check, Customise, Live data, Emissions
// self-tests, MOT check, Battery test, Service). Read-only: no faults cleared,
// no coding written, no routines run. A step that fails is logged and the next
// one runs; Stop keeps what was found and still saves.
//
// The first run reads everything. Later runs refresh only what changes
// (faults of every module, emissions and readiness, the MOT read, battery and
// odometer) and carry on exploring values where the last run stopped. Module
// identities and codings, the sensor search and the address search run again
// for a new or missing module, after 30 days, or when the owner asks.
// The app has no AI features (owner's choice, 15 Nov 2026).
import { addSample, afterQuick, Discovery, loadDiscovery, quickDone, quickExploreRanges, quickResume, saveDiscovery } from '../discover';
import { addOlderToCheck, CarStatus, GarageLike, HealthCheckResult, readOdometer, runHealthCheck } from '../diag/healthCheck';
import { readEmissions, saveEmissions } from '../diag/emissionsStore';
import { addHistory, loadHistory } from '../history';
import { fromHealthCheck, readCarForMot } from '../mot/read';
import { loadDraft, saveDraft } from '../mot/store';
import { engineLast } from '../obd/elm';
import type { ElmClient, ModuleDef, ModuleDetails } from '../obd/elm';
import { readKey, sensorsForCar } from '../obd/sensors';
import { quickRows, remainingRows, sharedSensorKeys } from '../obd/sharedSensors';
import { toHex } from '../obd/uds';
import { mergeCodingBackup, mergeModuleIds } from '../vehicle/ids';
import { inferredFromParts, Vehicle, vehicleTitle } from '../vehicle/garage';
import { groupValuesText, moduleCount, modulesText, sensorCount, sensorCountText } from '../vehicle/counts';
import { scanValueGroups } from './valueGroups';
import { dateText, shortDuration } from '../timeText';

export type LearnStep = 'modules' | 'faults' | 'sensors' | 'values' | 'emissions' | 'mot' | 'battery' | 'send';
// The order the steps run in: what every other screen needs first (modules,
// faults), then the slow exploring, then the quick reads with the engine warm.
export const LEARN_ORDER: LearnStep[] = ['modules', 'faults', 'sensors', 'values', 'emissions', 'mot', 'battery', 'send'];

// A full read is due again after this long.
export const FULL_READ_DAYS = 30;
const FULL_READ_MS = FULL_READ_DAYS * 86400000;
// The values step's share of each run: it carries on from where it stopped.
export const VALUES_LIMIT_MS = 150000;

// done: finished (gets a tick). partial: ran to its time limit and carries on
// next time. stopped: Stop was pressed during it. failed: an error, logged,
// and the run carried on. skipped: not run (Stop, or nothing to do).
export type StepState = 'done' | 'partial' | 'stopped' | 'failed' | 'skipped';
export interface StepOutcome {
  state: StepState;
  note?: string;
  ms: number;
}

// What this run does: everything (first run, after 30 days, or asked for), or
// a repeat run that refreshes what changes.
export interface LearnMode {
  full: boolean;
  why: 'first' | 'old' | 'asked' | 'repeat';
}

export function learnMode(v: Pick<Vehicle, 'learnFullAt'>, opts: { everything?: boolean; now?: number } = {}): LearnMode {
  const now = opts.now ?? Date.now();
  if (opts.everything) return { full: true, why: 'asked' };
  if (!v.learnFullAt) return { full: true, why: 'first' };
  if (now - v.learnFullAt > FULL_READ_MS) return { full: true, why: 'old' };
  return { full: false, why: 'repeat' };
}

// Addresses that never answered, still trusted on this run: kept until the
// next full read after 30 days or on request, which asks every address again.
export function silentToSkip(v: Pick<Vehicle, 'learnSilent'>, mode: LearnMode, now = Date.now()): { modules: string[]; addresses: string[]; tp20: number[] } {
  const s = v.learnSilent;
  if (!s || mode.why === 'old' || mode.why === 'asked' || now - s.at > FULL_READ_MS) return { modules: [], addresses: [], tp20: [] };
  return { modules: [...s.modules], addresses: [...s.addresses], tp20: [...s.tp20] };
}

export interface LearnSummary {
  steps: Partial<Record<LearnStep, StepOutcome>>;
  // Set when the run could not start or had to end (car not answering).
  aborted?: string;
  stopped: boolean;
  // What this run did: a full read or a repeat run.
  mode: LearnMode;
  modules: number;
  // Modules with a coding backed up (on this run or before).
  codings: number;
  sensors: number;
  groupValues: number;
  // Value groups that hold those values (older VW modules).
  groups: number;
  faults: number | null;
  sent: { via: string; detail: string } | null;
  minutes: number;
}

export interface LearnDeps {
  client: ElmClient;
  vin: string;
  garage: GarageLike & { vehicles: Vehicle[] };
  isCan: boolean;
  // Read everything again: identities, codings, sensors, every address, values.
  everything?: boolean;
  // Send what this run finds (the Learn my car switch).
  send: boolean;
  readStatus?: () => Promise<CarStatus | null>;
  cancelled: () => boolean;
  onStep?: (step: LearnStep, outcome: StepOutcome | 'running') => void;
  onProgress?: (value: number, label: string) => void;
  // After each step, the adapter log goes when sending is on.
  log?: (reason: string) => void;
  sendBack?: (kind: string, vin: string, data: unknown) => Promise<{ via: string; detail: string }>;
  // The value step's time limit (VALUES_LIMIT_MS); shorter in tests.
  valuesLimitMs?: number;
  // Wait before a second ask of a module that answered before (1.2 s).
  retryWaitMs?: number;
}

// The run cannot go on: nothing more can be read.
export class LearnAbort extends Error {}

// What Learn my car records about each module, sent back with the scan.
interface ModuleFacts {
  id: string;
  name: string;
  code?: string;
  part?: string | null;
  software?: string | null;
  system?: string | null;
  coding?: string | null; // hex
  route?: string | null;
  tx: string;
  rx: string;
}

// Value numbers swept per module: Unknown values' quick explore
// (quickExploreRanges in discover.ts), in the same store, so either screen
// carries on where the other stopped. Its full explore covers far wider ranges.

// The same module listed twice (two makes' lists share an address): one entry.
const sameModule = (a: ModuleDef, b: ModuleDef) => a.id === b.id || (!!a.tx && a.tx === b.tx && a.rx === b.rx);

const sayError = (e: unknown) => (e instanceof Error ? e.message : String(e));
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
// A module name inside a sentence: "the engine", but "the ABS and stability control".
const inText = (name: string) => name.replace(/^[A-Z](?=[a-z])/, (c) => c.toLowerCase());
const day = (ms: number) => dateText(ms);
// "2.5-minute", "3-minute".
const minutesText = (ms: number) => `${Math.round(ms / 6000) / 10 || 1}`;

// Modules whose identity Caristini already has for this car.
const identifiedIds = (v: Vehicle) => new Set([...(v.ids?.modules ?? []).map((m) => m.id), ...Object.keys(v.knowledge ?? {})]);

// The adapter's pace for the estimate: measured on this connection or the
// last run, else the slower of the owner's two adapters (Leon log, 15 Nov).
export interface LearnPace {
  // Adapter command round trip (s).
  link: number;
  // Cost of a request nothing answers (s): the adapter's wait plus the link.
  silent: number;
}
const DEFAULT_PACE: LearnPace = { link: 0.06, silent: 0.27 };

// Seconds each step usually takes on this car, low and high, for the time
// shown before and during a run. The last run of the same kind is the best
// guide; without one, the work each step has to do at the adapter's pace
// (request costs from replica/learn-speed-2026-11-16.md).
export function learnEstimate(
  v: Vehicle,
  others: Vehicle[] = [],
  opts: { everything?: boolean; pace?: { linkMs: number; silentMs: number } | null; now?: number } = {},
): Record<LearnStep, [number, number]> {
  const mode = learnMode(v, opts);
  const refresh = mode.why === 'old' || mode.why === 'asked';
  const p: LearnPace = opts.pace ? { link: opts.pace.linkMs / 1000, silent: opts.pace.silentMs / 1000 } : v.learnPace ? { link: v.learnPace.linkMs / 1000, silent: v.learnPace.silentMs / 1000 } : DEFAULT_PACE;
  const pq35 = v.platform === 'PQ35';
  const known = new Set([...(v.modulesSeen ?? []), ...(v.deepFound ?? []).map((d) => d.moduleId)]);
  const mods = known.size >= 3 ? known.size : pq35 ? 8 : 20;
  const older = pq35 ? mods : [...known].filter((id) => v.routes?.[id]?.via === 'tp20').length;
  const newer = Math.max(0, mods - older);
  const silent = silentToSkip(v, mode);
  // Unit costs (s): an answered request, a request with no answer, one older
  // VW frame exchange (listen time 100 ms), one module's identity and fault read.
  const ask = p.link + 0.03;
  const frame = 0.12 + p.link;
  const idNewer = 6 * p.link + 7 * ask;
  const idOlder = 6 * p.link + 0.06 + 6 * frame;
  const faultNewer = 2 * p.link + p.silent;
  const faultOlder = 5 * p.link + 0.06 + 5 * frame;
  const askAll = mode.full && !pq35 && (refresh || (v.modulesSeen?.length ?? 0) < 3);
  const probe = askAll ? (254 - silent.addresses.length) * (2 * p.link + p.silent) : 0;
  const olderSearch = v.group === 'vag' && (!v.deepFound || refresh) ? (28 - silent.tp20.length) * (2 * p.link + 2 * frame) : 0;
  const all = pq35 ? [] : sensorsForCar(v, others);
  const asked = new Set(refresh ? (v.sensorsFound ?? []) : [...(v.sensorsAsked ?? []), ...(v.sensorsFound ?? [])]);
  const shared = sharedSensorKeys(v, others);
  const searchDone = !!v.sensorScan?.complete && !refresh;
  const rows = !all.length || searchDone ? 0 : (shared.size ? quickRows(all, shared, asked) : remainingRows(all, asked)).length;
  const explore = v.learnExplored && !refresh ? [0, 5] : [60, VALUES_LIMIT_MS / 1000];
  const model: Record<LearnStep, [number, number]> = {
    modules: mode.full ? [newer * idNewer + older * idOlder + probe, 2.5 * (newer * idNewer + older * idOlder) + 1.3 * probe] : [0, 2],
    faults: [6 * ask + newer * faultNewer + older * faultOlder + olderSearch, 2 * (6 * ask + newer * faultNewer + older * faultOlder) + 1.5 * olderSearch + (pq35 ? 6 : 0)],
    sensors: mode.full || !searchDone ? [rows * ask, rows * (p.link + p.silent)] : [0, 2],
    values: explore as [number, number],
    emissions: [3, 15],
    mot: [0, 3],
    battery: [0.5, 3],
    send: [1, 10],
  };
  // The last run of the same kind, where it ran to the end.
  const last = v.learnTimes?.[mode.full ? 'first' : 'repeat'];
  if (!last) return model;
  const out = { ...model };
  for (const s of LEARN_ORDER) {
    const t = last[s];
    if (t == null || s === 'values') continue;
    out[s] = [t * 0.8, t * 1.25 + 1];
  }
  return out;
}

// Seconds for the whole run (or some steps), low and high; aboutRange in
// src/timeText.ts says it in words.
export function estimateSeconds(est: Record<LearnStep, [number, number]>, steps: LearnStep[] = LEARN_ORDER): [number, number] {
  return [steps.reduce((n, s) => n + est[s][0], 0), steps.reduce((n, s) => n + est[s][1], 0)];
}

// Minutes for the whole run, low and high, rounded to whole minutes.
export function estimateMinutes(est: Record<LearnStep, [number, number]>, steps: LearnStep[] = LEARN_ORDER): [number, number] {
  const lo = steps.reduce((n, s) => n + est[s][0], 0);
  const hi = steps.reduce((n, s) => n + est[s][1], 0);
  return [Math.max(1, Math.round(lo / 60)), Math.max(1, Math.ceil(hi / 60))];
}

// After a first run: "First read done: 4 faults, 7 modules". Later runs say
// how long they took.
export function learnSummaryHeader(s: Pick<LearnSummary, 'mode' | 'stopped' | 'faults' | 'modules' | 'minutes'>): string {
  const ended = s.stopped ? 'stopped early' : 'done';
  if (s.mode.why === 'first') {
    const faults = s.faults == null ? null : `${s.faults} fault${s.faults === 1 ? '' : 's'}`;
    return `First read ${ended}: ${[faults, modulesText(s.modules)].filter(Boolean).join(', ')}`;
  }
  return `${s.mode.full ? 'Full read' : 'Repeat run'} ${ended} in ${shortDuration(s.minutes * 60000)}`;
}

export async function runLearn(d: LearnDeps): Promise<LearnSummary> {
  const { client, vin, garage } = d;
  const started = Date.now();
  const halted = () => d.cancelled();
  const progress = (value: number, label: string) => d.onProgress?.(Math.max(0, Math.min(1, value)), label);
  const log = d.log ?? (() => undefined);
  const v0 = garage.latest(vin);
  if (!v0) throw new Error('This car is not saved on the phone yet. Connect to it again.');
  const mode = learnMode(v0, { everything: d.everything });
  // A full read after 30 days or on request: every address, sensor and value again.
  const refresh = mode.why === 'old' || mode.why === 'asked';
  const steps: Partial<Record<LearnStep, StepOutcome>> = {};
  const summary: LearnSummary = { steps, stopped: false, mode, modules: 0, codings: 0, sensors: 0, groupValues: 0, groups: 0, faults: null, sent: null, minutes: 0 };

  const knowledge = { ...(v0.knowledge ?? {}) };
  const identified = identifiedIds(v0);
  const facts: ModuleFacts[] = [];
  const found = new Set(v0.sensorsFound ?? []);
  // Everything already asked on this car, by the sensor search or Learn my
  // car; a full refresh asks again.
  const asked = new Set(refresh ? [...found] : [...(v0.sensorsAsked ?? []), ...found]);
  // Addresses that never answered: not asked again until the next full read.
  const skip = silentToSkip(v0, mode);
  const silent = { at: v0.learnSilent && skip.modules.length + skip.addresses.length + skip.tp20.length ? v0.learnSilent.at : Date.now(), modules: new Set(skip.modules), addresses: new Set(skip.addresses), tp20: new Set(skip.tp20) };
  // Modules this run found for the first time; their sensors and values are explored too.
  const fresh: ModuleDef[] = [];
  // VW PQ35 cars: modules speak the older protocol (TP2.0) only, so the
  // newer-protocol (UDS) address search and sensor list are skipped; the
  // gateway's own module list (TP2.0 1A 9F) says what is fitted.
  const pq35 = v0.platform === 'PQ35';
  const all = pq35 ? [] : sensorsForCar(v0, garage.vehicles);
  const shared = sharedSensorKeys(v0, garage.vehicles);
  // Values read from older VW modules' measuring groups on this run, sent back.
  const groupSamples: Record<string, Record<string, string>> = {};
  let disc: Discovery | null = null;
  let check: HealthCheckResult | null = null;
  let status: CarStatus | null = null;

  // Identity and coding of each module in turn; modules that do not answer are left out.
  const readModules = async (defs: ModuleDef[], known: Set<string>, from: number, span: number): Promise<ModuleDetails[]> => {
    const read: ModuleDetails[] = [];
    for (const [i, def] of defs.entries()) {
      if (halted()) break;
      progress(from + (i / defs.length) * span, `Asking ${inText(def.name)}`);
      let m = await client.readModuleDetails(def).catch(() => null);
      // A module that answered before gets a second ask after a short wait:
      // one missed reply must not write it off.
      if (!m?.responded && known.has(def.id) && !halted()) {
        await new Promise((r) => setTimeout(r, d.retryWaitMs ?? 1200));
        m = await client.readModuleDetails(def).catch(() => null);
      }
      if (!m?.responded) continue;
      const coding = m.coding ?? (await client.readCoding(def).then((c) => (c ? toHex(c) : null)).catch(() => null));
      read.push({ ...m, coding });
      facts.push({ id: def.id, name: def.name, code: def.code, part: m.partNumber, software: m.software, system: m.systemName, coding, route: m.route ?? null, tx: def.tx, rx: def.rx });
      // The name the module has now; a part number read before is kept when this read gave none.
      knowledge[def.id] = { plainName: def.name, what: knowledge[def.id]?.what ?? '', notes: knowledge[def.id]?.notes, part: m.partNumber || knowledge[def.id]?.part || null, at: Date.now() };
    }
    return read;
  };
  // Saved the way Read part numbers saves them, so Parts and IDs and
  // Customise have them: identities, the coding backup, and the coding of
  // newer-protocol modules for Customise to open with.
  const saveModules = async (read: ModuleDetails[]) => {
    const now = garage.latest(vin);
    const mine = facts.filter((f) => read.some((r) => r.def.id === f.id));
    const codingCache = Object.fromEntries(mine.filter((f) => f.coding && f.route !== 'tp20' && /^([0-9A-F]{2})+$/.test(f.coding)).map((f) => [f.id, f.coding!]));
    const codingBackup = mergeCodingBackup(now?.codingBackup, mine.map((f) => ({ module: f.name, part: f.part ?? null, coding: f.coding ?? null })));
    await garage.update(vin, {
      knowledge,
      ids: { ...(now?.ids ?? {}), modules: mergeModuleIds(now?.ids?.modules, read) },
      ...(codingBackup ? { codingBackup } : {}),
      codingCache: { ...(now?.codingCache ?? {}), ...codingCache },
    });
    countModules();
  };
  // Step 1's line: the one module count, and codings backed up.
  const modulesNote = () => `${modulesText(summary.modules)}, ${plural(summary.codings, 'coding')} backed up`;
  // Modules known for this car (this run and before), and codings backed up.
  const countModules = () => {
    const now = garage.latest(vin);
    // The one module count (vehicle/counts.ts), with this run's reads.
    summary.modules = Math.max(moduleCount(now ?? v0), new Set([...identifiedIds(now ?? v0), ...facts.map((f) => f.id)]).size);
    summary.codings = now?.codingBackup?.modules.filter((m) => m.coding).length ?? facts.filter((f) => f.coding).length;
  };

  // Each step: its own work, then 'done' unless it says otherwise. An error
  // is logged against the step and the run carries on.
  type Work = () => Promise<{ state?: StepState; note?: string } | void>;
  const work: Record<LearnStep, Work> = {
    // 1. Modules: identity and coding backup of every module. A repeat run
    // keeps what is known; the health check that follows asks every module,
    // and a new or missing one is read there.
    modules: async () => {
      if (!mode.full) {
        countModules();
        return { note: `Known since ${day(v0.learnFullAt!)}: ${modulesText(summary.modules)}. Read again for a new or missing module, or after ${FULL_READ_DAYS} days.` };
      }
      const listed = v0.group === 'other' ? [] : await client.modulesForCar(v0.group);
      client.rememberModules(v0.modulesSeen);
      // Every address is asked when the car's modules are not known yet (no
      // health check has run), on a full refresh, or when asked for.
      const known = new Set(v0.modulesSeen ?? []);
      const askAll = !pq35 && (refresh || known.size < 3);
      // Modules that answered before go first; ones never seen are asked last;
      // older VW modules with the engine at the end (see engineLast). Raw CAN
      // stays on between older VW modules.
      const order = (defs: ModuleDef[]) => engineLast([...defs.filter((x) => known.has(x.id)), ...defs.filter((x) => !known.has(x.id) && !silent.modules.has(x.id))]);
      let read = await client.holdOlder(() => readModules(order(listed), known, 0, askAll ? 0.4 : 1));
      // Then every other address. The listed modules' answers have timed the
      // link, so silent addresses get the measured wait (pace.ts).
      if (askAll && !halted()) {
        progress(0.4, 'Asking every address who is there');
        const probed = await client.findAnyModules({
          cancelled: halted,
          skip: silent.addresses,
          onSilent: (tx) => silent.addresses.add(tx),
          onProgress: (n, total) => progress(0.4 + (n / total) * 0.4, `Checking address ${n + 1} of ${total}`),
        });
        const extra = probed.filter((p) => !listed.some((l) => sameModule(l, p)));
        read = [...read, ...(await readModules(extra, known, 0.8, 0.2))];
      }
      // Fewer than half the modules a health check found answered: the car went
      // quiet (ignition off, low battery). End here and keep the earlier results.
      const answeredKnown = facts.filter((f) => known.has(f.id)).length;
      if (!halted() && known.size >= 4 && answeredKnown < known.size / 2) {
        log('Learn my car: modules silent');
        throw new LearnAbort(`Only ${answeredKnown} of the ${known.size} modules your health check found answered this time, so nothing was saved over your earlier results. Check the ignition is on (engine running is best), then run Learn my car again.`);
      }
      await saveModules(read);
      // A car that gave no VIN: model and platform from its part numbers.
      const after = garage.latest(vin);
      const fill = after ? inferredFromParts(after) : null;
      if (fill) await garage.update(vin, fill);
      countModules();
      return { note: modulesNote() };
    },

    // 2. Faults: the full health check, saved exactly as the Health check
    // screen saves it. Every module that answered before is asked; addresses
    // that never answered are left out until the next full read.
    faults: async () => {
      check = await runHealthCheck({
        client,
        vin,
        garage,
        isCan: d.isCan,
        quick: false,
        odometer: false,
        olderSearch: true,
        olderAgain: refresh,
        olderSkip: [...silent.tp20],
        skipModules: silent.modules,
        readStatus: d.readStatus,
        cancelled: halted,
        onStep: (what) => what && progress(0.05, `Reading ${what}`),
        onModule: (_r, n, total, next) => {
          progress(0.1 + (n / total) * 0.6, next ? `Reading ${inText(next.name)}` : 'Saving the result');
        },
        onOlderStart: () => progress(0.7, 'Looking for older VW modules'),
        onOlderProgress: (n, total) => progress(0.7 + (total ? n / total : 1) * 0.3, 'Looking for older VW modules'),
      });
      const c = check as HealthCheckResult;
      status = c.status;
      summary.faults = c.logged.length;
      for (const id of c.silentModules) silent.modules.add(id);
      for (const a of c.silentOlder) silent.tp20.add(a);
      let what = `${plural(c.logged.length, 'fault')}, ${plural(c.answered, 'module')} answered`;
      // Modules that answered and whose identity is not known yet: older
      // modules this check found for the first time, and on a repeat run any
      // new module. Their identity and coding backup are read now.
      const answeredIds = new Set(c.results.filter((r) => r.state === 'ok' || r.state === 'faults').map((r) => r.def.id));
      const have = new Set([...identified, ...facts.map((f) => f.id)]);
      const olderNew = (c.older ?? []).flatMap((m) => (m.moduleId && !m.error && !have.has(m.moduleId) ? [client.moduleById(m.moduleId)].filter((x): x is ModuleDef => !!x) : []));
      const newer = c.results.filter((r) => answeredIds.has(r.def.id) && !have.has(r.def.id) && !olderNew.some((o) => o.id === r.def.id)).map((r) => r.def);
      // Missing: a module known before that did not answer this check. Its
      // faults are asked once more after a pause and added to the check; one
      // still silent sends the address search round again on a newer-protocol
      // car (quick: addresses that never answered are left out), in case it moved.
      const missing = mode.full ? [] : [...identified].filter((id) => (v0.modulesSeen ?? []).includes(id) && !answeredIds.has(id)).map((id) => client.moduleById(id)).filter((x): x is ModuleDef => !!x);
      const gone: ModuleDef[] = [];
      if (missing.length && !halted()) {
        progress(0.85, 'Asking missing modules again');
        await new Promise((r) => setTimeout(r, d.retryWaitMs ?? 1200));
        const back: { address: number; moduleId: string; faults: { code: string; status: number }[] }[] = [];
        for (const m of missing) {
          const r = await client.readModuleFaults(m).catch(() => null);
          if (r && (r.state === 'ok' || r.state === 'faults')) back.push({ address: 0, moduleId: m.id, faults: r.faults.map((f) => ({ code: f.code, status: 0 })) });
          else gone.push(m);
        }
        if (back.length) {
          Object.assign(c, await addOlderToCheck({ client, garage, vin, brand: v0.brand }, c, back));
          summary.faults = c.logged.length;
          what = `${plural(c.logged.length, 'fault')}, ${plural(c.answered, 'module')} answered`;
        }
      }
      if (gone.length && !pq35 && v0.group !== 'other' && !halted()) {
        progress(0.9, 'Looking for missing modules');
        const probed = await client.findAnyModules({ cancelled: halted, skip: silent.addresses, onSilent: (tx) => silent.addresses.add(tx) });
        for (const p of probed) if (!have.has(p.id) && ![...newer, ...olderNew].some((x) => sameModule(x, p))) newer.push(p);
      }
      const toRead = [...newer, ...olderNew];
      if (toRead.length && !halted()) {
        const read = await client.holdOlder(() => readModules(toRead, new Set(), 0.9, 0.1));
        await saveModules(read);
        fresh.push(...toRead.filter((m) => read.some((r) => r.def.id === m.id)));
        if (fresh.length) what += `; ${plural(fresh.length, mode.full ? 'older VW module' : 'new module')} added to the backup`;
        // Step 1's count takes in the modules this check added, so every
        // screen says the same number.
        if (fresh.length && mode.full && steps.modules?.state === 'done') {
          steps.modules = { ...steps.modules, note: modulesNote() };
        }
      }
      if (gone.length) what += `; not answering: ${gone.map((m) => m.name).join(', ')}`;
      if (!mode.full) countModules();
      if (c.stopped) return { state: 'stopped', note: `${what}; saved in History as stopped early` };
      if (c.noAnswer) return { state: 'failed', note: 'No control module answered, so this is not a clean result. Only the engine’s standard codes were read.' };
      return { note: c.olderError ? `${what}. The search for older VW modules stopped: ${c.olderError}` : what };
    },

    // 3. Known sensors: the full search on a full read (skipped once it ran to
    // the end); on a repeat run only an unfinished search and new modules.
    sensors: async () => {
      let state: StepState = 'done';
      const scan = garage.latest(vin)?.sensorScan;
      const newTx = new Set(fresh.map((m) => m.tx).filter(Boolean));
      // A repeat run asks only new modules' sensors (or searches, when no
      // search has run on this car yet).
      const search = all.length > 0 && (mode.full ? refresh || !scan?.complete : newTx.size > 0 || !scan);
      if (search) {
        // A family other cars already taught Caristini gets the quick check
        // of those sensors only; the full search stays on Find my car's
        // sensors and skips whatever was asked here.
        let rows = shared.size ? quickRows(all, shared, asked) : remainingRows(all, asked);
        if (!mode.full && scan) rows = remainingRows(all, asked).filter((r) => newTx.has(r.h));
        if (rows.length) {
          await client.probeSensors(rows, {
            cancelled: halted,
            onProgress: (n, total, m) => progress(total ? n / total : 1, m ? `Asking the ${inText(m)}` : 'Asking for sensors'),
            onFound: (k) => found.add(k),
            onAsked: (k) => asked.add(k),
          });
        }
        const complete = !halted() && remainingRows(all, asked).length === 0;
        await garage.update(vin, { sensorsFound: [...found], sensorsAsked: [...asked], sensorScan: { at: Date.now(), asked: asked.size, complete, quick: !complete && shared.size > 0 } });
        if (halted()) state = 'stopped';
      }
      summary.sensors = all.filter((r) => found.has(readKey(r))).length;
      if (!all.length) {
        // Older VW modules: no sensor list; their value groups are read in the
        // next step unless every one was read before.
        const had = sensorCount(garage.latest(vin) ?? v0);
        const before = !refresh && v0.learnExplored && had.groupValues > 0;
        return {
          state,
          note: before
            ? `No sensor list for this car’s older VW modules; ${groupValuesText(had)} found before`
            : 'No sensor list for this car’s older VW modules; their value groups are read in the next step',
        };
      }
      if (!summary.sensors) return { state, note: search ? 'No sensors answered' : `No sensors known; searched again after ${FULL_READ_DAYS} days` };
      const text = sensorCountText({ maker: summary.sensors, groupValues: 0, groups: 0 });
      return { state, note: search ? `${text} found` : `${text} known; searched again after ${FULL_READ_DAYS} days` };
    },

    // 4. Unknown values: a quick sweep of every newer module, a second read,
    // then the older VW modules' value groups. A slice of each run, carrying
    // on where the last one stopped; what was explored to the end is not
    // explored again until the next full read after 30 days or on request.
    values: async () => {
      disc = await loadDiscovery(vin);
      const dd = disc;
      if (refresh) {
        // A full refresh explores again from the start.
        for (const m of Object.values(dd.modules)) {
          delete m.learnDone;
          delete m.learnNext;
          delete m.learnRanges;
        }
        await garage.update(vin, { groupsScanned: [], groupsResume: {}, learnExplored: false });
      }
      // A time limit, so Learn my car stays in minutes on any car: the step
      // stops after 2.5 minutes, wherever it is. What was found up to then is
      // kept, and the next run carries on from that module and value. (A cap
      // per module left most of the time unused once one big module was left:
      // the Mazda6 engine's value blocks took 8 runs instead of 4.)
      const limit = d.valuesLimitMs ?? VALUES_LIMIT_MS;
      const stepEnd = Date.now() + limit;
      // left: the time limit cut this run short, so the next run carries on.
      let left = false;
      const timeUp = () => {
        if (Date.now() > stepEnd) left = true;
        return halted() || Date.now() > stepEnd;
      };
      let newValues = 0;
      // Modules explored on this run (the rest were done before).
      let worked = 0;
      // A full read explores the modules it read; a repeat run every module
      // known on this car, new ones included.
      const pool = mode.full ? facts : knownFacts();
      const uds = pool.filter((f) => f.tx && f.route !== 'tp20');
      for (const [i, f] of uds.entries()) {
        if (halted() || Date.now() > stepEnd) {
          left = left || Date.now() > stepEnd;
          break;
        }
        const def = client.moduleById(f.id) ?? { id: f.id, name: f.name, tx: f.tx, rx: f.rx, groups: [], source: 'Found by probing' };
        const mod = dd.modules[f.id] ?? { id: f.id, name: f.name, tx: f.tx, rx: f.rx, found: {} };
        // Blocks around values already known for this module: public lists
        // for this make, and what the owner's other cars found.
        const knownDids = [...all.filter((r) => r.h === f.tx).map((r) => r.d), ...[...shared].filter((k) => k.startsWith(`${f.tx}-`)).map((k) => k.slice(f.tx.length + 1))];
        const ranges = quickExploreRanges(f.tx, knownDids);
        const key = JSON.stringify(ranges);
        // Swept to the end before, here or in Unknown values: nothing more to ask.
        if (!ranges.length || quickDone(dd.modules[f.id], key)) continue;
        worked++;
        // Not asked again: values the sensor search already asked on this
        // module, and values an earlier sweep found (read again below).
        const skipDids = new Set([...[...asked].filter((k) => k.startsWith(`${f.tx}-`)).map((k) => k.slice(f.tx.length + 1)), ...Object.keys(mod.found)]);
        const before = Object.keys(mod.found).length;
        const swept = await client.discoverDids(def, ranges, {
          startAt: quickResume(mod, key),
          skip: skipDids,
          cancelled: timeUp,
          onProgress: (_n, n, total) => progress(((i + n / total) / Math.max(1, uds.length)) * 0.6, `Exploring ${inText(f.name)}`),
          onFound: (did, data) => {
            mod.found[did] = addSample(mod.found[did], toHex(data));
          },
        });
        // A second read a moment later shows which values are live; values
        // read twice on an earlier run are not read again.
        const once = Object.keys(mod.found).filter((did) => (mod.found[did].samples?.length ?? 0) < 2);
        const again = once.length ? await client.sampleDids(def, once).catch(() => ({}) as Record<string, number[]>) : {};
        for (const [did, data] of Object.entries(again)) mod.found[did] = addSample(mod.found[did], toHex(data));
        newValues += Object.keys(mod.found).length - before;
        // Cut short by the time limit: the next run carries on from here. A
        // module that stayed silent is not marked done: it is tried again.
        dd.modules[f.id] = afterQuick(mod, key, swept);
        await saveDiscovery(dd);
      }
      // Older VW modules give live values in numbered groups: groups with
      // names are read first, then the engine and gearbox from group 1 to
      // 255, other modules until 8 groups in a row are empty. A module read
      // to the end on an earlier run is not read again; one cut short
      // carries on from where it stopped. Raw CAN stays on between modules.
      const tp20 = pool.filter((f) => f.route === 'tp20' && !(garage.latest(vin)?.groupsScanned ?? []).includes(f.id));
      await client.holdOlder(async () => {
        for (const [i, f] of tp20.entries()) {
          if (halted() || Date.now() > stepEnd) {
            left = left || Date.now() > stepEnd;
            break;
          }
          const def = client.moduleById(f.id);
          if (!def) continue;
          const res = await scanValueGroups(client, garage, vin, def, {
            cancelled: timeUp,
            onProgress: (p) => progress(0.6 + ((i + p) / tp20.length) * 0.4, `Reading value groups in the ${inText(f.name)}`),
          });
          groupSamples[f.id] = res.samples;
        }
      });
      const explored = !left && !halted();
      await garage.update(vin, { learnExplored: explored });
      const had = sensorCount(garage.latest(vin) ?? v0);
      summary.groupValues = had.groupValues;
      summary.groups = had.groups;
      const note = `${plural(newValues, 'new value')}${summary.groupValues ? `, ${groupValuesText(had)}` : ''}`;
      if (halted()) return { state: 'stopped', note };
      if (left) return { state: 'partial', note: `${note}. Stopped at the ${minutesText(limit)}-minute limit for this run; the next run carries on.` };
      return { note: explored && !worked && !tp20.length ? 'Every module explored before; nothing new to explore' : note };
    },

    // 5. Emissions: self-tests, test results (06) and calibration (09). The
    // engine light and self-tests come from this run's health check.
    emissions: async () => {
      progress(0, 'Reading the self-tests');
      status = status ?? (await (d.readStatus ?? (() => client.readStatus()))().catch(() => null));
      const r = await readEmissions(client, { isCan: d.isCan, diesel: !!status?.diesel || v0.fuel === 'Diesel', onStep: (what) => progress(0.5, what.replace(/…$/, '')) });
      await saveEmissions({ vin, at: Date.now(), from: 'learn', milOn: status?.milOn ?? null, diesel: !!status?.diesel || v0.fuel === 'Diesel', monitors: status?.monitors ?? [], tests: r.tests, cal: r.cal });
      const failed = r.tests.results.filter((x) => x.pass === false).length;
      const self = status?.monitors.length ? `${status.monitors.filter((m) => m.state === 'complete').length} of ${status.monitors.length} self-tests complete` : 'No self-tests reported';
      const calIds = r.cal.units.reduce((n, u) => n + u.calIds.length, 0);
      const extra = r.tests.results.length || calIds ? `; ${plural(r.tests.results.length, 'test result')}${failed ? `, ${failed} outside the car's limits` : ''}, ${plural(calIds, 'calibration ID')}` : '';
      return { note: `${self}${extra}` };
    },

    // 6. MOT: the from-the-car part, saved into the car's MOT draft. Built
    // from this run's health check when it ran to the end; read otherwise.
    mot: async () => {
      const v = garage.latest(vin) ?? v0;
      const c = check as HealthCheckResult | null;
      const entry = c?.historyId && !c.stopped && !c.noAnswer ? (await loadHistory(vin)).find((e) => e.id === c.historyId) : undefined;
      const incomplete = status?.monitors.length ? status.monitors.filter((m) => m.state === 'incomplete').length : null;
      const read = entry
        ? fromHealthCheck(entry, v.group, { milOn: status?.milOn ?? null, volts: c?.volts ?? null, monitorsIncomplete: incomplete }, v.modulesSeen)
        : await readCarForMot(client, v.group, { seen: v.modulesSeen, cancelled: halted, onStep: (what, n, total) => progress(total ? n / total : 0, `Reading ${what}`) });
      const draft = (await loadDraft(vin)) ?? { vin, startedAt: Date.now(), answers: {}, read: null };
      await saveDraft({ ...draft, read: { ...read, by: 'learn' } });
      if (!read.complete) return { state: 'stopped', note: 'Saved as read so far' };
      return { note: `Engine light ${read.milOn == null ? 'not read' : read.milOn ? 'on' : 'off'}, ${plural(read.faults.length, 'fault')}; the walk-round is left` };
    },

    // 7. Battery voltage and odometer, where the Battery test and Service read
    // them. The voltage is the one the health check read minutes ago.
    battery: async () => {
      progress(0, 'Reading the battery voltage');
      const c = check as HealthCheckResult | null;
      const volts = c?.volts ?? (await client.batteryVoltage().catch(() => null));
      if (volts != null) await garage.update(vin, { battery: { volts, at: Date.now(), from: 'Learn my car' } });
      progress(0.5, 'Reading the odometer');
      const km = v0.group === 'other' ? null : await readOdometer(client, v0.group).catch(() => null);
      if (km != null) await garage.update(vin, { odometerKm: km, odometerAt: Date.now() });
      if (volts == null && km == null) throw new Error('The adapter gave no voltage and the car gave no odometer.');
      return { note: [volts != null ? `Battery ${volts.toFixed(1)} V` : 'No voltage from the adapter', km != null ? 'odometer read' : 'the car did not give its odometer'].join(', ') };
    },

    // 8. Save and send.
    send: async () => {
      const stopped = summary.stopped;
      const sensorTotal = summary.sensors + summary.groupValues;
      const said = sensorCountText({ maker: summary.sensors, groupValues: summary.groupValues, groups: summary.groups });
      const counts = `${modulesText(summary.modules)}, ${said.charAt(0).toLowerCase()}${said.slice(1)}${summary.faults != null ? `, ${plural(summary.faults, 'fault')}` : ''}`;
      // A full read counts once its module and fault steps ran to the end.
      const fullDone = mode.full && steps.modules?.state === 'done' && steps.faults?.state === 'done';
      const timed = Object.fromEntries(LEARN_ORDER.filter((s) => steps[s] && s !== 'send').map((s) => [s, Math.round(steps[s]!.ms / 100) / 10]));
      const v1 = garage.latest(vin) ?? v0;
      const pace = client.pace.snapshot();
      await garage.update(vin, {
        knowledge,
        sensorsFound: [...found],
        learnRun: { at: Date.now(), modules: summary.modules, sensors: sensorTotal, ...(summary.faults != null ? { faults: summary.faults } : {}), full: mode.full },
        ...(fullDone ? { learnFullAt: Date.now() } : {}),
        // Answering modules come off the list (a module fitted since, found by the check).
        learnSilent: { at: silent.at, modules: [...silent.modules].filter((id) => !(v1.modulesSeen ?? []).includes(id)), addresses: [...silent.addresses], tp20: [...silent.tp20] },
        ...(!stopped ? { learnTimes: { ...(v1.learnTimes ?? {}), [mode.full ? 'first' : 'repeat']: timed } } : {}),
        ...(pace ? { learnPace: { ...pace, at: Date.now() } } : {}),
      });
      await addHistory({ vin, kind: 'discover', title: mode.full ? 'Learned this car' : 'Learned this car again', detail: stopped ? `${counts}; stopped early` : counts });
      if (!d.send) {
        summary.sent = { via: 'none', detail: 'Not sent: kept on this phone, as you chose.' };
        return { note: 'Saved on this phone; not sent, as you chose' };
      }
      // A failed send is kept on the phone and sent again later.
      const v = garage.latest(vin) ?? v0;
      const steps_ = Object.fromEntries(Object.entries(steps).map(([k, o]) => [k, o?.state]));
      summary.sent = d.sendBack
        ? await d
            .sendBack('learn', vin, {
              car: { title: vehicleTitle(v), brand: v.brand, model: v.model, year: v.year, platform: v.platform, group: v.group },
              run: mode.why,
              modules: facts,
              knowledge,
              discovery: disc,
              sensorsFound: [...found],
              groupsFound: v.groupsFound,
              groupSamples,
              steps: steps_,
            })
            .catch((e) => ({ via: 'none', detail: sayError(e) }))
        : { via: 'none', detail: 'Not sent.' };
      return { note: summary.sent.via === 'github' ? 'Saved and sent to your findings store' : summary.sent.via === 'none' ? summary.sent.detail : `Saved. ${summary.sent.detail}` };
    },
  };

  // A repeat run's modules for the value step: those known on this car, with
  // the way each answered (this connection first, then the saved routes).
  const knownFacts = (): ModuleFacts[] =>
    [...identifiedIds(garage.latest(vin) ?? v0)].flatMap((id) => {
      const def = client.moduleById(id);
      if (!def) return [];
      return [{ id, name: def.name, code: def.code, tx: def.tx, rx: def.rx, route: client.routeOf(def) ?? (garage.latest(vin) ?? v0).routes?.[id]?.via ?? (pq35 ? 'tp20' : 'uds') }];
    });

  // The car must be answering before anything is learned: with the ignition
  // off, modules behind the gateway stay silent and would be saved as missing.
  if (!(await client.carAwake().catch(() => false))) {
    summary.aborted = 'The car is not answering. Switch the ignition on (engine running is best) and run Learn my car again. Nothing was changed.';
    for (const s of LEARN_ORDER) steps[s] = { state: 'skipped', ms: 0 };
    return summary;
  }

  for (const s of LEARN_ORDER) {
    if (halted()) summary.stopped = true;
    // After Stop only Save and send runs, so what was found is kept.
    if (halted() && s !== 'send') {
      steps[s] = { state: 'skipped', note: 'Stopped before this step', ms: 0 };
      d.onStep?.(s, steps[s]!);
      continue;
    }
    d.onStep?.(s, 'running');
    progress(0, '');
    const t0 = Date.now();
    try {
      const r = (await work[s]()) ?? {};
      const state: StepState = r.state ?? (halted() && s !== 'send' ? 'stopped' : 'done');
      steps[s] = { state, note: r.note, ms: Date.now() - t0 };
    } catch (e) {
      if (e instanceof LearnAbort) {
        summary.aborted = e.message;
        steps[s] = { state: 'failed', note: e.message, ms: Date.now() - t0 };
        d.onStep?.(s, steps[s]!);
        for (const rest of LEARN_ORDER.slice(LEARN_ORDER.indexOf(s) + 1)) steps[rest] = { state: 'skipped', ms: 0 };
        break;
      }
      steps[s] = { state: 'failed', note: sayError(e), ms: Date.now() - t0 };
      log(`Learn my car: ${s} failed`);
    }
    if (steps[s]!.state === 'stopped') summary.stopped = true;
    d.onStep?.(s, steps[s]!);
    // The log goes after each step: one run writes more lines than the log holds.
    if (s !== 'send') log(`Learn my car: ${s}`);
  }
  summary.minutes = (Date.now() - started) / 60000;
  return summary;
}
