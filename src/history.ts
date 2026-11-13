// History per car: every scan, fault clear, setting change, service tool and
// search Caristini runs is logged on the phone, so it can be read later with
// no adapter connected.
import AsyncStorage from '@react-native-async-storage/async-storage';

export type HistoryKind = 'scan' | 'clear' | 'change' | 'service' | 'sensors' | 'discover';

export interface HistoryFault {
  module: string;
  code: string;
  text?: string;
}

export interface HistoryEntry {
  id: string;
  vin: string;
  at: number; // ms
  kind: HistoryKind;
  title: string;
  detail?: string;
  // Scans: faults found, modules that answered, and whether the scan finished.
  faults?: HistoryFault[];
  modules?: number;
  complete?: boolean;
  // Changes: before and after, for the record.
  before?: string;
  after?: string;
  odometerKm?: number;
}

export const HISTORY_LABEL: Record<HistoryKind, string> = {
  scan: 'Health check',
  clear: 'Faults cleared',
  change: 'Setting changed',
  service: 'Service reset',
  sensors: 'Sensor search',
  discover: 'Learning',
};

const KEY = 'caristini.history.v1';
const MAX = 500;
let listeners: (() => void)[] = [];

export async function loadHistory(vin?: string): Promise<HistoryEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const list = raw ? (JSON.parse(raw) as HistoryEntry[]) : [];
    return (vin ? list.filter((e) => e.vin === vin) : list).sort((a, b) => b.at - a.at);
  } catch {
    return [];
  }
}

export async function addHistory(entry: Omit<HistoryEntry, 'id' | 'at'> & { at?: number }): Promise<void> {
  const list = await loadHistory();
  const next = [{ ...entry, at: entry.at ?? Date.now(), id: `${Date.now()}-${Math.round(Math.random() * 1e6)}` }, ...list].slice(0, MAX);
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Storage unavailable (for example a private browser window).
  }
  listeners.forEach((l) => l());
}

export async function removeHistory(id: string): Promise<void> {
  const list = await loadHistory();
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(list.filter((e) => e.id !== id)));
  } catch {
    // ignore
  }
  listeners.forEach((l) => l());
}

export function onHistory(fn: () => void): () => void {
  listeners.push(fn);
  return () => {
    listeners = listeners.filter((l) => l !== fn);
  };
}

// Faults that were in the previous scan and are gone from this one.
export function goneSince(prev: HistoryEntry | undefined, now: HistoryFault[]): HistoryFault[] {
  if (!prev?.faults) return [];
  const seen = new Set(now.map((f) => `${f.module}|${f.code}`));
  return prev.faults.filter((f) => !seen.has(`${f.module}|${f.code}`));
}
