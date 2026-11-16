// UX review 16 Nov 2026: names, navigation, live data and monitors.
import { decodeFreezeValue, freezeText } from '../src/diag/freeze';
import { GUIDE_ORDER, GUIDES, SECTIONS } from '../src/help';
import { kpaText, mbarToKpa } from '../src/live/boost';
import { shiftLabel, shiftRpmFrom } from '../src/live/dashboards';
import { driveTools, driveToolsSummary } from '../src/monitors/hub';
import { ElmClient } from '../src/obd/elm';
import { DEMO_CARS, demoCodes, demoDrive, DEMO_STOP_FIRST_S, SimTransport } from '../src/obd/simTransport';

const KMH_PER_MPH = 1.609344;
const toMph = (value: number, unit: string) => (unit === 'km/h' ? { value: value / KMH_PER_MPH, unit: 'mph' } : { value, unit });

describe('Drive monitors: only the tools that work on the car', () => {
  it('lists knock and trip on the Leon, DPF and trip on a diesel', () => {
    expect(driveTools({ group: 'vag', fuel: 'Petrol' }, false)).toEqual(['knock', 'trip']);
    expect(driveTools({ group: 'vag', fuel: 'Diesel' }, false)).toEqual(['dpf', 'trip']);
    // The engine says diesel even when the saved fuel is missing.
    expect(driveTools({ group: 'mazda', fuel: null }, true)).toEqual(['dpf', 'trip']);
  });

  it('gives timing only where knock values are not known, never knock', () => {
    expect(driveTools({ group: 'ford', fuel: 'Petrol' }, false)).toEqual(['timing', 'trip']);
    expect(driveTools({ group: 'other', fuel: null }, false)).not.toContain('knock');
  });

  it('writes the Car tab subtitle from the list', () => {
    expect(driveToolsSummary(driveTools({ group: 'vag', fuel: 'Petrol' }, false))).toBe('Knock, trip');
    expect(driveToolsSummary(driveTools({ group: 'vag', fuel: 'Diesel' }, false))).toBe('DPF, trip');
    expect(driveToolsSummary(driveTools({ group: 'ford', fuel: 'Petrol' }, false))).toBe('Timing, trip');
  });
});

describe('help and user guide', () => {
  it('has a screen guide for each drive tool, Fuel trims, Turbo boost and Car reference', () => {
    for (const id of ['monitors', 'knock', 'dpf', 'trip', 'fuelTrims', 'boost', 'carReference'] as const) {
      expect(GUIDES[id].title.length).toBeGreaterThan(0);
      expect(GUIDE_ORDER).toContain(id);
    }
    expect(GUIDES.monitors.title).toBe('Drive monitors');
    expect(GUIDES.boost.title).toBe('Turbo boost');
    expect(GUIDES.sensors.title).toBe('Find my car’s sensors');
  });

  it('keeps the section help the same as the screen guide', () => {
    expect(SECTIONS.monHub).toBe(GUIDES.monitors);
    expect(SECTIONS.liveBoost).toBe(GUIDES.boost);
  });

  it('lists every guide once on the User guide page', () => {
    expect(new Set(GUIDE_ORDER).size).toBe(GUIDE_ORDER.length);
    expect(Object.keys(GUIDES).sort()).toEqual([...GUIDE_ORDER].sort());
  });

  it('opens each guide with a sentence that says what the screen does', () => {
    expect(GUIDES.discover.what.startsWith('For experts')).toBe(false);
  });

  it('uses no old names', () => {
    const text = JSON.stringify({ GUIDES, SECTIONS });
    expect(text).not.toMatch(/Health monitors|Head-up|Sensor search|sensor search/);
    expect(text).not.toMatch(/mbar/);
  });
});

describe('dashboard shift light', () => {
  it('reads the typed engine speed', () => {
    expect(shiftRpmFrom('')).toBe(0);
    expect(shiftRpmFrom(' 6500 ')).toBe(6500);
    expect(shiftRpmFrom('6400.4')).toBe(6400);
    expect(shiftRpmFrom('900')).toBeNull();
    expect(shiftRpmFrom('13000')).toBeNull();
    expect(shiftRpmFrom('-6500')).toBeNull();
    expect(shiftRpmFrom('fast')).toBeNull();
  });

  it('says on the button whether it is set', () => {
    expect(shiftLabel(0)).toBe('Shift light');
    expect(shiftLabel(6500)).toBe('Shift light 6500');
  });
});

describe('one pressure unit: kPa, as on Live data', () => {
  it('shows boost in kPa', () => {
    expect(mbarToKpa(1850)).toBe(185);
    expect(kpaText(1850)).toBe('185 kPa');
    expect(kpaText(120, true)).toBe('+12 kPa');
    expect(kpaText(-120, true)).toBe('−12 kPa');
    expect(kpaText(0, true)).toBe('0 kPa');
  });
});

describe('freeze frame in the owner’s units', () => {
  it('shows speed in mph when the app is set to miles', () => {
    const v = decodeFreezeValue(0x0d, [72]);
    expect(v.text).toBe('72 km/h');
    expect(freezeText(v, toMph)).toBe('45 mph');
    expect(freezeText(v, (value, unit) => ({ value, unit }))).toBe('72 km/h');
  });

  it('leaves raw and unitless values as read', () => {
    const raw = decodeFreezeValue(0xfe, [1, 2]);
    expect(freezeText(raw, toMph)).toBe(raw.text);
    const fuel = decodeFreezeValue(0x03, [2, 0]);
    expect(freezeText(fuel, toMph)).toBe(fuel.text);
  });
});

describe('demo cars', () => {
  it('never move with the engine at 0 rpm', () => {
    for (const off of [false, true]) {
      for (let t = 0; t < 600; t += 0.7) {
        const d = demoDrive(t, off);
        if (d.kmh > 0) expect(d.rpm).toBeGreaterThan(600);
        if (!off) expect(d.rpm).toBeGreaterThan(600);
      }
    }
  });

  it('stop-start cars start stopped with the engine off, so faults can be cleared', () => {
    expect(demoDrive(0, true)).toEqual({ kmh: 0, rpm: 0 });
    expect(demoDrive(DEMO_STOP_FIRST_S - 1, true)).toEqual({ kmh: 0, rpm: 0 });
    expect(demoDrive(DEMO_STOP_FIRST_S + 5, true).kmh).toBeGreaterThan(0);
  });

  it('gives the diesels diesel engine codes and the petrol cars petrol ones', () => {
    const a6 = DEMO_CARS.find((c) => c.id === 'a6')!;
    const leon = DEMO_CARS.find((c) => c.id === 'leon')!;
    expect(demoCodes(a6).stored).toEqual(['P2002', 'P0401', 'P2463']);
    expect(demoCodes(leon).stored).toEqual(['P0420', 'P0171', 'P0300']);
  });

  it('the A6 reports its diesel codes and a freeze frame for the first one', async () => {
    const a6 = DEMO_CARS.find((c) => c.id === 'a6')!;
    const c = new ElmClient(new SimTransport(a6, 0));
    await c.initialise();
    const codes = await c.readFaultCodes();
    expect(codes.stored).toEqual(['P2002', 'P0401', 'P2463']);
    expect(codes.pending).toEqual(['P0401']);
    expect(codes.permanent).toEqual(['P2002']);
    expect((await c.readFreezeFrame())?.code).toBe('P2002');
  });
});
