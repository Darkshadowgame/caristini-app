import { addKnockSample, assessKnock, cellDegrees, knockSupport, newKnockSession, retardsFrom, sessionVerdict } from '../src/monitors/knock';
import { decodeDpfDelta, dpfPlan, trackRegen } from '../src/monitors/dpf';
import { addTripSample, fuelMethod, lPer100ToMpgUk, newTrip, petrolLitresPerSecond, summarise, TRIP_MAX_GAP_MS } from '../src/monitors/trip';
import { EXTRAS } from '../src/obd/extras';
import { MODULES } from '../src/obd/modules';
import { onSecondBusOnly, SECOND_BUS_ONLY, secondBusNote } from '../src/obd/msCan';
import type { MeasuringCell } from '../src/obd/tp20';

// A measuring cell with a formula the app's table does not know (raw a*256+b).
const raw = (formula: number, a: number, b: number): MeasuringCell => ({ formula, value: a * 256 + b, unit: 'raw', known: false });

describe('knock: degree decoding', () => {
  it('decodes the public degree formulas from raw cells', () => {
    // Formula 3: 0.002*a*b.
    expect(cellDegrees(raw(0x03, 100, 15))).toBeCloseTo(3, 6);
    // Formula 4: (b-127)*0.01*a, BTDC below 127.
    expect(cellDegrees(raw(0x04, 100, 117))).toBeCloseTo(-10, 6);
    // Formula 9: (b-127)*0.02*a.
    expect(cellDegrees(raw(0x09, 50, 130))).toBeCloseTo(3, 6);
    // Formula 27: abs(b-128)*0.01*a.
    expect(cellDegrees(raw(0x1b, 100, 125))).toBeCloseTo(3, 6);
  });

  it('refuses cells that are not degrees', () => {
    expect(cellDegrees({ formula: 0x01, value: 800, unit: 'rpm', known: true })).toBeNull();
    expect(cellDegrees(raw(0x99, 1, 2))).toBeNull();
  });

  it('takes the size of retard per cylinder from group 020', () => {
    const cells = [raw(0x09, 50, 127), raw(0x09, 50, 124), raw(0x03, 100, 10), raw(0x01, 1, 1)];
    expect(retardsFrom(cells)).toEqual([0, expect.closeTo(3, 6), expect.closeTo(2, 6), null]);
  });
});

describe('knock: spread rule', () => {
  it('is ok with no retard and watch with small even retard', () => {
    expect(assessKnock([0, 0, 0, 0]).level).toBe('ok');
    const a = assessKnock([1, 1.5, 1, 0.5]);
    expect(a.level).toBe('watch');
    expect(a.outlier).toBeNull();
    expect(a.worstCylinder).toBe(2);
    expect(a.spread).toBeCloseTo(1, 6);
  });

  it('flags one cylinder that pulls 3 degrees more than every other', () => {
    const a = assessKnock([0, 0, 3, 0]);
    expect(a.level).toBe('warn');
    expect(a.outlier).toBe(3);
    expect(a.over).toEqual([]);
  });

  it('does not call it an outlier when another cylinder pulls nearly as much', () => {
    const a = assessKnock([2.5, 0, 2, 0]);
    expect(a.outlier).toBeNull();
    expect(a.level).toBe('watch');
  });

  it('flags any cylinder over the 3 degree guide', () => {
    const a = assessKnock([3.5, 3.2, 3.1, 3.4]);
    expect(a.level).toBe('warn');
    expect(a.over).toEqual([1, 2, 3, 4]);
    expect(a.outlier).toBeNull();
  });

  it('ignores missing fields', () => {
    expect(assessKnock([null, null]).level).toBe('none');
    expect(assessKnock([null, 4, null, 0]).worstCylinder).toBe(2);
  });

  it('keeps peaks and counts outliers over a session', () => {
    let s = newKnockSession();
    s = addKnockSample(s, [0, 0, 0, 0]);
    s = addKnockSample(s, [0, 0, 3.5, 0]);
    s = addKnockSample(s, [0, 1, 4, 0]);
    expect(s.samples).toBe(3);
    expect(s.peak).toEqual([0, 1, 4, 0]);
    expect(s.outlierCount).toEqual([0, 0, 2, 0]);
    const v = sessionVerdict(s);
    expect(v.level).toBe('warn');
    expect(v.text).toContain('Cylinder 3');
  });

  it('says what each car can show', () => {
    expect(knockSupport({ group: 'vag', fuel: 'Petrol' }, false).kind).toBe('groups');
    expect(knockSupport({ group: 'vag', fuel: null }, true).kind).toBe('diesel');
    expect(knockSupport({ group: 'mazda', fuel: 'Diesel' }, false).kind).toBe('diesel');
    const ford = knockSupport({ group: 'ford', fuel: 'Petrol' }, false);
    expect(ford.kind).toBe('timing-only');
    expect(ford.kind === 'timing-only' && ford.why).toMatch(/not known/);
  });
});

describe('DPF decode', () => {
  it('decodes the pressure difference (bytes B-C, signed, / 100 kPa)', () => {
    // A = support bits, B-C = 0x01F4 = 500 -> 5.00 kPa; inlet and outlet ignored.
    expect(decodeDpfDelta([0x01, 0x01, 0xf4, 0, 0, 0, 0])).toBeCloseTo(5, 6);
    expect(decodeDpfDelta([0x01, 0xff, 0x38])).toBeCloseTo(-2, 6);
    expect(decodeDpfDelta([0x01, 0x01])).toBeNull();
    // Byte A bit 0 clear: the car does not report the difference.
    expect(decodeDpfDelta([0x06, 0x01, 0xf4])).toBeNull();
  });

  it('decodes the Mazda captures from mazda6-sources section 4', () => {
    const e = (id: string) => EXTRAS.find((x) => x.id === id)!;
    expect(e('mazda-regen-dist').decode([0x00, 0x00, 0x0f, 0x94])).toBeCloseTo(6.09, 2);
    expect(e('mazda-regen-count').decode([0x00, 0x82])).toBe(130);
    expect(e('mazda-soot').decode([0x01, 0xa9])).toBeCloseTo(0.649, 2);
    expect(e('mazda-regen').decode([0x00, 0x00, 0x00, 0x00])).toBe(0);
    expect(e('mazda-dpf-dp').decode([0x01, 0x01, 0xf4])).toBeCloseTo(5, 6);
  });

  it('plans the Mazda with maker regen values and says what is not known on the VW', () => {
    const mazda = dpfPlan('mazda', new Set([0x0d]));
    expect(mazda.regen?.did).toBe('0380');
    expect(mazda.standard).toEqual([]);
    expect(mazda.notKnown).toEqual([]);
    const vw = dpfPlan('vag', new Set([0x7a]));
    expect(vw.regen).toBeNull();
    expect(vw.standard.map((p) => p.pid)).toEqual([0x7a]);
    expect(vw.notKnown.join(' ')).toMatch(/Regeneration status: not known/);
    expect(vw.notKnown.join(' ')).toMatch(/Distance since last regeneration: not known/);
    const ford = dpfPlan('ford', new Set());
    expect(ford.maker).toEqual([]);
    expect(ford.notKnown).toHaveLength(3);
  });

  it('tracks regeneration start and end', () => {
    let ev = trackRegen([], false, 0);
    expect(ev).toEqual([]);
    ev = trackRegen(ev, true, 1000);
    ev = trackRegen(ev, true, 2000);
    ev = trackRegen(ev, null, 3000);
    expect(ev).toEqual([{ start: 1000 }]);
    ev = trackRegen(ev, false, 601000);
    expect(ev).toEqual([{ start: 1000, end: 601000 }]);
  });
});

describe('trip fuel maths', () => {
  it('estimates petrol from air flow at 14.7:1 and 0.755 kg/l', () => {
    // 14.7 g/s of air -> 1 g/s of petrol -> 1/755 l/s.
    expect(petrolLitresPerSecond(14.7)).toBeCloseTo(1 / 755, 9);
    // Rich mixture (lambda 0.8) burns more fuel for the same air.
    expect(petrolLitresPerSecond(14.7, 0.8)).toBeCloseTo(1 / 755 / 0.8, 9);
    // No lambda reading falls back to 1.
    expect(petrolLitresPerSecond(14.7, 0)).toBeCloseTo(1 / 755, 9);
  });

  it('integrates distance, time and fuel', () => {
    // 72 km/h (20 m/s) for 100 s with 14.7 g/s of air.
    let trip = newTrip('maf', 0);
    for (let t = 0; t <= 100_000; t += 500) trip = addTripSample(trip, { t, kmh: 72, mafGs: 14.7 });
    const s = summarise(trip);
    expect(s.km).toBeCloseTo(2, 6);
    expect(s.hours * 3600).toBeCloseTo(100, 6);
    expect(s.avgKmh).toBeCloseTo(72, 6);
    expect(s.litres!).toBeCloseTo(100 / 755, 6);
    expect(s.lPer100!).toBeCloseTo((100 / 755 / 2) * 100, 6);
  });

  it('uses the diesel fuel rate in litres an hour', () => {
    let trip = newTrip('rate', 0);
    for (let t = 0; t <= 3_600_000; t += 1000) trip = addTripSample(trip, { t, kmh: 50, rateLh: 3 });
    const s = summarise(trip);
    expect(s.litres!).toBeCloseTo(3, 6);
    expect(s.km).toBeCloseTo(50, 6);
    expect(s.lPer100!).toBeCloseTo(6, 6);
  });

  it('skips gaps in the readings', () => {
    let trip = newTrip('none', 0);
    trip = addTripSample(trip, { t: 0, kmh: 36 });
    trip = addTripSample(trip, { t: 1000, kmh: 36 });
    trip = addTripSample(trip, { t: 1000 + TRIP_MAX_GAP_MS + 1, kmh: 36 });
    trip = addTripSample(trip, { t: 2000 + TRIP_MAX_GAP_MS + 1, kmh: 36 });
    expect(trip.metres).toBeCloseTo(20, 6);
    expect(trip.gaps).toBe(1);
    expect(summarise(trip).litres).toBeNull();
  });

  it('picks the fuel method per car', () => {
    expect(fuelMethod(false, new Set([0x10]))).toBe('maf');
    expect(fuelMethod(true, new Set([0x10]))).toBe('none');
    expect(fuelMethod(true, new Set([0x5e]))).toBe('rate');
    expect(fuelMethod(false, new Set([0x5e]))).toBe('rate');
  });

  it('converts litres per 100 km to UK mpg', () => {
    // 1 UK gallon per 100 miles = 4.54609 l per 160.9344 km.
    expect(lPer100ToMpgUk((4.54609 / 160.9344) * 100)).toBeCloseTo(100, 6);
    expect(lPer100ToMpgUk(5)).toBeCloseTo(56.5, 1);
  });
});

describe('second CAN bus', () => {
  it('lists only modules that exist in the module table', () => {
    for (const id of [...SECOND_BUS_ONLY.ford, ...SECOND_BUS_ONLY.mazda]) {
      const def = MODULES.find((m) => m.id === id);
      expect(def).toBeDefined();
      // Each has a second-bus route for STN adapters.
      expect(def!.alt?.some((r) => r.via === 'mscan')).toBe(true);
    }
  });

  it('explains the adapter only for second-bus modules on a plain ELM327', () => {
    expect(onSecondBusOnly({ id: 'ford-ipc' }, 'ford')).toBe(true);
    expect(onSecondBusOnly({ id: 'ford-ipc' }, 'vag')).toBe(false);
    expect(secondBusNote({ id: 'ford-ipc' }, 'ford', false)).toMatch(/OBDLink MX\+ or vLinker FS/);
    expect(secondBusNote({ id: 'ford-ipc' }, 'ford', true)).toBeNull();
    expect(secondBusNote({ id: 'ford-bcm' }, 'ford', false)).toBeNull();
    expect(secondBusNote({ id: 'mazda-rbcm' }, 'mazda', false)).not.toBeNull();
  });
});

describe('DPF monitor keeps only filter values', () => {
  const { dpfSensors } = jest.requireActual('../src/monitors/dpf');
  const row = (d: string, n: string) => ({ h: '7E0', d, n, p: 'Engine', b: 0, l: 16, u: 'g', src: 'test' });
  it('drops odometer, lambda, petrol filter and repeated addresses', () => {
    const got = dpfSensors([
      row('1001', 'Particulate filter soot mass calculated'),
      row('1001', 'Particulate filter soot mass calculated'),
      row('1002', 'Odometer (dash)'),
      row('1003', 'Lambda probe voltage'),
      row('1004', 'Petrol particulate filter oil ash mass'),
    ]).map((r: { d: string }) => r.d);
    expect(got).toEqual(['1001']);
  });
});
