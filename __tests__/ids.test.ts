import { ElmClient } from '../src/obd/elm';
import { DEMO_CARS, SimTransport } from '../src/obd/simTransport';
import { catalogueLinks, idsText, mergeModuleIds } from '../src/vehicle/ids';

const def = (id: string, name: string, code?: string) => ({ id, name, code, tx: '7E0', rx: '7E8', groups: [], source: 'test' });

describe('Parts and IDs', () => {
  it('keeps one entry per module and earlier fields a newer read did not return', () => {
    const first = mergeModuleIds([], [{ def: def('engine', 'Engine', '01'), responded: true, partNumber: '03L906018LB', software: '9970', vin: null, hardware: '03L907309', systemName: 'R4 2.0L EDC', serial: null, coding: '0102' }], 1);
    const again = mergeModuleIds(first, [
      { def: def('engine', 'Engine', '01'), responded: true, partNumber: '03L906018LB', software: '9971', vin: null },
      { def: def('vag-17', 'Instrument cluster', '17'), responded: true, partNumber: '4G8920950K', software: '0209', vin: null },
      { def: def('vag-55', 'Headlights', '55'), responded: false, partNumber: null, software: null, vin: null },
    ], 2);
    expect(again.map((m) => m.id)).toEqual(['engine', 'vag-17']);
    expect(again[0]).toMatchObject({ software: '9971', hardware: '03L907309', systemName: 'R4 2.0L EDC', coding: '0102', at: 2 });
    const text = idsText({ title: 'Audi A6', vin: 'WAUZZZ4G1CN000001' }, { modules: again, codes: { engineCode: { value: 'CGLC', from: 'ai' }, paintCode: { value: 'LY9B', from: 'owner' } } });
    expect(text).toContain('Engine code: CGLC (found by AI, check the data label)');
    expect(text).toContain('Paint code: LY9B');
    expect(text).toContain('  Part number: 4G8920950K');
    expect(catalogueLinks('WAUZZZ4G1CN000001')[0].url).toBe('https://partsouq.com/catalogs/vin/WAUZZZ4G1CN000001/');
  });

  it('reads every module identity from the demo A6', async () => {
    const c = new ElmClient(new SimTransport(structuredClone(DEMO_CARS.find((x) => x.id === 'a6')!), 0));
    await c.initialise();
    c.setMake('vag', 'MLB');
    const list = await c.scanModules('vag');
    const ids = mergeModuleIds([], list);
    expect(ids.length).toBeGreaterThan(3);
    expect(ids.find((m) => m.id === 'vag-17')?.part).toBe('4G8920950K');
  });
});
