import { ElmClient, measuringOrder } from '../src/obd/elm';
import { MODULES } from '../src/obd/modules';
import { DEMO_CARS, SimTransport } from '../src/obd/simTransport';
import { Tp20Session } from '../src/obd/tp20';
import { GROUP_LABELS } from '../src/data/groupLabels';

// Fix 1: on a Mazda, an address shared with a Ford module (720) is the Mazda
// module, and every address is listed once (Mazda6 2016 scan of 14 Nov 2026
// had mazda-ic and ford-ipc both on 720).
describe('address search on a Mazda', () => {
  it('names modules from the Mazda list, once per address, with part numbers for unknown ones', async () => {
    const mazda = structuredClone(DEMO_CARS.find((c) => c.id === 'mazda')!);
    mazda.modules['733'] = { part: 'G46G-61190-', sw: 'A' };
    mazda.modules['737'] = { part: 'GMC8-57K30-', sw: 'A' };
    mazda.modules['734'] = { part: 'GML8-5102X-', sw: 'A' };
    const c = new ElmClient(new SimTransport(mazda, 0));
    await c.initialise();
    c.setMake('mazda');
    const found = await c.findAnyModules();
    const ids = found.map((d) => d.id);
    expect(ids).toEqual(expect.arrayContaining(['mazda-ic', 'mazda-abs', 'mazda-fbcm', 'mazda-hvac', 'mazda-rcm']));
    expect(ids.filter((id) => id.startsWith('ford-'))).toEqual([]);
    const addresses = found.map((d) => `${d.tx}>${d.rx}`);
    expect(new Set(addresses).size).toBe(addresses.length);
    expect(found.find((d) => d.tx === '734')!.name).toBe('Module 734 · GML8-5102X');
  }, 60000);
});

// Fix 3: a TP2.0 module that sends A8 (disconnect) has closed the channel.
// Replays the 2007 Leon log of 15 Nov 2026 at 20:47:08: the module answers
// 10 89, repeats it, then sends A8.
describe('TP2.0 disconnect from the module', () => {
  const leonA8 = '300B1\r3001000025089\r3001000025089\r3001000025089\r300A8';

  it('stops the session at once and sends nothing more on the dead channel', async () => {
    const sent: string[] = [];
    const reply = (c: string): string => {
      if (c === '01C000100003011') return '2010' + '0D00003400701';
      if (c === 'A00F8AFF32FF1') return '300A10F8AFF4AFF';
      if (c === '1000021089') return leonA8;
      return 'NO DATA';
    };
    const s = new Tp20Session(async (c) => {
      sent.push(c);
      return `${reply(c)}\r\r>`;
    }, '6');
    expect(await s.open(0x01)).toBe(true);
    expect(await s.request([0x10, 0x89], 2000)).toEqual([0x50, 0x89]);
    await expect(s.request([0x1a, 0x9b], 2000)).rejects.toThrow(/closed/);
    expect(s.closed).toBe(true);
    await expect(s.request([0x22, 0xf1, 0x87], 2000)).rejects.toThrow(/closed/);
    await s.close();
    expect(sent.some((c) => /^1.00021A9B$/.test(c))).toBe(false);
    expect(sent.some((c) => /^1.000322F1/.test(c))).toBe(false);
    expect(sent).not.toContain('A3');
    expect(sent).not.toContain('A8');
  });

  it('does not count a module that closed the channel as answered, and skips the F1xx reads', async () => {
    const leon = structuredClone(DEMO_CARS.find((c) => c.id === 'leon')!);
    const t = new SimTransport(leon, 0);
    const send = t.send.bind(t);
    const sent: string[] = [];
    let airbagOpen = false;
    t.send = (cmd: string) => {
      sent.push(cmd);
      if (/^..C000100003011$/.test(cmd)) airbagOpen = cmd.startsWith('05');
      if (airbagOpen && cmd === '1000021089') return Promise.resolve(`${leonA8}\r\r>`);
      return send(cmd);
    };
    const c = new ElmClient(t);
    await c.initialise();
    c.setMake('vag', 'PQ35');
    const airbag = MODULES.find((m) => m.id === 'vag-15')!;
    sent.length = 0;
    const d = await c.readModuleDetails(airbag);
    expect(sent).toContain('05C000100003011');
    expect(d.responded).toBe(false);
    expect(sent.some((x) => /^1.00021A9B$/.test(x))).toBe(false);
    expect(sent.some((x) => /^1.000322F1/.test(x))).toBe(false);
    // A module that answers is still read as before.
    const cluster = await c.readModuleDetails(MODULES.find((m) => m.id === 'vag-17')!);
    expect(cluster.responded).toBe(true);
    expect(cluster.partNumber).toBe('1P0920823A');
  }, 60000);
});

// Fix 11: value groups with names are read first, and a scan cut short and
// resumed reads every group exactly once.
describe('value group order', () => {
  it('puts named groups first and resumes without gaps or repeats', () => {
    const named = [5, 115, 2, 300];
    expect(measuringOrder(named, 8)).toEqual([2, 5, 115, 1, 3, 4, 6, 7, 8]);
    // Cut short in the named pass at 115: the rest of the named, then all others.
    expect(measuringOrder(named, 8, 115)).toEqual([115, 1, 3, 4, 6, 7, 8]);
    // Cut short in the second pass at 4.
    expect(measuringOrder(named, 8, 4)).toEqual([4, 6, 7, 8]);
  });

  it('reads the engine named groups first and covers 1 to 255 once over several runs', async () => {
    const leon = structuredClone(DEMO_CARS.find((c) => c.id === 'leon')!);
    const t = new SimTransport(leon, 0);
    const send = t.send.bind(t);
    const asked: number[] = [];
    t.send = (cmd: string) => {
      const m = /^1.000221([0-9A-F]{2})$/.exec(cmd);
      if (m) asked.push(parseInt(m[1], 16));
      return send(cmd);
    };
    const c = new ElmClient(t);
    await c.initialise();
    c.setMake('vag', 'PQ35');
    const engine = MODULES.find((m) => m.id === 'engine')!;
    expect((await c.readModuleDetails(engine)).responded).toBe(true);
    asked.length = 0;
    const got: number[] = [];
    let next: number | undefined;
    let runs = 0;
    // Resume is a position in the order, so it is passed back as fromIndex.
    for (;;) {
      // Each run stops after 70 groups, as the time limit would.
      let left = 70;
      const res = await c.scanMeasuringBlocks(engine, (g) => got.push(g), undefined, { fromIndex: next, to: 255, cancelled: () => left-- <= 0 });
      runs++;
      if (res.complete) break;
      next = res.nextIndex;
      expect(runs).toBeLessThan(10);
    }
    const namedGroups = Object.keys(GROUP_LABELS['01']).map(Number).sort((a, b) => a - b);
    expect(asked.slice(0, namedGroups.length)).toEqual(namedGroups);
    expect([...asked].sort((a, b) => a - b)).toEqual(Array.from({ length: 255 }, (_, i) => i + 1));
    expect(runs).toBeGreaterThan(1);
    expect(got).toEqual([115]);
  }, 120000);
});
