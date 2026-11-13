// Sensors other cars of the same family answered, so a new car is asked those
// first in a quick check (modules and value IDs repeat across models of one
// maker family; see sameFamily). Sources: the owner's other saved cars, and
// sensors built in from findings any car sent back (src/data/seenSensors.ts).
// A sensor from another car is still asked on this car before it is shown.
import { SEEN_SENSORS } from '../data/seenSensors';
import type { Vehicle } from '../vehicle/garage';
import { readKey, sameFamily, SensorRow } from './sensors';

type Car = Pick<Vehicle, 'vin' | 'group' | 'brand'>;

export function sharedSensorKeys(v: Car, others: (Car & Pick<Vehicle, 'sensorsFound'>)[]): Set<string> {
  const keys = new Set<string>();
  for (const o of others) if (o.vin !== v.vin && sameFamily(o, v)) for (const k of o.sensorsFound ?? []) keys.add(k);
  for (const s of SEEN_SENSORS) if (sameFamily({ group: s.group as Vehicle['group'], brand: s.brand ?? undefined }, v)) for (const k of s.keys) keys.add(k);
  return keys;
}

// Rows for the quick check: shared with other cars, not yet asked on this one.
export function quickRows(all: SensorRow[], shared: Set<string>, asked: Set<string>): SensorRow[] {
  return all.filter((r) => !r.ai && shared.has(readKey(r)) && !asked.has(readKey(r)));
}

// Rows a full search still has to ask on this car.
export function remainingRows(all: SensorRow[], asked: Set<string>): SensorRow[] {
  return all.filter((r) => !r.ai && !asked.has(readKey(r)));
}
