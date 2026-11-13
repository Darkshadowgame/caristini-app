// Caristini's car assistant: Claude with tools that read this car (sensors,
// standard live data, faults, modules, coding settings) and one tool that
// changes a setting. A change always waits for the owner to tap Allow in the
// app; the write itself uses the same safe path as Customise.
import { applySetting } from '../coding/apply';
import { bitsLabel, CodingItem, codingItemsFor, isOn } from '../coding/items';
import { preflightCheck } from '../coding/preflight';
import { loadHistory } from '../history';
import { KbKind, kbForCar, kbSettings, loadKb, saveKb, searchEverything } from '../kb';
import { ElmClient } from '../obd/elm';
import { pidInfo } from '../obd/pids';
import { categoryOf, displaySensor, HEADER_NAMES, readKey, sensorId, sensorsForCar } from '../obd/sensors';
import { Vehicle, vehicleTitle } from '../vehicle/garage';
import { callClaude, ChatTurn } from './claude';

export interface AgentEnv {
  client: ElmClient | null;
  vehicle: Vehicle;
  update: (patch: Partial<Vehicle>) => Promise<void>;
  // The newest saved copy of the car (updates made earlier in this turn included).
  latest?: () => Vehicle | undefined;
  imperial: { speed: boolean; temp: boolean };
  // Shows the owner what will change and resolves true on Allow.
  confirm: (title: string, lines: string[]) => Promise<boolean>;
  // A short line for the chat while a tool runs ("Reading 24 sensors").
  status: (text: string) => void;
  // True once the owner taps Stop: the turn ends before the next step.
  cancelled?: () => boolean;
}

const TOOLS = [
  {
    name: 'read_sensors',
    description:
      "Reads live values from the car's modules (engine, gearbox, DPF, battery, tyres and more) plus standard OBD2 values. Use it to look at how the car is running and explain what the numbers mean. Optional filter by category or a word in the sensor name.",
    input_schema: {
      type: 'object',
      properties: {
        category: { type: 'string', description: 'One of: Engine, Turbo and air, Gearbox, Diesel filter and exhaust, Service and oil, Battery and charging, Fuel, Mileage and trips, Tyres, Brakes and chassis, Climate, Airbag crash counts, Body, Other' },
        search: { type: 'string', description: 'A word to match in sensor names, for example "oil" or "boost"' },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'faults',
    description: 'Fault codes. With run=false (default) returns the last saved health check. With run=true scans every module now (takes 30 to 90 seconds).',
    input_schema: { type: 'object', properties: { run: { type: 'boolean' } }, additionalProperties: false },
  },
  {
    name: 'list_modules',
    description: 'The control modules Caristini knows on this car, with part numbers and what each does when learned.',
    input_schema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'list_settings',
    description: 'Customisation settings available for this car with their current state (on or off), read from the modules now. Each has an id to use with change_setting.',
    input_schema: { type: 'object', properties: { search: { type: 'string' } }, additionalProperties: false },
  },
  {
    name: 'knowledge_search',
    description:
      "Searches Caristini's knowledge base for this car: built-in settings, fuse boxes, and everything researched or saved before (fuses, modifications, settings, how-to, notes). Search here first; use web search only when nothing useful is saved.",
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Words to find, for example "fuse cigarette lighter" or "needle sweep"' },
        kind: { type: 'string', enum: ['fuse', 'modification', 'setting', 'sensor', 'procedure', 'module', 'note'] },
      },
      required: ['query'],
      additionalProperties: false,
    },
  },
  {
    name: 'knowledge_save',
    description:
      'Saves something useful you found (usually through web search) so it is there next time, for this owner and every Caristini user with this car: a fuse layout, a modification, a coding setting, a how-to or a note. Include the source URLs. For a coding setting give data {module, byte, bits} exactly as the source states; the app then offers it in Customise as unconfirmed. Do not save guesses.',
    input_schema: {
      type: 'object',
      properties: {
        kind: { type: 'string', enum: ['fuse', 'modification', 'setting', 'sensor', 'procedure', 'module', 'note'] },
        title: { type: 'string' },
        body: { type: 'string', description: 'The facts, in plain British English' },
        model: { type: 'string', description: 'Model it applies to, or omit for the whole make' },
        platform: { type: 'string', description: 'Platform code if known, for example MLB, PQ35, C346' },
        years: { type: 'string' },
        data: { type: 'object', description: 'For settings: {"module": "vag-09", "byte": 4, "bits": [2]}' },
        sources: { type: 'array', items: { type: 'object', properties: { label: { type: 'string' }, url: { type: 'string' } }, required: ['url'] } },
      },
      required: ['kind', 'title', 'body', 'sources'],
      additionalProperties: false,
    },
  },
  { type: 'web_search_20260209', name: 'web_search', max_uses: 6 },
  {
    name: 'change_setting',
    description:
      'Turns one setting on or off in the car. The owner sees exactly what will change and must tap Allow first; if they decline, nothing changes. Only call it when the owner asked for that change. The app saves the original coding and puts it back if the module does not keep the change.',
    input_schema: {
      type: 'object',
      properties: { id: { type: 'string', description: 'Setting id from list_settings' }, on: { type: 'boolean' } },
      required: ['id', 'on'],
      additionalProperties: false,
    },
  },
];

const BASIC_PIDS = [0x0c, 0x05, 0x0d, 0x04, 0x0b, 0x0f, 0x10, 0x11, 0x42, 0x46, 0x5c, 0x2f, 0x33, 0x23];

async function settingsFor(v: Vehicle): Promise<CodingItem[]> {
  // Shared settings only for this make and this exact platform.
  const plat = (v.platform ?? '').toLowerCase();
  const kb = kbSettings(kbForCar(await loadKb(), v)).filter((i) => !!plat && i.platforms.some((x) => x.toLowerCase() === plat));
  return [...codingItemsFor(v.group, v.platform), ...(v.aiItems ?? []), ...kb];
}

async function runTool(env: AgentEnv, name: string, input: Record<string, unknown>): Promise<string> {
  const { client, vehicle: v } = env;
  const need = () => {
    if (!client) throw new Error('Not connected to the car. Ask the owner to connect the adapter.');
    return client;
  };
  if (name === 'read_sensors') {
    const c = need();
    const all = sensorsForCar(v);
    const found = new Set(v.sensorsFound ?? []);
    let rows = v.sensorScan ? all.filter((r) => found.has(readKey(r))) : [];
    if (input.category) rows = rows.filter((r) => categoryOf(r) === input.category);
    if (input.search) rows = rows.filter((r) => r.n.toLowerCase().includes(String(input.search).toLowerCase()));
    rows = rows.slice(0, 45);
    env.status(`Reading ${rows.length + BASIC_PIDS.length} values`);
    const values = rows.length ? await c.readSensors(rows) : {};
    const out = rows
      .filter((r) => values[sensorId(r)] != null)
      .map((r) => {
        const d = displaySensor(r, values[sensorId(r)], env.imperial);
        return `${HEADER_NAMES[r.h] ?? r.h} | ${r.n}: ${d.text}${d.unit ? ` ${d.unit}` : ''}${d.check ? ' (implausible for this unit: the definition may not fit this car)' : ''}`;
      });
    for (const pid of BASIC_PIDS) {
      const p = pidInfo(pid);
      if (!p) continue;
      const val = await c.readLive(p).catch(() => null);
      if (val != null) out.push(`OBD2 | ${p.label}: ${Math.round(val * 10) / 10} ${p.unit}`);
    }
    if (!v.sensorScan) out.push('(Maker sensors are not searched yet on this car: suggest All sensors > Find my car’s sensors for many more values.)');
    return out.length ? out.join('\n') : 'No values answered.';
  }
  if (name === 'faults') {
    if (input.run) {
      const c = need();
      env.status('Scanning every module');
      c.rememberModules(v.modulesSeen);
      const res = await c.scanAllFaults(v.group === 'other' ? 'vag' : v.group, undefined, env.cancelled);
      const lines = res.filter((r) => r.faults.length).map((r) => `${r.def.name}: ${r.faults.map((f) => f.code).join(', ')}`);
      const answered = res.filter((r) => r.state === 'ok' || r.state === 'faults').length;
      return `${answered} modules answered.\n${lines.join('\n') || 'No faults stored.'}`;
    }
    const last = (await loadHistory(v.vin)).find((e) => e.kind === 'scan');
    if (!last) return 'No health check saved yet.';
    return `Last health check ${new Date(last.at).toLocaleString('en-GB')}: ${last.faults?.length ? last.faults.map((f) => `${f.module} ${f.code}${f.text ? ` (${f.text})` : ''}`).join('; ') : 'no faults'}.`;
  }
  if (name === 'list_modules') {
    const k = v.knowledge ?? {};
    const ids = Object.keys(k);
    if (!ids.length) return 'Not learned yet. Suggest Learn my car.';
    return ids.map((id) => `${id}: ${k[id].plainName}${k[id].part ? ` (${k[id].part})` : ''}${k[id].what ? `: ${k[id].what}` : ''}`).join('\n');
  }
  if (name === 'list_settings') {
    const c = need();
    let items = await settingsFor(v);
    if (input.search) items = items.filter((i) => `${i.title} ${i.summary}`.toLowerCase().includes(String(input.search).toLowerCase()));
    const mods = [...new Set(items.map((i) => i.module))];
    env.status(`Reading coding from ${mods.length} module${mods.length === 1 ? '' : 's'}`);
    const codings: Record<string, number[] | null> = {};
    for (const m of mods) {
      const def = c.moduleById(m);
      codings[m] = def ? await c.readCoding(def).catch(() => null) : null;
    }
    const lines = items
      .filter((i) => {
        const cd = codings[i.module];
        const def = c.moduleById(i.module);
        return cd && !(def && c.codingStyle(def) === 'short') && (i.length ? cd.length === i.length : cd.length > i.byte);
      })
      .map((i) => `${i.id} | ${i.title} | ${isOn(i, codings[i.module]!) ? 'on' : 'off'} | ${i.confidence === 'low' ? 'unconfirmed' : 'sourced'} | ${i.summary}`);
    return lines.length ? lines.join('\n') : 'No settings could be read on this car right now.';
  }
  if (name === 'change_setting') {
    const c = need();
    const item = (await settingsFor(v)).find((i) => i.id === input.id);
    if (!item) return 'Unknown setting id. Call list_settings first.';
    const on = !!input.on;
    const check = await preflightCheck(c);
    if (check.block) return `Not changed: ${check.block}`;
    const ok = await env.confirm(`Switch ${on ? 'on' : 'off'}: ${item.title}?`, [
      ...(check.warn ? [check.warn] : []),
      `Changes the ${c.moduleById(item.module)?.name ?? item.module} coding: byte ${item.byte}, ${bitsLabel(item)}.`,
      item.confidence === 'low' ? 'Unconfirmed setting: check the result in the car.' : 'From a public source.',
      'The current coding is saved first and put back automatically if the module does not keep the change.',
    ]);
    if (!ok) return 'The owner declined. Nothing was changed.';
    env.status(`Changing ${item.title}`);
    const res = await applySetting(c, v, env.update, item, on, env.latest);
    return res.text;
  }
  if (name === 'knowledge_search') {
    const hits = searchEverything(await loadKb(), v, String(input.query ?? ''), input.kind as KbKind | undefined);
    return hits.length ? hits.join('\n') : 'Nothing saved for that yet.';
  }
  if (name === 'knowledge_save') {
    const sources = (Array.isArray(input.sources) ? input.sources : []).filter((x): x is { label?: string; url: string } => !!x && typeof (x as { url?: unknown }).url === 'string' && /^https?:\/\//.test((x as { url: string }).url));
    if (!sources.length) return 'Not saved: give at least one source URL.';
    env.status('Saving to the knowledge base');
    const r = await saveKb({
      kind: String(input.kind) as KbKind,
      car: { make: v.brand, model: input.model ? String(input.model) : undefined, platform: input.platform ? String(input.platform) : v.platform ?? undefined, years: input.years ? String(input.years) : undefined },
      title: String(input.title).slice(0, 90),
      body: String(input.body).slice(0, 4000),
      data: input.data && typeof input.data === 'object' ? (input.data as Record<string, unknown>) : undefined,
      sources: sources.map((x) => ({ label: x.label ?? 'Source', url: x.url })),
      addedBy: 'ai',
    });
    return r.shared ? `Saved and shared: "${r.entry.title}". Every install gets it on its next start.` : `Saved on this phone: "${r.entry.title}".${r.error ? ` Not shared: ${r.error}` : ''}`;
  }
  return 'Unknown tool.';
}

type Block = { type: string; id?: string; name?: string; input?: Record<string, unknown>; text?: string };

// One owner message through the tool loop. Returns the new turns to append.
export async function agentTurn(env: AgentEnv, history: ChatTurn[], context: string): Promise<{ turns: ChatTurn[]; answer: string; actions: string[] }> {
  const turns: ChatTurn[] = [];
  const actions: string[] = [];
  const system = [
    'You are Caristini, an assistant built into a car diagnostics app, talking to the car owner in British English: short, direct, outcome first, digits for numbers.',
    'You can read the car through tools. Use them rather than guessing: read sensors to explain how the car is running, read faults, list modules and settings.',
    'Explain values in context for this car (normal ranges, what is worth watching). Be honest about uncertainty.',
    'Only change a setting when the owner asks; use change_setting, which asks them to confirm. Never claim a change happened unless the tool said so.',
    'Knowledge: search the knowledge base first (knowledge_search). When it lacks something (a fuse layout, a modification, a coding setting, a procedure), research it with web search, tell the owner what you found with sources, and save the useful, sourced facts with knowledge_save so the next search finds them. Never save guesses.',
    `The car: ${vehicleTitle(env.vehicle)}${env.vehicle.year ? `, ${env.vehicle.year}` : ''}${env.vehicle.fuel ? `, ${env.vehicle.fuel}` : ''}${env.vehicle.platform ? `, ${env.vehicle.platform}` : ''}.`,
    env.client ? 'The adapter is connected.' : 'The adapter is not connected: reading the car is not possible right now.',
    context,
  ].join('\n');
  for (let step = 0; step < 8; step++) {
    if (env.cancelled?.()) return { turns: closeOpenTools(turns), answer: 'Stopped.', actions };
    const res = await callClaude({
      max_tokens: 4000,
      output_config: { effort: 'medium' },
      system,
      tools: TOOLS,
      messages: [...history, ...turns],
    });
    const content = res.content as Block[];
    turns.push({ role: 'assistant', content });
    // A long web search pauses the turn: send it back to carry on.
    if (res.stop_reason === 'pause_turn') {
      env.status('Researching on the web');
      continue;
    }
    const uses = content.filter((b) => b.type === 'tool_use');
    if (res.stop_reason !== 'tool_use' || !uses.length) {
      const answer = content
        .filter((b) => b.type === 'text')
        .map((b) => b.text)
        .join('\n')
        .trim();
      return { turns, answer: res.stop_reason === 'refusal' ? 'Claude declined to answer this one.' : answer || 'Done.', actions };
    }
    const results = [];
    for (const u of uses) {
      if (env.cancelled?.()) {
        results.push({ type: 'tool_result', tool_use_id: u.id, content: 'Stopped by the owner.', is_error: true });
        continue;
      }
      let out: string;
      let isError = false;
      try {
        out = await runTool(env, u.name!, u.input ?? {});
      } catch (e) {
        out = e instanceof Error ? e.message : String(e);
        isError = true;
      }
      if (u.name === 'change_setting' || u.name === 'knowledge_save') actions.push(out);
      results.push({ type: 'tool_result', tool_use_id: u.id, content: out, ...(isError ? { is_error: true } : {}) });
    }
    turns.push({ role: 'user', content: results });
  }
  return { turns, answer: 'That took too many steps. Try a narrower question.', actions };
}

// A stopped turn must not end on tool calls with no results, or the next
// question would be rejected by the API: drop a trailing assistant tool call.
function closeOpenTools(turns: ChatTurn[]): ChatTurn[] {
  const last = turns[turns.length - 1];
  // Also a paused web search (server_tool_use with no result yet).
  if (last?.role === 'assistant' && Array.isArray(last.content) && (last.content as Block[]).some((b) => b.type === 'tool_use' || b.type === 'server_tool_use')) return turns.slice(0, -1);
  return turns;
}
