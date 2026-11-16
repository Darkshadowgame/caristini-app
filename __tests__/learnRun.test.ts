jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
import AsyncStorage from '@react-native-async-storage/async-storage';
import { loadEmissions } from '../src/diag/emissionsStore';
import { countFaults } from '../src/diag/faults';
import { runHealthCheck } from '../src/diag/healthCheck';
import { loadHistory } from '../src/history';
import { estimateMinutes, LEARN_ORDER, learnEstimate, LearnStep, runLearn, StepOutcome } from '../src/learn/runLearn';
import { loadDraft, saveDraft } from '../src/mot/store';
import { ElmClient } from '../src/obd/elm';
import { DEMO_CARS, DemoCar, SimTransport } from '../src/obd/simTransport';
import { Vehicle } from '../src/vehicle/garage';

const leonCar = DEMO_CARS.find((c) => c.id === 'leon')!;
const golfCar = DEMO_CARS.find((c) => c.id === 'vw')!;

// The garage as the screens use it: newest copy, merged updates.
function memoryGarage(cars: Vehicle[]) {
  let list = cars.map((c) => ({ ...c }));
  return {
    get vehicles() {
      return list;
    },
    latest: (vin: string) => list.find((v) => v.vin === vin),
    update: async (vin: string, patch: Partial<Vehicle>) => {
      list = list.map((v) => (v.vin === vin ? { ...v, ...patch } : v));
    },
  };
}

const vehicleOf = (car: DemoCar, patch: Partial<Vehicle> = {}): Vehicle => ({
  vin: car.vin,
  group: 'vag',
  brand: car.id === 'leon' ? 'SEAT / Cupra' : 'Volkswagen',
  model: car.id === 'leon' ? 'Leon II' : 'Golf VII',
  platform: car.id === 'leon' ? 'PQ35' : 'MQB',
  year: 2007,
  fuel: car.diesel ? 'Diesel' : 'Petrol',
  nickname: '',
  edited: false,
  lastSeen: Date.now(),
  lastMilOn: false,
  lastCodes: [],
  ...patch,
});

async function connect(car: DemoCar, platform: string) {
  const sim = new SimTransport(car, 0);
  const client = new ElmClient(sim);
  const info = await client.initialise();
  client.setMake('vag', platform);
  // Every command the car was sent, and every call that changes the car, to
  // prove the run is read-only.
  const sent: string[] = [];
  const send = sim.send.bind(sim);
  sim.send = (cmd: string) => {
    sent.push(cmd.replace(/\s/g, '').toUpperCase());
    return send(cmd);
  };
  const changes = (['clearFaultCodes', 'clearModuleFaults', 'clearTp20', 'writeCoding', 'writeDid', 'runServiceReset'] as const).map((m) => jest.spyOn(client, m));
  const writes = () => [...sent.filter((x) => x === '04' || x.startsWith('14FFFFFF')), ...changes.filter((c) => c.mock.calls.length).map((c) => c.getMockName())];
  return { client, info, writes };
}

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe('Learn my car reads everything once', () => {
  it('runs the steps in order on the demo Leon and saves each result where its screen reads it', async () => {
    const { client, info, writes } = await connect(leonCar, 'PQ35');
    const garage = memoryGarage([vehicleOf(leonCar)]);
    const order: LearnStep[] = [];
    const ends: [LearnStep, StepOutcome][] = [];
    const sendBack = jest.fn(async () => ({ via: 'github', detail: 'Sent' }));
    const r = await runLearn({
      client,
      vin: leonCar.vin,
      garage,
      isCan: info.isCan,
      send: true,
      cancelled: () => false,
      onStep: (s, o) => (o === 'running' ? order.push(s) : ends.push([s, o])),
      sendBack,
      valuesLimitMs: 20000,
      retryWaitMs: 0,
    });
    expect(r.aborted).toBeUndefined();
    expect(order).toEqual(LEARN_ORDER);
    expect(ends.map(([s]) => s)).toEqual(LEARN_ORDER);
    for (const s of ['modules', 'faults', 'emissions', 'mot', 'battery', 'send'] as LearnStep[]) expect([s, r.steps[s]?.state]).toEqual([s, 'done']);
    expect(writes()).toEqual([]);

    // Health check: one History entry, saved as the Health check screen saves it.
    const v = garage.latest(leonCar.vin)!;
    const scans = (await loadHistory(leonCar.vin)).filter((e) => e.kind === 'scan');
    expect(scans).toHaveLength(1);
    const scan = scans[0];
    expect(scan.complete).toBe(true);
    expect(scan.noAnswer).toBe(false);
    expect(scan.read).toContain('Engine (OBD2)');
    expect(scan.modules).toBeGreaterThanOrEqual(4);
    // The fault count is the shared one: module faults plus OBD2 codes not among them.
    expect(scan.faults!.length).toBe(v.lastCodes.length);
    expect(scan.faults!.some((f) => f.code === '00532')).toBe(true);
    expect(v.lastCheckedAt).toBeGreaterThan(0);
    expect(v.modulesSeen?.length).toBeGreaterThanOrEqual(4);
    expect(v.fullChecks).toBe(1);
    // The older-module search ran once and its modules are in the check.
    expect(v.deepFound).toBeDefined();
    for (const d of v.deepFound ?? []) expect(scan.read).toContain(client.moduleById(d.moduleId)?.name);

    // Modules: identities and the coding backup.
    expect(v.ids?.modules?.length).toBeGreaterThanOrEqual(4);
    expect(v.codingBackup?.modules.length).toBeGreaterThan(0);
    // Older modules the health check found first are added to the module list too.
    expect(v.deepFound?.length).toBeGreaterThan(0);
    for (const d of v.deepFound ?? []) expect(v.ids?.modules?.some((m) => m.id === d.moduleId)).toBe(true);
    // Emissions, MOT draft, battery.
    const em = await loadEmissions(leonCar.vin);
    expect(em?.from).toBe('learn');
    expect(em?.tests).toBeTruthy();
    const draft = await loadDraft(leonCar.vin);
    expect(draft?.read?.by).toBe('learn');
    expect(draft?.read?.from).toBe('health-check');
    expect(draft?.read?.healthCheckAt).toBe(scan.at);
    expect(v.battery?.from).toBe('Learn my car');
    // Save and send.
    expect(v.learnRun?.modules).toBe(r.modules);
    expect(sendBack).toHaveBeenCalledTimes(1);
    expect((await loadHistory(leonCar.vin)).some((e) => e.kind === 'discover' && e.title === 'Learned this car')).toBe(true);
  }, 120000);

  it('keeps the MOT walk-round answers already given', async () => {
    const { client, info } = await connect(leonCar, 'PQ35');
    const garage = memoryGarage([vehicleOf(leonCar, { deepFound: [] })]);
    await saveDraft({ vin: leonCar.vin, startedAt: 1, answers: { tyres: { state: 'pass' } }, read: null });
    await runLearn({ client, vin: leonCar.vin, garage, isCan: info.isCan, send: false, cancelled: () => false, valuesLimitMs: 2000, retryWaitMs: 0 });
    const draft = await loadDraft(leonCar.vin);
    expect(draft?.answers.tyres?.state).toBe('pass');
    expect(draft?.read?.by).toBe('learn');
  }, 120000);

  it('carries on when a step fails, and ticks only the steps that finished', async () => {
    const { client, info } = await connect(leonCar, 'PQ35');
    const garage = memoryGarage([vehicleOf(leonCar, { deepFound: [] })]);
    jest.spyOn(client, 'scanAllFaults').mockRejectedValue(new Error('Lost contact'));
    jest.spyOn(client, 'batteryVoltage').mockRejectedValue(new Error('No voltage'));
    jest.spyOn(client, 'readExtras').mockResolvedValue({});
    const logged: string[] = [];
    const sendBack = jest.fn(async () => ({ via: 'none', detail: 'Not sent' }));
    const r = await runLearn({ client, vin: leonCar.vin, garage, isCan: info.isCan, send: false, cancelled: () => false, log: (x) => logged.push(x), sendBack, valuesLimitMs: 2000, retryWaitMs: 0 });
    expect(r.steps.faults?.state).toBe('failed');
    expect(r.steps.faults?.note).toMatch(/Lost contact/);
    expect(r.steps.battery?.state).toBe('failed');
    // The others still ran.
    for (const s of ['modules', 'emissions', 'mot', 'send'] as LearnStep[]) expect([s, r.steps[s]?.state]).toEqual([s, 'done']);
    expect(logged).toContain('Learn my car: faults failed');
    // No health check saved; the MOT step read the car itself.
    expect((await loadHistory(leonCar.vin)).filter((e) => e.kind === 'scan')).toHaveLength(0);
    const draft = await loadDraft(leonCar.vin);
    expect(draft?.read?.from).toBe('read');
    // Sending off: nothing sent.
    expect(sendBack).not.toHaveBeenCalled();
    expect(r.sent?.via).toBe('none');
  }, 120000);

  it('Stop keeps what was found, skips the rest and still saves', async () => {
    const { client, info } = await connect(leonCar, 'PQ35');
    const garage = memoryGarage([vehicleOf(leonCar, { deepFound: [] })]);
    let stop = false;
    const r = await runLearn({
      client,
      vin: leonCar.vin,
      garage,
      isCan: info.isCan,
      send: false,
      cancelled: () => stop,
      // Stop pressed as the health check finishes.
      onStep: (s, o) => {
        if (s === 'faults' && o !== 'running') stop = true;
      },
      retryWaitMs: 0,
    });
    expect(r.stopped).toBe(true);
    expect(r.steps.modules?.state).toBe('done');
    expect(r.steps.faults?.state).toBe('done');
    for (const s of ['sensors', 'values', 'emissions', 'mot', 'battery'] as LearnStep[]) expect([s, r.steps[s]?.state]).toEqual([s, 'skipped']);
    expect(r.steps.send?.state).toBe('done');
    const v = garage.latest(leonCar.vin)!;
    expect(v.learnRun).toBeDefined();
    expect(v.lastCheckedAt).toBeGreaterThan(0);
    expect(await loadEmissions(leonCar.vin)).toBeNull();
    const learned = (await loadHistory(leonCar.vin)).find((e) => e.kind === 'discover');
    expect(learned?.detail).toMatch(/stopped early/);
  }, 120000);

  it('Stop during the module step leaves that step unticked and saves no health check', async () => {
    const { client, info } = await connect(leonCar, 'PQ35');
    const garage = memoryGarage([vehicleOf(leonCar, { deepFound: [] })]);
    let asks = 0;
    const r = await runLearn({
      client,
      vin: leonCar.vin,
      garage,
      isCan: info.isCan,
      send: false,
      cancelled: () => asks >= 2,
      onProgress: (_v, label) => {
        if (/^Asking /.test(label)) asks++;
      },
      retryWaitMs: 0,
    });
    expect(r.steps.modules?.state).toBe('stopped');
    expect(r.steps.faults?.state).toBe('skipped');
    expect(r.steps.send?.state).toBe('done');
    expect((await loadHistory(leonCar.vin)).filter((e) => e.kind === 'scan')).toHaveLength(0);
    expect(garage.latest(leonCar.vin)?.learnRun?.modules).toBeGreaterThanOrEqual(1);
  }, 120000);

  it('does nothing when the car is not answering', async () => {
    const { client, info } = await connect(leonCar, 'PQ35');
    const garage = memoryGarage([vehicleOf(leonCar)]);
    jest.spyOn(client, 'carAwake').mockResolvedValue(false);
    const r = await runLearn({ client, vin: leonCar.vin, garage, isCan: info.isCan, send: true, cancelled: () => false });
    expect(r.aborted).toMatch(/not answering/);
    expect(LEARN_ORDER.every((s) => r.steps[s]?.state === 'skipped')).toBe(true);
    expect(garage.latest(leonCar.vin)?.learnRun).toBeUndefined();
    expect(await loadHistory(leonCar.vin)).toHaveLength(0);
  });
});

describe('the time Learn my car shows', () => {
  it('gives a range for the whole run from what each step has to do', () => {
    const first = learnEstimate(vehicleOf(golfCar));
    const known = learnEstimate(vehicleOf(golfCar, { modulesSeen: ['engine', 'gearbox', 'vag-17', 'vag-19', 'vag-03', 'vag-15', 'vag-44', 'vag-08'], deepFound: [], sensorScan: { at: 1, asked: 1, complete: true } }));
    // A car never checked asks every address and looks for older modules: longer.
    expect(first.modules[1]).toBeGreaterThan(known.modules[1]);
    expect(first.faults[1]).toBeGreaterThan(known.faults[1]);
    expect(known.sensors).toEqual([0, 0]);
    // The value step never counts more than its 8-minute limit.
    expect(first.values[1]).toBeLessThanOrEqual(480);
    const [lo, hi] = estimateMinutes(known);
    expect(lo).toBeLessThanOrEqual(hi);
    expect(hi).toBeLessThanOrEqual(20);
    expect(estimateMinutes(known, ['battery'])).toEqual([1, 1]);
  });
});

describe('first health check of a VW car', () => {
  it('adds the older modules found after the check to its History entry and saved faults', async () => {
    // The Leon's comfort module (TP2.0 0x20) is not in its gateway list, so
    // only the older-module search finds it; here it holds a fault.
    const car: DemoCar = JSON.parse(JSON.stringify(leonCar));
    car.tp20![0x20].faults = [[1317, 0x23]];
    const { client, info } = await connect(car, 'PQ35');
    const garage = memoryGarage([vehicleOf(car)]);
    let savedFirst: number | null = null;
    const r = await runHealthCheck({
      client,
      vin: car.vin,
      garage,
      isCan: info.isCan,
      olderSearch: true,
      onSaved: (x) => (savedFirst = x.logged.length),
    });
    expect(r.older?.length).toBeGreaterThan(0);
    const extra = r.older!.flatMap((m) => m.faults);
    expect(extra.length).toBe(1);
    const entry = (await loadHistory(car.vin)).find((e) => e.id === r.historyId)!;
    expect(entry.faults!.length).toBe(savedFirst! + 1);
    expect(entry.faults!.some((f) => f.code === extra[0].code)).toBe(true);
    expect(entry.modules).toBe(r.answered);
    expect(garage.latest(car.vin)!.lastCodes).toContain(extra[0].code);
    expect(garage.latest(car.vin)!.lastCodes.length).toBe(entry.faults!.length);
    expect(garage.latest(car.vin)!.deepFound?.some((d) => d.address === 0x20)).toBe(true);
    // The count is the shared one.
    expect(entry.faults!.length).toBe(countFaults(entry.faults!.filter((f) => f.module !== 'Engine (OBD2)').map((f) => f.code), entry.faults!.filter((f) => f.module === 'Engine (OBD2)').map((f) => f.code)));
  }, 120000);

  it('does not search again once the car has been searched', async () => {
    const { client, info } = await connect(leonCar, 'PQ35');
    const garage = memoryGarage([vehicleOf(leonCar, { deepFound: [] })]);
    const deep = jest.spyOn(client, 'deepScan');
    const r = await runHealthCheck({ client, vin: leonCar.vin, garage, isCan: info.isCan, olderSearch: true });
    expect(deep).not.toHaveBeenCalled();
    expect(r.older).toBeNull();
  }, 120000);
});
