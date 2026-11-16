// Saved monitor data on the phone (AsyncStorage): performance runs per car,
// custom timer ranges, and trips per car.
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SavedTrip } from './trip';

const RUNS = 'caristini.perfRuns.v1';
const RANGES = 'caristini.perfRanges.v1';
const TRIPS = 'caristini.trips.v1';
const MAX_RUNS = 300;
const MAX_TRIPS = 200;

export interface SavedRun {
  vin: string;
  testId: string;
  label: string;
  seconds: number;
  // Plus or minus, in seconds (see runUncertainty in app/performance.tsx).
  plusMinus: number | null;
  rate: number;
  samples: number;
  finishKmh?: number;
  at: number;
}

export interface CustomRange {
  id: string;
  fromKmh: number;
  toKmh: number;
  // Unit the owner typed the range in, for its label.
  unit: 'mph' | 'km/h';
}

async function load<T>(key: string): Promise<T[]> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T[]) : [];
  } catch {
    return [];
  }
}

async function save<T>(key: string, list: T[]): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(list));
  } catch {
    // Storage unavailable: the data stays for this session only.
  }
}

export async function loadRuns(vin: string): Promise<SavedRun[]> {
  return (await load<SavedRun>(RUNS)).filter((r) => r.vin === vin).sort((a, b) => b.at - a.at);
}

export async function addRun(run: SavedRun): Promise<void> {
  await save(RUNS, [run, ...(await load<SavedRun>(RUNS))].slice(0, MAX_RUNS));
}

export async function clearRuns(vin: string): Promise<void> {
  await save(RUNS, (await load<SavedRun>(RUNS)).filter((r) => r.vin !== vin));
}

export function loadRanges(): Promise<CustomRange[]> {
  return load<CustomRange>(RANGES);
}

export function saveRanges(list: CustomRange[]): Promise<void> {
  return save(RANGES, list);
}

export async function loadTrips(vin: string): Promise<SavedTrip[]> {
  return (await load<SavedTrip>(TRIPS)).filter((t) => t.vin === vin).sort((a, b) => b.startedAt - a.startedAt);
}

export async function addTrip(trip: SavedTrip): Promise<void> {
  await save(TRIPS, [trip, ...(await load<SavedTrip>(TRIPS))].slice(0, MAX_TRIPS));
}

export async function removeTrip(id: string): Promise<void> {
  await save(TRIPS, (await load<SavedTrip>(TRIPS)).filter((t) => t.id !== id));
}
