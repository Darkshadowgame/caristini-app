// UX recheck of 16 Nov 2026: one store for Learn my car and Unknown values,
// Put back after a write, the DPF monitor from the car's own sensors, sane
// suggested tiles, one count and one time wording, fault labels and copy.
jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
import AsyncStorage from '@react-native-async-storage/async-storage';
import { groupName } from '../src/data/groupLabels';
import { loadHistory } from '../src/history';
import { afterQuick, aboutTime, DiscoverModule, exploreStatus, loadDiscovery, quickDone, quickExploreRanges, quickResume } from '../src/discover';
import { faultLabel, faultMeaning, obdStates, sentenceCase } from '../src/diag/faults';
import { cacheAfterWrite, codingNow, putBackState } from '../src/diag/timeline';
import { learnSummaryHeader, runLearn } from '../src/learn/runLearn';
import { routeFor } from '../src/learn/valueGroups';
import { baseCode, classifyFault } from '../src/mot/rules';
import { dpfPlan } from '../src/monitors/dpf';
import { savedResult } from '../src/obd/battery';
import { ElmClient } from '../src/obd/elm';
import { isPlausible, sensorsFor, sensorsForCar, unitOf } from '../src/obd/sensors';
import { suggestedSensors } from '../src/obd/sensorSearch';
import { DEMO_CARS, DemoCar, SimTransport } from '../src/obd/simTransport';
import { stateText } from '../src/coding/items';
import { notSentText } from '../src/share/sendBack';
import { aboutRange, durationText, shortDuration } from '../src/timeText';
import { moduleCount, sensorCount, sensorCountText } from '../src/vehicle/counts';
import { Vehicle } from '../src/vehicle/garage';
import { platformModels } from '../src/vehicle/vin';

beforeEach(async () => {
  await AsyncStorage.clear();
});

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
  const client = new ElmClient(new SimTransport(car, 0));
  await client.initialise();
  client.setMake(group, platform);
  return client;
}

describe('1. one store for Learn my car and Unknown values', () => {
  const key = JSON.stringify(quickExploreRanges('7E1', ['1001']));

  it('uses the same quick explore ranges, without F400 off the engine', () => {
    expect(quickExploreRanges('7E0', ['1001'])).toEqual([
      [0x1000, 0x10ff],
      [0xf400, 0xf4ff],
    ]);
    expect(quickExploreRanges('7E1', ['1001'])).toEqual([[0x1000, 0x10ff]]);
  });

  it('carries on from where either screen stopped, and reads both as done', () => {
    const m: DiscoverModule = { id: 'gearbox', name: 'Gearbox', tx: '7E1', rx: '7E9', found: { '1005': { samples: ['01', '02'], moves: true } } };
    const cut = afterQuick(m, key, { finished: false, lastDid: 0x1040 });
    expect(quickResume(cut, key)).toBe(0x1041);
    expect(quickDone(cut, key)).toBe(false);
    expect(exploreStatus(cut, { key }).text).toBe('1 found so far, carries on');
    const done = afterQuick(cut, key, { finished: true, lastDid: 0x10ff });
    expect(quickDone(done, key)).toBe(true);
    expect(exploreStatus(done, { key })).toEqual({ text: 'Quick explore done: 1 value, 1 moving', state: 'done' });
    // A quick explore from an older version counts as done too.
    expect(quickDone({ ...m, quickDone: true }, key)).toBe(true);
  });

  it('shows older VW modules by their value groups', () => {
    expect(exploreStatus(undefined, { older: true, groups: { '115': ['/min', '%', 'mbar', 'mbar'] }, groupsDone: true })).toEqual({ text: '4 values in 1 value group', state: 'done' });
    expect(exploreStatus(undefined, { older: true }).text).toBe('Value groups not read yet');
    expect(exploreStatus(undefined, { older: true, groupsDone: true }).text).toBe('Value groups read: none hold values');
  });

  it('works out how a module answers', () => {
    const def = { id: 'engine', name: 'Engine', tx: '7E0', rx: '7E8', groups: [], source: '' };
    expect(routeFor({ routeOf: () => null }, { platform: 'PQ35' }, def)).toBe('tp20');
    expect(routeFor({ routeOf: () => null }, { platform: 'MQB', routes: { engine: { via: 'tp20' } as never } }, def)).toBe('tp20');
    expect(routeFor({ routeOf: () => 'uds' }, { platform: 'PQ35' }, def)).toBe('uds');
  });

  it('on the demo Leon, Unknown values reads what Learn my car explored, and a repeat run says so', async () => {
    const car = DEMO_CARS.find((c) => c.id === 'leon')!;
    const garage = memoryGarage([vehicleOf(car, 'vag', 'PQ35')]);
    const run = async () => runLearn({ client: await connect(car, 'vag', 'PQ35'), vin: car.vin, garage, isCan: true, send: false, cancelled: () => false, retryWaitMs: 0, valuesLimitMs: 60000 });
    const first = await run();
    expect(first.steps.sensors?.note).toMatch(/value groups are read in the next step/);
    const v = garage.latest(car.vin)!;
    const count = sensorCount(v);
    expect(count.groupValues).toBeGreaterThan(0);
    expect(first.groupValues).toBe(count.groupValues);
    expect(first.groups).toBe(count.groups);
    const engine = exploreStatus(undefined, { older: true, groups: v.groupsFound?.engine, groupsDone: v.groupsScanned?.includes('engine') });
    expect(engine.state).not.toBe('none');
    // History says the same module count as the health check step.
    const scan = (await loadHistory(car.vin)).find((e) => e.kind === 'scan')!;
    expect(first.steps.faults?.note).toContain(`${scan.modules} modules answered`);
    expect(scan.detail).toMatch(new RegExp(`^${scan.modules} modules answered`));
    // Step 1 counts the modules the health check added.
    expect(first.steps.modules?.note).toBe(`${first.modules} modules, ${first.codings} codings backed up`);
    const second = await run();
    // No promise of values "in the next step" when there is nothing left to read.
    expect(second.steps.sensors?.note).toMatch(/found before/);
    expect(second.steps.values?.note).toMatch(/nothing new to explore/);
  }, 60000);

  it('on the demo Mazda, a module Learn my car explored is not shown as not explored', async () => {
    const car = DEMO_CARS.find((c) => c.id === 'mazda')!;
    const garage = memoryGarage([vehicleOf(car, 'mazda', '')]);
    await runLearn({ client: await connect(car, 'mazda', ''), vin: car.vin, garage, isCan: true, send: false, cancelled: () => false, retryWaitMs: 0, valuesLimitMs: 60000 });
    const disc = await loadDiscovery(car.vin);
    const mods = Object.values(disc.modules);
    expect(mods.length).toBeGreaterThan(0);
    for (const m of mods) expect(exploreStatus(m, { key: m.learnDone ?? '' }).state).not.toBe('none');
  }, 60000);
});

describe('2. Put back after a write', () => {
  const original = '0F1A0000';
  const rows = [{ key: 'central', at: 2, before: '0F1A0000', after: '8F1A0000' }];

  it('offers Put back when the saved coding predates the write', () => {
    expect(codingNow('central', { central: '0F1A0000' }, rows)).toBe('8F1A0000');
    expect(putBackState({ key: 'central' }, { central: original }, { central: '0F1A0000' }, rows)).toBe('offer');
  });

  it('keeps a later read, and says original once it is back', () => {
    expect(codingNow('central', { central: '0F1A0000' }, [...rows, { key: 'central', at: 3, before: '8F1A0000', after: '0F1A0000' }])).toBe('0F1A0000');
    expect(putBackState({ key: 'central' }, { central: original }, cacheAfterWrite({}, [{ key: 'central', hex: '0f1a0000' }]), [])).toBe('original');
  });

  it('refreshes the cache after a write', () => {
    expect(cacheAfterWrite({ engine: 'AA', central: '0F' }, [{ key: 'central', hex: '8f' }])).toEqual({ engine: 'AA', central: '8F' });
  });
});

describe('3. DPF monitor from the car’s own sensors', () => {
  it('reads the found Diesel filter and exhaust sensors and drops what they cover', () => {
    const all = sensorsFor('vag');
    const pick = (re: RegExp) => all.find((r) => re.test(r.n))!;
    const found = [pick(/^Diesel particulate filter distance since last regeneration$/), pick(/^Diesel particulate filter regeneration status$/), pick(/^Engine speed$/i) ?? all[0]];
    const plan = dpfPlan('vag', new Set(), found);
    expect(plan.found.map((r) => r.n)).toEqual(['Diesel particulate filter distance since last regeneration', 'Diesel particulate filter regeneration status']);
    expect(plan.notKnown.some((l) => l.startsWith('Regeneration status'))).toBe(false);
    expect(plan.notKnown.some((l) => l.startsWith('Distance since'))).toBe(false);
    expect(dpfPlan('vag', new Set()).notKnown.length).toBe(3);
  });
});

describe('4. suggested tiles stay within a sane range', () => {
  it('marks 716 V as not plausible and suggests another value instead', () => {
    const rows = sensorsFor('vag');
    const variant = rows.find((r) => r.h === '7E0' && r.d === '105E' && r.u === 'V')!;
    expect(isPlausible(variant, 716)).toBe(false);
    expect(isPlausible(variant, 14.1)).toBe(true);
    const battery = rows.filter((r) => /battery voltage/i.test(r.n) && r.u === 'V');
    const first = suggestedSensors(battery, unitOf, 1);
    const next = suggestedSensors(battery.filter((r) => r !== first[0]), unitOf, 1);
    expect(next[0]).not.toBe(first[0]);
  });
});

describe('5, 6 and 9. one count, one wording', () => {
  it('counts sensors and value groups once', () => {
    const v = { group: 'vag' as const, platform: 'PQ35', groupsFound: { engine: { '115': ['/min', '%', 'mbar', 'mbar'], '7': [] } } };
    expect(sensorCount(v)).toEqual({ maker: 0, groupValues: 4, groups: 1 });
    expect(sensorCountText(sensorCount(v))).toBe('4 values in 1 value group');
    expect(sensorCountText({ maker: 88, groupValues: 0, groups: 0 })).toBe('88 sensors');
    expect(sensorCountText({ maker: 0, groupValues: 0, groups: 0 })).toBe('No sensors found yet');
  });

  it('gives PQ35 cars no newer-protocol sensor list anywhere', () => {
    expect(sensorsForCar({ group: 'vag', platform: 'PQ35' })).toEqual([]);
    expect(sensorsForCar({ group: 'vag', platform: 'MLB' }).length).toBeGreaterThan(0);
  });

  it('counts modules from one place', () => {
    expect(moduleCount({ group: 'vag', ids: { modules: [{ id: 'engine' }, { id: 'abs' }] }, knowledge: { abs: {}, 'vag-17': {} } })).toBe(3);
  });

  it('names a group after what it holds', () => {
    expect(groupName('01', 115)).toBe('Boost (group 115)');
    expect(groupName('01', 20)).toBe('Knock retard cylinder 1, Knock retard cylinder 2 (group 20)');
    expect(groupName('01', 250)).toBe('Group 250');
  });
});

describe('7. one time wording', () => {
  it('says seconds under a minute and never "1 minutes"', () => {
    expect(durationText(40)).toBe('40 seconds');
    expect(durationText(60)).toBe('1 minute');
    expect(aboutRange(50, 70)).toBe('About 50 seconds to 2 minutes');
    expect(aboutRange(20, 40)).toBe('About 20 to 40 seconds');
    expect(aboutRange(61, 80)).toBe('About 1 to 2 minutes');
    expect(aboutRange(60, 60)).toBe('About 1 minute');
    expect(aboutRange(30, 30)).toBe('About 30 seconds');
    expect(aboutRange(70, 70)).not.toMatch(/1 minutes/);
    expect(aboutRange(120, 300)).toBe('About 2 to 5 minutes');
    expect(aboutRange(120, 300, { lower: true })).toBe('about 2 to 5 minutes');
    expect(aboutTime(30)).toBe('about 30 seconds');
  });

  it('shows 4 s, not 1 min, so far', () => {
    expect(shortDuration(4000)).toBe('4 s');
    expect(shortDuration(150000)).toBe('3 min');
  });
});

describe('8. the real reason a run was not sent', () => {
  it('names the reason', () => {
    expect(notSentText('No GitHub token is set (Settings, Developer options).')).toBe('Not sent: no GitHub token is set (Settings, Developer options). Saved on this phone; it goes by itself next time the app opens.');
    expect(notSentText('Network request failed')).toMatch(/^Not sent: the phone could not reach GitHub/);
    expect(notSentText('GitHub refused the token (401).')).toMatch(/^Not sent: GitHub refused/);
  });
});

describe('17. first run summary', () => {
  it('leads with faults and modules after a first run', () => {
    const base = { stopped: false, faults: 4, modules: 7, minutes: 1.2 };
    expect(learnSummaryHeader({ ...base, mode: { full: true, why: 'first' } })).toBe('First read done: 4 faults, 7 modules');
    expect(learnSummaryHeader({ ...base, mode: { full: false, why: 'repeat' } })).toBe('Repeat run done in 1 min');
    expect(learnSummaryHeader({ ...base, minutes: 0.5, mode: { full: false, why: 'repeat' } })).toBe('Repeat run done in 30 s');
  });
});

describe('13 and 20. fault labels', () => {
  it('uses sentence case and keeps capitals', () => {
    expect(sentenceCase('Diesel Particulate Filter Efficiency Below Threshold (Bank 1)')).toBe('Diesel particulate filter efficiency below threshold (bank 1)');
    expect(sentenceCase('"A" Camshaft Position - Timing Over-Advanced or System Performance (Bank 1)')).toBe('"A" camshaft position - timing over-advanced or system performance (bank 1)');
    expect(sentenceCase('A/C pressure/temperature sensor (G395)')).toBe('A/C pressure/temperature sensor (G395)');
    expect(sentenceCase('Supply voltage B+')).toBe('Supply voltage B+');
    expect(faultMeaning('P0420').title).toBe(sentenceCase(faultMeaning('P0420').title));
  });

  it('gives unknown maker faults one pattern, older saved texts too', () => {
    expect(faultMeaning('0000F3', { brand: 'Audi' }).title).toBe('Audi fault 0000F3');
    expect(faultMeaning('00471', { brand: 'Audi' }).title).toBe('Audi fault 00471');
    expect(faultLabel({ code: '0000F3', text: 'Audi fault number 243' })).toBe('Audi fault 0000F3');
    expect(faultLabel({ code: 'P174100', text: 'Audi-specific code' })).toBe('Audi fault P1741');
    expect(faultLabel({ code: 'P0420', text: 'Catalyst System Efficiency Below Threshold (Bank 1)' })).toBe('Catalyst system efficiency below threshold (bank 1)');
  });

  it('shows the base code in the MOT check', () => {
    expect(baseCode('P0011B5')).toBe('P0011');
    expect(baseCode('00532')).toBe('00532');
    const f = classifyFault({ module: 'Engine', moduleId: 'engine', code: 'P0011B5' }, { fuel: 'Diesel', year: 2012 }, { milOn: true });
    expect(f?.code).toBe('P0011');
    expect(f?.key).toBe('fault:Engine:P0011B5');
  });

  it('never shows a permanent code only as stored', () => {
    expect(obdStates('P0420', { stored: ['P0420'], pending: [], permanent: ['P0420'] })).toBe('Stored, permanent');
    expect(obdStates('P0171', { stored: ['P0171'], pending: [], permanent: [] })).toBe('Stored');
  });
});

describe('15, 16, 20. battery, Customise and copy', () => {
  it('shows Learn my car’s battery read as a result', () => {
    const r = savedResult({ volts: 14.1, at: 1, from: 'Learn my car' })!;
    expect(r.title).toBe('Engine running, from Learn my car');
    expect(r.verdict.word).toBe('Charging');
    expect(savedResult({ volts: 12.6, at: 1, from: 'Learn my car' })!.verdict.word).toBe('Good');
    expect(savedResult(undefined)).toBeNull();
  });

  it('describes a setting as it is on the car', () => {
    expect(stateText({ summary: 'One touch of the stalk gives 3 flashes.' }, false)).toBe('Off on your car. When on, one touch of the stalk gives 3 flashes.');
    expect(stateText({ summary: 'One touch of the stalk gives 3 flashes.' }, true)).toBe('On on your car: one touch of the stalk gives 3 flashes.');
  });

  it('lists each PQ35 model once', () => {
    const list = platformModels('PQ35');
    expect(list).toContain('Golf V / VI');
    expect(list).not.toContain('Golf VI');
  });
});
