// Data logger: the saved log format and the pure helpers the viewer, the CSV
// export and the tests use. No React or native imports here.
//
// A log is a list of rows. Each row is one read of one source (standard OBD
// values, maker values, or one older VW measuring group) at time t, in ms
// from the start. v holds one slot per channel; a channel not read in that
// row is null. Values are kept in the car's own units (km/h, °C); the screens
// and the CSV convert to the owner's units.

export const LOG_VERSION = 1;

// Longest log kept in memory: about 1 hour at 50 reads a second.
export const MAX_ROWS = 180_000;

export type ChannelSource = 'obd' | 'maker' | 'group';

export interface LogChannel {
  // 'obd:12' (PID in decimal), 'maker:<sensor id>', 'group:<module id>:<group>:<field index>'.
  key: string;
  source: ChannelSource;
  label: string;
  unit: string;
  decimals: number;
}

// #17 GPS trace, preparation only. A row may carry a phone position. Nothing
// fills these yet: see src/logger/gps.ts for where a GPS source plugs in.
export interface GpsFields {
  lat?: number;
  lon?: number;
  // Speed from GPS in km/h.
  gpsKmh?: number;
}

export interface LogRow extends GpsFields {
  t: number;
  v: (number | null)[];
}

export interface LogMarker {
  n: number;
  t: number;
}

export type LogStart = 'manual' | 'auto';

export interface DataLog {
  version: typeof LOG_VERSION;
  id: string;
  vin: string;
  car: string;
  startedAt: number;
  durationMs: number;
  start: LogStart;
  channels: LogChannel[];
  rows: LogRow[];
  markers: LogMarker[];
  // Set once a GPS source exists; absent means no position was recorded.
  gps?: { source: string };
}

export interface LogSummary {
  id: string;
  vin: string;
  car: string;
  startedAt: number;
  durationMs: number;
  start: LogStart;
  labels: string[];
  rows: number;
  markers: number;
  // Reads a second over the whole log.
  rate: number;
}

// ---------------------------------------------------------------------------
// Channel keys and sources
// ---------------------------------------------------------------------------

export const obdKey = (pid: number) => `obd:${pid}`;
export const makerKey = (sensorId: string) => `maker:${sensorId}`;
export const groupKey = (moduleId: string, group: number, field: number) => `group:${moduleId}:${group}:${field}`;

export function sourceKind(key: string): ChannelSource {
  return key.startsWith('obd:') ? 'obd' : key.startsWith('maker:') ? 'maker' : 'group';
}

// The read each channel needs: all standard values in one request list, all
// maker values in one pass, and each older VW group on its own.
export function sourceOf(key: string): string {
  const kind = sourceKind(key);
  if (kind !== 'group') return kind;
  const [, moduleId, group] = key.split(':');
  return `group:${moduleId}:${group}`;
}

// Distinct sources for a set of channels, standard values first.
export function sourcesFor(keys: string[]): string[] {
  const out: string[] = [];
  for (const k of keys) {
    const s = sourceOf(k);
    if (!out.includes(s)) out.push(s);
  }
  const rank = (s: string) => (s === 'obd' ? 0 : s === 'maker' ? 1 : 2);
  return out.sort((a, b) => rank(a) - rank(b));
}

export function parseGroupKey(key: string): { moduleId: string; group: number; field: number } | null {
  const m = /^group:([^:]+):(\d+):(\d+)$/.exec(key);
  return m ? { moduleId: m[1], group: Number(m[2]), field: Number(m[3]) } : null;
}

// ---------------------------------------------------------------------------
// Building a log while recording
// ---------------------------------------------------------------------------

export class LogBuilder {
  readonly rows: LogRow[] = [];
  readonly markers: LogMarker[] = [];
  private index = new Map<string, number>();
  constructor(readonly channels: LogChannel[]) {
    channels.forEach((c, i) => this.index.set(c.key, i));
  }

  get full(): boolean {
    return this.rows.length >= MAX_ROWS;
  }

  // One read. values: channel key to value; keys not in the log are ignored.
  // Returns false when nothing was added (no channel of this log had a value).
  add(t: number, values: Map<string, number | null>, gps?: GpsFields): boolean {
    if (this.full) return false;
    const v: (number | null)[] = new Array(this.channels.length).fill(null);
    let any = false;
    for (const [k, x] of values) {
      const i = this.index.get(k);
      if (i == null || x == null || !Number.isFinite(x)) continue;
      v[i] = x;
      any = true;
    }
    if (!any) return false;
    const row: LogRow = { t: Math.max(0, Math.round(t)), v };
    if (gps?.lat != null && gps.lon != null) {
      row.lat = gps.lat;
      row.lon = gps.lon;
      if (gps.gpsKmh != null) row.gpsKmh = gps.gpsKmh;
    }
    this.rows.push(row);
    return true;
  }

  mark(t: number): LogMarker {
    const m = nextMarker(this.markers, t);
    this.markers.push(m);
    return m;
  }

  finish(meta: { id: string; vin: string; car: string; startedAt: number; durationMs: number; start: LogStart; gps?: { source: string } }): DataLog {
    const log: DataLog = { version: LOG_VERSION, ...meta, channels: this.channels, rows: this.rows, markers: this.markers };
    if (!meta.gps) delete log.gps;
    return log;
  }
}

// Markers are numbered from 1 in the order they are dropped.
export function nextMarker(markers: LogMarker[], t: number): LogMarker {
  return { n: markers.length + 1, t: Math.max(0, Math.round(t)) };
}

// ---------------------------------------------------------------------------
// Reading a log back
// ---------------------------------------------------------------------------

export interface Series {
  t: number[];
  v: number[];
}

export function seriesOf(log: Pick<DataLog, 'rows'>, channel: number): Series {
  const t: number[] = [];
  const v: number[] = [];
  for (const r of log.rows) {
    const x = r.v[channel];
    if (x == null) continue;
    t.push(r.t);
    v.push(x);
  }
  return { t, v };
}

export interface Stats {
  min: number;
  max: number;
  avg: number;
  count: number;
  // Readings a second for this value.
  rate: number;
}

export function statsOf(s: Series, durationMs?: number): Stats | null {
  if (!s.v.length) return null;
  let min = Infinity;
  let max = -Infinity;
  let sum = 0;
  for (const x of s.v) {
    if (x < min) min = x;
    if (x > max) max = x;
    sum += x;
  }
  const span = durationMs ?? (s.t.length > 1 ? s.t[s.t.length - 1] - s.t[0] : 0);
  return { min, max, avg: sum / s.v.length, count: s.v.length, rate: span > 0 ? s.v.length / (span / 1000) : 0 };
}

// The reading at or just before time t (what the value was at that moment).
// Before the first reading there is none.
export function valueAt(s: Series, t: number): number | null {
  if (!s.t.length || t < s.t[0]) return null;
  let lo = 0;
  let hi = s.t.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (s.t[mid] <= t) lo = mid;
    else hi = mid - 1;
  }
  return s.v[lo];
}

// Thins a series for drawing: per time bucket keep the first, lowest, highest
// and last reading in time order, so peaks survive. Short series pass through.
export function decimate(s: Series, buckets: number): Series {
  const n = s.t.length;
  if (n <= buckets * 4 || buckets < 1) return s;
  const t0 = s.t[0];
  const span = s.t[n - 1] - t0 || 1;
  const out: Series = { t: [], v: [] };
  let i = 0;
  for (let b = 0; b < buckets && i < n; b++) {
    const end = t0 + ((b + 1) / buckets) * span;
    const from = i;
    let lo = i;
    let hi = i;
    while (i < n && (s.t[i] <= end || b === buckets - 1)) {
      if (s.v[i] < s.v[lo]) lo = i;
      if (s.v[i] > s.v[hi]) hi = i;
      i++;
    }
    if (i === from) continue;
    const keep = [...new Set([from, lo, hi, i - 1])].sort((a, b2) => a - b2);
    for (const k of keep) {
      out.t.push(s.t[k]);
      out.v.push(s.v[k]);
    }
  }
  return out;
}

// Reads a second over the whole log (all sources together).
export function logRate(log: Pick<DataLog, 'rows' | 'durationMs'>): number {
  return log.durationMs > 0 ? log.rows.length / (log.durationMs / 1000) : 0;
}

export function summarise(log: DataLog): LogSummary {
  return {
    id: log.id,
    vin: log.vin,
    car: log.car,
    startedAt: log.startedAt,
    durationMs: log.durationMs,
    start: log.start,
    labels: log.channels.map((c) => c.label),
    rows: log.rows.length,
    markers: log.markers.length,
    rate: logRate(log),
  };
}

// A file-safe log id from its start time: 20261115-142233.
export function logId(startedAt: number): string {
  const d = new Date(startedAt);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

// "15 Nov, 14:22"
export function formatWhen(ms: number): string {
  return new Date(ms).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

// "2 min 05 s", "45 s", "1 h 02 min"
export function formatDuration(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return `${s} s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min ${String(s % 60).padStart(2, '0')} s`;
  return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')} min`;
}

// Checks a parsed file is a log this version can read.
export function isDataLog(x: unknown): x is DataLog {
  const l = x as DataLog;
  return !!l && l.version === LOG_VERSION && typeof l.id === 'string' && Array.isArray(l.channels) && Array.isArray(l.rows) && Array.isArray(l.markers);
}

// ---------------------------------------------------------------------------
// CSV
// ---------------------------------------------------------------------------

export type Convert = (value: number, unit: string) => { value: number; unit: string };
const asIs: Convert = (value, unit) => ({ value, unit });

function cell(s: string): string {
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// One row per read, one column per value in the owner's units. A value not
// read in a row repeats its last reading, so every row is complete for a
// spreadsheet chart. A Marker column numbers the row each marker falls on.
// Latitude, longitude and GPS speed columns appear only when the log has them.
export function toCsv(log: Pick<DataLog, 'channels' | 'rows' | 'markers'>, convert: Convert = asIs): string {
  const units = log.channels.map((c) => convert(0, c.unit).unit);
  const head = ['Time (s)', ...log.channels.map((c, i) => (units[i] ? `${c.label} (${units[i]})` : c.label)), 'Marker'];
  const gps = log.rows.some((r) => r.lat != null && r.lon != null);
  const gpsSpeedUnit = convert(0, 'km/h').unit;
  if (gps) head.push('Latitude', 'Longitude', `GPS speed (${gpsSpeedUnit})`);
  const lines = [head.map(cell).join(',')];
  const last: string[] = log.channels.map(() => '');
  // Markers in time order, each placed on the first row at or after it.
  const marks = [...log.markers].sort((a, b) => a.t - b.t);
  let m = 0;
  log.rows.forEach((r, ri) => {
    r.v.forEach((x, i) => {
      if (x == null) return;
      const c = log.channels[i];
      last[i] = convert(x, c.unit).value.toFixed(c.decimals);
    });
    const here: number[] = [];
    while (m < marks.length && (marks[m].t <= r.t || ri === log.rows.length - 1)) here.push(marks[m++].n);
    const line = [(r.t / 1000).toFixed(3), ...last, here.join(' ')];
    if (gps) {
      line.push(r.lat != null ? r.lat.toFixed(6) : '', r.lon != null ? r.lon.toFixed(6) : '', r.gpsKmh != null ? convert(r.gpsKmh, 'km/h').value.toFixed(1) : '');
    }
    lines.push(line.map(cell).join(','));
  });
  return lines.join('\n');
}
