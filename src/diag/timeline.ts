// Change timeline: every setting change Caristini wrote to a car, one
// line per module, newest first, from History (kind 'change'). Exported as
// plain text or CSV. Pure, so it is tested without a phone.
import type { HistoryEntry } from '../history';

export interface TimelineRow {
  id: string;
  at: number;
  module: string;
  // Customise key (module id, or "moduleId:DID"), when recorded: Put back uses it.
  key?: string;
  setting: string;
  from?: string;
  to?: string;
  before: string;
  after: string;
  backup?: string;
  source?: string;
  odometerKm?: number;
  // Saved before the timeline kept one line per module: the module split is
  // read from the History text and the backup was not recorded.
  older: boolean;
}

// Entries saved before 15 Nov 2026 hold module names in detail (", "
// between them) and the bytes of each module in before and after (" "
// between them).
function olderRows(e: HistoryEntry): TimelineRow[] {
  const befores = e.before ? e.before.split(' ') : [];
  const afters = e.after ? e.after.split(' ') : [];
  const names = e.detail ? e.detail.split(', ') : [];
  const source = e.detail === 'Workshop' ? 'Workshop' : e.detail === 'No effect seen in Try mode' ? 'Try mode' : 'Customise';
  const base = { at: e.at, setting: e.title, source, odometerKm: e.odometerKm, older: true };
  if (befores.length > 1 && befores.length === afters.length && names.length === befores.length) {
    return befores.map((b, i) => ({ ...base, id: `${e.id}-${i}`, module: names[i], before: b, after: afters[i] }));
  }
  const module = source === 'Customise' && e.detail ? e.detail : 'Not recorded';
  return [{ ...base, id: `${e.id}-0`, module, before: e.before ?? '', after: e.after ?? '' }];
}

export function timelineRows(history: HistoryEntry[]): TimelineRow[] {
  const rows: TimelineRow[] = [];
  for (const e of history) {
    if (e.kind !== 'change') continue;
    if (e.changes?.length) {
      e.changes.forEach((c, i) =>
        rows.push({
          id: `${e.id}-${i}`,
          at: e.at,
          module: c.module,
          key: c.key,
          setting: c.setting,
          from: c.from,
          to: c.to,
          before: c.before,
          after: c.after,
          backup: c.backup,
          source: c.source,
          odometerKm: e.odometerKm,
          older: false,
        }),
      );
    } else rows.push(...olderRows(e));
  }
  return rows.sort((a, b) => b.at - a.at);
}

const pad = (n: number) => String(n).padStart(2, '0');
// Local date and time as 2026-11-15 14:03, the same on every phone language.
export function stamp(at: number): { date: string; time: string } {
  const d = new Date(at);
  return { date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`, time: `${pad(d.getHours())}:${pad(d.getMinutes())}` };
}

// CSV field: quoted when it holds a comma, quote or line break (RFC 4180).
// A leading = + - @ is prefixed with ' so a spreadsheet does not run it.
export function csvField(v: string | number | undefined): string {
  let s = v == null ? '' : String(v);
  if (/^[=+\-@]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export const CSV_HEADER = ['Date', 'Time', 'Module', 'Setting', 'Old value', 'New value', 'Old bytes', 'New bytes', 'Backup', 'Made in', 'Odometer km'];

export function timelineCsv(rows: TimelineRow[]): string {
  const lines = [CSV_HEADER.join(',')];
  for (const r of rows) {
    const { date, time } = stamp(r.at);
    lines.push(
      [date, time, r.module, r.setting, r.from, r.to, r.before, r.after, r.backup ?? (r.older ? 'Not recorded' : ''), r.source, r.odometerKm == null ? '' : Math.round(r.odometerKm)]
        .map(csvField)
        .join(','),
    );
  }
  return `${lines.join('\r\n')}\r\n`;
}

export function timelineText(rows: TimelineRow[], car: string): string {
  const out = [`Change timeline: ${car}`, `${rows.length} change${rows.length === 1 ? '' : 's'}, newest first.`, ''];
  for (const r of rows) {
    const { date, time } = stamp(r.at);
    out.push(`${date} ${time}  ${r.module}: ${r.setting}`);
    if (r.from || r.to) out.push(`  Value: ${r.from ?? '?'} to ${r.to ?? '?'}`);
    if (r.before || r.after) out.push(`  Bytes: ${r.before || '?'} to ${r.after || '?'}`);
    out.push(`  Backup: ${r.backup ?? 'Not recorded'}`);
    const extra = [r.source ? `Made in ${r.source}` : null, r.odometerKm != null ? `${Math.round(r.odometerKm)} km` : null].filter(Boolean);
    if (extra.length) out.push(`  ${extra.join(', ')}`);
    out.push('');
  }
  out.push('Made with Caristini. Backups are the coding each module had before Caristini first changed it.');
  return out.join('\n');
}

// Put back on a timeline entry: the module's original coding (from Backups) is
// written again through Customise's restore. 'offer' when the module has a
// backup and its last known coding differs from it; 'original' when it is back
// to the original already; 'none' when no backup or key was recorded.
export type PutBack = 'offer' | 'original' | 'none';
export function putBackState(
  row: Pick<TimelineRow, 'key'>,
  originals: Record<string, string> | undefined,
  cache: Record<string, string> | undefined,
  rows: Pick<TimelineRow, 'key' | 'at' | 'before' | 'after'>[] = [],
): PutBack {
  const original = row.key ? originals?.[row.key] : undefined;
  if (!row.key || !original) return 'none';
  const now = codingNow(row.key, cache, rows);
  return now && now.toUpperCase() === original.toUpperCase() ? 'original' : 'offer';
}

// The module's coding now: the last coding read, unless a write since then
// changed it (the read is the write's old coding, or there is no read): then
// the newest write's new coding. A cache saved before a write is stale.
export function codingNow(key: string, cache: Record<string, string> | undefined, rows: Pick<TimelineRow, 'key' | 'at' | 'before' | 'after'>[]): string | undefined {
  const read = cache?.[key];
  const last = rows.filter((r) => r.key === key && r.after).sort((a, b) => b.at - a.at)[0];
  if (!last) return read;
  if (!read || read.toUpperCase() === last.before.toUpperCase()) return last.after;
  return read;
}

// The coding cache after a write: each written module's new coding, so
// screens that decide from the cache (Put back) see the change at once.
export function cacheAfterWrite(cache: Record<string, string> | undefined, written: { key: string; hex: string }[]): Record<string, string> {
  return { ...(cache ?? {}), ...Object.fromEntries(written.map((w) => [w.key, w.hex.toUpperCase()])) };
}
