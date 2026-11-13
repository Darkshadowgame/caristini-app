// VIN decoding: maker from the WMI (characters 1-3), model year from
// character 10 where the maker uses it, and a likely model for VW group
// (characters 7-8) and Mazda (characters 4-5). Model hits are "likely":
// the owner can correct them on the vehicle screen.

export type MakeGroup = 'vag' | 'ford' | 'mazda' | 'other';

export interface DecodedVin {
  vin: string;
  valid: boolean;
  group: MakeGroup;
  brand: string | null;
  model: string | null;
  platform: string | null;
  year: number | null;
  yearReliable: boolean;
}

const WMI: Record<string, { group: MakeGroup; brand: string; euYear?: boolean }> = {
  WVW: { group: 'vag', brand: 'Volkswagen' },
  WVG: { group: 'vag', brand: 'Volkswagen' },
  WV1: { group: 'vag', brand: 'Volkswagen Commercial' },
  WV2: { group: 'vag', brand: 'Volkswagen Commercial' },
  '1VW': { group: 'vag', brand: 'Volkswagen' },
  '3VW': { group: 'vag', brand: 'Volkswagen' },
  '9BW': { group: 'vag', brand: 'Volkswagen' },
  WAU: { group: 'vag', brand: 'Audi' },
  WA1: { group: 'vag', brand: 'Audi' },
  WUA: { group: 'vag', brand: 'Audi' },
  TRU: { group: 'vag', brand: 'Audi' },
  TMB: { group: 'vag', brand: 'Skoda' },
  VSS: { group: 'vag', brand: 'SEAT / Cupra' },
  WF0: { group: 'ford', brand: 'Ford', euYear: true },
  SFA: { group: 'ford', brand: 'Ford', euYear: true },
  VS6: { group: 'ford', brand: 'Ford', euYear: true },
  NM0: { group: 'ford', brand: 'Ford', euYear: true },
  '1FA': { group: 'ford', brand: 'Ford' },
  '1FB': { group: 'ford', brand: 'Ford' },
  '1FC': { group: 'ford', brand: 'Ford' },
  '1FD': { group: 'ford', brand: 'Ford' },
  '1FM': { group: 'ford', brand: 'Ford' },
  '1FT': { group: 'ford', brand: 'Ford' },
  '2FA': { group: 'ford', brand: 'Ford' },
  '2FM': { group: 'ford', brand: 'Ford' },
  '3FA': { group: 'ford', brand: 'Ford' },
  MAJ: { group: 'ford', brand: 'Ford' },
  JM1: { group: 'mazda', brand: 'Mazda' },
  JM3: { group: 'mazda', brand: 'Mazda' },
  JMZ: { group: 'mazda', brand: 'Mazda', euYear: true },
  '3MZ': { group: 'mazda', brand: 'Mazda' },
};

// VW group model codes at VIN characters 7-8, with platform.
const VAG_MODELS: Record<string, { model: string; platform: string }> = {
  '1K': { model: 'Golf V / VI', platform: 'PQ35' },
  '5K': { model: 'Golf VI', platform: 'PQ35' },
  AU: { model: 'Golf VII', platform: 'MQB' },
  '5G': { model: 'Golf VII', platform: 'MQB' },
  CD: { model: 'Golf VIII', platform: 'MQB evo' },
  '3C': { model: 'Passat B6 / B7', platform: 'PQ46' },
  '3G': { model: 'Passat B8', platform: 'MQB' },
  '5N': { model: 'Tiguan', platform: 'PQ35' },
  AD: { model: 'Tiguan II', platform: 'MQB' },
  '6R': { model: 'Polo V', platform: 'PQ25' },
  AW: { model: 'Polo VI', platform: 'MQB' },
  '5T': { model: 'Touran II', platform: 'MQB' },
  '1T': { model: 'Touran', platform: 'PQ35' },
  '3H': { model: 'Arteon', platform: 'MQB' },
  A1: { model: 'T-Roc', platform: 'MQB' },
  C1: { model: 'T-Cross', platform: 'MQB' },
  '8V': { model: 'A3 (8V)', platform: 'MQB' },
  '8Y': { model: 'A3 (8Y)', platform: 'MQB evo' },
  '8P': { model: 'A3 (8P)', platform: 'PQ35' },
  '8K': { model: 'A4 B8', platform: 'MLB' },
  '8W': { model: 'A4 B9', platform: 'MLB evo' },
  '4G': { model: 'A6 C7', platform: 'MLB' },
  GA: { model: 'Q2', platform: 'MQB' },
  F3: { model: 'Q3 (F3)', platform: 'MQB' },
  FV: { model: 'TT (FV)', platform: 'MQB' },
  '5E': { model: 'Octavia III', platform: 'MQB' },
  NX: { model: 'Octavia IV', platform: 'MQB evo' },
  '1Z': { model: 'Octavia II', platform: 'PQ35' },
  '3V': { model: 'Superb III', platform: 'MQB' },
  NS: { model: 'Kodiaq', platform: 'MQB' },
  NU: { model: 'Karoq', platform: 'MQB' },
  NJ: { model: 'Fabia III', platform: 'PQ26' },
  '1P': { model: 'Leon II', platform: 'PQ35' },
  '5P': { model: 'Altea', platform: 'PQ35' },
  '5F': { model: 'Leon III', platform: 'MQB' },
  KL: { model: 'Leon IV', platform: 'MQB evo' },
  KJ: { model: 'Ibiza V / Arona', platform: 'MQB A0' },
  '6J': { model: 'Ibiza IV', platform: 'PQ25' },
};

// Mazda model codes at VIN characters 4-5.
const MAZDA_MODELS: Record<string, string> = {
  BK: 'Mazda3 (BK)',
  BL: 'Mazda3 (BL)',
  BM: 'Mazda3 (BM)',
  BN: 'Mazda3 (BN)',
  BP: 'Mazda3 (BP)',
  GG: 'Mazda6 (GG)',
  GH: 'Mazda6 (GH)',
  GJ: 'Mazda6 (GJ)',
  GL: 'Mazda6 (GL)',
  KE: 'CX-5 (KE)',
  KF: 'CX-5 (KF)',
  DK: 'CX-3',
  DE: 'Mazda2 (DE)',
  DJ: 'Mazda2 (DJ)',
  DM: 'CX-30',
  ND: 'MX-5 (ND)',
  NC: 'MX-5 (NC)',
};

const YEAR_CODES = 'ABCDEFGHJKLMNPRSTVWXY123456789';

export function modelYearFromCode(c: string, now = new Date().getFullYear()): number | null {
  const i = YEAR_CODES.indexOf(c);
  if (i < 0) return null;
  // Codes repeat every 30 years; pick the latest year not after next year.
  let year = 1980 + i;
  while (year + 30 <= now + 1) year += 30;
  return year;
}

export function isValidVin(vin: string): boolean {
  return /^[A-HJ-NPR-Z0-9]{17}$/.test(vin);
}

// A VIN inside a module's identification reply, where it sits among other
// bytes and text. Only a 17-character run with a known maker code is taken,
// so a part number or immobiliser ID next to it is not mistaken for one.
export function vinInBytes(bytes: number[]): string | null {
  const text = String.fromCharCode(...bytes.map((b) => (b >= 0x20 && b < 0x7f ? b : 0x20))).toUpperCase();
  for (const run of text.match(/[A-HJ-NPR-Z0-9]{17,}/g) ?? []) {
    for (let i = 0; i + 17 <= run.length; i++) {
      const vin = run.slice(i, i + 17);
      if (WMI[vin.slice(0, 3)]) return vin;
    }
  }
  return null;
}

export function decodeVin(raw: string): DecodedVin {
  const vin = raw.trim().toUpperCase();
  const valid = isValidVin(vin);
  const base: DecodedVin = { vin, valid, group: 'other', brand: null, model: null, platform: null, year: null, yearReliable: false };
  if (!valid) return base;
  const w = WMI[vin.slice(0, 3)];
  if (!w) return base;
  const out: DecodedVin = { ...base, group: w.group, brand: w.brand };
  if (w.group === 'vag') {
    const m = VAG_MODELS[vin.slice(6, 8)];
    if (m) {
      out.model = m.model;
      out.platform = m.platform;
    }
  }
  if (w.group === 'mazda') out.model = MAZDA_MODELS[vin.slice(3, 5)] ?? null;
  const year = modelYearFromCode(vin[9]);
  if (year) {
    out.year = year;
    // European Ford and Mazda VINs do not always encode the year at character 10.
    out.yearReliable = !w.euYear;
  }
  return out;
}

export const GROUP_LABEL: Record<MakeGroup, string> = {
  vag: 'VW group',
  ford: 'Ford',
  mazda: 'Mazda',
  other: 'Other make',
};
