// App settings kept on the phone: units and connection behaviour.
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

export interface Settings {
  speed: 'mph' | 'km/h';
  temp: '°C' | '°F';
  // Connect to the last adapter when the app opens.
  autoConnect: boolean;
  // Run a health check straight after connecting.
  autoCheck: boolean;
  // Keep a log of adapter traffic for troubleshooting.
  debugLog: boolean;
  // Send the adapter log to the findings repo by itself after each check or scan.
  autoSendLog: boolean;
  // Where emailed findings go when automatic sending is not set up.
  sendTo: string;
  // Units follow the phone's region until the owner picks them.
  speedAuto: boolean;
  tempAuto: boolean;
}

// The phone's region (for example GB from en-GB), or null.
export function phoneRegion(): string | null {
  try {
    const loc = Intl.NumberFormat().resolvedOptions().locale;
    const m = /[-_]([A-Z]{2})\b/.exec(loc);
    return m ? m[1] : null;
  } catch {
    return null;
  }
}

// Road speeds in mph: the UK, the US and a few others. Fahrenheit: the US
// and a few others. Everywhere else km/h and Celsius.
const MPH = new Set(['GB', 'US', 'LR', 'MM', 'BS', 'BZ', 'KY', 'VG', 'FK', 'GI', 'IM', 'JE', 'GG', 'PR', 'GU', 'VI', 'AS', 'MP', 'AI', 'MS', 'AG', 'DM', 'GD', 'KN', 'LC', 'VC', 'WS']);
const FAHRENHEIT = new Set(['US', 'LR', 'MM', 'BS', 'BZ', 'KY', 'PW', 'FM', 'MH', 'PR', 'GU', 'VI', 'AS', 'MP']);

export function regionUnits(region: string | null = phoneRegion()): Pick<Settings, 'speed' | 'temp'> {
  if (!region) return { speed: 'km/h', temp: '°C' };
  return { speed: MPH.has(region) ? 'mph' : 'km/h', temp: FAHRENHEIT.has(region) ? '°F' : '°C' };
}

const DEFAULTS: Settings = { speed: 'mph', temp: '°C', autoConnect: false, autoCheck: false, debugLog: true, autoSendLog: true, sendTo: '', speedAuto: true, tempAuto: true };
const KEY = 'caristini.settings.v1';

interface Ctx {
  settings: Settings;
  loaded: boolean;
  set(patch: Partial<Settings>): Promise<void>;
}

const SettingsCtx = createContext<Ctx>({ settings: DEFAULTS, loaded: false, set: async () => undefined });

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<Settings>(DEFAULTS);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((raw) => {
        const saved: Partial<Settings> & { unitsAuto?: boolean } = raw ? JSON.parse(raw) : {};
        const next = { ...DEFAULTS, ...saved };
        // Earlier versions kept one switch for both.
        if (saved.speedAuto == null && saved.unitsAuto != null) next.speedAuto = saved.unitsAuto;
        if (saved.tempAuto == null && saved.unitsAuto != null) next.tempAuto = saved.unitsAuto;
        const region = regionUnits();
        setSettings({ ...next, ...(next.speedAuto ? { speed: region.speed } : {}), ...(next.tempAuto ? { temp: region.temp } : {}) });
      })
      .catch(() => undefined)
      .finally(() => setLoaded(true));
  }, []);
  const set = useCallback(async (patch: Partial<Settings>) => {
    setSettings((old) => {
      const next = { ...old, ...patch };
      AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => undefined);
      return next;
    });
  }, []);
  const value = useMemo(() => ({ settings, loaded, set }), [settings, loaded, set]);
  return <SettingsCtx.Provider value={value}>{children}</SettingsCtx.Provider>;
}

export const useSettings = () => useContext(SettingsCtx);

// Unit helpers. Inputs are metric (km/h, °C), as the car reports them.
export const KMH_PER_MPH = 1.609344;

export function speedIn(kmh: number, unit: Settings['speed']): number {
  return unit === 'mph' ? kmh / KMH_PER_MPH : kmh;
}

export function tempIn(c: number, unit: Settings['temp']): number {
  return unit === '°F' ? (c * 9) / 5 + 32 : c;
}

// Converts a value with a metric unit to the owner's units; other units pass through.
export function toUserUnits(value: number, unit: string, s: Pick<Settings, 'speed' | 'temp'>): { value: number; unit: string } {
  if (unit === 'km/h') return { value: speedIn(value, s.speed), unit: s.speed };
  if (unit === '°C') return { value: tempIn(value, s.temp), unit: s.temp };
  if (unit === 'km' && s.speed === 'mph') return { value: value / KMH_PER_MPH, unit: 'mi' };
  return { value, unit };
}
