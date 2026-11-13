// Parts and IDs: everything needed to buy parts for a car without connecting
// to it. Module identities are saved whenever a screen reads them; codes that
// are not readable over OBD (paint, gearbox, engine code and so on) are typed
// by the owner from the vehicle's data label, or found by AI research and
// marked as such.
import type { ModuleDetails, ModuleInfo } from '../obd/elm';

export interface ModuleId {
  id: string;
  name: string;
  code?: string;
  tx?: string;
  part?: string | null;
  hardware?: string | null;
  software?: string | null;
  systemName?: string | null;
  serial?: string | null;
  coding?: string | null;
  at: number;
}

// A code with where it came from: typed by the owner, or found by AI (to check).
export interface IdValue {
  value: string;
  from: 'owner' | 'ai';
  source?: { label: string; url: string };
}

export const CODE_FIELDS = [
  { key: 'registration', label: 'Registration', hint: 'For example AB12 CDE' },
  { key: 'engineCode', label: 'Engine code', hint: 'For example CGLC' },
  { key: 'gearboxCode', label: 'Gearbox code', hint: 'For example NBS' },
  { key: 'paintCode', label: 'Paint code', hint: 'For example LY9B' },
  { key: 'interiorCode', label: 'Interior or trim code', hint: 'As on the data label' },
  { key: 'optionCodes', label: 'Option codes (PR codes)', hint: 'As on the data label' },
  { key: 'tyreSize', label: 'Tyre size', hint: 'For example 245/45 R18' },
  { key: 'batteryType', label: 'Battery', hint: 'For example 80 Ah AGM' },
] as const;

export type CodeKey = (typeof CODE_FIELDS)[number]['key'];

export interface CarIds {
  modules?: ModuleId[];
  codes?: Partial<Record<CodeKey, IdValue>>;
  notes?: string;
}

export interface PartItem {
  name: string;
  group: string;
  // Maker part number as the source gives it.
  oem: string;
  notes?: string;
  source: { label: string; url: string };
}

export interface PartsList {
  at: number;
  items: PartItem[];
  // What the search was based on, so the owner knows when to search again.
  basis: string;
}

// Merge newly read module identities into the saved list, one entry per
// module, keeping earlier fields a newer read did not return.
export function mergeModuleIds(saved: ModuleId[] = [], read: (ModuleDetails | ModuleInfo)[], at = Date.now()): ModuleId[] {
  const out = new Map(saved.map((m) => [m.id, m]));
  for (const r of read) {
    if (!r.responded) continue;
    const d = r as Partial<ModuleDetails> & ModuleInfo;
    const old = out.get(r.def.id);
    const pick = <T,>(n: T | null | undefined, o: T | null | undefined) => (n != null && n !== '' ? n : (o ?? null));
    out.set(r.def.id, {
      id: r.def.id,
      name: r.def.name,
      code: r.def.code,
      tx: r.def.tx,
      part: pick(r.partNumber, old?.part),
      hardware: pick(d.hardware, old?.hardware),
      software: pick(r.software, old?.software),
      systemName: pick(d.systemName, old?.systemName),
      serial: pick(d.serial, old?.serial),
      coding: pick(d.coding, old?.coding),
      at,
    });
  }
  return [...out.values()].sort((a, b) => (a.code ?? a.tx ?? a.id).localeCompare(b.code ?? b.tx ?? b.id));
}

// Plain text of everything, to copy or share with a parts counter.
export function idsText(car: { title: string; vin: string }, ids: CarIds | undefined): string {
  const lines = [`${car.title}`, `VIN ${car.vin}`];
  for (const f of CODE_FIELDS) {
    const v = ids?.codes?.[f.key];
    if (v?.value) lines.push(`${f.label}: ${v.value}${v.from === 'ai' ? ' (found by AI, check the data label)' : ''}`);
  }
  if (ids?.modules?.length) {
    lines.push('', 'Control modules');
    for (const m of ids.modules) {
      lines.push(`${m.code ? `${m.code} ` : ''}${m.name}`);
      if (m.part) lines.push(`  Part number: ${m.part}`);
      if (m.hardware && m.hardware !== m.part) lines.push(`  Hardware: ${m.hardware}`);
      if (m.software) lines.push(`  Software: ${m.software}`);
      if (m.systemName) lines.push(`  System: ${m.systemName}`);
      if (m.coding) lines.push(`  Coding: ${m.coding}`);
    }
  }
  if (ids?.notes) lines.push('', ids.notes);
  return lines.join('\n');
}

// Where the codes are printed, by make. Only what sources in replica/ say.
export function labelHint(group: string): string {
  if (group === 'vag') return 'VW group cars have a vehicle data label in the boot (often by the spare wheel) and in the service book, with the engine and gearbox codes, the paint code and the option (PR) codes.';
  if (group === 'ford') return 'Ford prints the engine variant and other codes on the certification label.';
  return 'Check the owner’s manual for where the vehicle label is; it usually lists the paint and trim codes.';
}

// Online parts catalogues that search by VIN. Opening one sends the VIN to that
// site, so the owner chooses when.
export function catalogueLinks(vin: string): { label: string; url: string; note: string }[] {
  return [
    { label: 'PartSouq', url: `https://partsouq.com/catalogs/vin/${encodeURIComponent(vin)}/`, note: 'Maker parts diagrams by VIN (VW group, Ford, Mazda)' },
    { label: '7zap', url: 'https://7zap.com/en/', note: 'Exploded parts diagrams for 70 makes; paste the VIN' },
  ];
}
