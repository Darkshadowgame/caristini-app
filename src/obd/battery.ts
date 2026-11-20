// Battery verdicts from the voltage at the diagnostic port (shared by Home,
// the health check and the battery test).
import type { Tone } from '../ui';

export interface Verdict {
  tone: Tone;
  word: string;
  text: string;
}

// General 12 V lead-acid figures.
export function restVerdict(v: number): Verdict {
  if (v >= 12.5) return { tone: 'ok', word: 'Good', text: 'Close to full charge.' };
  if (v >= 12.2) return { tone: 'neutral', word: 'Fair', text: 'Part charged. A longer drive or a charger will top it up.' };
  if (v >= 12.0) return { tone: 'neutral', word: 'Low', text: 'About half charge or less. Charge the battery.' };
  return { tone: 'danger', word: 'Flat', text: 'Below 12.0 V. Charge the battery and test it again.' };
}

export function crankVerdict(min: number, first: number, last: number): Verdict {
  if (first - min < 0.5 && last < 13) {
    return { tone: 'neutral', word: 'No start seen', text: 'No dip from cranking. Start the engine within 10 seconds of tapping Start, then try again.' };
  }
  if (min >= 9.6) return { tone: 'ok', word: 'Good', text: 'The voltage held up while cranking.' };
  return { tone: 'danger', word: 'Low', text: 'Below 9.6 V while cranking suggests a weak battery or a poor connection.' };
}

export function chargeVerdict(v: number): Verdict {
  if (v > 15.0) return { tone: 'danger', word: 'Too high', text: 'Above 15.0 V. The regulator may be overcharging the battery.' };
  if (v > 14.7) return { tone: 'neutral', word: 'High', text: 'A little above the usual range.' };
  if (v >= 13.7) return { tone: 'ok', word: 'Charging', text: 'In the usual range of 13.7 to 14.7 V.' };
  if (v >= 12.5) {
    return { tone: 'neutral', word: 'Low', text: 'Below the usual range. Smart charging systems can run this low, so this is not always a fault.' };
  }
  return { tone: 'danger', word: 'Not charging', text: 'Below 12.5 V with the engine running. The alternator may not be charging.' };
}


// A reading above this is not a battery at rest: the engine is running, or
// the battery still holds surface charge from a drive or a charger.
export const REST_MAX_VOLTS = 13.0;

// The message for a "rest" reading that is too high to be one, or null when
// the reading can be judged as a rest voltage.
export function restTooHigh(v: number): string | null {
  if (!(v > REST_MAX_VOLTS)) return null;
  return `${v.toFixed(2)} V is too high for a battery at rest. This looks like a running engine, or surface charge left from a drive or a charger. Switch the engine off, wait a few minutes, then read again.`;
}

// The message for an idle or loads-on charging reading that is too low to be
// one, or null. Used when the car gives no engine speed to check the engine is
// running: a running alternator holds about 13.0 V or more.
export const CHARGE_MIN_VOLTS = 13;
export function chargeTooLow(v: number): string | null {
  if (!(v < CHARGE_MIN_VOLTS)) return null;
  return `${v.toFixed(2)} V looks like the engine is off, or the car is holding its charge low: a running engine usually charges at 13 V or more. Start the engine, let it idle, then read again.`;
}

// One battery test, saved on the car as each step completes.
export interface BatteryTest {
  // When the first and the latest step of this test were saved (ms).
  startedAt: number;
  at: number;
  // Step 1: rest voltage.
  rest?: number;
  // Step 2: lowest, first and last voltage while cranking.
  crank?: { min: number; first: number; last: number };
  // Step 3: charging voltage at idle, loads off and loads on.
  idle?: number;
  load?: number;
  // The History entry this test keeps its verdicts in.
  historyId?: string;
}

export type BatteryStep = Pick<BatteryTest, 'rest'> | Pick<BatteryTest, 'crank'> | Pick<BatteryTest, 'idle'> | Pick<BatteryTest, 'load'>;

// The test with one more completed step. A step read again replaces its
// earlier reading. With no test yet, this step starts one.
export function withBatteryStep(prev: BatteryTest | null | undefined, step: BatteryStep, now: number): BatteryTest {
  return { ...(prev ?? { startedAt: now }), ...step, at: now };
}

// A saved test is carried on when its latest step is under 30 minutes old
// (the owner left the page part-way); an older one is shown as the last test
// and the next reading starts a new one.
export const BATTERY_RESUME_MS = 30 * 60 * 1000;
export function resumableTest(saved: BatteryTest | null | undefined, now: number): BatteryTest | null {
  if (!saved || !Number.isFinite(saved.at)) return null;
  const age = now - saved.at;
  return age >= 0 && age < BATTERY_RESUME_MS ? saved : null;
}

export interface BatteryResult {
  key: 'rest' | 'crank' | 'idle' | 'load';
  title: string;
  v: number;
  verdict: Verdict;
}

// The completed steps of a test, in order, each with its verdict.
export function batteryResults(t: Pick<BatteryTest, 'rest' | 'crank' | 'idle' | 'load'> | null | undefined): BatteryResult[] {
  if (!t) return [];
  const out: BatteryResult[] = [];
  if (t.rest != null) out.push({ key: 'rest', title: 'Rest, engine off', v: t.rest, verdict: restVerdict(t.rest) });
  if (t.crank) out.push({ key: 'crank', title: 'Lowest while cranking', v: t.crank.min, verdict: crankVerdict(t.crank.min, t.crank.first, t.crank.last) });
  if (t.idle != null) out.push({ key: 'idle', title: 'Idle, loads off', v: t.idle, verdict: chargeVerdict(t.idle) });
  if (t.load != null) out.push({ key: 'load', title: 'Idle, loads on', v: t.load, verdict: chargeVerdict(t.load) });
  return out;
}

// The verdicts in one line, for History:
// "Rest, engine off 12.45 V: Fair. Lowest while cranking 10.20 V: Good."
export function batterySummary(t: Pick<BatteryTest, 'rest' | 'crank' | 'idle' | 'load'> | null | undefined): string {
  return batteryResults(t)
    .map((r) => `${r.title} ${r.v.toFixed(2)} V: ${r.verdict.word}.`)
    .join(' ');
}

// The title of the History entry: "Battery test, 3 of 4 readings".
export function batteryTitle(t: Pick<BatteryTest, 'rest' | 'crank' | 'idle' | 'load'> | null | undefined): string {
  return `Battery test, ${batteryResults(t).length} of 4 readings`;
}

// The last reading another screen saved (Learn my car, the health check), as
// a Battery test result: charging bands at 13.3 V and above (engine
// running), rest bands below.
export function savedResult(saved: { volts: number; at: number; from: string } | null | undefined): { title: string; v: number; verdict: Verdict } | null {
  if (!saved || !Number.isFinite(saved.volts)) return null;
  const running = saved.volts >= 13.3;
  return { title: `${running ? 'Engine running' : 'Engine off'}, from ${saved.from}`, v: saved.volts, verdict: running ? chargeVerdict(saved.volts) : restVerdict(saved.volts) };
}
