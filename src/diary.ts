// Car diary: service and repair log, stored on the phone.
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface DiaryEntry {
  id: string;
  vin: string | null;
  vehicleName: string;
  date: string; // YYYY-MM-DD
  kind: string;
  mileage: number | null;
  notes: string;
}

export const DIARY_KINDS = ['Oil service', 'Inspection', 'Service reset', 'Faults cleared', 'Brakes', 'Tyres', 'Battery', 'Repair', 'Other'];

const KEY = 'gauge.diary.v1';

export async function loadDiary(): Promise<DiaryEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const list = raw ? (JSON.parse(raw) as DiaryEntry[]) : [];
    return list.sort((a, b) => b.date.localeCompare(a.date));
  } catch {
    return [];
  }
}

export async function addDiary(entry: Omit<DiaryEntry, 'id'>): Promise<void> {
  const list = await loadDiary();
  const next = [{ ...entry, id: `${Date.now()}-${Math.round(Math.random() * 1e6)}` }, ...list];
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Storage unavailable (for example a private browser window).
  }
}

export async function removeDiary(id: string): Promise<void> {
  const list = await loadDiary();
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(list.filter((e) => e.id !== id)));
  } catch {
    // ignore
  }
}

export function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
