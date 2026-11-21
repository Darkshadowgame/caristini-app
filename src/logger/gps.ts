// GPS on data logs. While a log records, each row carries the phone's newest
// position and GPS speed (lat, lon, gpsKmh in src/logger/format.ts). The CSV
// adds Latitude, Longitude and GPS speed columns, the viewer draws the route,
// and a GPX file can be shared for maps.
//
// The phone's GPS lives in src/logger/phoneGps.ts. Running it also keeps the
// logger working with the screen off. Pure helpers stay here so the tests
// need no phone.

export interface GpsFix {
  lat: number;
  lon: number;
  // Speed over ground in km/h, when the phone gives one.
  kmh: number | null;
  // When the phone took the fix (ms since 1970).
  at: number;
}

// on: GPS running. denied: location permission refused. off: Location
// Services switched off on the phone. unavailable: no GPS here (web preview).
export type GpsStart = 'on' | 'denied' | 'off' | 'unavailable';

export interface GpsSource {
  // A short name saved with the log, for example 'phone'.
  name: string;
  start(): Promise<GpsStart>;
  // The newest fix, or null when none has come yet.
  latest(): GpsFix | null;
  stop(): void;
}

// A fix older than this is not stamped on a row.
export const GPS_MAX_AGE_MS = 3000;

// The position fields for a row read at `now`, from the newest fix.
export function gpsFields(fix: GpsFix | null, now: number): { lat?: number; lon?: number; gpsKmh?: number } | undefined {
  if (!fix || now - fix.at > GPS_MAX_AGE_MS) return undefined;
  return fix.kmh != null ? { lat: fix.lat, lon: fix.lon, gpsKmh: fix.kmh } : { lat: fix.lat, lon: fix.lon };
}

// What the logger screen says about GPS after Record or auto-start.
export function gpsNote(r: GpsStart | null): string | null {
  if (r === 'denied') return 'Location is not allowed for Pin16, so this log has no route and stops reading when the screen turns off. Allow it in iPhone Settings, Pin16, Location, While Using the App.';
  if (r === 'off') return 'Location Services are off on this phone, so this log has no route and stops reading when the screen turns off.';
  return null;
}

// ---------------------------------------------------------------------------
// Route for the viewer and GPX
// ---------------------------------------------------------------------------

export interface RoutePoint {
  t: number;
  lat: number;
  lon: number;
  kmh?: number;
}

// The positions in a log, one per change of position, in time order.
export function routeOf(rows: { t: number; lat?: number; lon?: number; gpsKmh?: number }[]): RoutePoint[] {
  const out: RoutePoint[] = [];
  for (const r of rows) {
    if (r.lat == null || r.lon == null) continue;
    const last = out[out.length - 1];
    if (last && last.lat === r.lat && last.lon === r.lon) continue;
    out.push(r.gpsKmh != null ? { t: r.t, lat: r.lat, lon: r.lon, kmh: r.gpsKmh } : { t: r.t, lat: r.lat, lon: r.lon });
  }
  return out;
}

// Distance in metres between two points (haversine).
export function metresBetween(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const R = 6371000;
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLon = (b.lon - a.lon) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function routeKm(route: RoutePoint[]): number {
  let m = 0;
  for (let i = 1; i < route.length; i++) m += metresBetween(route[i - 1], route[i]);
  return m / 1000;
}

// The route drawn in a box of w by h, north up, same scale both ways, with a
// margin. Returns the points in box coordinates, in route order.
export function projectRoute(route: RoutePoint[], w: number, h: number, margin = 8): { x: number; y: number }[] {
  if (!route.length) return [];
  const midLat = (route.reduce((n, p) => n + p.lat, 0) / route.length) * (Math.PI / 180);
  const kx = Math.cos(midLat);
  const xs = route.map((p) => p.lon * kx);
  const ys = route.map((p) => p.lat);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const spanX = maxX - minX;
  const spanY = maxY - minY;
  const span = Math.max(spanX, spanY);
  if (span === 0) return route.map(() => ({ x: w / 2, y: h / 2 }));
  const scale = Math.min((w - 2 * margin) / (spanX || span), (h - 2 * margin) / (spanY || span));
  const offX = (w - spanX * scale) / 2;
  const offY = (h - spanY * scale) / 2;
  return route.map((_, i) => ({ x: offX + (xs[i] - minX) * scale, y: h - (offY + (ys[i] - minY) * scale) }));
}

// Index of the route point at or just before time t.
export function routeIndexAt(route: RoutePoint[], t: number): number {
  let lo = 0;
  let hi = route.length - 1;
  if (hi < 0) return -1;
  if (t <= route[0].t) return 0;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (route[mid].t <= t) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// The route as a GPX track, for Google Earth, Strava or a map app.
export function toGpx(name: string, startedAt: number, route: RoutePoint[], markers: { n: number; t: number }[] = []): string {
  const time = (t: number) => new Date(startedAt + t).toISOString();
  const lines = ['<?xml version="1.0" encoding="UTF-8"?>', '<gpx version="1.1" creator="Pin16" xmlns="http://www.topografix.com/GPX/1/1">'];
  for (const m of markers) {
    const i = routeIndexAt(route, m.t);
    if (i < 0) continue;
    const p = route[i];
    lines.push(`  <wpt lat="${p.lat.toFixed(6)}" lon="${p.lon.toFixed(6)}"><time>${time(m.t)}</time><name>Marker ${m.n}</name></wpt>`);
  }
  lines.push(`  <trk><name>${esc(name)}</name><trkseg>`);
  for (const p of route) lines.push(`    <trkpt lat="${p.lat.toFixed(6)}" lon="${p.lon.toFixed(6)}"><time>${time(p.t)}</time></trkpt>`);
  lines.push('  </trkseg></trk>', '</gpx>', '');
  return lines.join('\n');
}
