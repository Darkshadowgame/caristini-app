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
    return { tone: 'neutral', word: 'No start seen', text: 'No dip from cranking. Start the engine within 10 s of tapping Start, then try again.' };
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


// The last reading another screen saved (Learn my car, the health check), as
// a Battery test result: charging bands at 13.3 V and above (engine
// running), rest bands below.
export function savedResult(saved: { volts: number; at: number; from: string } | null | undefined): { title: string; v: number; verdict: Verdict } | null {
  if (!saved || !Number.isFinite(saved.volts)) return null;
  const running = saved.volts >= 13.3;
  return { title: `${running ? 'Engine running' : 'Engine off'}, from ${saved.from}`, v: saved.volts, verdict: running ? chargeVerdict(saved.volts) : restVerdict(saved.volts) };
}
