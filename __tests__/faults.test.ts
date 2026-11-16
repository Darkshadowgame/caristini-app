import { countFaults, extraObdCodes, faultKey, faultMeaning, isPowertrainModule, vagPCode } from '../src/diag/faults';
import { headline, summarise } from '../src/mot/rules';
import { withOlderModules } from '../src/vehicle/ids';

describe('fault count', () => {
  it('maps VW engine numbers to their P code', () => {
    expect(vagPCode('16684')).toBe('P0300');
    expect(vagPCode('00532')).toBeNull();
    expect(vagPCode('P0300')).toBeNull();
  });

  it('counts the same fault read two ways once', () => {
    expect(faultKey('16684')).toBe('P0300');
    expect(faultKey('P030000')).toBe('P0300');
    expect(faultKey('p0300')).toBe('P0300');
    expect(faultKey('00532')).toBe('00532');
  });

  it('adds the engine codes no module reported (the demo Leon: 4 faults, not 2)', () => {
    const modules = ['16684', '00532'];
    const obd = ['P0420', 'P0171', 'P0300'];
    expect(extraObdCodes(modules, obd)).toEqual(['P0420', 'P0171']);
    expect(countFaults(modules, obd)).toBe(4);
  });

  it('counts engine codes when no module was read, each once', () => {
    expect(countFaults([], ['P0420', 'P0420', 'P0171'])).toBe(2);
  });

  it('keeps module faults that share a code in different modules', () => {
    expect(countFaults(['U010000', 'U010000'], ['U0100'])).toBe(2);
  });
});

describe('fault meaning', () => {
  it('treats a P code in a module outside the engine as the maker own number', () => {
    const m = faultMeaning('P000183', { module: 'Heating and air conditioning', brand: 'Audi' });
    expect(m.label).toBe('P0001');
    expect(m.title).toBe('Audi fault P0001');
    expect(m.scope).toBe('Manufacturer-specific');
    expect(m.makerUse).toBe(true);
    expect(m.advice).toBeNull();
    expect(m.entry).toBeNull();
  });

  it('gives the library entry for engine codes', () => {
    const m = faultMeaning('P0300', { module: 'Engine' });
    expect(m.entry?.code).toBe('P0300');
    expect(m.advice?.causes.length).toBeGreaterThan(0);
    expect(faultMeaning('P0300').entry?.code).toBe('P0300');
  });

  it('gives no general cause list for a maker code', () => {
    const m = faultMeaning('P1741', { module: 'Transmission', brand: 'Audi' });
    expect(m.title).toBe('Audi fault P1741');
    expect(m.scope).toBe('Manufacturer-specific');
    expect(m.advice).toBeNull();
  });

  it('shows the P code entry for a VW number that maps to one, in the engine only', () => {
    const m = faultMeaning('16684', { module: 'Engine' });
    expect(m.kind).toBe('vw');
    expect(m.pcode).toBe('P0300');
    expect(m.entry?.code).toBe('P0300');
    expect(m.advice).not.toBeNull();
    const other = faultMeaning('16684', { module: 'Airbags' });
    expect(other.pcode).toBeNull();
    expect(other.advice).toBeNull();
    expect(faultMeaning('00532', { module: 'Airbags' }).advice).toBeNull();
  });

  it('names maker-numbered faults', () => {
    expect(faultMeaning('0000F3', { brand: 'Audi' }).title).toBe('Audi fault 0000F3');
  });

  it('knows engine and gearbox modules', () => {
    expect(isPowertrainModule('Engine (OBD2)')).toBe(true);
    expect(isPowertrainModule('Transmission')).toBe(true);
    expect(isPowertrainModule(undefined)).toBe(true);
    expect(isPowertrainModule('Heating and air conditioning')).toBe(false);
  });
});

describe('older modules in Parts and IDs', () => {
  it('adds part numbers from the older module search', () => {
    const list = withOlderModules(
      [{ id: 'engine', name: 'Engine', code: '01', part: '1K0907115', at: 1 }],
      [
        { address: 0x1f, moduleId: 'vag-19', part: '1K0907530L', component: 'J533 Gateway', at: 2 },
        { address: 0x01, moduleId: 'engine', part: 'other', at: 2 },
      ],
      (id) => ({ name: id === 'vag-19' ? 'CAN gateway' : id, code: '19' }),
    );
    expect(list.map((m) => m.id)).toEqual(['engine', 'vag-19']);
    expect(list[1]).toMatchObject({ name: 'CAN gateway', part: '1K0907530L', systemName: 'J533 Gateway' });
    expect(list[0].part).toBe('1K0907115');
  });
});

describe('MOT headline', () => {
  it('says not checked yet before anything is done', () => {
    const s = summarise(null, {}, { fuel: 'Petrol', year: 2007 });
    expect(headline(s)).toMatch(/^Not checked yet\. To do: read the car and check \d+ items\.$/);
  });
});
