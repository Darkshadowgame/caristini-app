// Learn my car repeat runs: what is skipped, the 30-day and new-module rules,
// remembered silent addresses, the adaptive wait floor, and that every
// module's faults are still read.
jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
import AsyncStorage from '@react-native-async-storage/async-storage';
import { loadHistory } from '../src/history';
import { estimateMinutes, FULL_READ_DAYS, learnEstimate, learnMode, runLearn, silentToSkip } from '../src/learn/runLearn';
import { ElmClient, engineLast } from '../src/obd/elm';
import { atstFor, PACE_FLOOR_MS, PaceMeter } from '../src/obd/pace';
import { DEMO_CARS, DemoCar, SimTransport } from '../src/obd/simTransport';
import { TP20_CANDIDATES } from '../src/obd/tp20';
import { Vehicle } from '../src/vehicle/garage';

const DAY = 86400000;
const mazdaCar = DEMO_CARS.find((c) => c.id === 'mazda')!;
const golfCar = DEMO_CARS.find((c) => c.id === 'vw')!;
const leonCar = DEMO_CARS.find((c) => c.id === 'leon')!;

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

const vehicleOf = (car: DemoCar, group: Vehicle['group'], platform: string): Vehicle => ({
  vin: car.vin,
  group,
  brand: group === 'mazda' ? 'Mazda' : 'Volkswagen',
  model: '',
  platform,
  year: 2016,
  fuel: car.diesel ? 'Diesel' : 'Petrol',
  nickname: '',
  edited: false,
  lastSeen: Date.now(),
  lastMilOn: false,
  lastCodes: [],
});

async function connect(car: DemoCar, group: 'vag' | 'mazda', platform: string) {
  const sim = new SimTransport(car, 0);
  const client = new ElmClient(sim);
  const info = await client.initialise();
  client.setMake(group, platform);
  const sent: string[] = [];
  const send = sim.send.bind(sim);
  sim.send = (cmd: string) => {
    sent.push(cmd.replace(/\s/g, '').toUpperCase());
    return send(cmd);
  };
  return { client, info, sent, sim };
}

type Garage = ReturnType<typeof memoryGarage>;
const learn = (client: ElmClient, vin: string, garage: Garage, extra: { everything?: boolean } = {}) =>
  runLearn({ client, vin, garage, isCan: true, send: false, cancelled: () => false, retryWaitMs: 0, ...extra });

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe('which runs read everything', () => {
  it('reads everything on the first run, after 30 days and on request; refreshes otherwise', () => {
    const now = Date.UTC(2026, 10, 16);
    expect(learnMode({}, { now })).toEqual({ full: true, why: 'first' });
    expect(learnMode({ learnFullAt: now - 5 * DAY }, { now })).toEqual({ full: false, why: 'repeat' });
    expect(learnMode({ learnFullAt: now - (FULL_READ_DAYS - 1) * DAY }, { now }).full).toBe(false);
    expect(learnMode({ learnFullAt: now - (FULL_READ_DAYS + 1) * DAY }, { now })).toEqual({ full: true, why: 'old' });
    expect(learnMode({ learnFullAt: now - DAY }, { now, everything: true })).toEqual({ full: true, why: 'asked' });
  });

  it('trusts remembered silent addresses until the next full read', () => {
    const now = Date.UTC(2026, 10, 16);
    const learnSilent = { at: now - 3 * DAY, modules: ['mazda-radar'], addresses: ['7A0'], tp20: [0x46] };
    expect(silentToSkip({ learnSilent }, { full: false, why: 'repeat' }, now)).toEqual({ modules: ['mazda-radar'], addresses: ['7A0'], tp20: [0x46] });
    // A first run that stopped part-way and runs again keeps them too.
    expect(silentToSkip({ learnSilent }, { full: true, why: 'first' }, now).addresses).toEqual(['7A0']);
    // The 30-day read and Read everything again ask every address.
    expect(silentToSkip({ learnSilent }, { full: true, why: 'old' }, now).addresses).toEqual([]);
    expect(silentToSkip({ learnSilent }, { full: true, why: 'asked' }, now).addresses).toEqual([]);
    expect(silentToSkip({ learnSilent: { ...learnSilent, at: now - (FULL_READ_DAYS + 1) * DAY } }, { full: false, why: 'repeat' }, now).modules).toEqual([]);
  });
});

describe('a repeat run', () => {
  it('skips identities, codings, the address search and the sensor search, and still reads every module’s faults', async () => {
    const garage = memoryGarage([vehicleOf(mazdaCar, 'mazda', 'GJ')]);
    const one = await connect(mazdaCar, 'mazda', 'GJ');
    const first = await learn(one.client, mazdaCar.vin, garage);
    expect(first.mode).toEqual({ full: true, why: 'first' });
    expect(first.steps.modules?.state).toBe('done');
    const v1 = garage.latest(mazdaCar.vin)!;
    expect(v1.learnFullAt).toBeGreaterThan(0);
    const seen = v1.modulesSeen ?? [];
    expect(seen.length).toBeGreaterThanOrEqual(4);

    const two = await connect(mazdaCar, 'mazda', 'GJ');
    const details = jest.spyOn(two.client, 'readModuleDetails');
    const coding = jest.spyOn(two.client, 'readCoding');
    const probe = jest.spyOn(two.client, 'findAnyModules');
    const sensors = jest.spyOn(two.client, 'probeSensors');
    const faults = jest.spyOn(two.client, 'readModuleFaults');
    const r = await learn(two.client, mazdaCar.vin, garage);
    expect(r.mode).toEqual({ full: false, why: 'repeat' });
    expect(details).not.toHaveBeenCalled();
    expect(coding).not.toHaveBeenCalled();
    expect(probe).not.toHaveBeenCalled();
    expect(sensors).not.toHaveBeenCalled();
    expect(r.steps.modules?.note).toMatch(/^Known since/);
    expect(r.modules).toBe(first.modules);
    // Every module that answered before was asked for its faults.
    const asked = new Set(faults.mock.calls.map(([d]) => d.id));
    for (const id of seen) expect([id, asked.has(id)]).toEqual([id, true]);
    // A second health check saved, as a full one, with every module read.
    const scans = (await loadHistory(mazdaCar.vin)).filter((e) => e.kind === 'scan');
    expect(scans).toHaveLength(2);
    expect(scans.every((e) => e.complete)).toBe(true);
    expect(scans[0].modules).toBe(scans[1].modules);
    // Emissions, MOT and battery are refreshed.
    for (const s of ['faults', 'emissions', 'mot', 'battery'] as const) expect([s, r.steps[s]?.state]).toEqual([s, 'done']);
    expect(garage.latest(mazdaCar.vin)!.battery?.from).toBe('Learn my car');
    expect(r.minutes).toBeLessThan(first.minutes);
  }, 120000);

  it('reads the identity of a module the gateway lists for the first time, and nothing else', async () => {
    const garage = memoryGarage([vehicleOf(leonCar, 'vag', 'PQ35')]);
    const one = await connect(leonCar, 'vag', 'PQ35');
    await learn(one.client, leonCar.vin, garage);
    const v1 = garage.latest(leonCar.vin)!;
    // The comfort module (46) was not listed and is remembered as silent.
    expect(v1.learnSilent?.modules).toContain('vag-46');

    // Since then a comfort module was fitted at TP2.0 0x21 and the gateway lists it.
    const car: DemoCar = structuredClone(leonCar);
    car.tp20![0x21] = { faults: [[1317, 0x23]], part: '1K0959433CT', sw: '0110', component: 'KSG PQ35', coding: 4 };
    car.tp20![0x1f].list = [...car.tp20![0x1f].list!, [0x46, 0x21]];
    const two = await connect(car, 'vag', 'PQ35');
    const details = jest.spyOn(two.client, 'readModuleDetails');
    const r = await learn(two.client, leonCar.vin, garage);
    expect(r.mode.full).toBe(false);
    expect(details.mock.calls.map(([d]) => d.id)).toEqual(['vag-46']);
    const v2 = garage.latest(leonCar.vin)!;
    expect(v2.ids?.modules?.some((m) => m.id === 'vag-46' && m.part === '1K0959433CT')).toBe(true);
    expect(r.modules).toBe(new Set([...(v1.ids?.modules ?? []).map((m) => m.id), ...Object.keys(v1.knowledge ?? {})]).size + 1);
    expect(r.steps.faults?.note).toMatch(/1 new module added to the backup/);
    // Its fault is in this run's check.
    expect(v2.lastCodes).toContain('01317');
    expect(v2.learnSilent?.modules).not.toContain('vag-46');
  }, 120000);

  it('asks a missing module again, then runs the quick address search', async () => {
    const garage = memoryGarage([vehicleOf(golfCar, 'vag', 'MQB')]);
    const one = await connect(golfCar, 'vag', 'MQB');
    await learn(one.client, golfCar.vin, garage);
    const v1 = garage.latest(golfCar.vin)!;
    expect(v1.modulesSeen).toContain('vag-08');
    // The first run searched every address and remembered the silent ones.
    expect(v1.learnSilent?.addresses.length).toBeGreaterThan(100);

    // Since then the air conditioning (746) has gone quiet.
    const car: DemoCar = structuredClone(golfCar);
    delete car.modules['746'];
    const two = await connect(car, 'vag', 'MQB');
    const details = jest.spyOn(two.client, 'readModuleDetails');
    const faults = jest.spyOn(two.client, 'readModuleFaults');
    const probe = jest.spyOn(two.client, 'findAnyModules');
    const r = await learn(two.client, golfCar.vin, garage);
    expect(r.mode.full).toBe(false);
    expect(details).not.toHaveBeenCalled();
    // The missing module: asked in the check and once more after it.
    expect(faults.mock.calls.filter(([d]) => d.id === 'vag-08').length).toBeGreaterThanOrEqual(2);
    expect(r.steps.faults?.note).toMatch(/not answering: Heating and air conditioning/);
    // Then the address search, leaving out every address that never answered.
    expect(probe).toHaveBeenCalledTimes(1);
    const probed = two.sent.filter((c) => /^ATSH7..$/.test(c)).map((c) => c.slice(4));
    for (const tx of v1.learnSilent!.addresses) expect(probed).not.toContain(tx);
    expect(probed.length).toBeLessThan(60);
    // 746 did not answer the search either: remembered with the others.
    expect(garage.latest(golfCar.vin)!.learnSilent?.addresses).toContain('746');
  }, 120000);

  it('reads everything again after 30 days, asking every address', async () => {
    const garage = memoryGarage([vehicleOf(mazdaCar, 'mazda', 'GJ')]);
    const one = await connect(mazdaCar, 'mazda', 'GJ');
    await learn(one.client, mazdaCar.vin, garage);
    await garage.update(mazdaCar.vin, { learnFullAt: Date.now() - (FULL_READ_DAYS + 1) * DAY });
    const two = await connect(mazdaCar, 'mazda', 'GJ');
    const details = jest.spyOn(two.client, 'readModuleDetails');
    const probe = jest.spyOn(two.client, 'findAnyModules');
    const r = await learn(two.client, mazdaCar.vin, garage);
    expect(r.mode).toEqual({ full: true, why: 'old' });
    expect(details.mock.calls.length).toBeGreaterThanOrEqual(5);
    expect(probe).toHaveBeenCalledTimes(1);
    // Every address is asked again, the ones remembered as silent too.
    expect(two.sent.filter((c) => /^ATSH7..$/.test(c) && c !== 'ATSH7DF').length).toBeGreaterThan(240);
    expect(garage.latest(mazdaCar.vin)!.learnFullAt).toBeGreaterThan(Date.now() - DAY);
  }, 120000);
});

describe('remembered silent addresses', () => {
  it('are saved from the first run and not asked by the next health check or address search', async () => {
    const garage = memoryGarage([vehicleOf(mazdaCar, 'mazda', 'GJ')]);
    const one = await connect(mazdaCar, 'mazda', 'GJ');
    await learn(one.client, mazdaCar.vin, garage);
    const silent = garage.latest(mazdaCar.vin)!.learnSilent!;
    // Modules on the Mazda list that are not on this car, and addresses nothing answered.
    expect(silent.modules).toEqual(expect.arrayContaining(['mazda-radar', 'mazda-camera']));
    for (const tx of ['7E0', '760', '720', '726', '731']) expect(silent.addresses).not.toContain(tx);
    expect(silent.addresses).toContain('7A0');

    const two = await connect(mazdaCar, 'mazda', 'GJ');
    const faults = jest.spyOn(two.client, 'readModuleFaults');
    await learn(two.client, mazdaCar.vin, garage);
    const asked = faults.mock.calls.map(([d]) => d.id);
    for (const id of silent.modules) expect(asked).not.toContain(id);

    // The address search leaves them out.
    const three = await connect(mazdaCar, 'mazda', 'GJ');
    await three.client.findAnyModules({ skip: new Set(silent.addresses) });
    const headers = three.sent.filter((c) => /^ATSH7..$/.test(c)).map((c) => c.slice(4));
    for (const tx of silent.addresses) expect(headers).not.toContain(tx);
    expect(headers).toContain('7E0');
  }, 120000);

  it('older VW addresses that never opened are skipped until Read everything again', async () => {
    const garage = memoryGarage([vehicleOf(leonCar, 'vag', 'PQ35')]);
    const one = await connect(leonCar, 'vag', 'PQ35');
    await learn(one.client, leonCar.vin, garage);
    const silent = garage.latest(leonCar.vin)!.learnSilent!;
    expect(silent.tp20.length).toBeGreaterThan(5);
    expect(silent.tp20).not.toContain(0x20);

    // Read everything again: the older-module search runs again over every address.
    const two = await connect(leonCar, 'vag', 'PQ35');
    const deep = jest.spyOn(two.client, 'deepScan');
    const r = await learn(two.client, leonCar.vin, garage, { everything: true });
    expect(r.mode.why).toBe('asked');
    expect(deep).toHaveBeenCalledTimes(1);
    expect(deep.mock.calls[0][0]).toEqual(TP20_CANDIDATES);
  }, 120000);
});

describe('adaptive waits', () => {
  it('waits a multiple of the measured reply time, never under the floor nor over the old wait', () => {
    const p = new PaceMeter();
    // Before enough answers are timed: the old fixed wait.
    expect(p.silentWaitMs(200)).toBe(200);
    for (let i = 0; i < 10; i++) p.noteLink(30);
    // Instant answers: the floor.
    for (let i = 0; i < 5; i++) p.noteAnswer(30);
    expect(p.silentWaitMs(200)).toBe(PACE_FLOOR_MS);
    // Answers about 45 ms after the link time: 3 times that.
    const q = new PaceMeter();
    for (let i = 0; i < 10; i++) q.noteLink(31);
    for (const ms of [60, 62, 58, 70, 76, 61, 59, 60, 63, 75]) q.noteAnswer(ms);
    expect(q.silentWaitMs(200)).toBe(135);
    // Slow modules: never longer than the wait used before.
    const s = new PaceMeter();
    for (let i = 0; i < 10; i++) s.noteLink(60);
    for (let i = 0; i < 10; i++) s.noteAnswer(300);
    expect(s.silentWaitMs(200)).toBe(200);
    expect(atstFor(100)).toBe('ATST19');
    expect(atstFor(135)).toBe('ATST22');
    expect(atstFor(200)).toBe('ATST32');
  });

  it('the address search and fault sweep use the measured wait, and the floor when replies are instant', async () => {
    const { client, sent } = await connect(mazdaCar, 'mazda', 'GJ');
    // Before any module answer is timed: the old fixed waits.
    sent.length = 0;
    await client.scanAllFaults('mazda');
    expect(sent).toContain('ATST4B');
    // Module answers (here instant, as the simulator has no delay) set the floor.
    const engine = client.moduleById('engine')!;
    await client.readModuleDetails(engine);
    expect(client.pace.replyMs()).not.toBeNull();
    sent.length = 0;
    await client.findAnyModules();
    expect(sent).toContain(atstFor(PACE_FLOOR_MS));
    expect(sent).not.toContain('ATST32');
    sent.length = 0;
    await client.scanAllFaults('mazda');
    expect(sent).toContain(atstFor(PACE_FLOOR_MS));
    expect(sent).not.toContain('ATST4B');
    // Older VW modules keep their own listen time.
    const leon = await connect(leonCar, 'vag', 'PQ35');
    await leon.client.readModuleDetails(leon.client.moduleById('vag-17')!);
    expect(leon.sent).toContain('ATST19');
  }, 60000);

  it('puts the engine after the other older VW modules', () => {
    expect(engineLast([{ id: 'engine' }, { id: 'vag-17' }, { id: 'gearbox' }, { id: 'vag-03' }]).map((d) => d.id)).toEqual(['vag-17', 'vag-03', 'engine', 'gearbox']);
  });
});

describe('the time shown', () => {
  it('is shorter for a repeat run, and uses the last run of the same kind', () => {
    const base = { ...vehicleOf(mazdaCar, 'mazda', 'GJ'), modulesSeen: ['engine', 'mazda-abs', 'mazda-ic', 'mazda-fbcm', 'mazda-ssu'], sensorScan: { at: 1, asked: 10, complete: true } };
    const first = estimateMinutes(learnEstimate(base, [], { pace: { linkMs: 31, silentMs: 157 } }));
    const repeat = estimateMinutes(learnEstimate({ ...base, learnFullAt: Date.now() - DAY, learnExplored: true }, [], { pace: { linkMs: 31, silentMs: 157 } }));
    expect(repeat[1]).toBeLessThan(first[1]);
    expect(repeat[1]).toBeLessThanOrEqual(2);
    // Measured times of the last repeat run are used.
    const timed = learnEstimate({ ...base, learnFullAt: Date.now() - DAY, learnExplored: true, learnTimes: { repeat: { faults: 40, emissions: 10 } } });
    expect(timed.faults[0]).toBeCloseTo(32);
    expect(timed.faults[1]).toBeCloseTo(51);
    // A slower adapter means a longer estimate.
    const slow = estimateMinutes(learnEstimate(base, [], { pace: { linkMs: 90, silentMs: 300 } }));
    expect(slow[1]).toBeGreaterThanOrEqual(first[1]);
  });
});
