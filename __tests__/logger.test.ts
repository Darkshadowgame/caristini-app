import { ARMED, AutoRule, AutoState, clampRule, DEFAULT_AUTO, stepAuto, stepStopDelay, stepThreshold, withKind } from '../src/logger/auto';
import {
  decimate,
  formatDuration,
  groupKey,
  isDataLog,
  LogBuilder,
  LogChannel,
  logId,
  logRate,
  makerKey,
  MAX_ROWS,
  nextMarker,
  obdKey,
  parseGroupKey,
  seriesOf,
  sourceOf,
  sourcesFor,
  statsOf,
  summarise,
  toCsv,
  valueAt,
} from '../src/logger/format';
import { gpsFields, gpsNote, metresBetween, projectRoute, routeIndexAt, routeKm, routeOf, toGpx } from '../src/logger/gps';
import { RateMeter, SampleScheduler } from '../src/logger/scheduler';

const RPM: LogChannel = { key: obdKey(0x0c), source: 'obd', label: 'Engine speed', unit: 'rpm', decimals: 0 };
const SPEED: LogChannel = { key: obdKey(0x0d), source: 'obd', label: 'Vehicle speed', unit: 'km/h', decimals: 0 };
const BOOST: LogChannel = { key: groupKey('engine', 115, 2), source: 'group', label: 'Boost, actual', unit: 'mbar', decimals: 0 };

const vals = (o: Record<string, number | null>) => new Map(Object.entries(o));

describe('channel keys and sources', () => {
  test('each kind of value maps to its read', () => {
    expect(sourceOf(obdKey(12))).toBe('obd');
    expect(sourceOf(makerKey('7E0-F40C-0-16'))).toBe('maker');
    expect(sourceOf(groupKey('engine', 115, 3))).toBe('group:engine:115');
    expect(parseGroupKey(groupKey('engine', 115, 3))).toEqual({ moduleId: 'engine', group: 115, field: 3 });
    expect(parseGroupKey('obd:12')).toBeNull();
  });

  test('sources are listed once, standard values first', () => {
    const keys = [groupKey('engine', 115, 0), makerKey('a'), obdKey(12), groupKey('engine', 115, 1), obdKey(13), groupKey('engine', 3, 0)];
    expect(sourcesFor(keys)).toEqual(['obd', 'maker', 'group:engine:115', 'group:engine:3']);
  });
});

describe('sampling scheduler', () => {
  test('a slow source does not hold the fast one to its pace', () => {
    const s = new SampleScheduler(['obd', 'group:engine:115']);
    const cost: Record<string, number> = { obd: 100, 'group:engine:115': 900 };
    const reads: Record<string, number> = { obd: 0, 'group:engine:115': 0 };
    let now = 0;
    while (now < 10_000) {
      const id = s.next(now)!;
      s.record(id, now, now + cost[id], true);
      now += cost[id];
      reads[id]++;
    }
    // Equal adapter time: about 5 s each, so about 50 fast and 5 or 6 slow reads.
    expect(reads.obd).toBeGreaterThanOrEqual(40);
    expect(reads['group:engine:115']).toBeGreaterThanOrEqual(5);
    expect(reads['group:engine:115']).toBeLessThanOrEqual(7);
  });

  test('equal sources take turns', () => {
    const s = new SampleScheduler(['a', 'b', 'c']);
    const order: string[] = [];
    for (let i = 0; i < 6; i++) {
      const id = s.next(i * 10)!;
      order.push(id);
      s.record(id, i * 10, i * 10 + 10, true);
    }
    expect(order).toEqual(['a', 'b', 'c', 'a', 'b', 'c']);
  });

  test('a silent source rests, then rejoins behind the others', () => {
    const s = new SampleScheduler(['obd', 'maker'], { restAfterEmpty: 2, restMs: 1000 });
    let now = 0;
    const seen: string[] = [];
    const step = (gotMaker: boolean) => {
      const id = s.next(now);
      if (!id) {
        now += 100;
        return;
      }
      seen.push(id);
      s.record(id, now, now + 50, id === 'obd' || gotMaker);
      now += 50;
    };
    for (let i = 0; i < 6; i++) step(false);
    expect(s.stats('maker')!.resting).toBe(true);
    const restStart = now;
    seen.length = 0;
    while (now < restStart + 900) step(false);
    expect(seen.every((x) => x === 'obd')).toBe(true);
    // After the rest the maker source is read again, but does not get a run of turns.
    seen.length = 0;
    while (now < restStart + 2000) step(true);
    expect(seen).toContain('maker');
    const makerRun = seen.join(',').split('obd').some((part) => (part.match(/maker/g) ?? []).length > 1);
    expect(makerRun).toBe(false);
  });

  test('every source resting gives no source', () => {
    const s = new SampleScheduler(['maker'], { restAfterEmpty: 1, restMs: 500 });
    s.record('maker', 0, 10, false);
    expect(s.next(100)).toBeNull();
    expect(s.next(600)).toBe('maker');
  });

  test('rate meter counts reads a second over its window', () => {
    const m = new RateMeter(5000);
    expect(m.rate()).toBeNull();
    for (let i = 0; i <= 20; i++) m.tick(i * 100);
    expect(m.rate()).toBeCloseTo(10, 5);
    for (let i = 1; i <= 100; i++) m.tick(2000 + i * 200);
    expect(m.rate()).toBeCloseTo(5, 1);
  });
});

describe('log builder and markers', () => {
  test('rows line up with channels; unknown keys and empty reads are dropped', () => {
    const b = new LogBuilder([RPM, SPEED]);
    expect(b.add(10, vals({ [RPM.key]: 800, 'obd:99': 5 }))).toBe(true);
    expect(b.add(20, vals({ [SPEED.key]: null }))).toBe(false);
    expect(b.add(30.6, vals({ [SPEED.key]: 12, [RPM.key]: NaN }))).toBe(true);
    expect(b.rows).toEqual([
      { t: 10, v: [800, null] },
      { t: 31, v: [null, 12] },
    ]);
  });

  test('markers are numbered in order', () => {
    const b = new LogBuilder([RPM]);
    expect(b.mark(1200)).toEqual({ n: 1, t: 1200 });
    expect(b.mark(2500)).toEqual({ n: 2, t: 2500 });
    expect(nextMarker(b.markers, -5)).toEqual({ n: 3, t: 0 });
  });

  test('GPS fields are kept only with a position', () => {
    const b = new LogBuilder([RPM]);
    b.add(0, vals({ [RPM.key]: 900 }), { gpsKmh: 30 });
    b.add(100, vals({ [RPM.key]: 950 }), { lat: 51.5, lon: -0.12, gpsKmh: 31 });
    expect(b.rows[0]).toEqual({ t: 0, v: [900] });
    expect(b.rows[1]).toEqual({ t: 100, v: [950], lat: 51.5, lon: -0.12, gpsKmh: 31 });
  });

  test('a full log takes no more rows', () => {
    const b = new LogBuilder([RPM]);
    for (let i = 0; i < MAX_ROWS; i++) b.rows.push({ t: i, v: [1] });
    expect(b.full).toBe(true);
    expect(b.add(MAX_ROWS, vals({ [RPM.key]: 1 }))).toBe(false);
  });

  test('finish makes a log the store accepts', () => {
    const b = new LogBuilder([RPM]);
    b.add(0, vals({ [RPM.key]: 900 }));
    b.add(2000, vals({ [RPM.key]: 3000 }));
    const log = b.finish({ id: 'x', vin: 'VIN', car: 'Leon', startedAt: 0, durationMs: 2000, start: 'manual' });
    expect(isDataLog(log)).toBe(true);
    expect('gps' in log).toBe(false);
    expect(isDataLog({ ...log, version: 2 })).toBe(false);
    expect(summarise(log)).toMatchObject({ id: 'x', rows: 2, markers: 0, labels: ['Engine speed'], rate: 1 });
    expect(logRate(log)).toBe(1);
  });
});

describe('stats, cursor and drawing', () => {
  const log = {
    rows: [
      { t: 0, v: [800, null] },
      { t: 100, v: [null, 0] },
      { t: 200, v: [1200, null] },
      { t: 300, v: [null, 10] },
      { t: 400, v: [2500, null] },
    ],
  };

  test('series and min, max, average per value', () => {
    const s = seriesOf(log, 0);
    expect(s).toEqual({ t: [0, 200, 400], v: [800, 1200, 2500] });
    const st = statsOf(s, 1000)!;
    expect(st.min).toBe(800);
    expect(st.max).toBe(2500);
    expect(st.avg).toBeCloseTo(1500, 5);
    expect(st.count).toBe(3);
    expect(st.rate).toBeCloseTo(3, 5);
    expect(statsOf({ t: [], v: [] })).toBeNull();
  });

  test('the cursor shows the reading at or just before that moment', () => {
    const s = seriesOf(log, 0);
    expect(valueAt(s, -1)).toBeNull();
    expect(valueAt(s, 0)).toBe(800);
    expect(valueAt(s, 199)).toBe(800);
    expect(valueAt(s, 200)).toBe(1200);
    expect(valueAt(s, 10_000)).toBe(2500);
    expect(valueAt({ t: [], v: [] }, 5)).toBeNull();
  });

  test('thinning keeps the peaks and the order', () => {
    const t: number[] = [];
    const v: number[] = [];
    for (let i = 0; i < 10_000; i++) {
      t.push(i * 10);
      v.push(i === 4321 ? 9999 : i === 7000 ? -50 : Math.sin(i / 100));
    }
    const d = decimate({ t, v }, 200);
    expect(d.t.length).toBeLessThanOrEqual(800);
    expect(d.v).toContain(9999);
    expect(d.v).toContain(-50);
    expect(d.t[0]).toBe(0);
    expect(d.t[d.t.length - 1]).toBe(99_990);
    for (let i = 1; i < d.t.length; i++) expect(d.t[i]).toBeGreaterThanOrEqual(d.t[i - 1]);
    const short = { t: [0, 1], v: [1, 2] };
    expect(decimate(short, 200)).toBe(short);
  });
});

describe('CSV export', () => {
  const b = new LogBuilder([RPM, SPEED, { ...BOOST, label: 'Boost, actual' }]);
  b.add(0, vals({ [RPM.key]: 800, [SPEED.key]: 0 }));
  b.add(150, vals({ [BOOST.key]: 1013.4 }));
  b.add(300, vals({ [RPM.key]: 1500.4, [SPEED.key]: 16.09344 }));
  b.mark(140);
  b.mark(5000);
  const log = b.finish({ id: 'a', vin: 'V', car: 'Leon', startedAt: 0, durationMs: 300, start: 'manual' });

  test('one row per read, last reading carried, owner units, markers', () => {
    const mph = (value: number, unit: string) => (unit === 'km/h' ? { value: value / 1.609344, unit: 'mph' } : { value, unit });
    expect(toCsv(log, mph).split('\n')).toEqual([
      'Time (s),Engine speed (rpm),Vehicle speed (mph),"Boost, actual (mbar)",Marker',
      '0.000,800,0,,',
      '0.150,800,0,1013,1',
      // The second marker falls after the last row: it goes on the last row.
      '0.300,1500,10,1013,2',
    ]);
  });

  test('GPS columns appear only when the log has positions', () => {
    expect(toCsv(log).split('\n')[0]).not.toContain('Latitude');
    const g = new LogBuilder([RPM]);
    g.add(0, vals({ [RPM.key]: 900 }), { lat: 51.123456789, lon: -1.5, gpsKmh: 20 });
    g.add(100, vals({ [RPM.key]: 950 }));
    const lines = toCsv(g.finish({ id: 'g', vin: 'V', car: 'c', startedAt: 0, durationMs: 100, start: 'manual' })).split('\n');
    expect(lines[0]).toBe('Time (s),Engine speed (rpm),Marker,Latitude,Longitude,GPS speed (km/h)');
    expect(lines[1]).toBe('0.000,900,,51.123457,-1.500000,20.0');
    expect(lines[2]).toBe('0.100,950,,,,');
  });
});

describe('auto-start rules', () => {
  const rule: AutoRule = { on: true, kind: 'rpm', above: 3000, stopAfterS: 5 };

  test('starts above the level, ignores missing readings while waiting', () => {
    expect(stepAuto(rule, ARMED, 2900, 0)).toEqual({ state: ARMED, action: null });
    expect(stepAuto(rule, ARMED, null, 0)).toEqual({ state: ARMED, action: null });
    expect(stepAuto(rule, ARMED, 3000, 0).action).toBeNull();
    expect(stepAuto(rule, ARMED, 3001, 0)).toEqual({ state: { phase: 'recording', belowSince: null }, action: 'start' });
  });

  test('stops only after staying below for the delay', () => {
    let s: AutoState = { phase: 'recording', belowSince: null };
    const feed = (v: number | null, at: number) => {
      const r = stepAuto(rule, s, v, at);
      s = r.state;
      return r.action;
    };
    expect(feed(4000, 0)).toBeNull();
    expect(feed(2000, 1000)).toBeNull();
    expect(feed(2000, 5000)).toBeNull();
    // Back above: the countdown starts again.
    expect(feed(3500, 5500)).toBeNull();
    expect(feed(2000, 6000)).toBeNull();
    expect(feed(null, 10_999)).toBeNull();
    expect(feed(null, 11_000)).toBe('stop');
    expect(s).toEqual(ARMED);
  });

  test('levels stay inside their limits', () => {
    expect(clampRule({ ...rule, above: 99_999, stopAfterS: 0 })).toMatchObject({ above: 8000, stopAfterS: 1 });
    expect(clampRule({ ...rule, kind: 'pedal', above: 2 }).above).toBe(5);
    expect(clampRule({ ...rule, kind: 'nonsense' as never }).kind).toBe('rpm');
    expect(clampRule({ ...rule, above: NaN }).above).toBe(DEFAULT_AUTO.above);
    expect(stepThreshold(rule, 1).above).toBe(3250);
    expect(stepThreshold({ ...rule, above: 8000 }, 1).above).toBe(8000);
    expect(withKind(rule, 'throttle')).toMatchObject({ kind: 'throttle', above: 50 });
    expect(withKind(rule, 'rpm')).toBe(rule);
  });

  test('stop delay steps through the offered values', () => {
    expect(stepStopDelay({ ...rule, stopAfterS: 5 }, 1).stopAfterS).toBe(10);
    expect(stepStopDelay({ ...rule, stopAfterS: 10 }, -1).stopAfterS).toBe(5);
    expect(stepStopDelay({ ...rule, stopAfterS: 7 }, -1).stopAfterS).toBe(5);
    expect(stepStopDelay({ ...rule, stopAfterS: 120 }, 1).stopAfterS).toBe(120);
    expect(stepStopDelay({ ...rule, stopAfterS: 1 }, -1).stopAfterS).toBe(1);
  });
});

describe('GPS on logs and small helpers', () => {
  test('only a fresh fix is stamped on a row', () => {
    const fix = { lat: 51, lon: -1, kmh: 50, at: 1000 };
    expect(gpsFields(fix, 2000)).toEqual({ lat: 51, lon: -1, gpsKmh: 50 });
    expect(gpsFields({ ...fix, kmh: null }, 2000)).toEqual({ lat: 51, lon: -1 });
    expect(gpsFields(fix, 4000)).toEqual({ lat: 51, lon: -1, gpsKmh: 50 });
    expect(gpsFields(fix, 4001)).toBeUndefined();
    expect(gpsFields(null, 0)).toBeUndefined();
  });

  test('a note only when location is refused or off', () => {
    expect(gpsNote('on')).toBeNull();
    expect(gpsNote(null)).toBeNull();
    expect(gpsNote('unavailable')).toBeNull();
    expect(gpsNote('denied')).toMatch(/not allowed/);
    expect(gpsNote('off')).toMatch(/Location Services are off/);
  });

  test('route: one point per change of position, distance and lookup by time', () => {
    const rows = [
      { t: 0, v: [1] },
      { t: 100, v: [1], lat: 51.5, lon: -0.1, gpsKmh: 30 },
      { t: 200, v: [1], lat: 51.5, lon: -0.1, gpsKmh: 30 },
      { t: 1000, v: [1], lat: 51.501, lon: -0.1 },
    ];
    const r = routeOf(rows);
    expect(r).toEqual([
      { t: 100, lat: 51.5, lon: -0.1, kmh: 30 },
      { t: 1000, lat: 51.501, lon: -0.1 },
    ]);
    // 0.001 degrees of latitude is about 111 m.
    expect(metresBetween(r[0], r[1])).toBeGreaterThan(110);
    expect(metresBetween(r[0], r[1])).toBeLessThan(112);
    expect(routeKm(r)).toBeCloseTo(0.111, 2);
    expect(routeIndexAt(r, 0)).toBe(0);
    expect(routeIndexAt(r, 999)).toBe(0);
    expect(routeIndexAt(r, 1000)).toBe(1);
    expect(routeIndexAt(r, 5000)).toBe(1);
    expect(routeIndexAt([], 10)).toBe(-1);
  });

  test('route drawing: north up, inside the box', () => {
    const r = [
      { t: 0, lat: 51.5, lon: -0.1 },
      { t: 1, lat: 51.51, lon: -0.1 },
      { t: 2, lat: 51.51, lon: -0.09 },
    ];
    const p = projectRoute(r, 200, 100, 10);
    expect(p).toHaveLength(3);
    for (const q of p) {
      expect(q.x).toBeGreaterThanOrEqual(10 - 1e-9);
      expect(q.x).toBeLessThanOrEqual(190 + 1e-9);
      expect(q.y).toBeGreaterThanOrEqual(10 - 1e-9);
      expect(q.y).toBeLessThanOrEqual(90 + 1e-9);
    }
    // Going north moves up the screen; going east moves right.
    expect(p[1].y).toBeLessThan(p[0].y);
    expect(p[2].x).toBeGreaterThan(p[1].x);
    // One point sits in the middle.
    expect(projectRoute([r[0]], 200, 100)).toEqual([{ x: 100, y: 50 }]);
  });

  test('GPX holds the track and the markers', () => {
    const r = [
      { t: 0, lat: 51.5, lon: -0.1 },
      { t: 1000, lat: 51.501, lon: -0.1 },
    ];
    const gpx = toGpx('Leon & test', Date.UTC(2026, 10, 16, 9, 0, 0), r, [{ n: 1, t: 1500 }]);
    expect(gpx).toContain('<trkpt lat="51.500000" lon="-0.100000"><time>2026-11-16T09:00:00.000Z</time></trkpt>');
    expect(gpx).toContain('<trkpt lat="51.501000" lon="-0.100000"><time>2026-11-16T09:00:01.000Z</time></trkpt>');
    expect(gpx).toContain('<wpt lat="51.501000" lon="-0.100000"><time>2026-11-16T09:00:01.500Z</time><name>Marker 1</name></wpt>');
    expect(gpx).toContain('<name>Leon &amp; test</name>');
  });

  test('durations and ids', () => {
    expect(formatDuration(45_200)).toBe('45 s');
    expect(formatDuration(125_000)).toBe('2 min 05 s');
    expect(formatDuration(3_720_000)).toBe('1 h 02 min');
    expect(logId(new Date(2026, 10, 15, 14, 2, 3).getTime())).toBe('20261115-140203');
  });
});
