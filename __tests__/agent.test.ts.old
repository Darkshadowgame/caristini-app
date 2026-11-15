import { agentTurn } from '../src/ai/agent';
import { ElmClient } from '../src/obd/elm';
import { DEMO_CARS, SimTransport } from '../src/obd/simTransport';
import type { Vehicle } from '../src/vehicle/garage';

jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('../src/share/secrets', () => ({ getSecret: async () => 'test-key', isBuiltIn: () => false }));
jest.mock('../src/history', () => ({ addHistory: async () => undefined, loadHistory: async () => [] }));
jest.mock('../src/diary', () => ({ addDiary: async () => undefined, today: () => '2026-11-12' }));

const a6 = DEMO_CARS.find((c) => c.id === 'a6')!;
const vehicle: Vehicle = {
  vin: a6.vin,
  group: 'vag',
  brand: 'Audi',
  model: 'A6',
  platform: 'MLB',
  year: 2012,
  fuel: 'Diesel',
  nickname: '',
  edited: false,
  lastSeen: 0,
  lastMilOn: false,
  lastCodes: [],
};

function reply(content: unknown[], stop: string) {
  return { ok: true, status: 200, json: async () => ({ content, stop_reason: stop }) } as unknown as Response;
}

describe('Caristini AI tool loop', () => {
  it('changes a setting only after Allow, then answers', async () => {
    const c = new ElmClient(new SimTransport(a6, 0));
    await c.initialise();
    c.setMake('vag', 'MLB');
    const def = c.moduleById('vag-17')!;
    const before = (await c.readCoding(def))!;
    const calls: unknown[] = [];
    const fetchMock = jest.fn(async (_url: string, init: { body: string }) => {
      calls.push(JSON.parse(init.body));
      if (calls.length === 1) return reply([{ type: 'tool_use', id: 't1', name: 'change_setting', input: { id: 'cat-c7-12h-clock', on: true } }], 'tool_use');
      return reply([{ type: 'text', text: 'Done: the clock is now 12-hour.' }], 'end_turn');
    });
    (global as unknown as { fetch: unknown }).fetch = fetchMock;
    const asked: string[] = [];
    const patches: Partial<Vehicle>[] = [];
    const res = await agentTurn(
      {
        client: c,
        vehicle,
        update: async (p) => {
          patches.push(p);
        },
        imperial: { speed: true, temp: false },
        status: () => undefined,
        confirm: async (title) => {
          asked.push(title);
          return true;
        },
      },
      [{ role: 'user', content: 'Make the clock 12-hour' }],
      '',
    );
    expect(asked).toEqual(['Switch on: 12-hour clock?']);
    expect(res.actions[0]).toMatch(/12-hour clock on/);
    expect(res.answer).toMatch(/12-hour/);
    const after = (await c.readCoding(def))!;
    expect(after[6] & 0x80).toBe(0x80);
    expect(after[6]).not.toBe(before[6]);
    // The original coding was kept before the first change.
    expect(patches.some((p) => p.codingOriginal?.['vag-17'])).toBe(true);
    // The second request carries the tool result back.
    const second = calls[1] as { messages: { role: string; content: unknown }[] };
    expect(JSON.stringify(second.messages[second.messages.length - 1])).toMatch(/tool_result/);
  }, 20000);

  it('changes nothing when the owner declines', async () => {
    const c = new ElmClient(new SimTransport(a6, 0));
    await c.initialise();
    c.setMake('vag', 'MLB');
    const def = c.moduleById('vag-17')!;
    const before = (await c.readCoding(def))!;
    let n = 0;
    (global as unknown as { fetch: unknown }).fetch = jest.fn(async () =>
      ++n === 1 ? reply([{ type: 'tool_use', id: 't1', name: 'change_setting', input: { id: 'cat-c7-12h-clock', on: true } }], 'tool_use') : reply([{ type: 'text', text: 'Left as it was.' }], 'end_turn'),
    );
    const res = await agentTurn(
      { client: c, vehicle, update: async () => undefined, imperial: { speed: true, temp: false }, status: () => undefined, confirm: async () => false },
      [{ role: 'user', content: 'Make the clock 12-hour' }],
      '',
    );
    expect(res.actions[0]).toMatch(/declined/);
    expect(await c.readCoding(def)).toEqual(before);
  }, 20000);
});
