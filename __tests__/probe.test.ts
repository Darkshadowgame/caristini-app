import { ElmClient } from '../src/obd/elm';
import { DEMO_CARS, SimTransport } from '../src/obd/simTransport';
import { LIVE_PIDS } from '../src/obd/pids';

const a6 = DEMO_CARS.find((c) => c.id === 'a6')!;

test('module probe hears VW reply IDs (request + 6A) and the engine (request + 8)', async () => {
  const c = new ElmClient(new SimTransport(a6, 0));
  await c.initialise();
  const found = await c.findAnyModules();
  const pairs = found.map((d) => `${d.tx}>${d.rx}`);
  expect(pairs).toContain('7E0>7E8');
  expect(pairs).toContain('714>77E');
  expect(pairs).toContain('710>77A');
  // Back to normal OBD afterwards.
  expect(await c.readLive(LIVE_PIDS.find((p) => p.pid === 0x05)!)).not.toBeNull();
});

test('combined live read returns every requested value', async () => {
  const c = new ElmClient(new SimTransport(a6, 0));
  await c.initialise();
  const list = LIVE_PIDS.filter((p) => [0x04, 0x05, 0x0c, 0x0d, 0x0b, 0x0f, 0x10, 0x42].includes(p.pid));
  const got = await c.readLiveMany(list);
  for (const p of list) expect(got.get(p.pid)).not.toBeNull();
});
