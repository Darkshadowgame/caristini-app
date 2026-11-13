import {
  crossingTime,
  distanceCrossing,
  integrateDistance,
  PerfTest,
  QUARTER_MILE_M,
  Run,
  Sample,
  segmentMetres,
  stepRun,
  TESTS,
} from '../src/app/performance';

// The screen's native dependencies are not needed for the timing logic.
jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('../src/state', () => ({ useConnection: jest.fn() }));
jest.mock('../src/ui', () => ({}));
jest.mock('expo-keep-awake', () => ({ useKeepAwake: jest.fn() }));

const test = (id: string): PerfTest => TESTS.find((x) => x.id === id)!;

// Feeds samples through an armed test and returns the final state.
function runAll(p: PerfTest, samples: Sample[]): Run {
  let r: Run = { phase: 'waiting' };
  for (const s of samples) r = stepRun(p, r, s);
  return r;
}

// Constant acceleration from `fromKmh` starting at `t0`, sampled every `step` ms.
function accel(opts: { t0: number; fromKmh: number; accMs2: number; step: number; until: number; standstillFrom?: number }): Sample[] {
  const out: Sample[] = [];
  for (let t = opts.standstillFrom ?? opts.t0; t <= opts.until; t += opts.step) {
    const kmh = t < opts.t0 ? opts.fromKmh : opts.fromKmh + opts.accMs2 * ((t - opts.t0) / 1000) * 3.6;
    out.push({ t, kmh });
  }
  return out;
}

describe('crossingTime', () => {
  it('interpolates between the samples either side', () => {
    expect(crossingTime({ t: 1000, kmh: 90 }, { t: 1200, kmh: 110 }, 100)).toBeCloseTo(1100, 6);
    expect(crossingTime({ t: 0, kmh: 0 }, { t: 400, kmh: 8 }, 2)).toBeCloseTo(100, 6);
  });

  it('clamps to the segment and handles a flat segment', () => {
    expect(crossingTime({ t: 0, kmh: 10 }, { t: 100, kmh: 20 }, 50)).toBe(100);
    expect(crossingTime({ t: 0, kmh: 10 }, { t: 100, kmh: 10 }, 10)).toBe(100);
  });
});

describe('distance', () => {
  it('integrates speed over time with the trapezoid rule', () => {
    const steady = [0, 1000, 2000, 3000, 4000, 5000].map((t) => ({ t, kmh: 36 }));
    expect(integrateDistance(steady)).toBeCloseTo(50, 6);
    expect(segmentMetres({ t: 0, kmh: 0 }, { t: 2000, kmh: 36 })).toBeCloseTo(10, 6);
  });

  it('finds where a target distance falls inside a segment', () => {
    // 0 to 36 km/h over 2 s covers 10 m; 2.5 m is reached at 1 s (d = a t^2 / 2, a = 5).
    const c = distanceCrossing({ t: 0, kmh: 0 }, { t: 2000, kmh: 36 }, 0, 2.5);
    expect(c.t).toBeCloseTo(1000, 6);
    expect(c.kmh).toBeCloseTo(18, 6);
    // Steady speed: linear in time.
    expect(distanceCrossing({ t: 0, kmh: 36 }, { t: 1000, kmh: 36 }, 100, 105).t).toBeCloseTo(500, 6);
  });
});

describe('stepRun', () => {
  it('times 0 to 100 km/h from a standstill', () => {
    // Stopped until 1000 ms, then 100 km/h in 10 s (27.78 m/s per 10 s).
    const samples = accel({ standstillFrom: 0, t0: 1000, fromKmh: 0, accMs2: 100 / 3.6 / 10, step: 100, until: 12000 });
    const r = runAll(test('0-100kmh'), samples);
    expect(r.phase).toBe('done');
    if (r.phase !== 'done') return;
    expect(r.result.seconds).toBeCloseTo(10, 3);
    expect(r.result.rate).toBeCloseTo(10, 1);
  });

  it('interpolates the finish between readings that miss the target', () => {
    // 3 m/s^2 sampled every 270 ms: 60 mph (26.8224 m/s) is reached at 8.9408 s.
    const samples = accel({ standstillFrom: 0, t0: 540, fromKmh: 0, accMs2: 3, step: 270, until: 12000 });
    const r = runAll(test('0-60mph'), samples);
    expect(r.phase).toBe('done');
    if (r.phase !== 'done') return;
    expect(r.result.seconds).toBeCloseTo(26.8224 / 3, 3);
  });

  it('times a rolling 30 to 70 mph run and interpolates the start', () => {
    // From 20 mph at 2 m/s^2, sampled every 130 ms: 40 mph more takes 8.9408 s.
    const from = 20 * 1.609344;
    const samples = accel({ t0: 0, fromKmh: from, accMs2: 2, step: 130, until: 20000 });
    const r = runAll(test('30-70mph'), samples);
    expect(r.phase).toBe('done');
    if (r.phase !== 'done') return;
    expect(r.result.seconds).toBeCloseTo((40 * 0.44704) / 2, 3);
  });

  it('times a quarter mile by integrating speed', () => {
    // 4 m/s^2 from rest: 402.336 m = a t^2 / 2.
    const samples = accel({ standstillFrom: 0, t0: 548, fromKmh: 0, accMs2: 4, step: 137, until: 20000 });
    const r = runAll(test('quarter'), samples);
    expect(r.phase).toBe('done');
    if (r.phase !== 'done') return;
    const expected = Math.sqrt((2 * QUARTER_MILE_M) / 4);
    expect(r.result.seconds).toBeCloseTo(expected, 3);
    expect(r.result.finishKmh!).toBeCloseTo(4 * expected * 3.6, 1);
  });

  it('waits for a standstill before a standing start', () => {
    const p = test('0-60mph');
    let r: Run = { phase: 'waiting' };
    r = stepRun(p, r, { t: 0, kmh: 40 });
    expect(r.phase).toBe('waiting');
    r = stepRun(p, r, { t: 100, kmh: 0 });
    expect(r.phase).toBe('ready');
    r = stepRun(p, r, { t: 200, kmh: 3 });
    expect(r.phase).toBe('running');
  });

  it('waits below the start speed for a rolling start and resets if speed drops back', () => {
    const p = test('30-70mph');
    let r: Run = { phase: 'waiting' };
    r = stepRun(p, r, { t: 0, kmh: 60 });
    expect(r.phase).toBe('waiting');
    r = stepRun(p, r, { t: 100, kmh: 45 });
    expect(r.phase).toBe('ready');
    r = stepRun(p, r, { t: 200, kmh: 50 });
    expect(r.phase).toBe('running');
    r = stepRun(p, r, { t: 300, kmh: 44 });
    expect(r.phase).toBe('ready');
  });

  it('gives up when readings stop for too long', () => {
    const p = test('0-100kmh');
    let r: Run = { phase: 'waiting' };
    r = stepRun(p, r, { t: 0, kmh: 0 });
    r = stepRun(p, r, { t: 100, kmh: 5 });
    r = stepRun(p, r, { t: 3000, kmh: 40 });
    expect(r.phase).toBe('aborted');
  });
});
