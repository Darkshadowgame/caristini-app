import { codeAnatomy, DTC_LIBRARY, genericAdvice, lookupDtc, searchDtc } from '../src/data/dtcLibrary';
import { categoriesFor, MODS, modsForVehicle } from '../src/mods/catalogue';
import { PROCEDURES } from '../src/service/procedures';
import { decodeVin, isValidVin, modelYearFromCode } from '../src/vehicle/vin';

describe('VIN decoding', () => {
  it('recognises a VW Golf VII with year', () => {
    const d = decodeVin('WVWZZZAUZHW000001');
    expect(d).toMatchObject({ valid: true, group: 'vag', brand: 'Volkswagen', model: 'Golf VII', platform: 'MQB', year: 2017, yearReliable: true });
  });

  it('recognises Skoda, Audi and SEAT', () => {
    expect(decodeVin('TMBJJ7NE5L0000001').brand).toBe('Skoda');
    expect(decodeVin('WAUZZZ8V5JA000001')).toMatchObject({ brand: 'Audi', model: 'A3 (8V)' });
    expect(decodeVin('VSSZZZ5FZJR000001')).toMatchObject({ brand: 'SEAT / Cupra', platform: 'MQB' });
  });

  it("recognises the owner's cars", () => {
    expect(decodeVin('WAUZZZ4GXCN000000')).toMatchObject({ brand: 'Audi', model: 'A6 C7', platform: 'MLB', year: 2012 });
    expect(decodeVin('VSSZZZ1PZ7R000000')).toMatchObject({ brand: 'SEAT / Cupra', model: 'Leon II', platform: 'PQ35', year: 2007 });
    expect(decodeVin('WF05XXGCC5FM00000').group).toBe('ford');
  });

  it('flags European Ford years as unreliable', () => {
    const d = decodeVin('WF0XXXGCDXKA00001');
    expect(d.group).toBe('ford');
    expect(d.yearReliable).toBe(false);
  });

  it('reads Mazda model codes', () => {
    expect(decodeVin('JMZKF6W1600000001')).toMatchObject({ group: 'mazda', model: 'CX-5 (KF)' });
  });

  it('rejects bad VINs and unknown makers', () => {
    expect(isValidVin('SIMULATED0CAR0001')).toBe(false); // contains I
    expect(decodeVin('ABC').valid).toBe(false);
    expect(decodeVin('ZFA31200000000001').group).toBe('other');
  });

  it('maps year codes across the 30-year cycle', () => {
    expect(modelYearFromCode('A', 2026)).toBe(2010);
    expect(modelYearFromCode('L', 2026)).toBe(2020);
    expect(modelYearFromCode('T', 2026)).toBe(2026);
    expect(modelYearFromCode('9', 2026)).toBe(2009);
    expect(modelYearFromCode('I', 2026)).toBeNull();
  });
});

describe('per-car filtering', () => {
  it('shows MQB mods only for an MQB VW', () => {
    const list = modsForVehicle('vag', 'MQB');
    expect(list.length).toBeGreaterThan(0);
    expect(list.every((m) => m.group === 'vag' && m.platforms?.includes('MQB'))).toBe(true);
    expect(modsForVehicle('vag', 'PQ35').some((m) => m.id === 'vag-pq-staging')).toBe(true);
    expect(modsForVehicle('vag', 'PQ35').some((m) => m.id === 'vag-mqb-needle-sweep')).toBe(false);
  });

  it('shows nothing for other makes and puts popular first', () => {
    expect(modsForVehicle('other', null)).toEqual([]);
    expect(categoriesFor(modsForVehicle('ford', null))[0].name).toBe('Most popular');
  });

  it('gives every mod and service method a source link', () => {
    for (const m of MODS) {
      expect(m.sources.length).toBeGreaterThan(0);
      for (const s of m.sources) expect(s.url).toMatch(/^https:\/\//);
    }
    for (const make of Object.values(PROCEDURES)) for (const m of make.methods) expect(m.source.url).toMatch(/^https:\/\//);
  });
});

describe('fault code library', () => {
  it('has a broad, unique set of entries', () => {
    expect(DTC_LIBRARY.length).toBeGreaterThan(300);
    expect(new Set(DTC_LIBRARY.map((d) => d.code)).size).toBe(DTC_LIBRARY.length);
  });

  it('looks up and searches', () => {
    expect(lookupDtc('p0171')?.causes[0]).toMatch(/vacuum/i);
    expect(searchDtc('P0171')[0].code).toBe('P0171');
    expect(searchDtc('misfire').some((d) => d.code === 'P0300')).toBe(true);
    expect(searchDtc('P04').every((d) => d.code.startsWith('P04'))).toBe(true);
  });

  it('explains any well-formed code', () => {
    expect(codeAnatomy('P1234')?.scope).toBe('Manufacturer-specific');
    expect(codeAnatomy('P0301')?.area).toMatch(/ignition|misfire/i);
    expect(codeAnatomy('hello')).toBeNull();
    expect(genericAdvice('P1399')?.causes.length).toBeGreaterThan(0);
  });
});
