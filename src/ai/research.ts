// Learn my car, AI step: for each module the car reported, Claude searches the
// web for that part number and coding and returns what the module does and any
// coding bits owners have published. Suggestions are kept as unconfirmed
// settings: Caristini only ever offers them through Try mode, which reads the
// coding back and puts the original back if nothing changes.
import type { CodingItem } from '../coding/items';
import type { SensorRow } from '../obd/sensors';
import { callClaude, searchErrors, ChatTurn, textOf } from './claude';

export interface ModuleFacts {
  id: string;
  name: string;
  code?: string;
  part?: string | null;
  software?: string | null;
  system?: string | null;
  coding?: string | null; // hex
  route?: string | null;
}

export interface ModuleResearch {
  id: string;
  plainName: string;
  what: string;
  notes?: string;
  items: CodingItem[];
  sources: { label: string; url: string }[];
  at: number;
}

const SYSTEM =
  'You research car control modules for a personal diagnostics app. Use web search. Report only what public sources state, with their URLs. ' +
  'Never invent a byte or bit: if no source gives the exact long-coding byte and bit for this module family, return an empty settings list. ' +
  'Leave out anything about airbags, seat belt warnings, emissions equipment or lighting that is unlawful in the UK. British English.';

function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenced ? fenced[1] : text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1);
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

type RawSetting = { title?: string; summary?: string; byte?: number; bit?: number; confidence?: string; source?: string; sourceUrl?: string; category?: string };

export async function researchModule(car: { title: string; year: number | null; platform: string | null; vin: string }, m: ModuleFacts, platformTag: string): Promise<ModuleResearch> {
  const codingBytes = m.coding ? m.coding.length / 2 : 0;
  const prompt = [
    `Car: ${car.title}, ${car.year ?? 'year unknown'}, platform ${car.platform ?? 'unknown'}, VIN prefix ${car.vin.slice(0, 11)}.`,
    `Module: ${m.code ? `address ${m.code}, ` : ''}${m.name}. Part number ${m.part ?? 'unknown'}, software ${m.software ?? 'unknown'}, system name ${m.system ?? 'unknown'}.`,
    m.coding ? `Current long coding (${codingBytes} bytes, hex): ${m.coding}.` : 'No coding read.',
    'Search for this part number and module family. Then answer with one JSON object only, in a ```json block:',
    '{"plainName": "what a driver would call this module", "what": "one sentence on what it controls", "notes": "anything useful, e.g. common faults", ',
    '"settings": [{"title": "short name", "summary": "what changes in the car", "byte": 0, "bit": 0, "category": "Lights|Locking|Instrument cluster|Comfort|Other", "confidence": "medium|low", "source": "site name", "sourceUrl": "https://..."}]}',
    `Only include a setting when a source gives its exact byte (0 to ${Math.max(0, codingBytes - 1)}) and bit (0 to 7) for this module family. Byte numbers start at 0 as in VCDS.`,
  ].join('\n');

  let messages: ChatTurn[] = [{ role: 'user', content: prompt }];
  let text = '';
  let refused: string[] = [];
  for (let turn = 0, retries = 0; turn < 4; turn++) {
    const res = await callClaude(
      {
        max_tokens: 8000,
        output_config: { effort: 'medium' },
        system: SYSTEM,
        tools: [{ type: 'web_search_20260209', name: 'web_search', max_uses: 6 }],
        messages,
      },
      180_000,
    );
    // The Audi's first run (12 Nov 2026) got one search, then the search was
    // refused, so it found no settings. A rate limit is waited out and the
    // same request asked again, up to twice.
    refused = searchErrors(res);
    if (refused.includes('too_many_requests') && retries < 2) {
      retries++;
      turn--;
      await new Promise((r) => setTimeout(r, 20_000));
      continue;
    }
    text += `
${textOf(res)}`;
    if (res.stop_reason !== 'pause_turn') break;
    // A long search pauses the turn; send it back to carry on.
    messages = [...messages, { role: 'assistant', content: res.content }];
  }
  const data = (extractJson(text) ?? {}) as { plainName?: string; what?: string; notes?: string; settings?: RawSetting[] };
  const sources: { label: string; url: string }[] = [];
  const items: CodingItem[] = [];
  for (const [i, s] of (data.settings ?? []).entries()) {
    const ok = typeof s.byte === 'number' && typeof s.bit === 'number' && s.byte >= 0 && s.byte < codingBytes && s.bit >= 0 && s.bit <= 7 && !!s.title && /^https?:\/\//.test(s.sourceUrl ?? '');
    if (!ok) continue;
    if (/airbag|seat ?belt|emission|catalyst|egr|dpf delete/i.test(`${s.title} ${s.summary}`)) continue;
    const src = { label: s.source || 'Web source', url: s.sourceUrl! };
    sources.push(src);
    items.push({
      id: `ai-${m.id}-${s.byte}-${s.bit}-${i}`,
      title: s.title!.slice(0, 60),
      summary: (s.summary ?? '').slice(0, 200),
      category: (s.category as CodingItem['category']) || 'Other',
      platforms: [platformTag],
      module: m.id,
      byte: s.byte!,
      bits: [s.bit!],
      length: codingBytes,
      confidence: 'low',
      note: 'Found by AI research on the web. Unconfirmed: try it, and Caristini puts it back if nothing changes.',
      sources: [src],
    } as CodingItem);
  }
  const stopped = refused.length ? ` Web search was refused (${[...new Set(refused)].join(', ')}); run Learn my car again later for settings.` : '';
  return { id: m.id, plainName: data.plainName || m.name, what: data.what || '', notes: `${data.notes ?? ''}${stopped}`.trim() || undefined, items, sources, at: Date.now() };
}

// Unknown values found on a module (Discover): the AI proposes a name and a
// decoding for each from its samples, the module's identity and the car. Kept
// as "named by AI" sensors; values that stay a guess are left out.
export async function nameValues(
  car: { title: string; year: number | null; platform: string | null },
  m: ModuleFacts & { tx: string; rx: string },
  found: { did: string; samples: string[]; moves?: boolean }[],
): Promise<SensorRow[]> {
  if (!found.length) return [];
  const list = found
    .slice(0, 80)
    .map((f) => `${f.did}: ${f.samples.slice(-4).join(' / ')}${f.moves ? ' (changes)' : ''}`)
    .join('\n');
  const prompt = [
    `Car: ${car.title}, ${car.year ?? 'year unknown'}, ${car.platform ?? ''}.`,
    `Module at CAN ${m.tx}: ${m.name}, part ${m.part ?? 'unknown'}, software ${m.software ?? 'unknown'}, system ${m.system ?? 'unknown'}.`,
    'These UDS data identifiers answered ReadDataByIdentifier. Hex samples, oldest to newest:',
    list,
    'Use web search if it helps (for example OBDb signal sets, forum PID lists for this maker). For each identifier you can identify with reasonable confidence, give a name and decoding.',
    'Answer with one JSON object only, in a ```json block: {"values": [{"did": "1234", "name": "Coolant temperature", "unit": "°C", "byteStart": 0, "byteLength": 1, "signed": false, "scale": 1, "offset": -40, "confidence": "medium|low"}]}',
    'value = raw * scale + offset, raw read big-endian from byteStart. Leave out anything you cannot identify. Do not invent.',
  ].join('\n');
  const res = await callClaude(
    { max_tokens: 8000, output_config: { effort: 'medium' }, system: SYSTEM, tools: [{ type: 'web_search_20260209', name: 'web_search', max_uses: 4 }], messages: [{ role: 'user', content: prompt }] },
    180_000,
  );
  const data = (extractJson(textOf(res)) ?? {}) as { values?: { did?: string; name?: string; unit?: string; byteStart?: number; byteLength?: number; signed?: boolean; scale?: number; offset?: number }[] };
  const out: SensorRow[] = [];
  for (const v of data.values ?? []) {
    const f = found.find((x) => x.did.toUpperCase() === String(v.did ?? '').toUpperCase());
    if (!f || !v.name || typeof v.byteStart !== 'number' || typeof v.byteLength !== 'number') continue;
    const bytes = (f.samples[f.samples.length - 1] ?? '').length / 2;
    if (v.byteStart < 0 || v.byteLength < 1 || v.byteLength > 4 || v.byteStart + v.byteLength > bytes) continue;
    out.push({
      h: m.tx,
      ...(parseInt(m.rx, 16) !== parseInt(m.tx, 16) + 8 ? { r: m.rx } : {}),
      d: f.did.toUpperCase(),
      n: v.name.slice(0, 70),
      p: 'Other',
      b: v.byteStart * 8,
      l: v.byteLength * 8,
      ...(v.signed ? { s: 1 as const } : {}),
      m: typeof v.scale === 'number' && v.scale !== 0 ? v.scale : 1,
      a: typeof v.offset === 'number' ? v.offset : 0,
      u: v.unit ?? '',
      src: 'AI from Discover',
      ai: 1,
    });
  }
  return out;
}
