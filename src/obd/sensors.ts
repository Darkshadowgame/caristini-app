// Maker sensors: definitions from the OBDb project (src/data/sensors.ts), the
// decoder that turns a module's answer into a value, and the plain categories
// shown in Live data. Decoding follows OBDb's own reference implementation
// (github.com/OBDb/.schemas python/can/signals.py): bit offsets count from the
// first byte after the data identifier, most significant bit first.
import { fordSensors, mazdaSensors, vagSensors } from '../data/sensors';
import type { ToolColour } from '../theme';
import type { ModuleGroup } from './modules';

export interface SensorRow {
  h: string; // request header
  r?: string; // reply header when not h + 8
  d: string; // data identifier
  n: string; // name
  p: string; // OBDb group
  b: number; // first bit
  l: number; // bit length
  s?: 1; // signed
  e?: 1; // bytes least significant first
  m?: number;
  v?: number;
  a?: number;
  lo?: number;
  hi?: number;
  nlo?: number;
  nhi?: number;
  u: string;
  map?: Record<string, string>;
  src: string;
  // Named by the AI from values found on this car (Discover), not from a list.
  ai?: 1;
}

// The car's own list: the shared lists plus anything the AI named on this car
// or on the owner's other cars of the same family (see sameFamily). Each is
// still asked on this car before it is shown.
export function sensorsForCar(
  v: { group: ModuleGroup | 'other'; brand?: string; aiSensors?: SensorRow[] } | null | undefined,
  others: { group: ModuleGroup | 'other'; brand?: string; aiSensors?: SensorRow[] }[] = [],
): SensorRow[] {
  if (!v) return [];
  const base = sensorsFor(v.group);
  const extra: SensorRow[] = [];
  for (const a of [...(v.aiSensors ?? []), ...others.filter((o) => o !== v && sameFamily(o, v)).flatMap((o) => o.aiSensors ?? [])]) {
    if (!base.some((b) => b.h === a.h && b.d === a.d && b.b === a.b) && !extra.some((b) => b.h === a.h && b.d === a.d && b.b === a.b)) extra.push(a);
  }
  return [...base, ...extra];
}

// Cars whose modules and value IDs are likely to repeat: the VW group makes
// together; Ford with Mazda (sister brands that shared platforms); any other
// make with the same make (BMW with BMW, and so on).
export function sameFamily(a: { group: ModuleGroup | 'other'; brand?: string }, b: { group: ModuleGroup | 'other'; brand?: string }): boolean {
  const fam = (x: { group: ModuleGroup | 'other'; brand?: string }) =>
    x.group === 'vag' ? 'vag' : x.group === 'ford' || x.group === 'mazda' ? 'ford-mazda' : `brand:${(x.brand ?? '').toLowerCase()}`;
  const fa = fam(a);
  return fa === fam(b) && fa !== 'brand:' && fa !== 'brand:unknown make';
}

export type SensorValue = number | string;

export const sensorId = (r: SensorRow) => `${r.h}-${r.d}-${r.b}-${r.l}`;
export const readKey = (r: SensorRow) => `${r.h}-${r.d}`;
export const replyHeader = (r: SensorRow) => r.r ?? (parseInt(r.h, 16) + 8).toString(16).toUpperCase();

// OBDb names are in US English: shown in British English.
const BRITISH: [RegExp, string][] = [
  [/\bGasoline\b/g, 'Petrol'],
  [/\bgasoline\b/g, 'petrol'],
  [/\bTire(s?)\b/g, 'Tyre$1'],
  [/\btire(s?)\b/g, 'tyre$1'],
  [/\b([Cc])enter\b/g, '$1entre'],
  [/\b([Cc])olor\b/g, '$1olour'],
  [/\b([Ff])iber\b/g, '$1ibre'],
  [/\b([Ll])iter(s?)\b/g, '$1itre$2'],
  [/\b([Ww])indshield\b/g, '$1indscreen'],
  [/\b([Tt])raveled\b/g, '$1ravelled'],
  [/\b([Cc])anceled\b/g, '$1ancelled'],
  [/\b([Nn])ormalized\b/g, '$1ormalised'],
  [/\bTransmission fluid\b/g, 'Gearbox oil'],
  [/\btransmission fluid\b/g, 'gearbox oil'],
];
export const britishName = (n: string) => BRITISH.reduce((s, [re, to]) => s.replace(re, to), n);

const LOCAL = new Map<string, SensorRow[]>();
export function sensorsFor(group: ModuleGroup | 'other' | undefined): SensorRow[] {
  if (group !== 'vag' && group !== 'ford' && group !== 'mazda') return [];
  let rows = LOCAL.get(group);
  if (!rows) {
    const raw = group === 'vag' ? vagSensors() : group === 'ford' ? fordSensors() : mazdaSensors();
    rows = raw.map((r) => (britishName(r.n) === r.n ? r : { ...r, n: britishName(r.n) }));
    LOCAL.set(group, rows);
  }
  return rows;
}

const BY_ID = new Map<string, SensorRow>();
export function sensorById(id: string): SensorRow | undefined {
  if (!BY_ID.size) for (const r of [...sensorsFor('vag'), ...sensorsFor('ford'), ...sensorsFor('mazda')]) BY_ID.set(sensorId(r), r);
  return BY_ID.get(id);
}

function bits(data: number[], start: number, len: number, lsbBytes: boolean): number | null {
  if (start + len > data.length * 8) return null;
  let bytes = data;
  if (lsbBytes && len > 8) {
    const from = Math.floor(start / 8);
    const count = Math.ceil(((start % 8) + len) / 8);
    bytes = [...data];
    const part = bytes.slice(from, from + count).reverse();
    bytes.splice(from, part.length, ...part);
  }
  let out = 0;
  for (let i = start; i < start + len; i++) {
    const bit = (bytes[i >> 3] >> (7 - (i % 8))) & 1;
    out = out * 2 + bit;
  }
  return out;
}

// One sensor's value from the bytes after the data identifier, or null when the
// answer is too short or the value means "not available".
export function decodeSensor(r: SensorRow, data: number[]): SensorValue | null {
  let raw = bits(data, r.b, r.l, !!r.e);
  if (raw == null) return null;
  if (r.map) return r.map[String(raw)] ?? null;
  if (r.s && raw >= 2 ** (r.l - 1)) raw -= 2 ** r.l;
  // Not clamped to the list's min and max: several lists carry a max far
  // below what the field holds (an odometer capped at 255), and clamping would
  // show a wrong number as if it were real. Odd values are marked instead.
  const v = (raw * (r.m ?? 1)) / (r.v ?? 1) + (r.a ?? 0);
  const eps = 1e-9;
  if (r.nlo != null && v <= r.nlo + eps) return null;
  if (r.nhi != null && v >= r.nhi - eps) return null;
  if (r.u === 'yesno') return v ? 'Yes' : 'No';
  return v;
}

// Plain categories for Live data, closest to how a driver thinks of the car.
export type SensorCategory =
  | 'Engine'
  | 'Turbo and air'
  | 'Gearbox'
  | 'Diesel filter and exhaust'
  | 'Battery and charging'
  | 'Fuel'
  | 'Tyres'
  | 'Climate'
  | 'Mileage and trips'
  | 'Service and oil'
  | 'Airbag crash counts'
  | 'Brakes and chassis'
  | 'Body'
  | 'Other';

export const CATEGORY_ORDER: SensorCategory[] = [
  'Engine',
  'Turbo and air',
  'Gearbox',
  'Diesel filter and exhaust',
  'Service and oil',
  'Battery and charging',
  'Fuel',
  'Mileage and trips',
  'Tyres',
  'Brakes and chassis',
  'Climate',
  'Airbag crash counts',
  'Body',
  'Other',
];

export const CATEGORY_ICON: Record<SensorCategory, string> = {
  Engine: 'engine-outline',
  'Turbo and air': 'turbine',
  Gearbox: 'cog-outline',
  'Diesel filter and exhaust': 'smoke',
  'Battery and charging': 'car-battery',
  Fuel: 'gas-station-outline',
  Tyres: 'tire',
  Climate: 'thermometer',
  'Mileage and trips': 'map-marker-distance',
  'Service and oil': 'oil',
  'Airbag crash counts': 'airbag',
  'Brakes and chassis': 'car-brake-abs',
  Body: 'car-door',
  Other: 'dots-horizontal-circle-outline',
};

export const CATEGORY_COLOUR: Record<SensorCategory, ToolColour> = {
  Engine: 'red',
  'Turbo and air': 'teal',
  Gearbox: 'indigo',
  'Diesel filter and exhaust': 'grey',
  'Service and oil': 'orange',
  'Battery and charging': 'green',
  Fuel: 'orange',
  'Mileage and trips': 'blue',
  Tyres: 'purple',
  'Brakes and chassis': 'red',
  Climate: 'teal',
  'Airbag crash counts': 'red',
  Body: 'blue',
  Other: 'grey',
};

const RULES: [RegExp, SensorCategory][] = [
  [/crash/i, 'Airbag crash counts'],
  [/soot|particulate|\bDPF\b|regenerat|\bEGR\b|exhaust|NOx|lambda|oxygen sensor|urea|AdBlue|\bDEF\b|catalyst|ash/i, 'Diesel filter and exhaust'],
  [/oil level|oil life|service|inspection|oil change|oil quality|oil dilution/i, 'Service and oil'],
  [/turbo|boost|charge air|charge pressure|air mass|intake|throttle|manifold|wastegate|intercooler/i, 'Turbo and air'],
  [/transmission|gear|clutch|shift|torque converter|\bATF\b|selector|gearbox/i, 'Gearbox'],
  [/odometer|mileage|distance|trip|range|driving time|operating time|drive time/i, 'Mileage and trips'],
  [/battery|voltage|alternator|generator|current|charge level|state of charge/i, 'Battery and charging'],
  [/fuel|injector|injection|rail|tank/i, 'Fuel'],
  [/tyre|tire/i, 'Tyres'],
  [/brake|wheel speed|steering|yaw|lateral|longitudinal|acceleration|suspension|ride height|damper/i, 'Brakes and chassis'],
  [/temperature inside|inside|interior|cabin|ambient|outside|climate|refrigerant|A\/C|HVAC|blower|windshield|windscreen/i, 'Climate'],
  [/door|window|light|seat|wiper|key|lock|sunroof/i, 'Body'],
];
const PATHS: Record<string, SensorCategory> = {
  Engine: 'Engine',
  Transmission: 'Gearbox',
  Drivetrain: 'Gearbox',
  Battery: 'Battery and charging',
  Fuel: 'Fuel',
  Tires: 'Tyres',
  Climate: 'Climate',
  Trips: 'Mileage and trips',
  Stats: 'Mileage and trips',
  Movement: 'Brakes and chassis',
  Control: 'Brakes and chassis',
  Doors: 'Body',
  Lights: 'Body',
  Fluids: 'Service and oil',
  Emissions: 'Diesel filter and exhaust',
};

export function categoryOf(r: SensorRow): SensorCategory {
  for (const [re, c] of RULES) if (re.test(r.n)) return c;
  return PATHS[r.p] ?? 'Other';
}

// Where the value comes from, in workshop terms.
export const HEADER_NAMES: Record<string, string> = {
  '7E0': 'Engine',
  '7E1': 'Gearbox',
  '7E2': 'Hybrid',
  '7E4': 'Body',
  '7E5': 'Engine (second)',
  '7E6': 'Gearbox (second)',
  '710': 'Gateway',
  '713': 'Brakes',
  '714': 'Instrument cluster',
  '715': 'Airbag',
  '70B': 'Tyre pressure',
  '70E': 'Body',
  '70F': 'Climate',
  '71D': 'Steering',
  '744': 'Parking aid',
  '746': 'Climate',
  '74F': 'Central electronics',
  '760': 'ABS',
  '726': 'Body control',
  '720': 'Instrument cluster',
  '730': 'Steering',
  '737': 'Airbag',
  '750': 'Body',
  '723': 'Steering angle',
  '703': 'Body',
  '7D0': 'Infotainment',
};

// Converts to the driver's units. Returns the value and its unit.
// The unit, filled in for temperatures some lists leave blank (an offset
// below zero on a value named temperature is degrees Celsius).
export function unitOf(r: SensorRow): string {
  if (r.u === 'yesno') return '';
  if (!r.u && (r.a ?? 0) < 0 && /\btemp(erature)?s?\b/i.test(r.n)) return '°C';
  return r.u;
}

export function displaySensor(r: SensorRow, v: SensorValue, imperial: { speed: boolean; temp: boolean }): { text: string; unit: string; check?: boolean } {
  if (typeof v === 'string') return { text: v.charAt(0) + v.slice(1).toLowerCase(), unit: '' };
  const check = !isPlausible(r, v) || undefined;
  let unit = unitOf(r);
  let x = v;
  if (imperial.temp && unit === '°C') {
    x = (x * 9) / 5 + 32;
    unit = '°F';
  } else if (!imperial.temp && unit === '°F') {
    x = ((x - 32) * 5) / 9;
    unit = '°C';
  }
  if (imperial.speed && unit === 'km/h') {
    x /= 1.609344;
    unit = 'mph';
  } else if (imperial.speed && unit === 'km') {
    x /= 1.609344;
    unit = 'mi';
  } else if (!imperial.speed && unit === 'mph') {
    x *= 1.609344;
    unit = 'km/h';
  } else if (!imperial.speed && unit === 'mi') {
    x *= 1.609344;
    unit = 'km';
  }
  const abs = Math.abs(x);
  // A value with a whole-number step (a gear, a count, rpm) shows no decimals.
  const step = (r.m ?? 1) / (r.v ?? 1);
  const whole = x === v && Number.isInteger(step) && Number.isInteger(r.a ?? 0);
  if (whole) return { text: Math.round(x).toLocaleString('en-GB'), unit, check };
  const text = abs >= 1000 ? Math.round(x).toLocaleString('en-GB') : abs >= 100 ? x.toFixed(0) : abs >= 10 ? x.toFixed(1) : Number.isInteger(x) ? String(x) : x.toFixed(2);
  return { text, unit, check };
}

// Readings that cannot be right for their unit (a value borrowed from a
// relative's list can decode differently on this car): shown dimmed, marked.
const PLAUSIBLE: Record<string, [number, number]> = {
  '°C': [-50, 1100],
  '°F': [-60, 2000],
  rpm: [-20000, 20000],
  'km/h': [-20, 350],
  mph: [-15, 220],
  '%': [-110, 110],
  V: [0, 60],
  bar: [-2, 3000],
  kPa: [-200, 300000],
};

export function isPlausible(r: SensorRow, v: SensorValue): boolean {
  if (typeof v === 'string') return true;
  if (!Number.isFinite(v)) return false;
  const range = PLAUSIBLE[unitOf(r)];
  if (range && (v < range[0] || v > range[1])) return false;
  if (/(^|\s)(selected |current )?gear$/i.test(r.n) && (v < -1 || v > 12)) return false;
  // Sitting exactly on the format's limit usually means "no value".
  if (r.hi != null && r.hi > (r.lo ?? 0) && (v === r.hi || (r.lo != null && r.lo < 0 && v === r.lo))) return false;
  return true;
}
