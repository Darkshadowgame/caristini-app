// The Diary's cars: entries are grouped by the car's VIN, so renaming a car
// keeps its entries together and 2 cars with one name stay apart. Pure.
import type { DiaryEntry } from './diary';

export interface DiaryCar {
  // "vin:WVW..." for a saved car; "name:Golf" for an entry with no VIN.
  key: string;
  label: string;
}

type CarOf = Pick<DiaryEntry, 'vin' | 'vehicleName'>;

export function entryCarKey(e: CarOf): string {
  return e.vin ? `vin:${e.vin}` : `name:${e.vehicleName}`;
}

// The name shown for an entry: the car's name now (after a rename), else the
// name saved with the entry.
export function entryCarName(e: CarOf, nameOf: (vin: string) => string | null | undefined): string {
  return (e.vin ? nameOf(e.vin) : null) || e.vehicleName;
}

// One chip per car, in the order the entries come. Cars that share a name
// get the last 4 characters of the VIN, so they can be told apart.
export function diaryCars(entries: CarOf[], nameOf: (vin: string) => string | null | undefined): DiaryCar[] {
  const cars = new Map<string, { label: string; vin: string | null }>();
  for (const e of entries) {
    const key = entryCarKey(e);
    const label = entryCarName(e, nameOf);
    if (!label || cars.has(key)) continue;
    cars.set(key, { label, vin: e.vin });
  }
  const count = new Map<string, number>();
  for (const c of cars.values()) count.set(c.label, (count.get(c.label) ?? 0) + 1);
  return [...cars.entries()].map(([key, c]) => ({ key, label: (count.get(c.label) ?? 0) > 1 && c.vin ? `${c.label} (${c.vin.slice(-4)})` : c.label }));
}

const KM_PER_MILE = 1.609344;

// The odometer for an entry written by the app, in the unit from Settings.
export function diaryMileage(odometerKm: number | null | undefined, miles: boolean): { mileage: number | null; unit?: 'mi' | 'km' } {
  if (odometerKm == null || !Number.isFinite(odometerKm)) return { mileage: null };
  return miles ? { mileage: Math.round(odometerKm / KM_PER_MILE), unit: 'mi' } : { mileage: Math.round(odometerKm), unit: 'km' };
}
