jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
import { HistoryEntry } from '../src/history';
import { ElmClient } from '../src/obd/elm';
import { DEMO_CARS, SimTransport } from '../src/obd/simTransport';
import { fromHealthCheck, motModules, readCarForMot, recentHealthCheck } from '../src/mot/read';
import {
  Answer,
  CarRead,
  carFindings,
  classifyFault,
  engineLight,
  firstUsedFrom,
  historyTitle,
  itemApplies,
  milApplies,
  MOT_HISTORY_URL,
  shareText,
  summarise,
  walkFindings,
  WALK_ITEMS,
} from '../src/mot/rules';
import { modulesFor } from '../src/obd/modules';

const leon = { fuel: 'Petrol' as const, year: 2007 };
const mazda = { fuel: 'Diesel' as const, year: 2016 };

const read = (patch: Partial<CarRead> = {}): CarRead => ({
  at: Date.UTC(2026, 10, 15, 10, 0),
  from: 'read',
  milOn: false,
  stored: [],
  pending: [],
  engineModuleRead: true,
  faults: [],
  volts: 12.6,
  modulesAsked: 6,
  modulesAnswered: 6,
  notRead: [],
  monitorsIncomplete: 0,
  complete: true,
  ...patch,
});

const allPass = (): Record<string, Answer> => Object.fromEntries(WALK_ITEMS.map((i) => [i.id, { state: 'pass' as const }]));

describe('MOT dates', () => {
  it('takes the year of a rule as maybe, since model year is not first use', () => {
    expect(firstUsedFrom(leon, 2003)).toBe('yes');
    expect(firstUsedFrom(leon, 2009)).toBe('no');
    expect(firstUsedFrom({ fuel: null, year: 2012 }, 2012)).toBe('maybe');
    expect(firstUsedFrom({ fuel: null, year: null }, 2012)).toBe('maybe');
  });

  it('applies the engine light rule from July 2003 for petrol and July 2008 for diesel (8.2.1.2(h), 8.2.2.2(g))', () => {
    expect(milApplies(leon)).toBe('yes');
    expect(milApplies({ fuel: 'Diesel', year: 2006 })).toBe('no');
    expect(milApplies(mazda)).toBe('yes');
    expect(milApplies({ fuel: 'Petrol', year: 2001 })).toBe('no');
  });

  it('greys out reversing lamps and headlamp washers on the 2007 Leon (4.6.1, 4.1.6)', () => {
    const rev = WALK_ITEMS.find((i) => i.id === 'reversing')!;
    expect(itemApplies(rev, leon)).toBe('no');
    expect(itemApplies(rev, mazda)).toBe('yes');
  });
});

describe('classifying faults from the car', () => {
  it('engine light on is a likely fail on the Leon, citing 8.2.1.2(h)', () => {
    const f = engineLight(true, leon, ['P0300'])!;
    expect(f.outcome).toBe('fail');
    expect(f.section).toBe('8.2.1.2(h)');
    expect(f.fix).toContain('P0300');
    expect(engineLight(true, leon, ['P0171', 'P0171'])!.fix).toContain('(P0171)');
    expect(engineLight(false, leon)).toBeNull();
  });

  it('engine light on a 2006 diesel is information only', () => {
    expect(engineLight(true, { fuel: 'Diesel', year: 2006 })!.outcome).toBe('info');
  });

  it('central electronics brake light bulb fault is a likely fail (4.3.1)', () => {
    const f = classifyFault({ module: 'Central electronics', moduleId: 'vag-09', code: '00987' }, leon)!;
    expect(f.outcome).toBe('fail');
    expect(f.section).toBe('4.3.1(a)');
    expect(f.itemId).toBe('brake-lights');
  });

  it('brake light switch fault is an advisory pointing at the helper check (4.3.2)', () => {
    const f = classifyFault({ module: 'ABS and stability control', moduleId: 'vag-03', code: '00526' }, leon)!;
    expect(f.outcome).toBe('advisory');
    expect(f.section).toBe('4.3.2(a)');
    expect(f.itemId).toBe('brake-lights');
    // From an engine module too, by text.
    expect(classifyFault({ module: 'Engine', moduleId: 'engine', code: 'P0571', text: 'Brake switch A circuit' }, leon)!.section).toBe('4.3.2(a)');
  });

  it('sorts lamp faults by their text', () => {
    const sec = (text: string, car = leon) => classifyFault({ module: 'Central electronics', moduleId: 'vag-09', code: '01234', text }, car)?.section;
    expect(sec('Lamp for low beam, left (M29)')).toBe('4.1.1(a)(ii)');
    expect(sec('Bulb for parking lamps, left (M1)')).toBe('4.2.1(a)(ii)');
    expect(sec('Right mirror turn signal lamp (L132)')).toBe('4.4.1(a)(ii)');
    expect(sec('License plate light bulb (X)')).toBe('4.7.1(b)');
    expect(sec('Control circuit for left headlight range adjusting motor (V48)')).toBe('4.1.5(a)');
    expect(sec('Rear fog light bulb')).toBe('4.5.1(a)(ii)');
    expect(sec('Horn relay')).toBe('7.7(a)');
    expect(sec('Windscreen wiper motor, driver side (V216)')).toBe('3.4(a)');
  });

  it('interior lamps and dashboard tell-tales are not MOT items', () => {
    expect(classifyFault({ module: 'Central electronics', moduleId: 'vag-09', code: '00059' }, leon)).toBeNull();
    expect(classifyFault({ module: 'Instrument cluster', moduleId: 'vag-17', code: '00755' }, leon)).toBeNull();
    expect(classifyFault({ module: 'Central electronics', moduleId: 'vag-09', code: '00694' }, leon)).toBeNull();
  });

  it('reversing lamp fault on a 2007 car is information, on a 2016 car a likely fail', () => {
    const f = { module: 'Body control (BCM / SJB)', moduleId: 'ford-bcm', code: 'B1234', text: 'Reversing lamp circuit open' };
    expect(classifyFault(f, leon)!.outcome).toBe('info');
    expect(classifyFault(f, mazda)!.outcome).toBe('fail');
  });

  it('warning-lamp systems: a current fault is a likely fail, an intermittent one an advisory', () => {
    const airbag = classifyFault({ module: 'Airbags', moduleId: 'vag-15', code: '00532' }, leon)!;
    expect(airbag.outcome).toBe('fail');
    expect(airbag.section).toBe('7.1.6(a)');
    expect(airbag.itemId).toBe('dash-lamps');
    const abs = classifyFault({ module: 'ABS', moduleId: 'ford-abs', code: 'C003A28', state: 'intermittent' }, mazda)!;
    expect(abs.outcome).toBe('advisory');
    expect(abs.section).toBe('1.6(b) and 7.12(e)');
    expect(classifyFault({ module: 'Power steering', moduleId: 'mazda-eps', code: 'C1234', state: 'active' }, mazda)!.section).toBe('2.6(a)');
    expect(classifyFault({ module: 'Parking brake', moduleId: 'vag-53', code: 'C1234', warningLamp: true }, mazda)!.section).toBe('1.1.6(e)');
  });

  it('tyre pressure faults count only on cars first used from 1 January 2012 (5.2.3(h))', () => {
    const f = { module: 'Tyre pressure', moduleId: 'vag-65', code: 'C1000', text: 'Tyre pressure sensor' };
    expect(classifyFault(f, leon)!.outcome).toBe('info');
    expect(classifyFault(f, mazda)!.outcome).toBe('fail');
  });

  it('engine codes with the light off are advisories; OBD2 codes count only when the engine module was not read', () => {
    const r = read({ engineModuleRead: false, stored: ['P0420'], pending: ['P0171'] });
    const found = carFindings(r, leon);
    expect(found.map((f) => [f.code, f.outcome])).toEqual([
      ['P0420', 'advisory'],
      ['P0171', 'advisory'],
    ]);
    expect(carFindings(read({ stored: ['P0420'] }), leon)).toEqual([]);
  });
});

describe('walk-round and result', () => {
  it('a fail on a Minor-only item passes the MOT, so it is an advisory', () => {
    const f = walkFindings({ pressures: { state: 'fail' }, tread: { state: 'fail', note: 'front left 1.2 mm' } }, leon);
    expect(f.find((x) => x.itemId === 'pressures')!.outcome).toBe('advisory');
    const tread = f.find((x) => x.itemId === 'tread')!;
    expect(tread.outcome).toBe('fail');
    expect(tread.category).toBe('Dangerous');
    expect(tread.why).toContain('front left 1.2 mm');
    expect(tread.section).toBe('5.2.3(e)');
  });

  it('every walk-round item cites a manual section and says what fails', () => {
    for (const i of WALK_ITEMS) {
      expect(i.section).toMatch(/^\d/);
      expect(i.failIf.length).toBeGreaterThan(10);
    }
    expect(WALK_ITEMS.find((i) => i.id === 'tread')!.failIf).toContain('1.6 mm');
    expect(WALK_ITEMS.find((i) => i.id === 'brake-lights')!.how).toMatch(/helper/);
  });

  it('a walk-round Pass turns a confirmable likely fail into an advisory; the engine light stays a fail', () => {
    const r = read({ milOn: true, faults: [{ module: 'Central electronics', moduleId: 'vag-09', code: '00987' }] });
    const before = summarise(r, {}, leon);
    expect(before.fails.map((f) => f.key).sort()).toEqual(['fault:Central electronics:00987', 'mil']);
    expect(before.verdict).toBe('fail');
    const after = summarise(r, allPass(), leon);
    expect(after.fails.map((f) => f.key)).toEqual(['mil']);
    expect(after.advisories.find((f) => f.code === '00987')!.why).toMatch(/walk-round found it working/);
  });

  it('gives the verdict', () => {
    expect(summarise(null, {}, leon).verdict).toBe('incomplete');
    expect(summarise(read(), {}, leon).verdict).toBe('incomplete');
    expect(summarise(read(), allPass(), leon).verdict).toBe('clear');
    // Never a clean result from a partial read of the car.
    expect(summarise(read({ milOn: null }), allPass(), leon).verdict).toBe('incomplete');
    expect(summarise(read({ complete: false }), allPass(), leon).verdict).toBe('incomplete');
    expect(summarise(read({ notRead: ['ABS'] }), allPass(), leon).verdict).toBe('incomplete');
    expect(summarise(read(), { ...allPass(), wipers: { state: 'advisory' } }, leon).verdict).toBe('advisories');
    expect(summarise(read(), { ...allPass(), horn: { state: 'fail' } }, leon).verdict).toBe('fail');
    // Items that do not apply to the car are not counted.
    const s = summarise(read(), allPass(), leon);
    expect(s.applicable).toBe(WALK_ITEMS.length - 2);
    expect(s.checked).toBe(s.applicable);
    expect(historyTitle(summarise(read({ milOn: true }), {}, leon))).toBe('MOT check: 1 likely fail');
  });

  it('share text lists fails with sections, the car reading and the MOT history link, and no VIN', () => {
    const r = read({ milOn: true, stored: ['P0300'], engineModuleRead: false, volts: 12.1 });
    const s = summarise(r, { tread: { state: 'fail' } }, leon);
    const text = shareText(s, { car: 'SEAT Leon Cupra, 2007, Petrol', at: Date.UTC(2026, 10, 15, 10, 0), read: r });
    expect(text).toContain('MOT check: SEAT Leon Cupra, 2007, Petrol');
    expect(text).toContain('Likely fails');
    expect(text).toContain('manual 8.2.1.2(h)');
    expect(text).toContain('manual 5.2.3(e)');
    expect(text).toContain('engine light on');
    expect(text).toContain('Battery 12.1 V');
    expect(text).toContain('Not checked:');
    expect(text).toContain(MOT_HISTORY_URL);
    expect(text).not.toMatch(/VSSZZZ/);
    expect(MOT_HISTORY_URL).toBe('https://www.gov.uk/check-mot-history');
    expect(text).not.toContain(String.fromCharCode(0x2014));
  });
});

describe('reading the car', () => {
  it('asks only MOT modules, and only known ones once 3 have answered', () => {
    const defs = modulesFor('vag');
    expect(motModules(defs).map((d) => d.id)).toEqual(expect.arrayContaining(['engine', 'vag-03', 'vag-15', 'vag-44', 'vag-09', 'vag-17']));
    expect(motModules(defs).some((d) => d.id === 'vag-08')).toBe(false);
    expect(motModules(defs, ['engine', 'vag-03', 'vag-15', 'vag-17']).map((d) => d.id)).toEqual(['engine', 'vag-03', 'vag-15', 'vag-17']);
  });

  it('offers a complete health check under 1 hour old', () => {
    const e: HistoryEntry = { id: '1', vin: 'X', at: 1_000_000, kind: 'scan', title: '', complete: true, faults: [{ module: 'Airbags', code: '00532', text: 'Supply voltage B+' }], modules: 6 };
    expect(recentHealthCheck(e, 1_000_000 + 30 * 60000)).toBe(e);
    expect(recentHealthCheck(e, 1_000_000 + 61 * 60000)).toBeNull();
    expect(recentHealthCheck({ ...e, complete: false }, 1_000_000)).toBeNull();
    const r = fromHealthCheck(e, 'vag', { milOn: false, volts: 12.5, monitorsIncomplete: null });
    expect(r.faults[0].moduleId).toBe('vag-15');
    expect(summarise(r, {}, leon).fails[0].section).toBe('7.1.6(a)');
  });

  it('reads the demo Leon over TP2.0 and finds the airbag fault, read only', async () => {
    const car = DEMO_CARS.find((c) => c.id === 'leon')!;
    const sim = new SimTransport(car, 0);
    const c = new ElmClient(sim);
    await c.initialise();
    c.setMake('vag', 'PQ35');
    const sent: string[] = [];
    const send = sim.send.bind(sim);
    sim.send = (cmd: string) => {
      sent.push(cmd.replace(/\s/g, '').toUpperCase());
      return send(cmd);
    };
    const r = await readCarForMot(c, 'vag');
    // No OBD2 clear (04), no UDS clear (14), write (2E) or routine (31).
    expect(sent.filter((x) => x === '04' || /^(14|2E|31)[0-9A-F]/.test(x))).toEqual([]);
    expect(sent).toContain('0101');
    expect(r.modulesAnswered).toBeGreaterThanOrEqual(3);
    expect(r.faults.find((f) => f.moduleId === 'vag-15')?.code).toBe('00532');
    const s = summarise(r, {}, leon);
    expect(s.fails.some((f) => f.section === '7.1.6(a)')).toBe(true);
  }, 60000);
});

describe('MOT check after review', () => {
  const rules = jest.requireActual('../src/mot/rules');
  it('treats the model year before a rule as maybe', () => {
    expect(rules.firstUsedFrom({ year: 2002 }, 2003)).toBe('maybe');
    expect(rules.firstUsedFrom({ year: 2001 }, 2003)).toBe('no');
  });
});
