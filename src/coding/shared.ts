// Settings one car learned (Learn from Carista), offered on the owner's other
// cars when the same module is fitted. Always unconfirmed on the new car: they
// go through Try mode (backup, write, read back, ask, restore) before they
// are kept. Rules, strictest first:
// - same maker family (VW group; Ford with Mazda; otherwise the same make);
// - coding only (no adaptation values), in a comfort or display module on the
//   allow-list: never the gateway, engine, gearbox, brakes, steering or airbags;
// - the module's part number matches: tier 1 the whole number, tier 2 (VW
//   group, same platform) its first 9 characters, the part without its revision;
// - the coding has the same length, and the bits the setting uses hold either
//   its "on" or its "off" value on this car now (checked when shown).
import { sameFamily } from '../obd/sensors';
import type { Vehicle } from '../vehicle/garage';
import type { LearnedPart, LearnedSetting } from './learn';

export const SHAREABLE_MODULES = new Set(['vag-08', 'vag-09', 'vag-10', 'vag-17', 'vag-36', 'vag-42', 'vag-46', 'vag-52']);

const clean = (p: string | null | undefined) => (p ?? '').replace(/[\s-]/g, '').toUpperCase();

// The part number last read for a module on a car, from any place it is saved.
export function modulePart(v: Pick<Vehicle, 'ids' | 'knowledge' | 'deepFound'>, moduleId: string): string {
  return clean(v.ids?.modules?.find((m) => m.id === moduleId)?.part ?? v.knowledge?.[moduleId]?.part ?? v.deepFound?.find((d) => d.moduleId === moduleId)?.part);
}

// 1: the same part number. 2: same part, another revision (VW group, same
// platform). 0: not a match.
export function partTier(a: string, b: string, vagSamePlatform: boolean): 0 | 1 | 2 {
  const x = clean(a);
  const y = clean(b);
  if (!x || !y) return 0;
  if (x === y) return 1;
  return vagSamePlatform && x.length >= 9 && x.slice(0, 9) === y.slice(0, 9) ? 2 : 0;
}

export const settingKey = (s: Pick<LearnedSetting, 'parts'>) =>
  s.parts
    .map((p) => `${p.module}:${p.did ?? ''}/${p.length}/${p.byte}/${p.mask}/${p.on}/${p.off}`)
    .sort()
    .join('|');

export interface SharedSetting extends LearnedSetting {
  // Where it was learned, and how closely the module matches.
  from: string;
  tier: 1 | 2;
}

export function sharedLearned(v: Vehicle, others: Vehicle[]): SharedSetting[] {
  const mine = new Set((v.learned ?? []).map(settingKey));
  const out: SharedSetting[] = [];
  for (const o of others) {
    if (o.vin === v.vin || !sameFamily(o, v)) continue;
    const vagSame = v.group === 'vag' && o.group === 'vag' && !!v.platform && v.platform === o.platform;
    for (const s of o.learned ?? []) {
      const key = settingKey(s);
      if (mine.has(key) || out.some((x) => settingKey(x) === key)) continue;
      let tier: 1 | 2 = 1;
      const ok = s.parts.every((p: LearnedPart) => {
        if (p.did || !SHAREABLE_MODULES.has(p.module)) return false;
        const t = partTier(p.part ?? modulePart(o, p.module), modulePart(v, p.module), vagSame);
        if (t === 2) tier = 2;
        return t !== 0;
      });
      if (ok) out.push({ ...s, id: `shared-${s.id}`, from: o.nickname || [o.brand, o.model].filter(Boolean).join(' '), tier });
    }
  }
  return out;
}

// Shown only when every bit the setting uses holds its on or off value now.
export function sharedFits(s: LearnedSetting, values: Record<string, number[] | null>): boolean {
  return s.parts.every((p) => {
    const c = values[p.module];
    return !!c && c.length === p.length && ((c[p.byte] & p.mask) === p.on || (c[p.byte] & p.mask) === p.off);
  });
}
