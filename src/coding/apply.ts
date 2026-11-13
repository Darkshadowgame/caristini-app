// One setting change with every safety step, shared by Customise and the AI
// assistant: read the module's coding now, keep the first coding ever seen as
// the original, write, read back (the client puts the original back when the
// module does not keep the change), and log it.
import { addDiary, today } from '../diary';
import { addHistory } from '../history';
import { ElmClient } from '../obd/elm';
import { toHex } from '../obd/uds';
import { Vehicle, vehicleTitle } from '../vehicle/garage';
import { CodingItem, isOn, withItem } from './items';

export type ApplyResult = { ok: boolean; text: string };

export async function applySetting(
  client: ElmClient,
  v: Vehicle,
  update: (patch: Partial<Vehicle>) => Promise<void>,
  item: CodingItem,
  on: boolean,
  latest: () => Vehicle | undefined = () => v,
): Promise<ApplyResult> {
  const def = client.moduleById(item.module);
  if (!def) return { ok: false, text: 'That module is not on this car.' };
  const before = await client.readCoding(def);
  if (!before) return { ok: false, text: `${def.name} did not give its coding.` };
  if (client.codingStyle(def) === 'short') return { ok: false, text: `${def.name} uses the old 3-digit short coding, which this setting does not fit. Nothing was changed.` };
  if (item.length ? before.length !== item.length : before.length <= item.byte) return { ok: false, text: `${def.name} coding has a different layout on this car, so it was not changed.` };
  if (isOn(item, before) === on) return { ok: true, text: `${item.title} is already ${on ? 'on' : 'off'}.` };
  const saved = latest()?.codingOriginal ?? {};
  if (!saved[def.id]) await update({ codingOriginal: { ...saved, [def.id]: toHex(before) } });
  const after = withItem(item, before, on);
  const res = await client.writeCoding(def, before, after, item.login);
  if (!res.ok) {
    return { ok: false, text: res.restored ? `${def.name} did not keep the change, so the original coding was put back. Nothing changed.` : `${def.name} did not keep the change and the original could not be confirmed; restore it in Customise.` };
  }
  const what = `${item.title} ${on ? 'on' : 'off'}`;
  await addDiary({ vin: v.vin, vehicleName: vehicleTitle(v), date: today(), kind: 'Other', mileage: null, notes: `Changed: ${what}. Undo it in Customise > Backups.` });
  await addHistory({ vin: v.vin, kind: 'change', title: what.charAt(0).toUpperCase() + what.slice(1), detail: def.name, before: toHex(before), after: toHex(after), odometerKm: v.odometerKm });
  return { ok: true, text: `${what}. Switch the ignition off and on to see it.` };
}
