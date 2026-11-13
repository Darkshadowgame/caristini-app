// Mode 01 live data PIDs (SAE J1979). Formulas use the data bytes A, B, C, D.
export type PidGroup = 'Engine' | 'Fuel' | 'Air and exhaust' | 'Temperatures' | 'Electrical' | 'Since codes cleared';

export interface LivePid {
  pid: number;
  label: string;
  unit: string;
  group: PidGroup;
  bytes: number;
  decimals: number;
  decode: (d: number[]) => number;
}

const pct = (a: number) => (a * 100) / 255;
const trim = (a: number) => ((a - 128) * 100) / 128;
const word = (a: number, b: number) => a * 256 + b;

export const LIVE_PIDS: LivePid[] = [
  // Engine
  { pid: 0x0c, label: 'Engine speed', unit: 'rpm', group: 'Engine', bytes: 2, decimals: 0, decode: ([a, b]) => word(a, b) / 4 },
  { pid: 0x0d, label: 'Vehicle speed', unit: 'km/h', group: 'Engine', bytes: 1, decimals: 0, decode: ([a]) => a },
  { pid: 0x04, label: 'Engine load', unit: '%', group: 'Engine', bytes: 1, decimals: 0, decode: ([a]) => pct(a) },
  { pid: 0x43, label: 'Absolute load', unit: '%', group: 'Engine', bytes: 2, decimals: 0, decode: ([a, b]) => (word(a, b) * 100) / 255 },
  { pid: 0x11, label: 'Throttle position', unit: '%', group: 'Engine', bytes: 1, decimals: 0, decode: ([a]) => pct(a) },
  { pid: 0x45, label: 'Relative throttle', unit: '%', group: 'Engine', bytes: 1, decimals: 0, decode: ([a]) => pct(a) },
  { pid: 0x4c, label: 'Commanded throttle', unit: '%', group: 'Engine', bytes: 1, decimals: 0, decode: ([a]) => pct(a) },
  { pid: 0x49, label: 'Accelerator pedal D', unit: '%', group: 'Engine', bytes: 1, decimals: 0, decode: ([a]) => pct(a) },
  { pid: 0x5a, label: 'Relative pedal', unit: '%', group: 'Engine', bytes: 1, decimals: 0, decode: ([a]) => pct(a) },
  { pid: 0x0e, label: 'Timing advance', unit: '°', group: 'Engine', bytes: 1, decimals: 1, decode: ([a]) => a / 2 - 64 },
  { pid: 0x61, label: 'Driver demand torque', unit: '%', group: 'Engine', bytes: 1, decimals: 0, decode: ([a]) => a - 125 },
  { pid: 0x62, label: 'Actual torque', unit: '%', group: 'Engine', bytes: 1, decimals: 0, decode: ([a]) => a - 125 },
  { pid: 0x63, label: 'Reference torque', unit: 'Nm', group: 'Engine', bytes: 2, decimals: 0, decode: ([a, b]) => word(a, b) },
  { pid: 0x1f, label: 'Run time since start', unit: 's', group: 'Engine', bytes: 2, decimals: 0, decode: ([a, b]) => word(a, b) },

  // Fuel
  { pid: 0x06, label: 'Short term fuel trim B1', unit: '%', group: 'Fuel', bytes: 1, decimals: 1, decode: ([a]) => trim(a) },
  { pid: 0x07, label: 'Long term fuel trim B1', unit: '%', group: 'Fuel', bytes: 1, decimals: 1, decode: ([a]) => trim(a) },
  { pid: 0x08, label: 'Short term fuel trim B2', unit: '%', group: 'Fuel', bytes: 1, decimals: 1, decode: ([a]) => trim(a) },
  { pid: 0x09, label: 'Long term fuel trim B2', unit: '%', group: 'Fuel', bytes: 1, decimals: 1, decode: ([a]) => trim(a) },
  { pid: 0x44, label: 'Commanded lambda', unit: 'λ', group: 'Fuel', bytes: 2, decimals: 3, decode: ([a, b]) => (2 / 65536) * word(a, b) },
  { pid: 0x0a, label: 'Fuel pressure', unit: 'kPa', group: 'Fuel', bytes: 1, decimals: 0, decode: ([a]) => a * 3 },
  { pid: 0x22, label: 'Fuel rail pressure (rel.)', unit: 'kPa', group: 'Fuel', bytes: 2, decimals: 0, decode: ([a, b]) => 0.079 * word(a, b) },
  { pid: 0x23, label: 'Fuel rail pressure', unit: 'kPa', group: 'Fuel', bytes: 2, decimals: 0, decode: ([a, b]) => 10 * word(a, b) },
  { pid: 0x5e, label: 'Fuel rate', unit: 'L/h', group: 'Fuel', bytes: 2, decimals: 1, decode: ([a, b]) => word(a, b) / 20 },
  { pid: 0x2f, label: 'Fuel level', unit: '%', group: 'Fuel', bytes: 1, decimals: 0, decode: ([a]) => pct(a) },
  { pid: 0x52, label: 'Ethanol content', unit: '%', group: 'Fuel', bytes: 1, decimals: 0, decode: ([a]) => pct(a) },
  { pid: 0x2e, label: 'Evap purge commanded', unit: '%', group: 'Fuel', bytes: 1, decimals: 0, decode: ([a]) => pct(a) },

  // Air and exhaust
  { pid: 0x10, label: 'Air flow (MAF)', unit: 'g/s', group: 'Air and exhaust', bytes: 2, decimals: 1, decode: ([a, b]) => word(a, b) / 100 },
  { pid: 0x0b, label: 'Intake pressure (MAP)', unit: 'kPa', group: 'Air and exhaust', bytes: 1, decimals: 0, decode: ([a]) => a },
  { pid: 0x33, label: 'Barometric pressure', unit: 'kPa', group: 'Air and exhaust', bytes: 1, decimals: 0, decode: ([a]) => a },
  { pid: 0x14, label: 'O2 sensor B1S1', unit: 'V', group: 'Air and exhaust', bytes: 2, decimals: 2, decode: ([a]) => a / 200 },
  { pid: 0x15, label: 'O2 sensor B1S2', unit: 'V', group: 'Air and exhaust', bytes: 2, decimals: 2, decode: ([a]) => a / 200 },
  { pid: 0x18, label: 'O2 sensor B2S1', unit: 'V', group: 'Air and exhaust', bytes: 2, decimals: 2, decode: ([a]) => a / 200 },
  { pid: 0x19, label: 'O2 sensor B2S2', unit: 'V', group: 'Air and exhaust', bytes: 2, decimals: 2, decode: ([a]) => a / 200 },
  { pid: 0x2c, label: 'EGR commanded', unit: '%', group: 'Air and exhaust', bytes: 1, decimals: 0, decode: ([a]) => pct(a) },
  { pid: 0x2d, label: 'EGR error', unit: '%', group: 'Air and exhaust', bytes: 1, decimals: 1, decode: ([a]) => trim(a) },

  // Temperatures
  { pid: 0x05, label: 'Coolant temp', unit: '°C', group: 'Temperatures', bytes: 1, decimals: 0, decode: ([a]) => a - 40 },
  { pid: 0x5c, label: 'Oil temp', unit: '°C', group: 'Temperatures', bytes: 1, decimals: 0, decode: ([a]) => a - 40 },
  { pid: 0x0f, label: 'Intake air temp', unit: '°C', group: 'Temperatures', bytes: 1, decimals: 0, decode: ([a]) => a - 40 },
  { pid: 0x46, label: 'Ambient air temp', unit: '°C', group: 'Temperatures', bytes: 1, decimals: 0, decode: ([a]) => a - 40 },
  { pid: 0x3c, label: 'Catalyst temp B1S1', unit: '°C', group: 'Temperatures', bytes: 2, decimals: 0, decode: ([a, b]) => word(a, b) / 10 - 40 },

  // Electrical
  { pid: 0x42, label: 'Module voltage', unit: 'V', group: 'Electrical', bytes: 2, decimals: 2, decode: ([a, b]) => word(a, b) / 1000 },
  { pid: 0x5b, label: 'Hybrid battery left', unit: '%', group: 'Electrical', bytes: 1, decimals: 0, decode: ([a]) => pct(a) },

  // Since codes cleared
  { pid: 0x21, label: 'Distance with light on', unit: 'km', group: 'Since codes cleared', bytes: 2, decimals: 0, decode: ([a, b]) => word(a, b) },
  { pid: 0x4d, label: 'Time with light on', unit: 'min', group: 'Since codes cleared', bytes: 2, decimals: 0, decode: ([a, b]) => word(a, b) },
  { pid: 0x31, label: 'Distance since clear', unit: 'km', group: 'Since codes cleared', bytes: 2, decimals: 0, decode: ([a, b]) => word(a, b) },
  { pid: 0x4e, label: 'Time since clear', unit: 'min', group: 'Since codes cleared', bytes: 2, decimals: 0, decode: ([a, b]) => word(a, b) },
  { pid: 0x30, label: 'Warm-ups since clear', unit: '', group: 'Since codes cleared', bytes: 1, decimals: 0, decode: ([a]) => a },
];

export const PID_GROUPS: PidGroup[] = ['Engine', 'Fuel', 'Air and exhaust', 'Temperatures', 'Electrical', 'Since codes cleared'];

// Shown first when the car supports them; good starting set for fault finding.
export const DEFAULT_WATCH = [0x0c, 0x0d, 0x05, 0x04, 0x06, 0x07, 0x10, 0x0b, 0x0f, 0x42];

// Values recorded with a freeze frame (mode 02).
export const FREEZE_PIDS = [0x0c, 0x0d, 0x05, 0x04, 0x06, 0x07, 0x0b, 0x0f, 0x11];

export function pidInfo(pid: number): LivePid | undefined {
  return LIVE_PIDS.find((p) => p.pid === pid);
}

// PIDs 00, 20, 40, 60 return a 32-bit mask of which of the next 32 PIDs the car supports.
export function supportedFromMask(base: number, d: number[]): number[] {
  const out: number[] = [];
  for (let i = 0; i < 32; i++) {
    const byte = d[i >> 3] ?? 0;
    if (byte & (0x80 >> (i & 7))) out.push(base + i + 1);
  }
  return out;
}

// Readiness monitors from mode 01 PID 01, bytes B, C, D (SAE J1979).
export interface Monitor {
  name: string;
  state: 'complete' | 'incomplete';
}

const SPARK = ['Catalyst', 'Heated catalyst', 'Evaporative system', 'Secondary air', 'A/C refrigerant', 'Oxygen sensor', 'Oxygen sensor heater', 'EGR system'];
const DIESEL = ['NMHC catalyst', 'NOx / SCR', '', 'Boost pressure', '', 'Exhaust gas sensor', 'Particulate filter', 'EGR / VVT'];

export function decodeReadiness(b: number, c: number, d: number): { diesel: boolean; monitors: Monitor[] } {
  const diesel = (b & 0x08) !== 0;
  const monitors: Monitor[] = [];
  const common = ['Misfire', 'Fuel system', 'Components'];
  common.forEach((name, i) => {
    if (b & (1 << i)) monitors.push({ name, state: b & (1 << (i + 4)) ? 'incomplete' : 'complete' });
  });
  const names = diesel ? DIESEL : SPARK;
  names.forEach((name, i) => {
    if (name && c & (1 << i)) monitors.push({ name, state: d & (1 << i) ? 'incomplete' : 'complete' });
  });
  return { diesel, monitors };
}
