// Sends the adapter log to the findings repo by itself after a check, a scan,
// Learn my car, Discover or a failed connect, so a problem on the car can be
// looked at without the owner sharing anything. Only lines added since the
// last send go, through the same outbox as findings (kept and sent later when
// there is no signal). Off when the log or this option is switched off.
import { trafficLog } from '../obd/trafficLog';
import { sendBack } from './sendBack';

let auto = true;
export function setAutoSendLog(on: boolean): void {
  auto = on;
}

export async function sendLogNow(reason: string, car: { vin?: string | null; brand?: string; model?: string } | null, force = false): Promise<string | null> {
  if (!force && !auto) return null;
  const fresh = trafficLog.unsentCount();
  if (!fresh) return null;
  const header = `# Caristini adapter log, ${reason}, ${new Date().toISOString()}${car ? `, ${[car.brand, car.model].filter(Boolean).join(' ')} ${car.vin ?? ''}` : ''}`;
  const text = trafficLog.unsentText(header);
  trafficLog.markSent();
  const r = await sendBack('log', car?.vin || 'NO-VIN', { reason, lines: fresh, text }).catch((e) => ({ via: 'none' as const, detail: e instanceof Error ? e.message : String(e) }));
  return r.detail;
}
