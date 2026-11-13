jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
import { ElmClient } from '../src/obd/elm';
import { readKey, sameFamily, sensorsFor } from '../src/obd/sensors';
import { quickRows, remainingRows, sharedSensorKeys } from '../src/obd/sharedSensors';
import { DEMO_CARS, SimTransport } from '../src/obd/simTransport';

describe('sharing what one car learned with the next', () => {
  it('groups makes into families', () => {
    expect(sameFamily({ group: 'vag', brand: 'Audi' }, { group: 'vag', brand: 'SEAT / Cupra' })).toBe(true);
    expect(sameFamily({ group: 'ford', brand: 'Ford' }, { group: 'mazda', brand: 'Mazda' })).toBe(true);
    expect(sameFamily({ group: 'other', brand: 'BMW' }, { group: 'other', brand: 'BMW' })).toBe(true);
    expect(sameFamily({ group: 'other', brand: 'BMW' }, { group: 'other', brand: 'Volvo' })).toBe(false);
    expect(sameFamily({ group: 'vag', brand: 'Audi' }, { group: 'ford', brand: 'Ford' })).toBe(false);
    expect(sameFamily({ group: 'other', brand: 'Unknown make' }, { group: 'other', brand: 'Unknown make' })).toBe(false);
  });

  it("offers another car's sensors to a new car of the same family, skipping what was asked", () => {
    const audi = { vin: 'A', group: 'vag' as const, brand: 'Audi', sensorsFound: ['7E0-1007', '7E0-100C'] };
    const leon = { vin: 'L', group: 'vag' as const, brand: 'SEAT / Cupra' };
    const ford = { vin: 'F', group: 'ford' as const, brand: 'Ford' };
    const shared = sharedSensorKeys(leon, [audi]);
    expect(shared.has('7E0-1007')).toBe(true);
    expect(sharedSensorKeys(ford, [audi]).has('7E0-1007')).toBe(false);
    const all = sensorsFor('vag');
    const asked = new Set(['7E0-1007']);
    const quick = quickRows(all, shared, asked).map(readKey);
    expect(quick).toContain('7E0-100C');
    expect(quick).not.toContain('7E0-1007');
    expect(remainingRows(all, asked).some((r) => readKey(r) === '7E0-1007')).toBe(false);
  });

  it('reports every value it asked, so a later search can skip them', async () => {
    const a6 = DEMO_CARS.find((c) => c.id === 'a6')!;
    const c = new ElmClient(new SimTransport(a6, 0));
    await c.initialise();
    c.setMake('vag', 'MLB');
    const rows = sensorsFor('vag').filter((r) => r.h === '7E0').slice(0, 12);
    const asked: string[] = [];
    const found = await c.probeSensors(rows, { onAsked: (k) => asked.push(k) });
    for (const k of found) expect(asked).toContain(k);
    expect(asked.length).toBeGreaterThanOrEqual(found.length);
  });
});

describe('quick explore blocks', () => {
  it('covers the 256-number blocks of known values plus F400', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { quickRanges } = require('../src/discover');
    expect(quickRanges(['1007', '10A0', '2A26'])).toEqual([
      [0x1000, 0x10ff],
      [0x2a00, 0x2aff],
      [0xf400, 0xf4ff],
    ]);
  });
});

describe('adapter log sending', () => {
  it('sends only lines added since the last send', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { trafficLog } = require('../src/obd/trafficLog');
    trafficLog.clear();
    trafficLog.add('>', '0902');
    trafficLog.add('<', 'NO DATA');
    expect(trafficLog.unsentCount()).toBe(2);
    trafficLog.markSent();
    trafficLog.add('>', '22F190');
    expect(trafficLog.unsentCount()).toBe(1);
    expect(trafficLog.unsentText('# h').split('\n')).toHaveLength(2);
    expect(trafficLog.unsentText('# h')).toContain('22F190');
  });
});
