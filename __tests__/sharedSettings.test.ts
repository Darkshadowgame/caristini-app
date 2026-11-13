jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
import { modulePart, partTier, sharedFits, sharedLearned } from '../src/coding/shared';
import { trimOutbox } from '../src/share/sendBack';
import type { Vehicle } from '../src/vehicle/garage';

const car = (over: Partial<Vehicle>): Vehicle =>
  ({ vin: 'X', group: 'vag', brand: 'Audi', model: 'A6', platform: 'MLB', year: 2012, fuel: 'Diesel', nickname: '', edited: false, lastSeen: 0, lastMilOn: false, lastCodes: [], ...over }) as Vehicle;

const setting = (module: string, part?: string, did?: string) => ({
  id: 'learned-1',
  title: 'Needle sweep',
  learnedAt: '2026-11-13',
  parts: [{ module, ...(did ? { did } : {}), length: 11, byte: 1, mask: 0x01, on: 0x01, off: 0x00, ...(part ? { part } : {}) }],
});

describe('learned settings offered on the owner’s other cars', () => {
  const a6 = car({ vin: 'A', learned: [setting('vag-17', '4G8920950K')], ids: { modules: [{ id: 'vag-17', part: '4G8 920 950 K' } as never] } });

  it('matches part numbers exactly, or by part without revision on the same VW platform', () => {
    expect(partTier('4G8920950K', '4G8 920 950 K', false)).toBe(1);
    expect(partTier('4G8920950K', '4G8920950M', true)).toBe(2);
    expect(partTier('4G8920950K', '4G8920950M', false)).toBe(0);
    expect(partTier('4G8920950K', '', true)).toBe(0);
    expect(modulePart(a6, 'vag-17')).toBe('4G8920950K');
  });

  it('offers a setting when the same module is fitted, marked with where it came from', () => {
    const a7 = car({ vin: 'B', model: 'A7', knowledge: { 'vag-17': { plainName: 'Cluster', what: '', part: '4G8920950K', at: 0 } } });
    const got = sharedLearned(a7, [a6, a7]);
    expect(got).toHaveLength(1);
    expect(got[0].id).toBe('shared-learned-1');
    expect(got[0].tier).toBe(1);
    expect(got[0].from).toContain('A6');
  });

  it('does not offer it for another part, another family, a protected module, an adaptation value, or twice', () => {
    expect(sharedLearned(car({ vin: 'C', knowledge: { 'vag-17': { plainName: '', what: '', part: '1P0920823A', at: 0 } } }), [a6])).toHaveLength(0);
    expect(sharedLearned(car({ vin: 'D', group: 'ford', brand: 'Ford', knowledge: { 'vag-17': { plainName: '', what: '', part: '4G8920950K', at: 0 } } }), [a6])).toHaveLength(0);
    const gw = car({ vin: 'E', learned: [setting('vag-19', '4G0907468F')] });
    expect(sharedLearned(car({ vin: 'F', knowledge: { 'vag-19': { plainName: '', what: '', part: '4G0907468F', at: 0 } } }), [gw])).toHaveLength(0);
    const adapt = car({ vin: 'G', learned: [setting('vag-17', '4G8920950K', '0C1F')] });
    const same = car({ vin: 'H', knowledge: { 'vag-17': { plainName: '', what: '', part: '4G8920950K', at: 0 } } });
    expect(sharedLearned(same, [adapt])).toHaveLength(0);
    expect(sharedLearned(car({ ...same, learned: a6.learned }), [a6])).toHaveLength(0);
  });

  it('is shown only when the coding has the learned length and the bits hold on or off', () => {
    const s = setting('vag-17', '4G8920950K');
    expect(sharedFits(s, { 'vag-17': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] })).toBe(true);
    expect(sharedFits(s, { 'vag-17': [0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0] })).toBe(true);
    expect(sharedFits(s, { 'vag-17': [0, 0, 0] })).toBe(false);
    expect(sharedFits(s, {})).toBe(false);
  });
});

describe('outbox', () => {
  it('keeps the newest 30 files and stays under the size cap', () => {
    const mk = (i: number, size = 10) => ({ path: `p${i}`, name: `n${i}`, text: 'x'.repeat(size), message: '', error: '', at: i });
    const many = Array.from({ length: 45 }, (_, i) => mk(i));
    const kept = trimOutbox(many);
    expect(kept).toHaveLength(30);
    expect(kept[0].path).toBe('p15');
    const big = trimOutbox([mk(1, 2_000_000), mk(2, 2_000_000), mk(3, 100)]);
    expect(big.map((o) => o.path)).toEqual(['p2', 'p3']);
  });
});
