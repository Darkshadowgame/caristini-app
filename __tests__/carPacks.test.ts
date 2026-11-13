import { CAR_PACKS, packFor } from '../src/data/cars';

describe('built-in car packs', () => {
  it('matches a 2007 Leon Cupra once engine code BWJ is typed', () => {
    const m = packFor('VSSZZZ1PZ7R000000', 2007, 'BWJ');
    expect(m?.sure).toBe(true);
    expect(m?.pack.engineCode).toBe('BWJ');
  });

  it('offers a possible match for another 2007 to 2009 Leon II until the engine code is typed', () => {
    expect(packFor('VSSZZZ1PZ8R123456', 2008)?.sure).toBe(false);
    expect(packFor('VSSZZZ1PZ8R123456', 2008, 'bwj')?.sure).toBe(true);
    expect(packFor('VSSZZZ1PZ8R123456', 2008, 'BKD')).toBeNull();
  });

  it('does not match other years, models or makers', () => {
    expect(packFor('VSSZZZ1PZCR123456', 2012)).toBeNull();
    expect(packFor('VSSZZZ5FZJR123456', 2018)).toBeNull();
    expect(packFor('WVWZZZ1KZ7W123456', 2007)).toBeNull();
  });

  it('drops the pack when another engine code is typed', () => {
    expect(packFor('VSSZZZ1PZ7R000000', 2007, 'BWA')).toBeNull();
  });

  it('keeps a source on every item', () => {
    for (const p of CAR_PACKS) {
      const all = [...p.parts, ...p.fluids, ...p.specs, ...p.schedule, ...p.faults, ...p.recalls];
      for (const x of p.faults) expect(['High', 'Medium', 'Low']).toContain(x.confidence);
      for (const x of all) expect(x.source.url).toMatch(/^https?:\/\//);
      for (const x of [...p.parts, ...p.fluids, ...p.specs, ...p.schedule]) expect(['High', 'Medium']).toContain(x.confidence);
    }
  });
});
