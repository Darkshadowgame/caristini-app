// How long Learn my car takes on the demo Leon and Mazda when the simulator
// answers at real-car speed (SIM_TIMING, from the owner's adapter logs). The
// clock is simulated, so the test itself takes seconds. Set LEARN_SPEED_OUT
// to a file path to save the step times (replica/learn-speed-2026-11-16.md).
jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as fs from 'fs';
import { loadDiscovery } from '../src/discover';
import { LEARN_ORDER, LearnStep, LearnSummary, runLearn } from '../src/learn/runLearn';
import { ElmClient } from '../src/obd/elm';
import { DEMO_CARS, DemoCar, SIM_TIMING, SimTransport } from '../src/obd/simTransport';
import { Vehicle } from '../src/vehicle/garage';

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

const demoLeon = DEMO_CARS.find((c) => c.id === 'leon')!;
const demoMazda = DEMO_CARS.find((c) => c.id === 'mazda')!;

// The demo cars with as many modules as the owner's cars answered (Learn my
// car results of 14 and 15 Nov 2026): the Leon's 13 older-protocol modules
// (here 11: two of the real ones have no known TP2.0 address) and the
// Mazda6's 14 newer-protocol modules.
const leonSized: DemoCar = (() => {
  const c: DemoCar = structuredClone(demoLeon);
  c.id = 'leon-sized';
  const add = (address: number, part: string, component: string) => (c.tp20![address] = { faults: [], part, sw: '0010', component, coding: 1 });
  add(0x21, '1K0959433CT', 'KSG PQ35 RDK');
  add(0x22, '1K0959701P', 'Tuer-SG FS');
  add(0x23, '1K0959702P', 'Tuer-SG BF');
  add(0x2c, '1K0820047HE', 'Climatronic');
  c.tp20![0x1f].list = [...c.tp20![0x1f].list!, [0x09, 0x20], [0x46, 0x21], [0x42, 0x22], [0x52, 0x23], [0x08, 0x2c]];
  return c;
})();
const mazdaSized: DemoCar = (() => {
  const c: DemoCar = structuredClone(demoMazda);
  c.id = 'mazda-sized';
  for (const [tx, part] of [
    ['730', 'GHP9-3J0'],
    ['733', 'G46G-61190'],
    ['737', 'GMC8-57K30'],
    ['734', 'GML8-5102X'],
    ['744', 'GHR4-66'],
    ['746', 'GJS1-67'],
    ['756', 'GHK1-55'],
    ['784', 'GMN5-66'],
    ['793', 'GJ6A-18'],
  ])
    c.modules[tx] = { part, sw: 'A' };
  return c;
})();

const CARS = {
  leon: { car: demoLeon, timing: SIM_TIMING.leon, group: 'vag' as const, platform: 'PQ35', brand: 'SEAT / Cupra', model: 'Leon II', year: 2007 },
  mazda: { car: demoMazda, timing: SIM_TIMING.mazda, group: 'mazda' as const, platform: 'GJ', brand: 'Mazda', model: 'Mazda6 (GJ)', year: 2016 },
  'leon-sized': { car: leonSized, timing: SIM_TIMING.leon, group: 'vag' as const, platform: 'PQ35', brand: 'SEAT / Cupra', model: 'Leon II', year: 2007 },
  'mazda-sized': { car: mazdaSized, timing: SIM_TIMING.mazda, group: 'mazda' as const, platform: 'GJ', brand: 'Mazda', model: 'Mazda6 (GJ)', year: 2016 },
};

const vehicleOf = (k: keyof typeof CARS): Vehicle => {
  const c = CARS[k];
  return { vin: c.car.vin, group: c.group, brand: c.brand, model: c.model, platform: c.platform, year: c.year, fuel: c.car.diesel ? 'Diesel' : 'Petrol', nickname: '', edited: false, lastSeen: Date.now(), lastMilOn: false, lastCodes: [] };
};

// Runs a promise to the end on the simulated clock.
async function onClock<T>(p: Promise<T>): Promise<T> {
  let done = false;
  let out: T | undefined;
  let err: unknown;
  p.then(
    (v) => {
      done = true;
      out = v;
    },
    (e) => {
      done = true;
      err = e;
    },
  );
  while (!done) await jest.advanceTimersByTimeAsync(5000);
  if (err) throw err;
  return out as T;
}

async function connect(car: DemoCar, k: keyof typeof CARS) {
  const sim = new SimTransport(car, 0);
  sim.timing = CARS[k].timing;
  const client = new ElmClient(sim);
  await onClock(client.initialise());
  client.setMake(CARS[k].group, CARS[k].platform);
  return { client, sim };
}

type Times = { total: number; steps: Partial<Record<LearnStep, number>>; states: Partial<Record<LearnStep, string>>; requests: Record<string, number> };

async function learn(k: keyof typeof CARS, garage: ReturnType<typeof memoryGarage>): Promise<{ r: LearnSummary; t: Times }> {
  const { client, sim } = await connect(CARS[k].car, k);
  for (const key of Object.keys(sim.counts)) delete sim.counts[key];
  const t0 = Date.now();
  const r = await onClock(
    runLearn({ client, vin: CARS[k].car.vin, garage, isCan: true, send: true, cancelled: () => false, sendBack: async () => ({ via: 'github', detail: 'Sent' }) }),
  );
  const steps: Times['steps'] = {};
  const states: Times['states'] = {};
  for (const s of LEARN_ORDER) {
    steps[s] = Math.round((r.steps[s]?.ms ?? 0) / 100) / 10;
    states[s] = r.steps[s]?.state;
  }
  return { r, t: { total: Math.round((Date.now() - t0) / 100) / 10, steps, states, requests: { ...sim.counts } } };
}

beforeEach(async () => {
  jest.useFakeTimers({ doNotFake: ['nextTick', 'queueMicrotask', 'setImmediate'] });
  await AsyncStorage.clear();
});
afterEach(() => {
  jest.useRealTimers();
});

const results: Record<string, Times> = {};
afterAll(() => {
  const out = process.env.LEARN_SPEED_OUT;
  if (out) fs.writeFileSync(out, JSON.stringify(results, null, 1));
});

describe('Learn my car at real-car speed (simulated clock)', () => {
  for (const k of ['leon', 'mazda', 'leon-sized', 'mazda-sized'] as const) {
    it(`first run and repeat run on the demo ${k}`, async () => {
      const garage = memoryGarage([vehicleOf(k)]);
      const first = await learn(k, garage);
      results[`${k} first`] = first.t;
      expect(first.r.aborted).toBeUndefined();
      const repeat = await learn(k, garage);
      results[`${k} repeat`] = repeat.t;
      expect(repeat.r.aborted).toBeUndefined();
      // The faults of every module are read on both runs.
      expect(first.r.steps.faults?.state).toBe('done');
      expect(repeat.r.steps.faults?.state).toBe('done');
      // Further runs until the value step has nothing left (at most 12 in all):
      // the time a repeat run settles at.
      let last = repeat;
      let runs = 2;
      while (last.r.steps.values?.state === 'partial' && runs < 12) {
        last = await learn(k, garage);
        runs++;
        if (process.env.LEARN_SPEED_DEBUG) {
          const dd = await loadDiscovery(CARS[k].car.vin);
          console.log(k, runs, last.r.steps.values?.note, Object.values(dd.modules).map((m) => `${m.id}:${m.learnDone ? 'done' : (m.learnNext ?? '-')}:${Object.keys(m.found).length}`).join(' '));
        }
      }
      if (runs > 2) {
        last = await learn(k, garage);
        runs++;
      }
      results[`${k} settled`] = { ...last.t, requests: { ...last.t.requests, runs } };
    }, 300000);
  }
});
