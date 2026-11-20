// One setting change with every safety step, used by Customise: read the module's coding now, keep the first coding ever seen as
// the original, write, read back (the client puts the original back when the
// module does not keep the change), and log it.
import { addDiary, SETTING_CHANGED, today } from '../diary';
import { addHistory } from '../history';
import { ElmClient } from '../obd/elm';
import { toHex } from '../obd/uds';
import { cacheAfterWrite } from '../diag/timeline';
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
  if (before.length <= item.byte) return { ok: false, text: `${def.name} coding is too short on this car to hold this setting, so it was not changed.` };
  if (isOn(item, before) === on) return { ok: true, text: `${item.title} is already ${on ? 'on' : 'off'}.` };
  const saved = latest()?.codingOriginal ?? {};
  if (!saved[def.id]) await update({ codingOriginal: { ...saved, [def.id]: toHex(before) } });
  const after = withItem(item, before, on);
  const res = await client.writeCoding(def, before, after, item.login);
  // The saved coding follows the write, so Put back decides from what the module holds now.
  if (res.coding) await update({ codingCache: cacheAfterWrite(latest()?.codingCache, [{ key: def.id, hex: toHex(res.coding) }]) });
  if (!res.ok) {
    return { ok: false, text: res.restored ? `${def.name} did not keep the change, so the original coding was put back. Nothing changed.` : `${def.name} did not keep the change and the original could not be confirmed. Tap Put back under Backups in Customise.` };
  }
  const what = `${item.title} ${on ? 'on' : 'off'}`;
  await addDiary({ vin: v.vin, vehicleName: vehicleTitle(v), date: today(), kind: SETTING_CHANGED, mileage: null, notes: `Changed: ${what}. Put it back in Customise, then Backups.` });
  const backup = saved[def.id] ?? toHex(before);
  await addHistory({
    vin: v.vin,
    kind: 'change',
    title: what.charAt(0).toUpperCase() + what.slice(1),
    detail: def.name,
    before: toHex(before),
    after: toHex(after),
    odometerKm: v.odometerKm,
    changes: [{ module: def.name, key: def.id, setting: item.title, from: on ? 'Off' : 'On', to: on ? 'On' : 'Off', before: toHex(before), after: toHex(after), backup, source: 'Customise' }],
  });
  return { ok: true, text: `${what}. Switch the ignition off and on to see it.` };
}
