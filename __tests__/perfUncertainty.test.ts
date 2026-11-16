import { customTest, MAX_TARGET_KMH, Run, runUncertainty, Sample, stepRun, TESTS } from '../src/app/performance';

// The screen's native dependencies are not needed for the timing logic.
jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('../src/state', () => ({ useConnection: jest.fn() }));
jest.mock('../src/ui', () => ({}));
jest.mock('expo-keep-awake', () => ({ useKeepAwake: jest.fn() }));

function runAll(p = TESTS[2], samples: Sample[]): Run {
  let r: Run = { phase: 'waiting' };
  for (const s of samples) r = stepRun(p, r, s);
  return r;
}

describe('runUncertainty', () => {
  it('adds half the reading gap at each end and the whole-km/h term', () => {
    // 200 ms gaps, no acceleration term: 0.1 + 0.1.
    expect(runUncertainty({ startGapMs: 200, endGapMs: 200, startAcc: null, endAcc: null })).toBeCloseTo(0.2, 9);
    // 10 km/h per s at each end: 0.5 / 10 = 0.05 s each.
    expect(runUncertainty({ startGapMs: 200, endGapMs: 200, startAcc: 10, endAcc: 10 })).toBeCloseTo(0.3, 9);
  });

  it('shrinks with a faster adapter', () => {
    const slow = runUncertainty({ startGapMs: 250, endGapMs: 250, startAcc: 10, endAcc: 10 });
    const fast = runUncertainty({ startGapMs: 100, endGapMs: 100, startAcc: 10, endAcc: 10 });
    expect(fast).toBeLessThan(slow);
  });

  it('is reported with each run from the measured gaps', () => {
    // 0 to 100 km/h at 10 km/h per second, read every 250 ms.
    const samples: Sample[] = [];
    for (let t = 0; t <= 13000; t += 250) samples.push({ t, kmh: t < 1000 ? 0 : Math.min(130, ((t - 1000) / 1000) * 10) });
    const r = runAll(TESTS.find((x) => x.id === '0-100kmh'), samples);
    expect(r.phase).toBe('done');
    if (r.phase !== 'done') return;
    expect(r.result.startGapMs).toBe(250);
    expect(r.result.endGapMs).toBe(250);
    expect(r.result.rate).toBeCloseTo(4, 1);
    // 0.125 + 0.125 + 0.05 + 0.05.
    expect(r.result.plusMinus).toBeCloseTo(0.35, 6);
  });

  it('leaves out the speed term at a distance finish', () => {
    const samples: Sample[] = [];
    for (let t = 0; t <= 30000; t += 200) samples.push({ t, kmh: t < 400 ? 0 : ((t - 400) / 1000) * 14.4 });
    const r = runAll(TESTS.find((x) => x.id === 'quarter'), samples);
    expect(r.phase).toBe('done');
    if (r.phase !== 'done') return;
    // 0.1 + 0.1 + start term 0.5 / 14.4.
    expect(r.result.plusMinus).toBeCloseTo(0.2 + 0.5 / 14.4, 6);
  });
});

describe('customTest', () => {
  it('makes a rolling or standing timer for a valid range', () => {
    const c = customTest(80, 120, '80 to 120 km/h')!;
    expect(c.startKmh).toBe(80);
    expect(c.targetKmh).toBe(120);
    expect(customTest(0, 50, 'x')!.startKmh).toBe(0);
  });

  it('refuses ranges that cannot run', () => {
    expect(customTest(50, 50, 'x')).toBeNull();
    expect(customTest(70, 30, 'x')).toBeNull();
    expect(customTest(-5, 30, 'x')).toBeNull();
    expect(customTest(0, MAX_TARGET_KMH + 1, 'x')).toBeNull();
    expect(customTest(NaN, 30, 'x')).toBeNull();
  });

  it('times a custom range like the built-in ones', () => {
    const c = customTest(50, 90, '50 to 90 km/h')!;
    const samples: Sample[] = [];
    for (let t = 0; t <= 10000; t += 100) samples.push({ t, kmh: 40 + (t / 1000) * 8 });
    const r = runAll(c, samples);
    expect(r.phase).toBe('done');
    if (r.phase !== 'done') return;
    expect(r.result.seconds).toBeCloseTo(5, 3);
  });
});
