// Gauge alerts, peak-hold and session lowest/highest for Live data and the
// dashboard. Limits are kept in the value's own unit as the car reports it
// (km/h, °C); the screens convert to and from the owner's units.
import type { Settings } from '../settings';

// As in src/settings.tsx (imported as a type only, so tests need no storage).
const KMH_PER_MPH = 1.609344;

export interface AlertRule {
  pid: number;
  // Alert above this value, below this value, or both (null: no limit).
  above: number | null;
  below: number | null;
  // Only alert while the engine turns faster than this (null: always).
  minRpm: number | null;
}

export type AlertLevel = 'above' | 'below' | null;

export function alertLevel(rule: AlertRule | undefined, value: number | null | undefined, rpm: number | null | undefined): AlertLevel {
  if (!rule || value == null || !Number.isFinite(value)) return null;
  if (rule.minRpm != null && rule.minRpm > 0 && (rpm == null || rpm <= rule.minRpm)) return null;
  if (rule.above != null && value > rule.above) return 'above';
  if (rule.below != null && value < rule.below) return 'below';
  return null;
}

export function needsRpm(rules: AlertRule[]): boolean {
  return rules.some((r) => r.minRpm != null && r.minRpm > 0);
}

// Buzz once when a value crosses into its alert, not on every reading. A
// value that drops out and back in within the quiet time does not buzz again.
export class AlertTracker {
  private on = new Map<number, AlertLevel>();
  private buzzed = new Map<number, number>();
  constructor(private quietMs = 5000) {}

  // Levels for this pass, by PID. Returns the PIDs whose alert just started.
  update(levels: Map<number, AlertLevel>, now: number): number[] {
    const fresh: number[] = [];
    for (const [pid, level] of levels) {
      const was = this.on.get(pid) ?? null;
      if (level && level !== was) {
        const last = this.buzzed.get(pid);
        if (last == null || now - last >= this.quietMs) {
          fresh.push(pid);
          this.buzzed.set(pid, now);
        }
      }
      this.on.set(pid, level);
    }
    return fresh;
  }

  reset(): void {
    this.on.clear();
    this.buzzed.clear();
  }
}

// Peak-hold: the highest reading stays on show for holdMs, then follows the
// value down. A higher reading always takes over at once.
export interface Peak {
  value: number;
  at: number;
}

export function holdPeak(prev: Peak | null | undefined, v: number, now: number, holdMs = 3000): Peak {
  if (!prev || v >= prev.value || now - prev.at >= holdMs) return { value: v, at: now };
  return prev;
}

// Session lowest and highest for one value.
export interface MinMax {
  min: number;
  max: number;
}

export function addMinMax(prev: MinMax | null | undefined, v: number): MinMax {
  return prev ? { min: Math.min(prev.min, v), max: Math.max(prev.max, v) } : { min: v, max: v };
}

// The owner's units back to the car's own unit (the reverse of toUserUnits).
export function fromUserUnits(value: number, unit: string, s: Pick<Settings, 'speed' | 'temp'>): number {
  if (unit === 'km/h' && s.speed === 'mph') return value * KMH_PER_MPH;
  if (unit === '°C' && s.temp === '°F') return ((value - 32) * 5) / 9;
  if (unit === 'km' && s.speed === 'mph') return value * KMH_PER_MPH;
  return value;
}

// A typed number: accepts a comma for the decimal point. Empty: null.
// Not a number: NaN.
export function parseNumber(text: string): number | null {
  const s = text.trim().replace(',', '.');
  if (!s) return null;
  return /^-?\d*\.?\d+$/.test(s) ? Number(s) : NaN;
}

// Builds a rule from what the owner typed, in their units. rule null with no
// error: both limits empty, so the alert is off.
export function ruleFromInput(
  pid: number,
  unit: string,
  input: { above: string; below: string; minRpm: string },
  s: Pick<Settings, 'speed' | 'temp'>,
): { rule: AlertRule | null; error?: string } {
  const above = parseNumber(input.above);
  const below = parseNumber(input.below);
  const minRpm = parseNumber(input.minRpm);
  if (Number.isNaN(above) || Number.isNaN(below) || Number.isNaN(minRpm)) return { rule: null, error: 'Type numbers only.' };
  if (above == null && below == null) return { rule: null };
  if (above != null && below != null && above <= below) return { rule: null, error: 'The upper limit must be higher than the lower limit.' };
  if (minRpm != null && minRpm < 0) return { rule: null, error: 'Engine speed cannot be below 0.' };
  return {
    rule: {
      pid,
      above: above == null ? null : fromUserUnits(above, unit, s),
      below: below == null ? null : fromUserUnits(below, unit, s),
      minRpm: minRpm || null,
    },
  };
}

// Replaces (or removes, with null) the rule for one value.
export function setRule(rules: AlertRule[], pid: number, rule: AlertRule | null): AlertRule[] {
  const rest = rules.filter((r) => r.pid !== pid);
  return rule ? [...rest, rule] : rest;
}
