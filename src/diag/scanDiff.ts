// Health check changes: each check compared with the previous full check of
// the same car, per module: new faults, faults gone (cleared) and faults seen
// in both (recurring). Pure, so it is tested without a phone.
import type { HistoryEntry, HistoryFault } from '../history';

// The engine's standard codes are logged as "Engine (OBD2)" when the engine
// module itself could not be read: the same faults as the Engine module's.
const ENGINE_OBD = 'Engine (OBD2)';
const moduleKey = (m: string) => (m === ENGINE_OBD ? 'Engine' : m);
// UDS codes carry a fault-type byte (P0011B5); the same fault is P0011.
const baseCode = (c: string) => (/^[PCBU][0-9A-F]{4}[0-9A-F]{2}$/.test(c) ? c.slice(0, 5) : c);
const keyOf = (f: HistoryFault) => `${moduleKey(f.module)}|${baseCode(f.code)}`;

// A check that ran to the end and that the car answered.
// A check where nothing at all was read is not a comparison point: the next
// good check would show every long-standing fault as new.
export function isFullCheck(e: HistoryEntry): boolean {
  return e.kind === 'scan' && e.complete !== false && !e.noAnswer && (e.read == null || e.read.length > 0);
}

// The newest full check of the same car made before this one.
export function previousFull(list: HistoryEntry[], entry: { at: number; vin: string; id?: string }): HistoryEntry | null {
  return (
    list
      .filter((e) => e.vin === entry.vin && e.id !== entry.id && e.at < entry.at && isFullCheck(e))
      .sort((a, b) => b.at - a.at)[0] ?? null
  );
}

export interface ModuleChanges {
  module: string;
  added: HistoryFault[];
  recurring: HistoryFault[];
  cleared: HistoryFault[];
  // In the previous check, but this check did not read the module.
  notRead: HistoryFault[];
  // Found now in a module the previous check did not read: maybe not new.
  notReadBefore: HistoryFault[];
}

export interface ScanDiff {
  since: HistoryEntry;
  modules: ModuleChanges[];
  added: number;
  recurring: number;
  cleared: number;
  notRead: number;
  notReadBefore: number;
}

const uniq = (list: HistoryFault[]) => {
  const seen = new Set<string>();
  return list.filter((f) => {
    const k = keyOf(f);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
};

// now.read: the modules this check read (answered). Without it every module
// is taken as read, as in checks saved before this list was kept.
export function diffScans(prev: HistoryEntry | null, now: { faults?: HistoryFault[]; read?: string[] }): ScanDiff | null {
  if (!prev) return null;
  const before = uniq(prev.faults ?? []);
  const after = uniq(now.faults ?? []);
  const beforeKeys = new Set(before.map(keyOf));
  const afterKeys = new Set(after.map(keyOf));
  const read = now.read ? new Set(now.read.map(moduleKey)) : null;
  // The engine module itself answered (not only the standard codes read,
  // which returns emissions codes only).
  const engineModuleRead = now.read ? now.read.some((m) => m !== ENGINE_OBD && moduleKey(m) === 'Engine') : true;
  const prevRead = prev.read ? new Set(prev.read.map(moduleKey)) : null;
  const prevEngineModuleRead = prev.read ? prev.read.some((m) => m !== ENGINE_OBD && moduleKey(m) === 'Engine') : true;
  // A fault is new only if the previous check could have seen it.
  const seenBefore = (f: HistoryFault) =>
    !prevRead || (prevRead.has(moduleKey(f.module)) && !(f.module !== ENGINE_OBD && moduleKey(f.module) === 'Engine' && !prevEngineModuleRead));
  const byModule = new Map<string, ModuleChanges>();
  const slot = (f: HistoryFault) => {
    const k = moduleKey(f.module);
    let m = byModule.get(k);
    if (!m) {
      m = { module: k, added: [], recurring: [], cleared: [], notRead: [], notReadBefore: [] };
      byModule.set(k, m);
    }
    return m;
  };
  for (const f of after) (beforeKeys.has(keyOf(f)) ? slot(f).recurring : seenBefore(f) ? slot(f).added : slot(f).notReadBefore).push(f);
  for (const f of before) {
    if (afterKeys.has(keyOf(f))) continue;
    if (read && !read.has(moduleKey(f.module))) slot(f).notRead.push(f);
    // A fault the engine module reported last time can only be called cleared
    // when the engine module answered this time; the standard codes read does
    // not return its other faults (U-codes, maker codes).
    else if (f.module !== ENGINE_OBD && moduleKey(f.module) === 'Engine' && !engineModuleRead) slot(f).notRead.push(f);
    else slot(f).cleared.push(f);
  }
  // Modules with something new first, then recurring, then cleared.
  const rank = (m: ModuleChanges) => (m.added.length ? 0 : m.recurring.length ? 1 : m.cleared.length ? 2 : 3);
  const modules = [...byModule.values()].sort((a, b) => rank(a) - rank(b) || a.module.localeCompare(b.module));
  const sum = (k: 'added' | 'recurring' | 'cleared' | 'notRead' | 'notReadBefore') => modules.reduce((n, m) => n + m[k].length, 0);
  return { since: prev, modules, added: sum('added'), recurring: sum('recurring'), cleared: sum('cleared'), notRead: sum('notRead'), notReadBefore: sum('notReadBefore') };
}

// One line for the result screen and History.
export function diffSummary(d: ScanDiff): string {
  if (!d.added && !d.recurring && !d.cleared) return 'No faults then and none now.';
  const parts: string[] = [];
  if (d.added) parts.push(`${d.added} new`);
  if (d.recurring) parts.push(`${d.recurring} also in the last check`);
  if (d.cleared) parts.push(`${d.cleared} cleared`);
  return `${parts.join(', ')}.`;
}
