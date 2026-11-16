// Data logger storage. Each log is a JSON file on the phone, in one folder
// per car (Documents/logs/<VIN>/<id>.json), with a small index.json beside
// them so the list opens without reading every log. The values chosen and the
// auto-start rule are kept per car in AsyncStorage.
//
// The web preview has no file system: logs stay in memory there.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Platform, Share } from 'react-native';
import { AutoRule, clampRule, DEFAULT_AUTO } from './auto';
import { DataLog, isDataLog, LogSummary, summarise } from './format';

const web = Platform.OS === 'web';
const memory = new Map<string, DataLog[]>();

const safe = (s: string) => s.replace(/[^A-Za-z0-9_-]/g, '_') || 'car';

function carDir(vin: string): Directory {
  const root = new Directory(Paths.document, 'logs');
  if (!root.exists) root.create({ intermediates: true, idempotent: true });
  const dir = new Directory(root, safe(vin));
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
  return dir;
}

async function writeText(f: File, text: string): Promise<void> {
  if (!f.exists) f.create();
  await f.write(text);
}

async function readIndex(vin: string): Promise<LogSummary[] | null> {
  const f = new File(carDir(vin), 'index.json');
  if (!f.exists) return null;
  try {
    const list = JSON.parse(await f.text());
    return Array.isArray(list) ? (list as LogSummary[]) : null;
  } catch {
    return null;
  }
}

async function writeIndex(vin: string, list: LogSummary[]): Promise<void> {
  await writeText(new File(carDir(vin), 'index.json'), JSON.stringify(list));
}

// Rebuilds the index from the log files (first use, or a damaged index).
async function rebuildIndex(vin: string): Promise<LogSummary[]> {
  const out: LogSummary[] = [];
  for (const item of carDir(vin).list()) {
    if (!(item instanceof File) || item.name === 'index.json' || !item.name.endsWith('.json')) continue;
    try {
      const log = JSON.parse(await item.text());
      if (isDataLog(log)) out.push(summarise(log));
    } catch {
      // not a log this version can read
    }
  }
  out.sort((a, b) => b.startedAt - a.startedAt);
  await writeIndex(vin, out);
  return out;
}

export async function listLogs(vin: string): Promise<LogSummary[]> {
  if (web) return (memory.get(vin) ?? []).map(summarise);
  return (await readIndex(vin)) ?? rebuildIndex(vin);
}

export async function saveLog(log: DataLog): Promise<void> {
  if (web) {
    memory.set(log.vin, [log, ...(memory.get(log.vin) ?? []).filter((l) => l.id !== log.id)]);
    return;
  }
  await writeText(new File(carDir(log.vin), `${log.id}.json`), JSON.stringify(log));
  const list = (await readIndex(log.vin)) ?? (await rebuildIndex(log.vin));
  const next = [summarise(log), ...list.filter((s) => s.id !== log.id)].sort((a, b) => b.startedAt - a.startedAt);
  await writeIndex(log.vin, next);
}

export async function loadLog(vin: string, id: string): Promise<DataLog | null> {
  if (web) return memory.get(vin)?.find((l) => l.id === id) ?? null;
  const f = new File(carDir(vin), `${safe(id)}.json`);
  if (!f.exists) return null;
  try {
    const log = JSON.parse(await f.text());
    return isDataLog(log) ? log : null;
  } catch {
    return null;
  }
}

// Removes one log the owner chose to delete.
export async function deleteLog(vin: string, id: string): Promise<void> {
  if (web) {
    memory.set(vin, (memory.get(vin) ?? []).filter((l) => l.id !== id));
    return;
  }
  const f = new File(carDir(vin), `${safe(id)}.json`);
  if (f.exists) f.delete();
  const list = (await readIndex(vin)) ?? (await rebuildIndex(vin));
  await writeIndex(vin, list.filter((s) => s.id !== id));
}

// Opens the share sheet with text as a file.
async function shareText(name: string, text: string, ext: string, mimeType: string, UTI: string): Promise<void> {
  if (web || !(await Sharing.isAvailableAsync())) {
    await Share.share({ title: name, message: text });
    return;
  }
  const f = new File(Paths.cache, `${safe(name)}.${ext}`);
  if (f.exists) f.delete();
  f.create();
  await f.write(text);
  await Sharing.shareAsync(f.uri, { mimeType, dialogTitle: name, UTI });
}

// The log as a CSV file.
export function shareCsv(name: string, csv: string): Promise<void> {
  return shareText(name, csv, 'csv', 'text/csv', 'public.comma-separated-values-text');
}

// The log's route as a GPX file, for a map app.
export function shareGpx(name: string, gpx: string): Promise<void> {
  return shareText(name, gpx, 'gpx', 'application/gpx+xml', 'com.topografix.gpx');
}

// ---------------------------------------------------------------------------
// Per-car logger settings
// ---------------------------------------------------------------------------

export interface LoggerPrefs {
  keys: string[];
  auto: AutoRule;
  // Record the route and keep logging with the screen off (on unless switched off).
  gps?: boolean;
}

const prefsKey = (vin: string) => `caristini.logger.v1.${vin}`;

export async function loadPrefs(vin: string): Promise<LoggerPrefs | null> {
  try {
    const raw = await AsyncStorage.getItem(prefsKey(vin));
    if (!raw) return null;
    const p = JSON.parse(raw) as Partial<LoggerPrefs>;
    return { keys: Array.isArray(p.keys) ? p.keys.filter((k) => typeof k === 'string') : [], auto: clampRule({ ...DEFAULT_AUTO, ...(p.auto ?? {}) }), gps: p.gps !== false };
  } catch {
    return null;
  }
}

export async function savePrefs(vin: string, p: LoggerPrefs): Promise<void> {
  await AsyncStorage.setItem(prefsKey(vin), JSON.stringify(p)).catch(() => undefined);
}
