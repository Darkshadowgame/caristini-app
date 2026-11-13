// Parts list: Claude searches the web for the maker part numbers of the usual
// service parts for this exact car (VIN, engine code, engine computer part
// number), and the engine and gearbox codes when a source ties them to it.
// Every number must come with the page it was found on; anything without a
// source is dropped. The list is a starting point to check against a
// catalogue by VIN, and the screen says so.
import type { CodeKey, IdValue, ModuleId, PartItem } from '../vehicle/ids';
import { callClaude, ChatTurn, textOf } from './claude';

const SYSTEM =
  'You research replacement parts for a personal car app. Use web search. Report only part numbers that a public page states for this car, with that page’s URL. ' +
  'Prefer the maker’s own (OEM) numbers. Never guess or complete a number. If sources disagree, give each with its own source. British English.';

const GROUPS = 'Service|Brakes|Engine|Electrical|Wipers and lights|Fluids';

function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenced ? fenced[1] : text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1);
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

type Raw = { name?: string; group?: string; oem?: string; notes?: string; source?: string; url?: string };
type RawCode = { value?: string; source?: string; url?: string };

export async function researchParts(
  car: { title: string; year: number | null; fuel: string | null; vin: string; platform: string | null },
  known: { engineCode?: string; gearboxCode?: string; modules: ModuleId[] },
): Promise<{ items: PartItem[]; codes: Partial<Record<CodeKey, IdValue>>; basis: string }> {
  const engine = known.modules.find((m) => m.id === 'engine');
  const gearbox = known.modules.find((m) => m.id === 'gearbox');
  const basis = [
    `${car.title}, ${car.year ?? 'year unknown'}, ${car.fuel ?? 'fuel unknown'}, platform ${car.platform ?? 'unknown'}`,
    `VIN ${car.vin}`,
    known.engineCode ? `engine code ${known.engineCode}` : null,
    known.gearboxCode ? `gearbox code ${known.gearboxCode}` : null,
    engine?.part ? `engine computer part number ${engine.part}` : null,
    gearbox?.part ? `gearbox computer part number ${gearbox.part}` : null,
  ]
    .filter(Boolean)
    .join('; ');
  const prompt = [
    `Car: ${basis}.`,
    'Find the maker (OEM) part numbers for this exact car for: oil filter, air filter, cabin (pollen) filter, fuel filter, spark plugs or glow plugs, front and rear brake pads, front and rear brake discs, wiper blades, auxiliary drive belt, timing belt or chain kit, water pump, battery (size and type), engine oil specification and capacity, coolant specification.',
    known.engineCode ? '' : 'Also find the engine code if a source ties it to this VIN, engine computer part number or model and power.',
    known.gearboxCode ? '' : 'Also find the gearbox code the same way.',
    'Answer with one JSON object only, in a ```json block:',
    `{"engineCode": {"value": "", "source": "", "url": ""}, "gearboxCode": {"value": "", "source": "", "url": ""}, "parts": [{"name": "Oil filter", "group": "${GROUPS}", "oem": "the part number exactly as the source gives it, or the specification for fluids", "notes": "fitment notes, e.g. from chassis number or for 17 inch wheels", "source": "site name", "url": "https://..."}]}`,
    'Leave a field empty when no source gives it. Do not include a part without a source URL.',
  ]
    .filter(Boolean)
    .join('\n');

  let messages: ChatTurn[] = [{ role: 'user', content: prompt }];
  let text = '';
  for (let turn = 0; turn < 5; turn++) {
    const res = await callClaude(
      { max_tokens: 12000, output_config: { effort: 'medium' }, system: SYSTEM, tools: [{ type: 'web_search_20260209', name: 'web_search', max_uses: 10 }], messages },
      240_000,
    );
    text += `\n${textOf(res)}`;
    if (res.stop_reason !== 'pause_turn') break;
    messages = [...messages, { role: 'assistant', content: res.content }];
  }
  const data = (extractJson(text) ?? {}) as { engineCode?: RawCode; gearboxCode?: RawCode; parts?: Raw[] };
  const sourced = (u?: string) => /^https?:\/\/\S+$/.test(u ?? '');
  const items: PartItem[] = (data.parts ?? [])
    .filter((p) => p.name && p.oem && sourced(p.url))
    .map((p) => ({
      name: p.name!.slice(0, 60),
      group: GROUPS.split('|').includes(p.group ?? '') ? p.group! : 'Service',
      oem: p.oem!.slice(0, 80),
      notes: p.notes?.slice(0, 160) || undefined,
      source: { label: p.source || new URL(p.url!).hostname, url: p.url! },
    }));
  const codes: Partial<Record<CodeKey, IdValue>> = {};
  for (const k of ['engineCode', 'gearboxCode'] as const) {
    const c = data[k];
    if (c?.value && /^[A-Z0-9]{2,6}$/i.test(c.value.trim()) && sourced(c.url)) codes[k] = { value: c.value.trim().toUpperCase(), from: 'ai', source: { label: c.source || new URL(c.url!).hostname, url: c.url! } };
  }
  return { items, codes, basis };
}
