// Emissions self-tests, test results (service 06) and calibration (service 09)
// last read from each car, kept on the phone so Emissions self-tests can show
// a Learn my car read without asking the car again.
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ElmClient } from '../obd/elm';
import type { Monitor } from '../obd/pids';
import { Mode06Read, readMode06 } from './service06';
import { Mode09Read, readMode09 } from './service09';

export interface SavedEmissions {
  vin: string;
  at: number;
  // Which screen read it: 'learn' (Learn my car) or 'screen' (Emissions self-tests).
  from: 'learn' | 'screen';
  milOn: boolean | null;
  diesel: boolean;
  monitors: Monitor[];
  tests: Mode06Read | null;
  cal: Mode09Read | null;
}

const KEY = 'caristini.emissions.v1';

async function all(): Promise<Record<string, SavedEmissions>> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Record<string, SavedEmissions>) : {};
  } catch {
    return {};
  }
}

export async function loadEmissions(vin: string): Promise<SavedEmissions | null> {
  return (await all())[vin] ?? null;
}

// Clearing faults resets the self-tests, so a saved read no longer applies.
export async function forgetEmissions(vin: string): Promise<void> {
  const list = await all();
  if (!list[vin]) return;
  delete list[vin];
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    // Storage unavailable: nothing saved to forget.
  }
}

export async function saveEmissions(e: SavedEmissions): Promise<void> {
  const list = await all();
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify({ ...list, [e.vin]: e }));
  } catch {
    // Storage unavailable: the screen reads the car again.
  }
}

// Test results and calibration from the engine. Asked of the engine only:
// with a second unit (a gearbox) answering too, multi-frame answers
// interleave and the units cannot be told apart. Reads only.
export async function readEmissions(
  client: ElmClient,
  opts: { isCan: boolean; diesel: boolean; onStep?: (what: string) => void; onTests?: (r: Mode06Read) => void },
): Promise<{ tests: Mode06Read; cal: Mode09Read }> {
  const step = opts.onStep ?? (() => undefined);
  const engine = client.moduleById('engine');
  const onEngine = <T,>(fn: () => Promise<T>): Promise<T> => (opts.isCan && engine ? client.withModule(engine, fn).catch(() => fn()) : fn());
  step('Reading the test results…');
  const tests = await onEngine(() => readMode06(client, { isCan: opts.isCan, onProgress: (d, n) => n && step(`Reading the test results… ${d} of ${n}`) }));
  opts.onTests?.(tests);
  step('Reading the calibration info…');
  const cal = await onEngine(() => readMode09(client, { isCan: opts.isCan, diesel: opts.diesel }));
  return { tests, cal };
}
