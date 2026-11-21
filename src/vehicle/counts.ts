// One count of a car's sensors and modules, and one way to say them, for
// Learn my car, the Car tab, History, Research notes, Live data and Find my
// car's sensors. Pure, so it is tested without a phone.
import { readKey, sensorsForCar } from '../obd/sensors';
import type { ModuleGroup } from '../obd/modules';

type CarLike = {
  group: ModuleGroup | 'other';
  brand?: string;
  platform?: string | null;
  sensorsFound?: string[];
  groupsFound?: Record<string, Record<string, string[]>>;
  ids?: { modules?: { id: string }[] };
  knowledge?: Record<string, unknown>;
};

export interface SensorCount {
  // Maker sensors from the car's list that answered.
  maker: number;
  // Older VW modules: values in numbered value groups, and those groups.
  groupValues: number;
  groups: number;
}

export function sensorCount(v: CarLike | null | undefined): SensorCount {
  if (!v) return { maker: 0, groupValues: 0, groups: 0 };
  const found = new Set(v.sensorsFound ?? []);
  const maker = found.size ? sensorsForCar(v).filter((r) => found.has(readKey(r))).length : 0;
  let groupValues = 0;
  let groups = 0;
  for (const mod of Object.values(v.groupsFound ?? {})) {
    for (const units of Object.values(mod)) {
      if (!units.length) continue;
      groups++;
      groupValues += units.length;
    }
  }
  return { maker, groupValues, groups };
}

const plural = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString('en-GB')} ${n === 1 ? one : many}`;

// "4 values in 1 value group": the older VW modules' share.
export const groupValuesText = (c: Pick<SensorCount, 'groupValues' | 'groups'>) => `${plural(c.groupValues, 'value')} in ${plural(c.groups, 'value group')}`;

// "88 sensors", "4 values in 1 value group", "88 sensors and 4 values in 1
// value group", or "No sensors found yet".
export function sensorCountText(c: SensorCount): string {
  const parts = [c.maker ? plural(c.maker, 'sensor') : null, c.groupValues ? groupValuesText(c) : null].filter(Boolean);
  return parts.length ? parts.join(' and ') : 'No sensors found yet';
}

// The same count for a tile's one status line, where the full sentence does
// not fit: "88 sensors", "4 values, 1 group", "88 sensors, 4 values".
export function sensorCountShort(c: SensorCount): string {
  if (c.maker) return c.groupValues ? `${plural(c.maker, 'sensor')}, ${plural(c.groupValues, 'value')}` : plural(c.maker, 'sensor');
  return c.groupValues ? `${plural(c.groupValues, 'value')}, ${plural(c.groups, 'group')}` : 'No sensors found yet';
}

// Modules Pin16 has identified on this car (part number or name read).
export function moduleCount(v: CarLike | null | undefined): number {
  if (!v) return 0;
  return new Set([...(v.ids?.modules ?? []).map((m) => m.id), ...Object.keys(v.knowledge ?? {})]).size;
}

export const modulesText = (n: number) => plural(n, 'module');
