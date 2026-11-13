// Sensor search in the words an owner uses: "gearbox oil temp" finds
// "Automatic transmission fluid temperature", "boost" finds charge pressure.
// Every word typed must match the name, the module name or a synonym, in any
// order. Results and category lists put the values people check most first.
import type { SensorRow } from './sensors';

// Each group is a set of words that mean the same thing for searching.
const SYNONYMS: string[][] = [
  ['gearbox', 'transmission', 'trans', 'atf', 'dsg', 'tiptronic', 'multitronic', 'cvt', 'gear'],
  ['oil', 'fluid', 'lubricant', 'atf'],
  ['temp', 'temperature', 'temperatures', 'heat'],
  ['boost', 'charge', 'turbo', 'turbocharger', 'supercharger', 'manifold', 'map'],
  ['pressure', 'press', 'psi', 'bar'],
  ['dpf', 'particulate', 'soot', 'ash', 'regeneration', 'regen', 'gpf'],
  ['egr', 'exhaust gas recirculation'],
  ['egt', 'exhaust'],
  ['coolant', 'water', 'antifreeze'],
  ['battery', 'voltage', 'volts', 'charging', 'alternator', 'generator'],
  ['speed', 'velocity', 'mph', 'kmh'],
  ['rpm', 'revs', 'engine speed'],
  ['fuel', 'diesel', 'petrol', 'injection', 'injector', 'rail'],
  ['odometer', 'mileage', 'miles', 'distance', 'km'],
  ['tyre', 'tyres', 'tire', 'tires', 'wheel'],
  ['brake', 'brakes', 'braking', 'pad', 'pads'],
  ['steering', 'steer', 'wheel angle'],
  ['air', 'intake', 'maf', 'airflow', 'mass air'],
  ['adblue', 'urea', 'def', 'scr', 'nox'],
  ['clutch', 'clutches'],
  ['ambient', 'outside', 'outdoor'],
  ['cabin', 'interior', 'inside'],
  ['throttle', 'pedal', 'accelerator'],
  ['lambda', 'o2', 'oxygen'],
  ['knock', 'ignition', 'timing'],
  ['service', 'inspection', 'interval'],
  ['crash', 'airbag', 'collision'],
];

const SYN = new Map<string, string[]>();
for (const g of SYNONYMS) for (const w of g) SYN.set(w, [...new Set([...(SYN.get(w) ?? []), ...g])]);

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

// Values people check most, ranked first in a list.
const USEFUL: [RegExp, number][] = [
  [/\b(oil|fluid|atf)\b.*\btemp/, 10],
  [/\btemp/, 6],
  [/\b(soot|ash|regeneration|regen)\b/, 8],
  [/\b(boost|charge (air )?pressure|manifold)\b/, 7],
  [/\b(selected|current|actual|engaged) gear\b|\bgear\b/, 6],
  [/\b(odometer|mileage|distance)\b/, 5],
  [/\b(voltage|battery)\b/, 5],
  [/\bpressure\b/, 4],
  [/\b(speed|rpm)\b/, 4],
  [/\b(level|quantity)\b/, 3],
  [/\b(raw|adaptation|characteristic|statistics|counter|quantity|histogram|time in range)\b/, -5],
];

export function usefulness(r: SensorRow): number {
  const n = norm(r.n);
  let score = 0;
  for (const [re, w] of USEFUL) if (re.test(n)) score += w;
  return score - n.length / 40;
}

export function byUsefulness(list: SensorRow[]): SensorRow[] {
  return list.map((r) => [usefulness(r), r] as const).sort((a, b) => b[0] - a[0]).map(([, r]) => r);
}

// Score a row for a query; 0 means no match.
export function matchScore(r: SensorRow, query: string, moduleName = ''): number {
  const words = norm(query).split(' ').filter(Boolean);
  if (!words.length) return 0;
  const name = ` ${norm(r.n)} `;
  const mod = ` ${norm(moduleName)} `;
  let score = 0;
  for (const w of words) {
    const alts = SYN.get(w) ?? [w];
    let best = 0;
    for (const a of alts) {
      const exact = a === w;
      if (name.includes(` ${a} `)) best = Math.max(best, exact ? 4 : 3);
      else if (name.includes(` ${a}`)) best = Math.max(best, exact ? 3 : 2);
      else if (name.includes(a) && a.length > 2) best = Math.max(best, 1);
      else if (mod.includes(` ${a}`)) best = Math.max(best, exact ? 2 : 1.5);
    }
    if (!best) return 0;
    score += best;
  }
  return score + usefulness(r) / 20;
}

export function searchSensors(list: SensorRow[], query: string, moduleName: (r: SensorRow) => string): SensorRow[] {
  return list
    .map((r) => [matchScore(r, query, moduleName(r)), r] as const)
    .filter(([s]) => s > 0)
    .sort((a, b) => b[0] - a[0])
    .map(([, r]) => r);
}

// The first values Live data shows before the owner pins any: the headline
// reading of each main system, in plain units.
const SUGGEST: { re: RegExp; units: string[] }[] = [
  { re: /\b(transmission|gearbox|atf)\b.*\b(fluid|oil)\b.*\btemp|\b(fluid|oil)\b.*\b(transmission|gearbox)\b.*\btemp/i, units: ['°C', ''] },
  { re: /^(engine )?oil temp(erature)?( \d)?$/i, units: ['°C', ''] },
  { re: /\bsoot\b.*\b(mass|load|loading|quantity)\b|\b(mass|load) of soot\b/i, units: ['g', '%', 'g/l'] },
  { re: /\b(charge|boost) pressure\b.*\bactual\b|^(charge|boost) pressure$/i, units: ['kPa', 'bar', 'hPa', 'mbar'] },
  { re: /\bcoolant temp(erature)?\b/i, units: ['°C'] },
  { re: /\bbattery voltage\b/i, units: ['V'] },
];

export function suggestedSensors(list: SensorRow[], unit: (r: SensorRow) => string, max = 4, fuel?: 'Petrol' | 'Diesel' | null): SensorRow[] {
  const out: SensorRow[] = [];
  // A value for the other fuel (a petrol particulate filter on a diesel) comes from a related model's list.
  const wrongFuel = fuel === 'Diesel' ? /\b(petrol|gasoline|spark)\b/i : fuel === 'Petrol' ? /\b(diesel|glow|adblue|urea)\b/i : null;
  for (const s of SUGGEST) {
    const hit = byUsefulness(list.filter((r) => s.re.test(r.n) && s.units.includes(unit(r)) && !/\b(raw|specified|control|voltage of|statistics|max(imum)?|min(imum)?)\b/i.test(r.n) && !(wrongFuel && wrongFuel.test(r.n))))[0];
    if (hit && !out.includes(hit)) out.push(hit);
    if (out.length >= max) break;
  }
  return out;
}
