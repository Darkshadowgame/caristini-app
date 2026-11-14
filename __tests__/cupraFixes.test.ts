jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
import { packFor } from '../src/data/cars';
import { ElmClient } from '../src/obd/elm';
import { DEMO_CARS, SimTransport } from '../src/obd/simTransport';
import { inferredFromParts, Vehicle } from '../src/vehicle/garage';
import { vagModelFromParts } from '../src/vehicle/vin';

const leon = DEMO_CARS.find((c) => c.id === 'leon')!;

describe('the 2007 Leon Cupra, from its 13 Nov 2026 logs', () => {
  it('opens the engine after it first says "temporarily not available"', async () => {
    const car = { ...leon, tp20Busy: { 0x01: 3 } };
    const c = new ElmClient(new SimTransport(car, 0));
    await c.initialise();
    c.setMake('vag', 'PQ35');
    const d = await c.readModuleDetails(c.moduleById('engine')!);
    expect(d.responded).toBe(true);
    expect(d.partNumber).toBe('1P0907115AA');
  }, 30000);

  it('works out model and platform from the engine or cluster part number, never from shared parts', () => {
    expect(vagModelFromParts([{ id: 'engine', part: '1P0907115C' }])).toEqual({ modelCode: '1P', model: 'Leon II', platform: 'PQ35' });
    expect(vagModelFromParts([{ id: 'vag-17', part: '1P0 920 925 CX' }])?.platform).toBe('PQ35');
    expect(vagModelFromParts([{ id: 'vag-19', part: '1K0907530K' }, { id: 'vag-09', part: '3C0937049AE' }])).toBeNull();
    expect(vagModelFromParts([])).toBeNull();
  });

  it('fills in the platform for a car saved without a VIN, keeping the model the owner typed', () => {
    const v = { vin: 'NO-VIN-REPORTED', group: 'vag', brand: 'Seat', model: 'Leon cupra', edited: true, platform: null, ids: { modules: [{ id: 'engine', part: '1P0907115C' }] } } as unknown as Vehicle;
    expect(inferredFromParts(v)).toEqual({ group: 'vag', platform: 'PQ35' });
    expect(inferredFromParts({ ...v, platform: 'PQ35' })).toBeNull();
  });

  it('matches the Cupra pack from part numbers when there is no VIN, and is sure once BWJ is typed', () => {
    expect(packFor('NO-VIN-REPORTED', 2007, null, '1P')?.sure).toBe(false);
    expect(packFor('NO-VIN-REPORTED', 2007, 'BWJ', '1P')?.sure).toBe(true);
    expect(packFor('NO-VIN-REPORTED', 2007, 'BWJ', '1K')).toBeNull();
    expect(packFor('NO-VIN-REPORTED', 2007, 'BWJ', null)).toBeNull();
  });
});
