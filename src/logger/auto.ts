// Data logger auto-start: start recording when engine speed, the accelerator
// pedal or the throttle goes above a set value, and stop once it has stayed
// below that value for a set time. Pure, tested in __tests__/logger.test.ts.

export type TriggerKind = 'rpm' | 'pedal' | 'throttle';

// Standard OBD values the trigger watches: 0C engine speed, 49 accelerator
// pedal position D, 11 throttle position.
export const TRIGGER_PID: Record<TriggerKind, number> = { rpm: 0x0c, pedal: 0x49, throttle: 0x11 };

export const TRIGGER_LABEL: Record<TriggerKind, string> = { rpm: 'Engine speed', pedal: 'Accelerator pedal', throttle: 'Throttle' };

export interface AutoRule {
  on: boolean;
  kind: TriggerKind;
  // Start above this: rpm, or % for the pedal and throttle.
  above: number;
  // Stop after this many seconds below it.
  stopAfterS: number;
}

export const DEFAULT_AUTO: AutoRule = { on: false, kind: 'rpm', above: 3000, stopAfterS: 10 };

export const LIMITS: Record<TriggerKind, { min: number; max: number; step: number; unit: string }> = {
  rpm: { min: 500, max: 8000, step: 250, unit: 'rpm' },
  pedal: { min: 5, max: 100, step: 5, unit: '%' },
  throttle: { min: 5, max: 100, step: 5, unit: '%' },
};
export const STOP_LIMITS = { min: 1, max: 120 };

// A rule with every number inside its limits (a saved rule, or a new kind).
export function clampRule(r: AutoRule): AutoRule {
  const l = LIMITS[r.kind] ?? LIMITS.rpm;
  const kind = LIMITS[r.kind] ? r.kind : 'rpm';
  const fix = (x: number, min: number, max: number, dflt: number) => (Number.isFinite(x) ? Math.min(max, Math.max(min, Math.round(x))) : dflt);
  return {
    on: !!r.on,
    kind,
    above: fix(r.above, l.min, l.max, kind === 'rpm' ? DEFAULT_AUTO.above : 50),
    stopAfterS: fix(r.stopAfterS, STOP_LIMITS.min, STOP_LIMITS.max, DEFAULT_AUTO.stopAfterS),
  };
}

// Changing the trigger kind puts the threshold back to a sensible value.
export function withKind(r: AutoRule, kind: TriggerKind): AutoRule {
  if (kind === r.kind) return r;
  return clampRule({ ...r, kind, above: kind === 'rpm' ? DEFAULT_AUTO.above : 50 });
}

export function stepThreshold(r: AutoRule, dir: 1 | -1): AutoRule {
  return clampRule({ ...r, above: r.above + dir * LIMITS[r.kind].step });
}

// Stop delays offered by the - and + buttons.
export const STOP_STEPS = [1, 2, 3, 5, 10, 15, 20, 30, 45, 60, 90, 120];

export function stepStopDelay(r: AutoRule, dir: 1 | -1): AutoRule {
  const s = r.stopAfterS;
  const next = dir > 0 ? STOP_STEPS.find((x) => x > s) : [...STOP_STEPS].reverse().find((x) => x < s);
  return clampRule({ ...r, stopAfterS: next ?? s });
}

export type AutoState = { phase: 'armed' } | { phase: 'recording'; belowSince: number | null };

export const ARMED: AutoState = { phase: 'armed' };

// Feeds one reading of the trigger value. A missing reading (engine off, no
// answer) counts as below while recording and does nothing while armed.
export function stepAuto(rule: AutoRule, state: AutoState, value: number | null, now: number): { state: AutoState; action: 'start' | 'stop' | null } {
  const above = value != null && value > rule.above;
  if (state.phase === 'armed') {
    return above ? { state: { phase: 'recording', belowSince: null }, action: 'start' } : { state, action: null };
  }
  if (above) return { state: state.belowSince == null ? state : { phase: 'recording', belowSince: null }, action: null };
  const since = state.belowSince ?? now;
  if (now - since >= rule.stopAfterS * 1000) return { state: ARMED, action: 'stop' };
  return { state: state.belowSince == null ? { phase: 'recording', belowSince: now } : state, action: null };
}
