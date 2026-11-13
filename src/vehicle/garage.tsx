import type { CodingItem } from '../coding/items';
import type { SensorRow } from '../obd/sensors';
// Saved vehicles, keyed by VIN, kept on the phone with AsyncStorage.
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { LearnedSetting, Snapshot } from '../coding/learn';
import type { ServiceReset } from '../service/obdReset';
import type { CarIds, PartsList } from './ids';
import type { Route } from '../obd/modules';
import { decodeVin, MakeGroup } from './vin';

export interface Vehicle {
  vin: string;
  group: MakeGroup;
  brand: string;
  model: string;
  platform: string | null;
  year: number | null;
  fuel: 'Petrol' | 'Diesel' | null;
  nickname: string;
  edited: boolean;
  lastSeen: number;
  lastMilOn: boolean;
  lastCodes: string[];
  // When the last full health check finished (ms); absent until one has run.
  lastCheckedAt?: number;
  // Last odometer reading from the car (km) and when it was read.
  odometerKm?: number;
  odometerAt?: number;
  // Service reminder: interval and the last service.
  service?: { everyKm: number; everyMonths: number; lastKm?: number; lastDate?: string };
  // Try mode results per setting id on this car.
  tried?: Record<string, TryResult>;
  // Module coding read from the car (read-only), kept as a backup.
  codingBackup?: { date: string; modules: { module: string; part: string | null; coding: string | null }[] };
  // Coding (hex) each module had before Caristini first changed it, by module id.
  codingOriginal?: Record<string, string>;
  // Learn from Carista: settings saved before the owner changed one elsewhere.
  // deep: module whose data identifiers 0000 to 0FFF were also saved.
  learnSnapshot?: { date: string; codings: Snapshot; deep?: string };
  // Switches learned from the owner's own car.
  learned?: LearnedSetting[];
  // Parts and IDs (src/vehicle/ids.ts): module identities, codes from the
  // data label, and a researched parts list, readable without the car.
  ids?: CarIds;
  partsList?: PartsList;
  // Service resets over OBD learned on this car (src/service/obdReset.ts).
  serviceResets?: ServiceReset[];
  // Instrument cluster values saved before another tool's service reset.
  serviceSnapshot?: { date: string; module: string; values: Record<string, string> };
  // Sensor finder: maker sensor reads (header-identifier) this car answers.
  sensorsFound?: string[];
  // Module ids that answered a fault scan, so the next scan asks them first.
  modulesSeen?: string[];
  // How each module answered last time (protocol and address), tried first next time.
  routes?: Record<string, Route>;
  // Complete health checks that asked every address, and when the last one ran.
  // After 2, a check asks only the modules the car has; every address is asked
  // again after 30 days or on request.
  fullChecks?: number;
  fullCheckAt?: number;
  // Last coding read per module key (hex), so Customise opens at once.
  codingCache?: Record<string, string>;
  // Standard live values chosen on Live data.
  liveWatch?: number[];
  // quick: only the sensors other cars of the same make answered were asked.
  sensorScan?: { at: number; asked: number; complete: boolean; quick?: boolean };
  // Every sensor value asked on this car (answered or not), so a later search
  // asks only what has not been asked yet.
  sensorsAsked?: string[];
  // Sensors pinned to the top of Live data, by sensor id.
  pinnedSensors?: string[];
  // Photo of the car chosen by the owner (local file URI).
  photo?: string;
  // Learn my car: what each module is (from its identification and AI research),
  // and settings the AI found on the web (unconfirmed, offered through Try mode).
  knowledge?: Record<string, { plainName: string; what: string; notes?: string; part?: string | null; at: number }>;
  aiItems?: CodingItem[];
  // Values found on this car that no list knew, named and decoded by the AI.
  aiSensors?: SensorRow[];
  learnRun?: { at: number; modules: number; sensors: number; researched: number };
  // The car does not report its VIN over the standard OBD request; it came from
  // its modules or the owner, so a later connect without one can pick this car.
  noObdVin?: boolean;
  // Older-protocol modules the deep scan reached, with what they said they are.
  deepFound?: { address: number; moduleId: string; part?: string | null; component?: string | null; faults: number; at: number }[];
}

// Saved under this key when neither the car nor the owner has given a VIN.
export const NO_VIN = 'NO-VIN-REPORTED';

export type TryResult = 'works' | 'refused' | 'no-effect';

const KEY = 'gauge.garage.v1';

interface Garage {
  vehicles: Vehicle[];
  loaded: boolean;
  upsertFromScan(vin: string | null, diesel: boolean, milOn: boolean): Promise<Vehicle>;
  update(vin: string, patch: Partial<Vehicle>): Promise<void>;
  remove(vin: string): Promise<void>;
  get(vin: string | null | undefined): Vehicle | undefined;
  // The newest saved copy, including updates not drawn yet (for long async flows).
  latest(vin: string): Vehicle | undefined;
}

const Ctx = createContext<Garage | null>(null);

export function vehicleTitle(v: Pick<Vehicle, 'brand' | 'model' | 'year' | 'nickname'>): string {
  if (v.nickname) return v.nickname;
  return [v.brand, v.model].filter(Boolean).join(' ') || 'Unknown vehicle';
}

export function GarageProvider({ children }: { children: React.ReactNode }) {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loaded, setLoaded] = useState(false);
  // Every update builds on the newest list, not the one a screen last drew, so
  // two quick updates in one flow cannot undo each other.
  const current = useRef<Vehicle[]>([]);

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((raw) => {
        current.current = raw ? (JSON.parse(raw) as Vehicle[]) : [];
        setVehicles(current.current);
      })
      .catch(() => setVehicles([]))
      .finally(() => setLoaded(true));
  }, []);

  const save = useCallback(async (next: Vehicle[]) => {
    current.current = next;
    setVehicles(next);
    try {
      await AsyncStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      // Storage can fail in private browser windows; the app still works this session.
    }
  }, []);

  const value = useMemo<Garage>(
    () => ({
      vehicles,
      loaded,
      get: (vin) => vehicles.find((v) => v.vin === vin),
      latest: (vin) => current.current.find((v) => v.vin === vin),
      upsertFromScan: async (vinRaw, diesel, milOn) => {
        const vin = vinRaw ?? NO_VIN;
        const existing = current.current.find((v) => v.vin === vin);
        const d = decodeVin(vin);
        const fresh: Vehicle = existing
          ? { ...existing, lastSeen: Date.now(), lastMilOn: milOn, fuel: existing.edited ? existing.fuel : diesel ? 'Diesel' : 'Petrol' }
          : {
              vin,
              group: d.group,
              brand: d.brand ?? 'Unknown make',
              model: d.model ?? '',
              platform: d.platform,
              year: d.yearReliable ? d.year : null,
              fuel: diesel ? 'Diesel' : 'Petrol',
              nickname: '',
              edited: false,
              lastSeen: Date.now(),
              lastMilOn: milOn,
              lastCodes: [],
            };
        await save([fresh, ...current.current.filter((v) => v.vin !== vin)]);
        return fresh;
      },
      update: async (vin, patch) => {
        await save(current.current.map((v) => (v.vin === vin ? { ...v, ...patch } : v)));
      },
      remove: async (vin) => {
        await save(current.current.filter((v) => v.vin !== vin));
      },
    }),
    [vehicles, loaded, save],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useGarage(): Garage {
  const c = useContext(Ctx);
  if (!c) throw new Error('useGarage must be used inside GarageProvider');
  return c;
}
