// Maker-specific values read with UDS service 22 from individual modules.
// None of these comes from a VW document: all are community-sourced and vary
// by engine and model (see replica/uds-sources.md, section 4). The app only
// shows a value when the car answers, and marks each one with its source so
// it can be checked against another tool.
import { ModuleGroup } from './modules';

export interface ExtraValue {
  id: string;
  label: string;
  category: 'Distance' | 'Engine' | 'Turbo' | 'Diesel particulate filter' | 'Battery' | 'Gearbox' | 'Service' | 'Airbag crash counters';
  group: Exclude<ModuleGroup, 'all'>;
  // Module id from modules.ts.
  module: string;
  did: string;
  unit: 'km' | '°C' | 'g' | 'count' | '%' | 'V' | 'A' | 'h' | 'kPa' | 'bar' | 'g/l' | 'on/off';
  decode: (b: number[]) => number | null;
  source: string;
  // Values above this are treated as a wrong identifier for this engine and hidden.
  max?: number;
  // Lowest plausible value (default 0); temperatures go below zero.
  min?: number;
}

const u8 = (b: number[]) => (b.length >= 1 ? b[0] : null);
const u16 = (b: number[], div = 1) => (b.length >= 2 ? (b[0] * 256 + b[1]) / div : null);
const u24 = (b: number[]) => (b.length >= 3 ? (b[0] << 16) | (b[1] << 8) | b[2] : null);
const s16 = (b: number[]) => (b.length >= 2 ? ((b[0] << 8) | b[1]) - (b[0] & 0x80 ? 0x10000 : 0) : null);
const u32 = (b: number[]) => (b.length >= 4 ? b[0] * 2 ** 24 + ((b[1] << 16) | (b[2] << 8) | b[3]) : null);
const kelvin10 = (b: number[]) => (b.length >= 2 ? (b[0] * 256 + b[1]) / 10 - 273.1 : null);
const PSI_KPA = 6.894757;
// Sources disagree on 24 or 32 bits; the reply length decides.
const u24or32 = (b: number[]) => (b.length >= 4 ? b[0] * 2 ** 24 + ((b[1] << 16) | (b[2] << 8) | b[3]) : u24(b));

export const EXTRAS: ExtraValue[] = [
  { id: 'odo-cluster', label: 'Odometer (instrument cluster)', category: 'Distance', group: 'vag', module: 'vag-17', did: '2203', unit: 'km', decode: u24, source: 'OBDb Audi A6 signalset; OBDb RS 3' },
  { id: 'odo-engine', label: 'Odometer (engine computer)', category: 'Distance', group: 'vag', module: 'engine', did: '295A', unit: 'km', decode: u24or32, source: 'OBDb Golf and A6 signalsets; T6 forum' },
  { id: 'oil-temp', label: 'Engine oil temperature', category: 'Engine', group: 'vag', module: 'vag-17', did: '202F', unit: '°C', decode: (b) => (b.length ? b[0] - 58 : null), source: 'OBDb Audi A6 signalset', max: 160 },
  { id: 'dpf-soot-calc', label: 'Soot, calculated', category: 'Diesel particulate filter', group: 'vag', module: 'engine', did: '208B', unit: 'g', decode: (b) => u16(b, 100), source: 'T6 forum (2018 2.0 TDI CXEB)', max: 100 },
  { id: 'dpf-soot-meas', label: 'Soot, measured', category: 'Diesel particulate filter', group: 'vag', module: 'engine', did: '208C', unit: 'g', decode: (b) => u16(b, 100), source: 'T6 forum (2018 2.0 TDI CXEB)', max: 100 },
  { id: 'dpf-ash', label: 'Oil ash', category: 'Diesel particulate filter', group: 'vag', module: 'engine', did: '406C', unit: 'g', decode: (b) => u16(b, 100), source: 'T6 forum (2018 2.0 TDI CXEB)', max: 300 },
  { id: 'dpf-soot-calc-old', label: 'Soot, calculated (older engines)', category: 'Diesel particulate filter', group: 'vag', module: 'engine', did: '114F', unit: 'g', decode: (b) => u16(b, 100), source: 'T6 forum (2016 2.0 TDI)', max: 100 },
  { id: 'dpf-soot-meas-old', label: 'Soot, measured (older engines)', category: 'Diesel particulate filter', group: 'vag', module: 'engine', did: '114E', unit: 'g', decode: (b) => u16(b, 100), source: 'T6 forum (2016 2.0 TDI)', max: 100 },
  { id: 'dpf-ash-old', label: 'Oil ash (older engines)', category: 'Diesel particulate filter', group: 'vag', module: 'engine', did: '178C', unit: 'g', decode: (b) => u16(b, 10), source: 'T6 forum (2016 2.0 TDI)', max: 300 },
  // VW group additions from replica/vag-sources.md section 6 (Medium).
  { id: 'odo-engine-mlb', label: 'Odometer (engine computer, MLB)', category: 'Distance', group: 'vag', module: 'engine', did: '10E0', unit: 'km', decode: u32, source: 'vag-sources L3 (2014 A4 B8 capture)', max: 2_000_000 },
  { id: 'dpf-out-temp', label: 'DPF outlet temperature', category: 'Diesel particulate filter', group: 'vag', module: 'engine', did: '10F9', unit: '°C', decode: kelvin10, source: 'vag-sources L1, L4', min: -40, max: 1000 },
  { id: 'egt-turbo', label: 'Exhaust temperature before turbo', category: 'Engine', group: 'vag', module: 'engine', did: '10FB', unit: '°C', decode: kelvin10, source: 'vag-sources L1, L4', min: -40, max: 1100 },
  { id: 'gbx-hours', label: 'Gearbox total drive time', category: 'Gearbox', group: 'vag', module: 'gearbox', did: '0302', unit: 'h', decode: (b) => u16(b, 4), source: 'vag-sources L2 (2012 A6 capture)' },
  { id: 'gbx-eco', label: 'Drive time in eco', category: 'Gearbox', group: 'vag', module: 'gearbox', did: '0303', unit: '%', decode: (b) => (b.length ? b[0] / 2.5 : null), source: 'vag-sources L2 (2012 A6)', max: 100 },
  { id: 'gbx-sport', label: 'Drive time in sport', category: 'Gearbox', group: 'vag', module: 'gearbox', did: '0304', unit: '%', decode: (b) => (b.length ? b[0] / 2.5 : null), source: 'vag-sources L2 (2012 A6)', max: 100 },
  { id: 'gbx-manual', label: 'Drive time in manual', category: 'Gearbox', group: 'vag', module: 'gearbox', did: '0305', unit: '%', decode: (b) => (b.length ? b[0] / 2.5 : null), source: 'vag-sources L2 (2012 A6)', max: 100 },

  // Ford Focus Mk3 (replica/focus-st-sources.md section 5, OBDb captures 2012 to 2018, Medium).
  { id: 'ford-odo', label: 'Odometer (body module)', category: 'Distance', group: 'ford', module: 'ford-bcm', did: 'DD01', unit: 'km', decode: u24, source: 'OBDb Focus captures (focus-st-sources)' },
  { id: 'ford-odo-pcm', label: 'Odometer (engine computer)', category: 'Distance', group: 'ford', module: 'engine', did: 'DD01', unit: 'km', decode: u24, source: 'OBDb 2016 Focus capture' },
  { id: 'ford-bat-soc', label: 'Battery charge', category: 'Battery', group: 'ford', module: 'ford-bcm', did: '4028', unit: '%', decode: u8, source: 'OBDb Focus captures', max: 100 },
  { id: 'ford-bat-temp', label: 'Battery temperature', category: 'Battery', group: 'ford', module: 'ford-bcm', did: '4029', unit: '°C', decode: (b) => (b.length ? b[0] - 40 : null), source: 'OBDb Focus captures', min: -40, max: 100 },
  { id: 'ford-bat-v', label: 'Battery voltage (body module)', category: 'Battery', group: 'ford', module: 'ford-bcm', did: '402A', unit: 'V', decode: (b) => (b.length ? b[0] / 20 + 6 : null), source: 'OBDb Focus captures', max: 20 },
  { id: 'ford-bat-age', label: 'Battery age', category: 'Battery', group: 'ford', module: 'ford-bcm', did: '4027', unit: 'h', decode: (b) => (b.length >= 2 ? (b[0] * 256 + b[1]) * 24 : null), source: 'OBDb Focus captures' },
  { id: 'ford-bat-a', label: 'Battery current', category: 'Battery', group: 'ford', module: 'ford-bcm', did: '4090', unit: 'A', decode: (b) => (b.length >= 2 ? (b[0] * 256 + b[1]) / 16 - 511.7 : null), source: 'OBDb Focus captures', min: -600, max: 600 },
  { id: 'ford-tip', label: 'Boost pressure (absolute)', category: 'Turbo', group: 'ford', module: 'engine', did: '033E', unit: 'kPa', decode: (b) => (b.length >= 2 ? (((b[0] * 256 + b[1]) * 37) / 33441) * PSI_KPA : null), source: 'OBDb Focus captures (2013, 2016)', max: 400 },
  { id: 'ford-baro', label: 'Barometric pressure', category: 'Turbo', group: 'ford', module: 'engine', did: '0353', unit: 'kPa', decode: (b) => (b.length >= 2 ? (((b[0] * 256 + b[1]) * 615) / 16963) * PSI_KPA : null), source: 'OBDb Focus captures', max: 120 },
  { id: 'ford-cat', label: 'Charge air temperature', category: 'Turbo', group: 'ford', module: 'engine', did: '0461', unit: '°C', decode: (b) => { const v = s16(b); return v == null ? null : v / 64 - 40; }, source: 'OBDb 2016 Focus', min: -40, max: 200 },
  { id: 'ford-wgdc', label: 'Wastegate duty', category: 'Turbo', group: 'ford', module: 'engine', did: '0462', unit: '%', decode: (b) => (b.length >= 2 ? ((b[0] * 256 + b[1]) * 100) / 32768 : null), source: 'OBDb 2016 Focus', max: 100 },
  { id: 'ford-oil-life', label: 'Oil life remaining', category: 'Service', group: 'ford', module: 'engine', did: '054B', unit: '%', decode: u8, source: 'OBDb Focus captures (2013, 2016)', max: 100 },
  { id: 'ford-oil-temp', label: 'Engine oil temperature', category: 'Engine', group: 'ford', module: 'engine', did: '1310', unit: '°C', decode: (b) => (b.length >= 2 ? (b[0] * 256 + b[1]) / 100 - 40 : null), source: 'Ford Power Stroke Torque list; no Focus capture, hidden if not answered', min: -40, max: 160 },

  // Mazda6 GJ 2.2 diesel (replica/mazda6-sources.md, Medium unless noted).
  { id: 'mazda-odo', label: 'Odometer', category: 'Distance', group: 'mazda', module: 'engine', did: 'DD01', unit: 'km', decode: u24, source: 'OBDb Mazda6 2014 to 2020 captures (High)' },
  { id: 'mazda-oil-temp', label: 'Engine oil temperature', category: 'Engine', group: 'mazda', module: 'engine', did: '1310', unit: '°C', decode: (b) => (b.length >= 2 ? (b[0] * 256 + b[1]) / 100 - 40 : null), source: 'OBDb Mazda6 2014 to 2017 captures', min: -40, max: 160 },
  { id: 'mazda-boost-dsd', label: 'Desired boost', category: 'Turbo', group: 'mazda', module: 'engine', did: '1305', unit: 'bar', decode: (b) => u16(b, 6400), source: 'mazda6-sources Z5, Z6, Z8', max: 5 },
  { id: 'mazda-map', label: 'Intake manifold pressure', category: 'Turbo', group: 'mazda', module: 'engine', did: 'F470', unit: 'kPa', decode: (b) => (b.length >= 5 ? (b[3] * 256 + b[4]) / 32 : null), source: 'mazda6-sources Z6, Z7, Z8', max: 400 },
  { id: 'mazda-soot', label: 'DPF soot load', category: 'Diesel particulate filter', group: 'mazda', module: 'engine', did: '042C', unit: 'g/l', decode: (b) => (b.length >= 2 ? ((b[0] * 256 + b[1]) * 100) / 65535 : null), source: 'mazda6-sources Z5 capture (scale differs about 4% from Z8)', max: 100 },
  { id: 'mazda-soot-dsd', label: 'DPF soot load target', category: 'Diesel particulate filter', group: 'mazda', module: 'engine', did: '044B', unit: 'g/l', decode: (b) => (b.length >= 2 ? ((b[0] * 256 + b[1]) * 100) / 65535 : null), source: 'mazda6-sources Z5', max: 100 },
  { id: 'mazda-regen', label: 'DPF regeneration running', category: 'Diesel particulate filter', group: 'mazda', module: 'engine', did: '0380', unit: 'on/off', decode: u8, source: 'mazda6-sources Z5, Z8', max: 1 },
  { id: 'mazda-regen-count', label: 'DPF regenerations', category: 'Diesel particulate filter', group: 'mazda', module: 'engine', did: '0432', unit: 'count', decode: (b) => u16(b), source: 'mazda6-sources Z5 capture' },
  { id: 'mazda-regen-dist', label: 'Distance since last regeneration', category: 'Diesel particulate filter', group: 'mazda', module: 'engine', did: '0434', unit: 'km', decode: (b) => (b.length >= 4 ? (((b[1] << 16) | (b[2] << 8) | b[3]) * 100) / 65535 : null), source: 'mazda6-sources Z5 capture (scale differs about 2% from Z8)', max: 5000 },
  { id: 'mazda-dpf-dp', label: 'DPF pressure difference', category: 'Diesel particulate filter', group: 'mazda', module: 'engine', did: 'F47A', unit: 'kPa', decode: (b) => { const v = s16(b.slice(1)); return v == null ? null : v / 100; }, source: 'mazda6-sources Z8', min: -50, max: 200 },
  { id: 'mazda-bat-v', label: 'Battery voltage (body module)', category: 'Battery', group: 'mazda', module: 'mazda-fbcm', did: '402A', unit: 'V', decode: (b) => u16(b, 1000), source: 'mazda6-sources Z5, Z6, Z7', max: 20 },

  { id: 'crash-front', label: 'Front crashes recorded', category: 'Airbag crash counters', group: 'vag', module: 'vag-15', did: '2353', unit: 'count', decode: u8, source: 'OBDb Audi A6 signalset' },
  { id: 'crash-driver', label: "Driver's side crashes recorded", category: 'Airbag crash counters', group: 'vag', module: 'vag-15', did: '2354', unit: 'count', decode: u8, source: 'OBDb Audi A6 signalset' },
  { id: 'crash-passenger', label: "Passenger's side crashes recorded", category: 'Airbag crash counters', group: 'vag', module: 'vag-15', did: '2355', unit: 'count', decode: u8, source: 'OBDb Audi A6 signalset' },
  { id: 'crash-rear', label: 'Rear crashes recorded', category: 'Airbag crash counters', group: 'vag', module: 'vag-15', did: '2356', unit: 'count', decode: u8, source: 'OBDb Audi A6 signalset' },
  { id: 'crash-rollover', label: 'Rollovers recorded', category: 'Airbag crash counters', group: 'vag', module: 'vag-15', did: '2357', unit: 'count', decode: u8, source: 'OBDb Audi A6 signalset' },
];

export function extrasFor(group: 'vag' | 'ford' | 'mazda' | 'other'): ExtraValue[] {
  return group === 'other' ? [] : EXTRAS.filter((e) => e.group === group);
}

export function formatExtra(e: ExtraValue, v: number, units?: { temp: '°C' | '°F' }): string {
  if (e.unit === '°C' && units?.temp === '°F') return `${Math.round((v * 9) / 5 + 32)} °F`;
  if (e.unit === 'km') return `${Math.round(v / 1.609344).toLocaleString('en-GB')} mi (${Math.round(v).toLocaleString('en-GB')} km)`;
  if (e.unit === 'count') return String(v);
  if (e.unit === 'on/off') return v ? 'On' : 'Off';
  if (e.unit === 'g' || e.unit === 'V' || e.unit === 'A' || e.unit === 'h') return `${v.toFixed(1)} ${e.unit}`;
  if (e.unit === 'bar' || e.unit === 'g/l') return `${v.toFixed(2)} ${e.unit}`;
  return `${Math.round(v)} ${e.unit}`;
}
