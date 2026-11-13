import { ALL_ITEMS, codingItemsFor } from '../src/coding/items';

describe('one item per setting, the best-supported kept', () => {
  it('shows the high-confidence 120 km/h chime with every source', () => {
    const chime = codingItemsFor('vag', 'MLB').filter((i) => i.module === 'vag-17' && i.byte === 0 && i.bits.join() === '6');
    expect(chime).toHaveLength(1);
    expect(chime[0].confidence).toBe('high');
    expect(chime[0].sources.length).toBeGreaterThanOrEqual(2);
    expect(chime[0].length).toBe(11);
  });

  it('has no duplicate settings', () => {
    const keys = ALL_ITEMS.map((i) => `${i.platforms.join()}|${i.module}|${i.byte}|${i.bits.join()}|${i.field?.mask ?? ''}`);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
