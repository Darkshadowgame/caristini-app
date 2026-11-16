import { addMinMax, AlertLevel, alertLevel, AlertRule, AlertTracker, fromUserUnits, holdPeak, needsRpm, parseNumber, ruleFromInput, setRule } from '../src/live/alerts';
import { RateMeter, rateText } from '../src/live/rate';
import { filterPids, loadSet, matchesQuery, removeSet, saveSet } from '../src/live/sets';
import { LIVE_PIDS } from '../src/obd/pids';
import { addPage, DashPage, fitSlots, fraction, MAX_PAGES, pagesForCar, rangeFor, removePage, resizePage, shiftLightOn, updatePage } from '../src/live/dashboards';
jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
import { toUserUnits } from '../src/settings';

const metric = { speed: 'km/h' as const, temp: '°C' as const };
const imperial = { speed: 'mph' as const, temp: '°F' as const };

describe('alert rules', () => {
  const rule: AlertRule = { pid: 0x05, above: 105, below: 60, minRpm: null };

  test('above and below', () => {
    expect(alertLevel(rule, 110, null)).toBe('above');
    expect(alertLevel(rule, 50, null)).toBe('below');
    expect(alertLevel(rule, 90, null)).toBeNull();
    expect(alertLevel(rule, 105, null)).toBeNull();
    expect(alertLevel(undefined, 200, null)).toBeNull();
    expect(alertLevel(rule, null, null)).toBeNull();
  });

  test('only when the engine turns faster than the set speed', () => {
    const r: AlertRule = { pid: 0x0b, above: 200, below: null, minRpm: 3000 };
    expect(alertLevel(r, 230, 2500)).toBeNull();
    expect(alertLevel(r, 230, null)).toBeNull();
    expect(alertLevel(r, 230, 3500)).toBe('above');
    expect(needsRpm([r])).toBe(true);
    expect(needsRpm([rule])).toBe(false);
  });

  test('buzzes once on entry, not on every reading, with a quiet time', () => {
    const tr = new AlertTracker(5000);
    const lv = (l: AlertLevel) => new Map([[0x05, l]]);
    expect(tr.update(lv('above'), 0)).toEqual([0x05]);
    expect(tr.update(lv('above'), 100)).toEqual([]);
    expect(tr.update(lv(null), 200)).toEqual([]);
    // Back in within 5 s: no second buzz.
    expect(tr.update(lv('above'), 300)).toEqual([]);
    expect(tr.update(lv(null), 6000)).toEqual([]);
    expect(tr.update(lv('above'), 6100)).toEqual([0x05]);
    tr.reset();
    expect(tr.update(lv('below'), 6200)).toEqual([0x05]);
  });

  test('typed limits in the owner units are kept in the car units', () => {
    const f = ruleFromInput(0x05, '°C', { above: '221', below: '', minRpm: '' }, imperial);
    expect(f.rule?.above).toBeCloseTo(105, 5);
    expect(f.rule?.below).toBeNull();
    const back = toUserUnits(f.rule!.above!, '°C', imperial).value;
    expect(back).toBeCloseTo(221, 5);
    const s = ruleFromInput(0x0d, 'km/h', { above: '70', below: '', minRpm: '' }, imperial);
    expect(s.rule?.above).toBeCloseTo(112.65, 1);
    expect(fromUserUnits(10, '%', imperial)).toBe(10);
  });

  test('input checks', () => {
    expect(ruleFromInput(0x05, '°C', { above: '', below: '', minRpm: '' }, metric)).toEqual({ rule: null });
    expect(ruleFromInput(0x05, '°C', { above: 'hot', below: '', minRpm: '' }, metric).error).toBeTruthy();
    expect(ruleFromInput(0x05, '°C', { above: '50', below: '60', minRpm: '' }, metric).error).toBeTruthy();
    expect(ruleFromInput(0x42, 'V', { above: '', below: '12,2', minRpm: '800' }, metric).rule).toEqual({ pid: 0x42, above: null, below: 12.2, minRpm: 800 });
    expect(parseNumber(' -3.5 ')).toBe(-3.5);
    expect(parseNumber('')).toBeNull();
    expect(parseNumber('1.2.3')).toBeNaN();
  });

  test('one rule per value', () => {
    const a = setRule([], 5, { pid: 5, above: 1, below: null, minRpm: null });
    const b = setRule(a, 5, { pid: 5, above: 2, below: null, minRpm: null });
    expect(b).toHaveLength(1);
    expect(b[0].above).toBe(2);
    expect(setRule(b, 5, null)).toEqual([]);
  });
});

describe('peak-hold and lowest/highest', () => {
  test('a peak holds, then follows the value down', () => {
    let p = holdPeak(null, 100, 0);
    p = holdPeak(p, 80, 1000);
    expect(p.value).toBe(100);
    p = holdPeak(p, 120, 1500);
    expect(p).toEqual({ value: 120, at: 1500 });
    p = holdPeak(p, 90, 4600);
    expect(p.value).toBe(90);
  });

  test('min and max', () => {
    let m = addMinMax(null, 5);
    m = addMinMax(m, -2);
    m = addMinMax(m, 9);
    expect(m).toEqual({ min: -2, max: 9 });
  });
});

describe('refresh-rate meter', () => {
  test('readings and updates per second over the window', () => {
    const r = new RateMeter(5000);
    expect(r.rate()).toBeNull();
    r.add(4, 0);
    expect(r.rate()).toBeNull();
    r.add(4, 500);
    r.add(4, 1000);
    expect(r.rate()).toEqual({ readings: 8, updates: 2 });
    // Old passes drop out of the window.
    for (let t = 1500; t <= 20000; t += 500) r.add(2, t);
    expect(r.rate()!.readings).toBeCloseTo(4, 5);
    r.reset();
    expect(r.rate()).toBeNull();
    expect(rateText(4.26)).toBe('4.3');
    expect(rateText(12.6)).toBe('13');
  });
});

describe('value search and saved sets', () => {
  test('search by words, group or PID number', () => {
    const trims = filterPids(LIVE_PIDS, 'fuel trim');
    expect(trims.map((p) => p.pid).sort()).toEqual([6, 7, 8, 9]);
    expect(filterPids(LIVE_PIDS, '010c').map((p) => p.pid)).toEqual([0x0c]);
    expect(matchesQuery(LIVE_PIDS[0], '')).toBe(true);
    expect(filterPids(LIVE_PIDS, 'TEMPERATURES').length).toBeGreaterThan(3);
  });

  test('save, replace, load and remove', () => {
    let sets = saveSet([], ' Boost ', [0x0b, 0x0c]);
    sets = saveSet(sets, 'Trims', [6, 7]);
    sets = saveSet(sets, 'boost', [0x0b, 0x0c, 0x10]);
    expect(sets.map((s) => s.name)).toEqual(['boost', 'Trims']);
    expect(saveSet(sets, '  ', [1])).toBe(sets);
    expect(saveSet(sets, 'Empty', [])).toBe(sets);
    expect(loadSet(sets[0], [0x0c, 0x10])).toEqual([0x0c, 0x10]);
    expect(removeSet(sets, 'Trims').map((s) => s.name)).toEqual(['boost']);
  });
});

describe('dashboard pages', () => {
  const supported = [0x0c, 0x0d, 0x05, 0x04, 0x0f, 0x0e, 0x10];
  const spares = [0x0c, 0x0d, 0x05, 0x04, 0x06, 0x07, 0x10];

  test('defaults swap values the car does not report', () => {
    expect(fitSlots([0x0d, 0x0c, 0x05, 0x0b], supported, spares)).toEqual([0x0d, 0x0c, 0x05, 0x04]);
    const pages = pagesForCar(undefined, supported, spares);
    expect(pages).toHaveLength(1);
    expect(pages[0].style).toBe('number');
    const saved: DashPage[] = [{ id: 'x', name: 'Track', style: 'bar', pids: [0x0c] }];
    expect(pagesForCar(saved, supported, spares)[0].name).toBe('Track');
  });

  test('add, edit, resize and remove pages', () => {
    let pages = pagesForCar(undefined, supported, spares);
    pages = addPage(pages, supported, spares, 1);
    expect(pages).toHaveLength(2);
    expect(pages[1].style).toBe('gauge');
    expect(new Set(pages.map((p) => p.id)).size).toBe(2);
    pages = updatePage(pages, pages[1].id, { name: 'Boost', style: 'graph' });
    expect(pages[1]).toMatchObject({ name: 'Boost', style: 'graph' });
    const big = resizePage(pages[1], 12, supported);
    expect(big.pids).toHaveLength(8);
    expect(resizePage(pages[1], 0, supported).pids).toHaveLength(1);
    pages = removePage(pages, pages[0].id);
    expect(pages).toHaveLength(1);
    expect(removePage(pages, pages[0].id)).toHaveLength(1);
    for (let i = 0; i < 10; i++) pages = addPage(pages, supported, spares, i);
    expect(pages).toHaveLength(MAX_PAGES);
  });

  test('dial ranges and the shift light', () => {
    const rpm = LIVE_PIDS.find((p) => p.pid === 0x0c)!;
    expect(fraction(3500, rangeFor(rpm)!)).toBeCloseTo(0.5);
    expect(fraction(9000, rangeFor(rpm)!)).toBe(1);
    expect(rangeFor({ pid: 0x99, unit: '%' })).toEqual([0, 100]);
    expect(rangeFor({ pid: 0x99, unit: 'kPa' })).toBeNull();
    expect(rangeFor({ pid: 0x99, unit: 'kPa' }, { min: 10, max: 300 })).toEqual([0, 300]);
    expect(shiftLightOn(6500, 6400)).toBe(true);
    expect(shiftLightOn(6300, 6400)).toBe(false);
    expect(shiftLightOn(6500, 0)).toBe(false);
    expect(shiftLightOn(null, 6400)).toBe(false);
  });
});
