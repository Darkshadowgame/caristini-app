// Checks before every write to the car.
// Only a flat battery stops a write. A low reading or a running engine asks first:
// adapters measure at the OBD pin, often 0.3 to 0.7 V under the battery itself,
// and Carista writes at the same readings.
import { ElmClient } from '../obd/elm';
import { pidInfo } from '../obd/pids';

const RPM = pidInfo(0x0c)!;
// Below this the battery is too flat for a module to save a change safely.
export const BLOCK_VOLTS = 10.5;
// Below this Caristini asks first.
export const WARN_VOLTS = 11.8;

export type Preflight = { block: string | null; warn: string | null; volts: number | null };

export async function preflightCheck(client: ElmClient | null): Promise<Preflight> {
  if (!client) return { block: 'Not connected.', warn: null, volts: null };
  const volts = await client.batteryVoltage();
  if (volts != null && volts < BLOCK_VOLTS)
    return { block: `The battery reads ${volts.toFixed(1)} V, too low to save a change safely. Start the engine for a few minutes or connect a charger, then try again.`, warn: null, volts };
  const warns: string[] = [];
  const rpm = await client.readLive(RPM).catch(() => null);
  if (rpm != null && rpm > 300) warns.push('The engine is running. Most settings save fine like this, but switching the engine off with the ignition on is safest.');
  if (volts != null && volts < WARN_VOLTS) warns.push(`The battery reads ${volts.toFixed(1)} V at the OBD port. One or two changes are fine; for many changes in a row, run the engine or connect a charger.`);
  return { block: null, warn: warns.length ? warns.join(' ') : null, volts };
}

// Older callers: a message only when the write must not go ahead.
export async function checkBeforeWrite(client: ElmClient | null): Promise<string | null> {
  return (await preflightCheck(client)).block;
}
