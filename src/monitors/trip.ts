// Trip computer: pure maths, tested in __tests__/monitors.test.ts.
//
// Distance: vehicle speed PID 0D (km/h, 1 byte) integrated over time with the
// trapezoid rule, as the performance timer does.
// Fuel, petrol: estimated from the air flow sensor (PID 10, g/s, Wikipedia
// OBD-II PIDs). Method: fuel mass = air mass / (14.7 x lambda). 14.7 is the
// stoichiometric air-fuel ratio for petrol (Wikipedia "Air-fuel ratio":
// "about 14.7:1"); lambda is the commanded value from PID 44 when the car
// gives it, else 1. Fuel volume = mass / 0.755 kg per litre (Wikipedia
// "Gasoline": "traded (in Europe) with a standard reference of 0.755
// kilograms per liter"). Ethanol blends need slightly more fuel (lower
// ratio), so on E10 the estimate reads a little low.
// Fuel, diesel: engine fuel rate PID 5E, (256A+B)/20 L/h (Wikipedia), only
// when the car lists it. Diesels run lean, so the air flow method does not apply.
export const STOICH_PETROL = 14.7;
export const PETROL_KG_PER_L = 0.755;
// Readings further apart than this are a gap (connection lost, screen off):
// no distance or fuel is added across it.
export const TRIP_MAX_GAP_MS = 5000;

export type FuelMethod = 'maf' | 'rate' | 'none';

export interface TripSample {
  t: number;
  kmh: number | null;
  // Air flow in g/s (petrol), commanded lambda (petrol, optional), fuel rate in L/h (diesel).
  mafGs?: number | null;
  lambda?: number | null;
  rateLh?: number | null;
}

export interface Trip {
  startedAt: number;
  lastT: number | null;
  last: TripSample | null;
  // Time with readings, excluding gaps, in ms.
  ms: number;
  movingMs: number;
  metres: number;
  litres: number;
  method: FuelMethod;
  samples: number;
  gaps: number;
}

export function newTrip(method: FuelMethod, at: number): Trip {
  return { startedAt: at, lastT: null, last: null, ms: 0, movingMs: 0, metres: 0, litres: 0, method, samples: 0, gaps: 0 };
}

// Litres per second of petrol from air flow (g/s) and lambda.
export function petrolLitresPerSecond(mafGs: number, lambda?: number | null): number {
  // PID 44 covers 0 to just under 2; anything outside is no reading.
  const l = lambda != null && lambda > 0 && lambda < 2 ? lambda : 1;
  return mafGs / (STOICH_PETROL * l) / 1000 / PETROL_KG_PER_L;
}

function litresPerSecond(method: FuelMethod, s: TripSample): number | null {
  if (method === 'maf') return s.mafGs != null ? petrolLitresPerSecond(s.mafGs, s.lambda) : null;
  if (method === 'rate') return s.rateLh != null ? s.rateLh / 3600 : null;
  return null;
}

export function addTripSample(trip: Trip, s: TripSample): Trip {
  const prev = trip.last;
  const next: Trip = { ...trip, last: s, lastT: s.t, samples: trip.samples + 1 };
  if (!prev) return next;
  const dtMs = s.t - prev.t;
  if (dtMs <= 0) return trip;
  if (dtMs > TRIP_MAX_GAP_MS) return { ...next, gaps: trip.gaps + 1 };
  const dt = dtMs / 1000;
  next.ms += dtMs;
  if (prev.kmh != null && s.kmh != null) {
    next.metres += ((prev.kmh + s.kmh) / 2 / 3.6) * dt;
    if (prev.kmh > 0 || s.kmh > 0) next.movingMs += dtMs;
  }
  const a = litresPerSecond(trip.method, prev);
  const b = litresPerSecond(trip.method, s);
  if (a != null && b != null) next.litres += ((a + b) / 2) * dt;
  return next;
}

export interface TripSummary {
  km: number;
  hours: number;
  avgKmh: number | null;
  litres: number | null;
  // Litres per 100 km, and UK miles per gallon.
  lPer100: number | null;
  mpgUk: number | null;
}

// 1 UK gallon = 4.54609 L; 1 mile = 1.609344 km.
export const UK_GALLON_L = 4.54609;
export const KM_PER_MILE = 1.609344;

export function lPer100ToMpgUk(l100: number): number {
  return (100 / KM_PER_MILE) / (l100 / UK_GALLON_L);
}

export function summarise(trip: Pick<Trip, 'metres' | 'ms' | 'litres' | 'method'>): TripSummary {
  const km = trip.metres / 1000;
  const hours = trip.ms / 3_600_000;
  const avgKmh = hours > 0 ? km / hours : null;
  const litres = trip.method === 'none' ? null : trip.litres;
  // Economy needs some distance to mean anything: at least 100 m.
  const lPer100 = litres != null && km >= 0.1 ? (litres / km) * 100 : null;
  return { km, hours, avgKmh, litres, lPer100, mpgUk: lPer100 != null && lPer100 > 0 ? lPer100ToMpgUk(lPer100) : null };
}

// Which fuel method a car gets.
export function fuelMethod(diesel: boolean, supported: Set<number>): FuelMethod {
  if (diesel) return supported.has(0x5e) ? 'rate' : 'none';
  return supported.has(0x10) ? 'maf' : supported.has(0x5e) ? 'rate' : 'none';
}

export const FUEL_METHOD_TEXT: Record<FuelMethod, string> = {
  maf: 'Fuel is estimated from the air flow sensor, at 14.7 parts air to 1 part petrol by weight (corrected by the commanded mixture when the car reports it) and 0.755 kg per litre. Treat it as a guide: it reads a little low on E10.',
  rate: 'Fuel is the fuel rate the engine computer reports (standard value 5E).',
  none: 'Fuel used is not available: this car does not report a fuel rate (standard value 5E).',
};

export interface SavedTrip {
  id: string;
  vin: string;
  startedAt: number;
  endedAt: number;
  km: number;
  hours: number;
  litres: number | null;
  method: FuelMethod;
}
