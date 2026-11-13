import { ElmClient } from '../src/obd/elm';
import { DEMO_CARS, SimTransport } from '../src/obd/simTransport';
import { kwpFaults, parseRawFrames, Tp20Session } from '../src/obd/tp20';
import { sensorsFor } from '../src/obd/sensors';

const a6 = DEMO_CARS.find((c) => c.id === 'a6')!;

describe('TP2.0 helpers', () => {
  it('reads raw frames with headers', () => {
    expect(parseRawFrames('2090000D0000340070 1\r3001000025089\r\r>').map((f) => f.id)).toEqual([0x209, 0x300]);
  });

  it('turns KWP fault records into 5-digit VW numbers', () => {
    expect(kwpFaults([0x58, 0x02, 0x01, 0x00, 0x23, 0x01, 0xd7, 0x24])).toEqual([
      { code: '00256', status: 0x23 },
      { code: '00471', status: 0x24 },
    ]);
    expect(kwpFaults([0x58, 0x00])).toEqual([]);
  });
});

describe('deep scan on the demo A6', () => {
  it('finds the TP2.0 modules and their faults, then returns to normal OBD', async () => {
    const c = new ElmClient(new SimTransport(a6, 0));
    await c.initialise();
    const found = await c.deepScan([0x20, 0x22, 0x21, 0x23]);
    expect(found.map((m) => m.address)).toEqual([0x20, 0x22, 0x21]);
    expect(found[0].faults.map((f) => f.code)).toEqual(['00256', '00471']);
    expect(found[1].faults.map((f) => f.code)).toEqual(['02123']);
    expect(found[2].faults).toEqual([]);
    expect((await c.readStatus()).milOn).toBeDefined();
  });

  it('clears one TP2.0 module', async () => {
    const c = new ElmClient(new SimTransport(a6, 0));
    await c.initialise();
    await c.clearTp20(0x22);
    const found = await c.deepScan([0x22]);
    expect(found[0].faults).toEqual([]);
  });
});

describe('late ACK', () => {
  it('reads a repeated module frame once and ACKs it again', async () => {
    const sent: string[] = [];
    let b1 = 0;
    const reply = (c: string): string => {
      // Channel setup: module sends on 0x300, listens on 0x740.
      if (c === '09C000100003011') return '20900D00003400701';
      if (c === 'A00F8AFF32FF1') return '300A10F8AFF4AFF';
      // Our request: the module ACKs, then sends frame 0 (wants an ACK).
      if (c === '1000041802FF00') return '300B1\r30000000558010100';
      // First ACK came late: the module had already repeated frame 0.
      // Second ACK: the module sends the last frame.
      if (c === 'B1') return ++b1 === 1 ? '30000000558010100' : '3001123';
      return '';
    };
    const s = new Tp20Session(async (c) => {
      sent.push(c);
      return `${reply(c) || 'OK'}\r\r>`;
    }, '6');
    expect(await s.open(0x09)).toBe(true);
    const msg = await s.request([0x18, 0x02, 0xff, 0x00], 2000);
    expect(msg).toEqual([0x58, 0x01, 0x01, 0x00, 0x23]);
    expect(kwpFaults(msg)).toEqual([{ code: '00256', status: 0x23 }]);
    expect(sent.filter((c) => c === 'B1').length).toBe(2);
    expect(sent).toContain('B2');
  });
});

describe('deep scan on the demo Leon (PQ35)', () => {
  it('reaches the PQ modules with the full address list', async () => {
    const leon = DEMO_CARS.find((c) => c.id === 'leon')!;
    const c = new ElmClient(new SimTransport(leon, 0));
    await c.initialise();
    const found = await c.deepScan();
    expect(found.map((m) => m.address).sort((a, b) => a - b)).toEqual([0x01, 0x03, 0x05, 0x07, 0x09, 0x1f, 0x20]);
    expect(found.find((m) => m.address === 0x01)!.faults.map((f) => f.code)).toEqual(['16684']);
    expect(found.find((m) => m.address === 0x05)!.faults.map((f) => f.code)).toEqual(['00532']);
  });
});

describe('modules over several protocols', () => {
  const leon = () => DEMO_CARS.find((c) => c.id === 'leon')!;

  it('finds the Leon modules from its gateway and reads them over TP2.0', async () => {
    const c = new ElmClient(new SimTransport(structuredClone(leon()), 0));
    await c.initialise();
    c.setMake('vag', 'PQ35');
    const res = await c.scanAllFaults('vag');
    const by = (id: string) => res.find((r) => r.def.id === id)!;
    expect(by('engine')).toMatchObject({ state: 'faults', route: 'tp20' });
    expect(by('engine').faults[0]).toMatchObject({ code: '16684', kwp: true });
    expect(by('vag-15').faults.map((f) => f.code)).toEqual(['00532']);
    // The cluster is not on a fixed address: the gateway list gave 0x07.
    expect(by('vag-17')).toMatchObject({ state: 'ok', route: 'tp20' });
    const cluster = await c.readModuleDetails(by('vag-17').def);
    expect(cluster).toMatchObject({ responded: true, partNumber: '1P0920823A', software: '0040', route: 'tp20', coding: '0001802' });
    await c.clearModuleFaults(by('engine').def);
    expect((await c.readModuleFaults(by('engine').def)).state).toBe('ok');
    // Normal OBD still works afterwards.
    expect((await c.readStatus()).milOn).toBeDefined();
  });

  it('sets raw CAN up once for older modules in a row, with the same results', async () => {
    const sent: string[] = [];
    const run = async (hold: boolean) => {
      const t = new SimTransport(structuredClone(leon()), 0);
      const send = t.send.bind(t);
      t.send = (cmd: string) => {
        sent.push(cmd);
        return send(cmd);
      };
      const c = new ElmClient(t);
      await c.initialise();
      c.setMake('vag', 'PQ35');
      if (!hold) (c as unknown as { holdRaw: number }).holdRaw = -1;
      sent.length = 0;
      const res = await c.scanAllFaults('vag');
      const enters = sent.filter((x) => x === 'ATPBC001').length;
      const status = await c.readStatus();
      return { res: res.map((r) => `${r.def.id}:${r.state}:${r.faults.map((f) => f.code).join(',')}`), enters, total: sent.length, mil: status.milOn };
    };
    const before = await run(false);
    const after = await run(true);
    expect(after.res).toEqual(before.res);
    expect(after.enters).toBeLessThan(before.enters);
    expect(after.total).toBeLessThan(before.total);
    expect(after.mil).toBeDefined();
  });

  it('reaches the A6 body modules the gateway says use the older protocol', async () => {
    const c = new ElmClient(new SimTransport(DEMO_CARS.find((x) => x.id === 'a6')!, 0));
    await c.initialise();
    c.setMake('vag', 'MLB');
    const res = await c.scanAllFaults('vag');
    const central = res.find((r) => r.def.id === 'vag-09')!;
    // 09 answers over TP2.0 at 0x20 and gives the faults Carista showed on the real car.
    expect(central.state).toBe('faults');
    expect(central.route).toBe('tp20');
    expect(central.faults.map((f) => f.code)).toEqual(['00256', '00471']);
    // UDS modules are unchanged.
    expect(res.find((r) => r.def.id === 'vag-17')!.route).toBe('uds');
  });
});

describe('live data from older VW modules', () => {
  it('reads the Leon engine boost group', async () => {
    const leon = DEMO_CARS.find((c) => c.id === 'leon')!;
    const c = new ElmClient(new SimTransport(structuredClone(leon), 0));
    await c.initialise();
    c.setMake('vag', 'PQ35');
    const mods = await c.findTp20Modules();
    expect(mods.map((m) => m.id)).toEqual(expect.arrayContaining(['engine', 'vag-17', 'vag-15']));
    const engine = mods.find((m) => m.id === 'engine')!;
    const cells = (await c.readMeasuringBlock(engine, 115))!;
    expect(cells.map((x) => x.unit)).toEqual(['rpm', '%', 'mbar', 'mbar']);
    expect(cells[0].value).toBe(3000);
    expect(cells[2].value).toBeCloseTo(2000);
    expect(cells[3].value).toBeCloseTo(1900);
    let n = 0;
    await c.watchMeasuringBlock(engine, 115, () => n++, () => n < 3);
    expect(n).toBe(3);
  });
});

describe('listen mode', () => {
  it('records frames, then the adapter works normally again', async () => {
    const c = new ElmClient(new SimTransport(DEMO_CARS.find((x) => x.id === 'a6')!, 0));
    await c.initialise();
    expect(c.canListen).toBe(true);
    const lines: string[] = [];
    let stop!: () => void;
    const until = new Promise<void>((r) => (stop = r));
    setTimeout(() => stop(), 700);
    const why = await c.listen('all', (l) => lines.push(l), until);
    expect(why).toBe('stopped');
    expect(lines.length).toBeGreaterThan(2);
    expect(lines[0]).toMatch(/^7[0-9A-F]{2}/);
    expect((await c.readStatus()).milOn).toBeDefined();
  });
});

describe('coding over TP2.0', () => {
  it('reads and writes the modern record on the A6 central electronics (09 at 0x20)', async () => {
    const c = new ElmClient(new SimTransport(a6, 0));
    await c.initialise();
    c.setMake('vag', 'MLB');
    const def = c.moduleById('vag-09')!;
    const before = await c.readCoding(def);
    expect(before).not.toBeNull();
    expect(c.codingStyle(def)).toBe('did');
    const after = [...before!];
    after[4] ^= 0x04;
    const res = await c.writeCoding(def, before!, after);
    expect(res.ok).toBe(true);
    expect(res.coding).toEqual(after);
    expect(await c.readCoding(def)).toEqual(after);
  });

  it('reads and writes old KWP long coding on the Leon central electronics', async () => {
    const leon = DEMO_CARS.find((x) => x.id === 'leon')!;
    const c = new ElmClient(new SimTransport(leon, 0));
    await c.initialise();
    c.setMake('vag', 'PQ35');
    const def = c.moduleById('vag-09')!;
    const before = await c.readCoding(def);
    expect(before?.length).toBe(29);
    expect(c.codingStyle(def)).toBe('long');
    const after = [...before!];
    after[18] |= 0x04;
    const res = await c.writeCoding(def, before!, after);
    expect(res.ok).toBe(true);
    expect(await c.readCoding(def)).toEqual(after);
  }, 20000);
});

describe('one module conversation at a time', () => {
  it('keeps a coding write on its module while sensors are read at the same time', async () => {
    const c = new ElmClient(new SimTransport(a6, 0));
    await c.initialise();
    c.setMake('vag', 'MLB');
    const def = c.moduleById('vag-17')!;
    const before = (await c.readCoding(def))!;
    const after = [...before];
    after[6] ^= 0x80;
    const rows = sensorsFor('vag').filter((r) => r.h === '7E0').slice(0, 40);
    const [, res] = await Promise.all([c.readSensors(rows), c.writeCoding(def, before, after), c.readSensors(rows)]);
    expect(res.ok).toBe(true);
    expect(await c.readCoding(def)).toEqual(after);
  }, 30000);
});

describe('deep scan links what it finds', () => {
  const leon = DEMO_CARS.find((c) => c.id === 'leon')!;

  it('names each module, ties it to its module id and reads its coding there', async () => {
    const c = new ElmClient(new SimTransport(leon, 0));
    await c.initialise();
    c.setMake('vag', 'PQ35');
    const found = await c.deepScan([0x20, 0x07, 0x09]);
    const bcm = found.find((m) => m.address === 0x20)!;
    expect(bcm.moduleId).toBe('vag-09');
    expect(bcm.part).toBe('1K0937049N');
    expect(found.find((m) => m.address === 0x07)!.moduleId).toBe('vag-17');
    expect(c.routeOf(c.moduleById('vag-09')!)).toBe('tp20');
    expect((await c.readCoding(c.moduleById('vag-09')!))?.length).toBeGreaterThan(0);
  });

  it('gives an unknown address its own module entry, and links it again on the next connect', async () => {
    const car = { ...leon, tp20: { ...leon.tp20, 0x62: { faults: [], part: '1K0959433', sw: '0001', component: 'Test module' } } };
    const c = new ElmClient(new SimTransport(car, 0));
    await c.initialise();
    c.setMake('vag', 'PQ35');
    const [m] = await c.deepScan([0x62]);
    expect(m.moduleId).toBe('vag-at62');
    const again = new ElmClient(new SimTransport(car, 0));
    await again.initialise();
    again.setMake('vag', 'PQ35');
    again.rememberDeep([{ address: 0x62 }]);
    expect(again.moduleById('vag-at62')?.name).toBeTruthy();
    expect(again.routeOf(again.moduleById('vag-at62')!)).toBe('tp20');
  });
});
