// Functionality review of 20 Nov 2026, findings 9 and 17: battery test steps
// are kept on the car, and a "rest" reading that is too high is not judged.
import { batteryResults, batterySummary, BatteryTest, batteryTitle, BATTERY_RESUME_MS, restTooHigh, resumableTest, withBatteryStep } from '../src/obd/battery';

describe('battery test record', () => {
  it('does not take a charging voltage as a rest reading', () => {
    expect(restTooHigh(12.6)).toBeNull();
    expect(restTooHigh(13.0)).toBeNull();
    const text = restTooHigh(14.16)!;
    expect(text).toContain('14.16 V is too high for a battery at rest');
    expect(text).toContain('running engine, or surface charge');
    expect(restTooHigh(13.01)).not.toBeNull();
  });

  it('adds each completed step to the test', () => {
    const a = withBatteryStep(null, { rest: 12.45 }, 1000);
    expect(a).toEqual({ startedAt: 1000, at: 1000, rest: 12.45 });
    const b = withBatteryStep({ ...a, historyId: 'h1' }, { crank: { min: 10.2, first: 12.4, last: 14.1 } }, 2000);
    expect(b).toEqual({ startedAt: 1000, at: 2000, rest: 12.45, crank: { min: 10.2, first: 12.4, last: 14.1 }, historyId: 'h1' });
    // A step read again replaces its earlier reading.
    expect(withBatteryStep(b, { rest: 12.61 }, 3000)).toMatchObject({ startedAt: 1000, at: 3000, rest: 12.61, historyId: 'h1' });
  });

  it('carries on a test left under 30 minutes ago, and starts a new one after that', () => {
    const now = 10 * BATTERY_RESUME_MS;
    const saved: BatteryTest = { startedAt: now - 20 * 60000, at: now - 10 * 60000, rest: 12.5 };
    expect(resumableTest(saved, now)).toBe(saved);
    expect(resumableTest({ ...saved, at: now - 31 * 60000 }, now)).toBeNull();
    expect(resumableTest({ ...saved, at: now + 60000 }, now)).toBeNull();
    expect(resumableTest(undefined, now)).toBeNull();
  });

  it('gives a verdict for each completed step, in order', () => {
    const t: BatteryTest = { startedAt: 1, at: 2, rest: 12.45, crank: { min: 10.2, first: 12.4, last: 14.1 }, idle: 14.2, load: 12.3 };
    expect(batteryResults(t).map((r) => [r.key, r.verdict.word])).toEqual([
      ['rest', 'Fair'],
      ['crank', 'Good'],
      ['idle', 'Charging'],
      ['load', 'Not charging'],
    ]);
    expect(batterySummary(t)).toBe('Rest, engine off 12.45 V: Fair. Lowest while cranking 10.20 V: Good. Idle, loads off 14.20 V: Charging. Idle, loads on 12.30 V: Not charging.');
    expect(batteryTitle(t)).toBe('Battery test, 4 of 4 readings');
    expect(batteryTitle({ rest: 12.7 })).toBe('Battery test, 1 of 4 readings');
    expect(batteryResults(null)).toEqual([]);
    expect(batterySummary({})).toBe('');
  });

  it('says when no start was seen while cranking', () => {
    expect(batteryResults({ crank: { min: 12.3, first: 12.4, last: 12.4 } })[0].verdict.word).toBe('No start seen');
    expect(batteryResults({ crank: { min: 8.9, first: 12.4, last: 14.0 } })[0].verdict.word).toBe('Low');
  });
});
