// The battery and engine reading taken before a write to the car.
// Nothing here stops or delays a write (the owner's choice, 20 Nov 2026): the
// reading only adds a line to the result, so a change that did not save on a
// weak battery says why. Adapters measure at the OBD pin, often 0.3 to 0.7 V
// under the battery itself.
import { ElmClient } from '../obd/elm';

// Below this a module may not save a change.
export const LOW_VOLTS = 10.5;

// block and warn are kept for the callers that read them; both are always null.
export type Preflight = { block: string | null; warn: string | null; volts: number | null; note: string | null };

export async function preflightCheck(client: ElmClient | null): Promise<Preflight> {
  if (!client) return { block: 'Not connected.', warn: null, volts: null, note: null };
  const volts = await client.batteryVoltage().catch(() => null);
  const note = volts != null && volts < LOW_VOLTS ? `The battery reads ${volts.toFixed(1)} V. If a change does not save, run the engine or connect a charger and try again.` : null;
  return { block: null, warn: null, volts, note };
}

// Older callers: a message only when the write cannot go ahead (not connected).
export async function checkBeforeWrite(client: ElmClient | null): Promise<string | null> {
  return (await preflightCheck(client)).block;
}
