import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useSettings } from './settings';
import { trafficLog } from './obd/trafficLog';
import { sendLogNow, setAutoSendLog } from './share/sendLog';
import { BleTransport } from './obd/bleTransport';
import { ElmClient, VehicleInfo } from './obd/elm';
import { DEMO_CARS, SimTransport } from './obd/simTransport';
import { Transport } from './obd/transport';
import { inferredFromParts, NO_VIN, useGarage, Vehicle } from './vehicle/garage';

type Status = 'idle' | 'connecting' | 'connected' | 'error';
// Where this connection's VIN came from: the standard OBD request, the car's
// modules, the car picked last time this car gave none, the owner, or nowhere.
export type VinSource = 'car' | 'modules' | 'remembered' | 'owner' | 'unknown';

interface Connection {
  status: Status;
  step: string;
  error: string | null;
  client: ElmClient | null;
  info: VehicleInfo | null;
  vehicle: Vehicle | null;
  vinSource: VinSource | null;
  // The owner says which car this is when the car gave no VIN.
  assignVin(vin: string): Promise<void>;
  connectDemo(carId: string): Promise<boolean>;
  connectBluetooth(id: string, name: string): Promise<boolean>;
  // The adapter used last time, for auto-connect.
  lastAdapter: { id: string; name: string } | null;
  disconnect(): Promise<void>;
  refreshStatus(): Promise<void>;
}

const Ctx = createContext<Connection | null>(null);
const LAST_ADAPTER = 'caristini.lastAdapter.v1';

export function ConnectionProvider({ children }: { children: React.ReactNode }) {
  const garage = useGarage();
  const [status, setStatus] = useState<Status>('idle');
  const [step, setStep] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [client, setClient] = useState<ElmClient | null>(null);
  const [info, setInfo] = useState<VehicleInfo | null>(null);
  const [vin, setVin] = useState<string | null>(null);
  const [vinSource, setVinSource] = useState<VinSource | null>(null);
  const clientRef = useRef<ElmClient | null>(null);
  // Each connect attempt gets a token; a disconnect or newer attempt invalidates it.
  const attemptRef = useRef(0);
  const busyRef = useRef(false);
  const { settings, loaded } = useSettings();
  const [lastAdapter, setLastAdapter] = useState<{ id: string; name: string } | null>(null);
  useEffect(() => {
    AsyncStorage.getItem(LAST_ADAPTER)
      .then((raw) => raw && setLastAdapter(JSON.parse(raw)))
      .catch(() => undefined);
  }, []);
  useEffect(() => trafficLog.setEnabled(settings.debugLog), [settings.debugLog]);
  useEffect(() => setAutoSendLog(settings.autoSendLog !== false), [settings.autoSendLog]);

  const dropClient = useCallback(() => {
    clientRef.current = null;
    setClient(null);
    setInfo(null);
    setVin(null);
    setVinSource(null);
  }, []);

  const start = useCallback(
    async (open: () => Promise<Transport>): Promise<boolean> => {
      if (busyRef.current) return false; // a double tap: one attempt at a time
      busyRef.current = true;
      const token = ++attemptRef.current;
      await clientRef.current?.close().catch(() => undefined);
      dropClient();
      setStatus('connecting');
      setError(null);
      let transport: Transport | null = null;
      try {
        setStep('Connecting to the adapter');
        transport = await open();
        if (token !== attemptRef.current) throw new Error('Cancelled.');
        const c = new ElmClient(transport);
        setStep('Identifying your car');
        const result = await c.initialise();
        if (token !== attemptRef.current) throw new Error('Cancelled.');
        let source: VinSource = result.vin ? 'car' : 'unknown';
        let carVin = result.vin;
        if (!carVin) {
          // A car that gave no VIN before is used at once (the owner can change
          // it on the Car tab): asking the modules again takes 30 to 60 commands.
          const known = garage.vehicles.filter((v) => v.noObdVin).sort((a, b) => b.lastSeen - a.lastSeen)[0];
          if (known) {
            carVin = known.vin;
            source = 'remembered';
          }
        }
        if (!carVin) {
          setStep('Reading the VIN from the engine and dashboard');
          carVin = await c.readVinFromModules().catch(() => null);
          if (token !== attemptRef.current) throw new Error('Cancelled.');
          if (carVin) source = 'modules';
        }
        let saved = await garage.upsertFromScan(carVin, result.diesel, result.milOn);
        const fill = inferredFromParts(saved);
        if (fill) {
          await garage.update(saved.vin, fill);
          saved = { ...saved, ...fill };
        }
        if (source === 'modules' && !saved.noObdVin) await garage.update(saved.vin, { noObdVin: true });
        c.setMake(makeOf(saved), saved.platform);
        c.rememberDeep(saved.deepFound);
        c.rememberRoutes(saved.routes);
        c.rememberModules(saved.modulesSeen);
        transport.onLost = (reason) => {
          if (clientRef.current !== c) return;
          dropClient();
          setError(`Connection lost: ${reason} Reconnect when the ignition is on.`);
          setStatus('error');
        };
        clientRef.current = c;
        setClient(c);
        setInfo(result);
        setVin(saved.vin);
        setVinSource(source);
        setStatus('connected');
        // How the car was identified, while it is fresh (the Cupra gave no VIN).
        if (source !== 'car') void sendLogNow(`connected, VIN from ${source}`, saved);
        return true;
      } catch (e) {
        await transport?.close().catch(() => undefined);
        if (token === attemptRef.current) {
          dropClient();
          setError(e instanceof Error ? e.message : String(e));
          setStatus('error');
          void sendLogNow(`connect failed: ${e instanceof Error ? e.message : String(e)}`, null);
        }
        return false;
      } finally {
        busyRef.current = false;
        setStep('');
      }
    },
    [garage, dropClient],
  );

  const value = useMemo<Connection>(
    () => ({
      status,
      step,
      error,
      client,
      info,
      vehicle: status === 'connected' ? (garage.get(vin) ?? null) : null,
      vinSource,
      assignVin: async (newVin) => {
        const c = clientRef.current;
        if (!c || !info || newVin === vin) return;
        const placeholder = vin === NO_VIN ? garage.latest(NO_VIN) : undefined;
        const existed = !!garage.latest(newVin);
        let saved = await garage.upsertFromScan(newVin, info.diesel, info.milOn);
        if (placeholder && !existed) {
          // A car first saved without a VIN: what was learned on it (modules,
          // settings, sensors, nickname, checks) moves to the VIN the owner typed.
          // Make, model, platform and year come from the VIN.
          const { vin: _old, group: _g, brand: _b, platform: _p, year: _y, ...learned } = placeholder;
          await garage.update(saved.vin, { ...learned, model: placeholder.edited && placeholder.model ? placeholder.model : saved.model, noObdVin: true });
          await garage.remove(NO_VIN);
          saved = garage.latest(saved.vin) ?? saved;
        } else {
          await garage.update(saved.vin, { noObdVin: true });
          // An empty placeholder is dropped; one with a saved check is kept.
          if (placeholder && placeholder.lastCheckedAt == null) await garage.remove(NO_VIN);
        }
        c.setMake(makeOf(saved), saved.platform);
        c.rememberDeep(saved.deepFound);
        c.rememberRoutes(saved.routes);
        c.rememberModules(saved.modulesSeen);
        setVin(saved.vin);
        setVinSource('owner');
      },
      connectDemo: (carId) => start(async () => new SimTransport(DEMO_CARS.find((c) => c.id === carId) ?? DEMO_CARS[0])),
      connectBluetooth: async (id, name) => {
        const ok = await start(() => BleTransport.connect(id, name));
        if (ok) {
          setLastAdapter({ id, name });
          AsyncStorage.setItem(LAST_ADAPTER, JSON.stringify({ id, name })).catch(() => undefined);
        }
        return ok;
      },
      lastAdapter,
      disconnect: async () => {
        attemptRef.current++; // cancels a connect in progress
        const c = clientRef.current;
        dropClient();
        setStatus('idle');
        await c?.close().catch(() => undefined);
      },
      refreshStatus: async () => {
        const c = clientRef.current;
        if (!c) return;
        const s = await c.readStatus();
        setInfo((v) => (v ? { ...v, ...s } : v));
      },
    }),
    [status, step, error, client, info, vin, vinSource, garage, start, dropClient, lastAdapter],
  );

  const tried = useRef(false);
  useEffect(() => {
    if (tried.current || !loaded || !settings.autoConnect || !lastAdapter || status !== 'idle') return;
    tried.current = true;
    value.connectBluetooth(lastAdapter.id, lastAdapter.name);
  }, [loaded, settings.autoConnect, lastAdapter, status, value]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

function makeOf(v: Vehicle): 'vag' | 'ford' | 'mazda' | 'other' {
  return v.group === 'vag' || v.group === 'ford' || v.group === 'mazda' ? v.group : 'other';
}

export function useConnection(): Connection {
  const c = useContext(Ctx);
  if (!c) throw new Error('useConnection must be used inside ConnectionProvider');
  return c;
}
