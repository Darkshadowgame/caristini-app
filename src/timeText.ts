// One way to say how long something takes, how long is left, and when
// something happened, for every screen and summary; and one name for every
// shared file. Pure, so it is tested without a phone
// (__tests__/uxRecheck.test.ts, __tests__/timeText.test.ts).

const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? '' : 's'}`;

// "40 seconds", "1 minute", "14 minutes", "2 hours 50 minutes". Under a
// minute in 5-second steps (10 seconds at least); minutes rounded.
export function durationText(seconds: number): string {
  const s = Math.max(0, seconds);
  if (s < 59.5) return plural(Math.max(10, Math.round(s / 5) * 5), 'second');
  const mins = Math.max(1, Math.round(s / 60));
  if (mins < 60) return plural(mins, 'minute');
  const h = Math.floor(mins / 60);
  const m = Math.round((mins % 60) / 10) * 10;
  if (m === 60) return plural(h + 1, 'hour');
  return `${plural(h, 'hour')}${m ? ` ${m} minutes` : ''}`;
}

// A range in plain words: "About 40 seconds", "About 3 minutes", "About 2 to
// 5 minutes", "About 30 seconds to 2 minutes". Lower case with lower: true.
export function aboutRange(loSeconds: number, hiSeconds: number, opts: { lower?: boolean } = {}): string {
  const lo = Math.min(loSeconds, hiSeconds);
  const hi = Math.max(loSeconds, hiSeconds);
  let text: string;
  if (hi < 59.5) {
    const a = durationText(lo);
    const b = durationText(hi);
    text = a === b ? a : `${a.replace(/ seconds?$/, '')} to ${b}`;
  } else if (lo < 59.5) {
    text = `${durationText(lo)} to ${durationText(Math.ceil(hi / 60) * 60)}`;
  } else {
    const a = Math.max(1, Math.round(lo / 60));
    const b = Math.max(a, Math.ceil(hi / 60));
    if (a === b) text = durationText(a * 60);
    else if (b < 60) text = `${a} to ${b} minutes`;
    else text = `${durationText(lo)} to ${durationText(hi)}`;
  }
  const out = `About ${text}`;
  return opts.lower ? out.charAt(0).toLowerCase() + out.slice(1) : out;
}

// Short form for a running clock or a summary: "4 s", "45 s", "2 min".
export function shortDuration(ms: number): string {
  const s = Math.max(0, ms / 1000);
  if (s < 59.5) return `${Math.max(1, Math.round(s))} s`;
  return `${Math.max(1, Math.round(s / 60))} min`;
}

// ---------------------------------------------------------------------------
// Time left on a running job: one wording on every screen.
// ---------------------------------------------------------------------------

// "under a minute left", "about 6 min left", "about 2 h 10 min left".
export function leftText(seconds: number): string {
  if (seconds < 60) return 'under a minute left';
  const m = Math.round(seconds / 60);
  if (m < 90) return `about ${m} min left`;
  const h = Math.floor(m / 60);
  return `about ${h} h ${m - h * 60} min left`;
}

// The same words from how fast the work has gone so far; null until there is
// enough to judge (5 items and 5 seconds).
export function timeLeft(done: number, total: number, startedAt: number, now = Date.now()): string | null {
  const elapsed = now - startedAt;
  if (done < 5 || elapsed < 5000 || total <= done) return null;
  return leftText(((total - done) * elapsed) / done / 1000);
}

// ---------------------------------------------------------------------------
// Dates and times: one format on every screen, in the phone's own time zone.
// Files (CSV, logs) keep ISO dates.
// ---------------------------------------------------------------------------

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const two = (n: number) => String(n).padStart(2, '0');

// A time in milliseconds, a Date, or a diary date ("2026-11-09", read as that
// day on this phone, not as midnight in London).
function toDate(at: number | string | Date): Date | null {
  if (at instanceof Date) return Number.isNaN(at.getTime()) ? null : at;
  if (typeof at === 'string') {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(at);
    if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  }
  const d = new Date(at);
  return Number.isNaN(d.getTime()) ? null : d;
}

// "9 Nov 2026". Text that is not a date comes back as it was.
export function dateText(at: number | string | Date): string {
  const d = toDate(at);
  if (!d) return String(at);
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

// "17:02", on the 24-hour clock.
export function clockText(at: number | string | Date): string {
  const d = toDate(at);
  if (!d) return '';
  return `${two(d.getHours())}:${two(d.getMinutes())}`;
}

// "9 Nov 2026, 17:02".
export function dateTimeText(at: number | string | Date): string {
  const d = toDate(at);
  if (!d) return String(at);
  return `${dateText(d)}, ${clockText(d)}`;
}

// The date part of a shared file's name: "20261109".
export function fileDate(at: number | Date = Date.now()): string {
  const d = toDate(at) ?? new Date();
  return `${d.getFullYear()}${two(d.getMonth() + 1)}${two(d.getDate())}`;
}

// One name for every file the app shares, without the extension:
// "Pin16-health-report-WVWZZZ1KZBW000001-20261109". what: lower-case
// words; stamp: a log's own start time in place of the date.
export function shareFileName(what: string, vin: string | null | undefined, at: number | Date = Date.now(), stamp?: string): string {
  const clean = (s: string) => s.trim().replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return ['Pin16', clean(what.toLowerCase()), vin ? clean(vin.toUpperCase()) : null, stamp ? stamp.replace(/[^0-9-]/g, '') : fileDate(at)].filter(Boolean).join('-');
}
