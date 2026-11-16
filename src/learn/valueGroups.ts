// Older VW modules (TP2.0) give live values in numbered value groups. Learn
// my car and Unknown values read them the same way and keep them in the same
// place on the car (groupsFound, groupsResume, groupsScanned), so either one
// carries on where the other stopped and both show the same count.
import type { ElmClient, ModuleDef } from '../obd/elm';
import type { Vehicle } from '../vehicle/garage';

interface GarageStore {
  latest(vin: string): Vehicle | undefined;
  update(vin: string, patch: Partial<Vehicle>): Promise<void> | void;
}

// How a module answers on this car: this connection first, then the saved
// route, then the platform (PQ35 modules speak the older protocol only).
export function routeFor(client: Pick<ElmClient, 'routeOf'>, v: Pick<Vehicle, 'routes' | 'platform'>, def: ModuleDef): 'tp20' | 'uds' {
  const r = client.routeOf(def) ?? v.routes?.[def.id]?.via ?? (v.platform === 'PQ35' ? 'tp20' : 'uds');
  return r === 'tp20' ? 'tp20' : 'uds';
}

// Reads one module's value groups: groups with names first, then the engine
// and gearbox from group 1 to 255, other modules until 8 groups in a row are
// empty. A module read to the end is not read again; one cut short carries
// on from where it stopped. Returns a text sample of each group read.
export async function scanValueGroups(
  client: Pick<ElmClient, 'scanMeasuringBlocks'>,
  garage: GarageStore,
  vin: string,
  def: ModuleDef,
  opts: { cancelled?: () => boolean; onProgress?: (p: number) => void } = {},
): Promise<{ complete: boolean; samples: Record<string, string> }> {
  const full = def.id === 'engine' || def.id === 'gearbox';
  const before = garage.latest(vin);
  const mine: Record<string, string[]> = { ...(before?.groupsFound?.[def.id] ?? {}) };
  const samples: Record<string, string> = {};
  const res = await client
    .scanMeasuringBlocks(
      def,
      (g, cells) => {
        mine[String(g)] = cells.map((c) => c.unit);
        samples[String(g)] = cells.map((c) => `${typeof c.value === 'number' ? Math.round(c.value * 100) / 100 : c.value} ${c.unit}`).join(' | ');
      },
      opts.onProgress,
      { fromIndex: before?.groupsResume?.[def.id], to: full ? 255 : 64, stopAfterEmpty: full ? undefined : 8, cancelled: opts.cancelled },
    )
    .catch(() => ({ complete: false, nextIndex: before?.groupsResume?.[def.id] }));
  const now = garage.latest(vin);
  const nextAt = { ...(now?.groupsResume ?? {}) };
  if (res.complete || res.nextIndex == null) delete nextAt[def.id];
  else nextAt[def.id] = res.nextIndex;
  await garage.update(vin, {
    groupsFound: { ...(now?.groupsFound ?? {}), [def.id]: mine },
    groupsScanned: res.complete ? [...new Set([...(now?.groupsScanned ?? []), def.id])] : now?.groupsScanned,
    groupsResume: nextAt,
  });
  return { complete: res.complete, samples };
}
