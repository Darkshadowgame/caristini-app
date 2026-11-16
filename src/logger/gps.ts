// =============================================================================
// #17 GPS TRACE ON LOGS: PREPARATION ONLY
// =============================================================================
//
// The log format already has room for the phone's position on each row
// (lat, lon, gpsKmh in src/logger/format.ts), the CSV adds Latitude,
// Longitude and GPS speed columns when a log has them, and the recorder asks
// gpsSource() below once per recording and stamps each row with latest().
//
// Nothing records a position yet. A GPS source needs expo-location, which is
// not installed: adding it changes the native build and the runtime
// fingerprint, so it cannot ship as an over-the-air update. Do not import it
// here until a new native build is planned.
//
// To add GPS later:
// 1. npx expo install expo-location, add its config plugin and the
//    location permission text to app.json, and make a new native build.
// 2. Write a GpsSource with it (start: ask permission and watch the position
//    at the best accuracy; latest: the newest fix; stop: remove the watcher).
// 3. Return it from gpsSource(). The recorder, the file format and the CSV
//    need no change. A map view for the viewer is still to design.
// =============================================================================

export interface GpsFix {
  lat: number;
  lon: number;
  // Speed over ground in km/h, when the phone gives one.
  kmh: number | null;
  // When the phone took the fix (ms since 1970).
  at: number;
}

export interface GpsSource {
  // A short name saved with the log, for example 'phone'.
  name: string;
  // Starts watching; false when the owner refused permission or there is no GPS.
  start(): Promise<boolean>;
  // The newest fix, or null when none is fresh enough to use.
  latest(): GpsFix | null;
  stop(): void;
}

// GPS SOURCE GOES HERE. Returns null until a GPS source exists (see above).
export function gpsSource(): GpsSource | null {
  return null;
}

// A fix older than this is not stamped on a row.
export const GPS_MAX_AGE_MS = 2000;

// The position fields for a row read at `now`, from the newest fix.
export function gpsFields(fix: GpsFix | null, now: number): { lat?: number; lon?: number; gpsKmh?: number } | undefined {
  if (!fix || now - fix.at > GPS_MAX_AGE_MS) return undefined;
  return fix.kmh != null ? { lat: fix.lat, lon: fix.lon, gpsKmh: fix.kmh } : { lat: fix.lat, lon: fix.lon };
}
