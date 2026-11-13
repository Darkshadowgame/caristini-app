import { ElmClient } from '../src/obd/elm';
import { DEMO_CARS, SimTransport } from '../src/obd/simTransport';
import type { Transport } from '../src/obd/transport';

const a6 = DEMO_CARS.find((c) => c.id === 'a6')!;

// Counts what is sent to the adapter.
function counted(): { t: Transport; n: () => number } {
  const sim = new SimTransport(a6, 0);
  let n = 0;
  const send = sim.send.bind(sim);
  sim.send = (cmd: string) => {
    n++;
    return send(cmd);
  };
  return { t: sim, n: () => n };
}

describe('what a car taught Caristini is reused on the next connection', () => {
  it('saves how each module answered and tries that way first next time', async () => {
    const first = new ElmClient(new SimTransport(a6, 0));
    await first.initialise();
    first.setMake('vag', 'MLB');
    await first.scanAllFaults('vag');
    const routes = first.exportRoutes();
    const seen = first.modulesSeen;
    expect(routes['vag-09']?.via).toBe('tp20');
    expect(seen).toContain('vag-17');

    // Central electronics answers only on the older protocol on this car.
    const cold = counted();
    const a = new ElmClient(cold.t);
    await a.initialise();
    a.setMake('vag', 'MLB');
    const before = cold.n();
    expect((await a.readCoding(a.moduleById('vag-09')!))?.length).toBeGreaterThan(0);
    const coldCost = cold.n() - before;

    const warm = counted();
    const b = new ElmClient(warm.t);
    await b.initialise();
    b.setMake('vag', 'MLB');
    b.rememberRoutes(routes);
    const start = warm.n();
    expect((await b.readCoding(b.moduleById('vag-09')!))?.length).toBeGreaterThan(0);
    expect(warm.n() - start).toBeLessThan(coldCost);
  }, 60000);

  it('a quick health check asks only the modules the car has, and finds the same faults', async () => {
    const full = counted();
    const a = new ElmClient(full.t);
    await a.initialise();
    a.setMake('vag', 'MLB');
    const all = await a.scanAllFaults('vag');
    const fullCost = full.n();
    const faults = (list: typeof all) => list.flatMap((r) => r.faults.map((f) => `${r.def.id}:${f.code}`)).sort();

    const quick = counted();
    const b = new ElmClient(quick.t);
    await b.initialise();
    b.setMake('vag', 'MLB');
    b.rememberModules(a.modulesSeen);
    b.rememberRoutes(a.exportRoutes());
    const some = await b.scanAllFaults('vag', undefined, undefined, { knownOnly: true });
    expect(some.length).toBe(a.modulesSeen.length);
    expect(faults(some)).toEqual(faults(all));
    expect(quick.n()).toBeLessThan(fullCost * 0.7);
    // Normal OBD works again afterwards.
    expect((await b.readStatus()).milOn).toBeDefined();
  }, 60000);

  it('says whether the car is answering', async () => {
    const c = new ElmClient(new SimTransport(a6, 0));
    await c.initialise();
    expect(await c.carAwake()).toBe(true);
  });
});
