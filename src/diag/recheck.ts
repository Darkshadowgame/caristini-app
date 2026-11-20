// After a clear or a "Try these again" on the Health check: the words for
// what came back, and the saved check brought up to date. Pure: the screen
// does the saving.
import type { HistoryEntry, HistoryFault } from '../history';
import { faultKey, faultMeaning } from './faults';

const ENGINE_OBD = 'Engine (OBD2)';
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

// Fault codes with each fault once: P0300 from the engine's standard list and
// 16684 from the engine module are one fault, and the first one read is kept.
export function uniqueFaultCodes(codes: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const c of codes) {
    const k = faultKey(c);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(c);
  }
  return out;
}

// What the screen says once the check after "Clear all faults" has ended.
// again: that check, or null when it did not run to the end.
export function recheckMessage(again: { stopped: boolean; faults: number; milOn: boolean | null } | null): string {
  const saved = 'Faults cleared. Saved to History and your diary.';
  if (!again || again.stopped) return `${saved} The check afterwards did not finish: tap Check again to see what comes back.`;
  if (again.faults) return `${saved} ${plural(again.faults, 'fault')} came straight back, so the cause is still there.`;
  return `${saved} Nothing came back.${again.milOn ? ' The engine light is still on.' : ''}`;
}

export interface CheckTotals {
  logged: HistoryFault[];
  read: string[];
  answered: number;
  codesCounted: string[];
}

// Modules read again after the check was saved ("Try these again"), added to
// that check. A module the check already read is left alone. An engine code
// from the standard list that a module read now reports is counted once.
export function mergeRetried(
  check: CheckTotals,
  retried: { name: string; state: string; faults: { code: string }[] }[],
  brand?: string | null,
): CheckTotals & { changed: boolean } {
  const fresh = retried.filter((r) => (r.state === 'ok' || r.state === 'faults') && !check.read.includes(r.name));
  if (!fresh.length) return { logged: check.logged, read: check.read, answered: check.answered, codesCounted: check.codesCounted, changed: false };
  const extra: HistoryFault[] = fresh.flatMap((r) => r.faults.map((f) => ({ module: r.name, code: f.code, text: faultMeaning(f.code, { module: r.name, brand }).title })));
  const now = new Set(extra.map((f) => faultKey(f.code)));
  const dropped = check.logged.filter((f) => f.module === ENGINE_OBD && now.has(faultKey(f.code)));
  const codesCounted = [...check.codesCounted];
  for (const d of dropped) {
    const i = codesCounted.indexOf(d.code);
    if (i >= 0) codesCounted.splice(i, 1);
  }
  return {
    logged: [...check.logged.filter((f) => !dropped.includes(f)), ...extra],
    read: [...check.read, ...fresh.map((r) => r.name)],
    answered: check.answered + fresh.length,
    codesCounted: [...codesCounted, ...extra.map((f) => f.code)],
    changed: true,
  };
}

// The History entry of the check after a retry: same wording as a new check.
export function retriedHistoryPatch(totals: CheckTotals, beforeDetail?: string): Partial<HistoryEntry> {
  const said = `${plural(totals.answered, 'module')} answered`;
  const detail = beforeDetail == null ? undefined : /^\d+ modules? answered/.test(beforeDetail) ? beforeDetail.replace(/^\d+ modules? answered/, said) : /^No control module answered/.test(beforeDetail) ? `${said}${/; engine light on$/.test(beforeDetail) ? '; engine light on' : ''}` : undefined;
  return {
    faults: totals.logged,
    read: totals.read,
    modules: totals.answered,
    title: totals.logged.length ? `${plural(totals.logged.length, 'fault')} found` : totals.answered ? 'No faults found' : 'No control module answered',
    ...(totals.answered ? { noAnswer: false } : {}),
    ...(detail ? { detail } : {}),
  };
}
