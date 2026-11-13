// Researched packs for single cars: service part numbers, fluids, specs,
// service schedule, known faults and recalls, each with the public page it
// came from. Built in, so they show without the internet or the car.
// Data files are generated from replica/<car>-*.json by scripts/gen_carpack.py.
import type { PartItem } from '../../vehicle/ids';
import { LEON_CUPRA } from './leonCupra';

export interface Source {
  label: string;
  url: string;
}

export interface Fact {
  item: string;
  value: string;
  confidence: 'High' | 'Medium';
  source: Source;
}

export interface KnownFault {
  title: string;
  symptoms: string;
  codes: string[];
  cause: string;
  fix: string;
  // Low: from owner and garage pages only, shown as "Owners report".
  confidence: 'High' | 'Medium' | 'Low';
  source: Source;
}

export interface Recall {
  ref: string;
  title: string;
  date: string;
  source: Source;
}

export interface CarPack {
  id: string;
  title: string;
  // What the pack was researched for, shown with it.
  basis: string;
  researched: string;
  // VIN characters 7-8 (VW group model code), maker prefix and model years.
  wmi: string;
  modelCode: string;
  years: number[];
  // Engine code the pack is for; a car matching the VIN but with another
  // engine code typed by the owner does not get the pack.
  engineCode: string;
  // VINs known to be this exact car (the owner's own).
  vins: string[];
  parts: (PartItem & { confidence: 'High' | 'Medium' })[];
  fluids: Fact[];
  specs: Fact[];
  schedule: Fact[];
  faults: KnownFault[];
  recalls: Recall[];
}

export const CAR_PACKS: CarPack[] = [LEON_CUPRA];

export type PackMatch = { pack: CarPack; sure: true } | { pack: CarPack; sure: false };

// The pack for a car: sure when the VIN is the owner's car or the engine code
// on the data label matches; otherwise a possible match the owner can confirm
// by typing the engine code.
export function packFor(vin: string, year: number | null, engineCode?: string | null): PackMatch | null {
  const v = vin.toUpperCase();
  const code = engineCode?.trim().toUpperCase() || null;
  for (const pack of CAR_PACKS) {
    if (pack.vins.includes(v)) {
      if (code && code !== pack.engineCode) return null;
      return { pack, sure: true };
    }
    if (!v.startsWith(pack.wmi) || v.slice(6, 8) !== pack.modelCode) continue;
    if (year != null && !pack.years.includes(year)) continue;
    if (code) return code === pack.engineCode ? { pack, sure: true } : null;
    return { pack, sure: false };
  }
  return null;
}
