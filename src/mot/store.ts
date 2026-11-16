// MOT check in progress, per car, kept on the phone so the walk-round can be
// done over a few days and the car read once.
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Answer, CarRead } from './rules';

export interface MotDraft {
  vin: string;
  startedAt: number;
  answers: Record<string, Answer>;
  read: CarRead | null;
  // When this draft was last saved to History.
  savedAt?: number;
}

const KEY = 'caristini.mot.v1';

async function all(): Promise<Record<string, MotDraft>> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Record<string, MotDraft>) : {};
  } catch {
    return {};
  }
}

export async function loadDraft(vin: string): Promise<MotDraft | null> {
  return (await all())[vin] ?? null;
}

export async function saveDraft(d: MotDraft): Promise<void> {
  const list = await all();
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify({ ...list, [d.vin]: d }));
  } catch {
    // Storage unavailable: the check still works this session.
  }
}

export async function clearDraft(vin: string): Promise<void> {
  const list = await all();
  delete list[vin];
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    // ignore
  }
}
