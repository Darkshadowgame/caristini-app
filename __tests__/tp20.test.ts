import { ElmClient } from '../src/obd/elm';
import { DEMO_CARS, SimTransport } from '../src/obd/simTransport';
import { kwpFaults, kwpReadFaults, parseRawFrames, Tp20Session } from '../src/obd/tp20';
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

// What the 2007 Leon's comfort and central electronics did on 14 Nov 2026.
describe('extra messages and lost frames', () => {
  const session = (reply: (c: string) => string, sent: string[]) => {
    const s = new Tp20Session(async (c) => {
      sent.push(c);
      if (c === '21C000100003011') return '22100D00003280301\r\r>';
      if (c === 'A00F8AFF32FF1' || c === 'A3') return '300A10F8AFF4AFF\r\r>';
      return `${reply(c) || 'NO DATA'}\r\r>`;
    }, '6');
    return s;
  };

  it('ACKs a second message after 1A 9B before the next request', async () => {
    const sent: string[] = [];
    let acked = false;
    const s = session((c) => {
      if (c === '1000021A9B') return '300B1\r3001000045A9B4142';
      // ACKing the answer brings the extra message (one byte, 5A).
      if (c === 'B1') return '3001180015A';
      if (c === 'B2') {
        acked = true;
        return '';
      }
      // The module ignores a request while it waits for that ACK.
      if (c === '1100021089') return acked ? '300B2\r3001200025089' : '30092';
      return '';
    }, sent);
    expect(await s.open(0x21)).toBe(true);
    expect(await s.request([0x1a, 0x9b], 2000)).toEqual([0x5a, 0x9b, 0x41, 0x42]);
    expect(await s.request([0x10, 0x89], 2000)).toEqual([0x50, 0x89]);
    expect(sent.indexOf('B2')).toBeLessThan(sent.indexOf('1100021089'));
  });

  it('skips an extra message heard with the next answer and asks again when the module dropped the request', async () => {
    const sent: string[] = [];
    const s = session((c) => {
      if (c === '1000021A9B') return '300B1\r3001000045A9B4142';
      if (c === '1100021089') return '30092\r3001180015A';
      if (c === '1200021089') return '300B3\r3001200025089';
      return '';
    }, sent);
    expect(await s.open(0x21)).toBe(true);
    await s.request([0x1a, 0x9b], 2000);
    expect(await s.request([0x10, 0x89], 2000)).toEqual([0x50, 0x89]);
    expect(sent).toContain('B2');
  });

  it('asks again when frames of an answer were lost', async () => {
    const sent: string[] = [];
    const s = session((c) => {
      if (c === '1000021089') return '300B1\r3001000025089';
      // Frames 1 and 2 went by unheard: only 3 and 4 arrive.
      if (c === '1100021A9A') return '300B2\r30023414243444546\r3001447';
      if (c === '1200021A9A') return '300B3\r30025000A5A9A010203\r300160405060708';
      return '';
    }, sent);
    expect(await s.open(0x21)).toBe(true);
    await s.request([0x10, 0x89], 2000);
    expect(await s.request([0x1a, 0x9a], 2000)).toEqual([0x5a, 0x9a, 1, 2, 3, 4, 5, 6, 7, 8]);
    expect(sent).toContain('B5');
  });

  it('tries the other fault-read forms when the engine refuses the usual one', async () => {
    const sent: string[] = [];
    const s = session((c) => {
      if (c === '1000041802FF00') return '300B1\r3001000037F1812';
      if (c === '1100041800FF00') return '300B2\r300110005580101002B';
      return '';
    }, sent);
    expect(await s.open(0x21)).toBe(true);
    expect(await kwpReadFaults(s)).toEqual([{ code: '00256', status: 0x2b }]);
  });
});

describe('value groups for Learn my car', () => {
  it('reads a body module until 8 groups in a row are empty, and the engine to the end', async () => {
    const leon = structuredClone(DEMO_CARS.find((c) => c.id === 'leon')!);
    leon.tp20![0x05].groups = { 1: [0x01, 0xc8, 0x4b], 2: [0x06, 0x0a, 0x64] };
    const t = new SimTransport(leon, 0);
    const send = t.send.bind(t);
    const sent: string[] = [];
    t.send = (cmd: string) => {
      sent.push(cmd);
      return send(cmd);
    };
    const c = new ElmClient(t);
    await c.initialise();
    c.setMake('vag', 'PQ35');
    const res = await c.scanAllFaults('vag');
    const body = res.find((r) => r.def.id === 'vag-15')!.def;
    const got: number[] = [];
    sent.length = 0;
    await c.scanMeasuringBlocks(body, (g) => got.push(g), undefined, { to: 64, stopAfterEmpty: 8 });
    expect(got).toEqual([1, 2]);
    // Its 3 named groups (21, 27, 31) first, then 1 to 10.
    expect(sent.filter((x) => /^1.0002210[0-9A-F]$|^1.000221[0-9A-F]{2}$/.test(x)).length).toBeLessThanOrEqual(13);
    const engine: number[] = [];
    await c.scanMeasuringBlocks(res.find((r) => r.def.id === 'engine')!.def, (g) => engine.push(g), undefined, { to: 255 });
    expect(engine).toEqual([115]);
  }, 60000);
});

describe('listen time on older VW modules (Leon logs of 15 Nov 2026)', () => {
  it('listens 100 ms after each frame, so the ACK goes out before the module repeats itself', async () => {
    const sent: string[] = [];
    const s = new Tp20Session(async (c) => {
      sent.push(c);
      return 'OK\r\r>';
    }, '6');
    await s.enter();
    expect(sent).toContain('ATST19');
    expect(sent).not.toContain('ATST32');
  });

  it('stops a value-group scan when the module stops answering', async () => {
    const leon = structuredClone(DEMO_CARS.find((c) => c.id === 'leon')!);
    const t = new SimTransport(leon, 0);
    const send = t.send.bind(t);
    let groupsAsked = 0;
    t.send = (cmd: string) => {
      // Every measuring-group request from group 3 on gets no answer at all.
      const m = /^1.00022(1)([0-9A-F]{2})$/.exec(cmd);
      if (m) {
        groupsAsked++;
        if (parseInt(m[2], 16) >= 3) return Promise.resolve('NO DATA\r\r>');
      }
      return send(cmd);
    };
    const c = new ElmClient(t);
    await c.initialise();
    c.setMake('vag', 'PQ35');
    const res = await c.scanAllFaults('vag');
    groupsAsked = 0;
    const started = Date.now();
    await c.scanMeasuringBlocks(res.find((r) => r.def.id === 'engine')!.def, () => undefined, undefined, { to: 255 });
    expect(groupsAsked).toBeGreaterThan(3);
    expect(groupsAsked).toBeLessThan(20);
    expect(Date.now() - started).toBeLessThan(60000);
  }, 120000);
});

// Replays of the 2007 Leon's adapter logs of 16 and 20 Nov 2026.
describe('2007 Leon channel behaviour', () => {
  const session = (reply: (c: string, sent: string[]) => string) => {
    const sent: string[] = [];
    const s = new Tp20Session(async (c) => {
      sent.push(c);
      const r = c === '20C000100003011' ? '22000D00003390301' : c === 'A00F8AFF32FF1' ? '300A10F8AFF4AFF' : reply(c, sent);
      return `${r || 'NO DATA'}\r\r>`;
    }, '6');
    return { s, sent };
  };

  it("answers the module's channel test with its parameters", async () => {
    const { s, sent } = session((c) => {
      // Group 0x25: the module ACKs, answers and adds a channel test.
      if (c === '1000022125') return '300B1\r3001000036125AA\r300A3';
      return '';
    });
    expect(await s.open(0x20)).toBe(true);
    expect(await s.request([0x21, 0x25], 1000)).toEqual([0x61, 0x25, 0xaa]);
    // The answer was ACKed, and the test answered when the next request began.
    await s.idle(0);
    await s.request([0x21, 0x25], 300).catch(() => undefined);
    expect(sent).toContain('B1');
    expect(sent).toContain('A10F8AFF32FF');
    expect(sent.indexOf('A10F8AFF32FF')).toBeGreaterThan(sent.indexOf('B1'));
  });

  it('reads every message of an identification that says more follow, and returns the first', async () => {
    let b = 0;
    const { s, sent } = session((c) => {
      // 1A 9B: first message is flagged 80 (more follow), 4 bytes 5A 9B 31 32.
      if (c === '10000021A9B' || c === '1000021A9B') return '300B1\r3001080045A9B3132';
      if (/^B[0-9A-F]$/.test(c)) {
        b++;
        // Filler "5A" (flagged), then the last message without the flag.
        if (b === 1) return '300118001' + '5A';
        if (b === 2) return '3001200045A9B4142';
        return '';
      }
      // The next request must only go out after the last message.
      if (c === '1100021089') return '300B2\r30013000250' + '89';
      return '';
    });
    expect(await s.open(0x20)).toBe(true);
    expect(await s.request([0x1a, 0x9b], 2000)).toEqual([0x5a, 0x9b, 0x31, 0x32]);
    expect(s.extras).toEqual([[0x5a], [0x5a, 0x9b, 0x41, 0x42]]);
    expect(await s.request([0x10, 0x89], 1000)).toEqual([0x50, 0x89]);
    // All three module messages were ACKed before the next request.
    const next = sent.indexOf('1100021089');
    expect(sent.slice(0, next).filter((c) => /^B[0-9A-F]$/.test(c))).toEqual(['B1', 'B2', 'B3']);
  });

  it('sends a request again with the number the module expects when it was not ready', async () => {
    let asked = 0;
    const { s, sent } = session((c) => {
      // First try: "not ready", still expecting frame 0.
      if (c === '1000021089') return ++asked === 1 ? '30090' : '300B1\r30010000250' + '89';
      return '';
    });
    expect(await s.open(0x20)).toBe(true);
    expect(await s.request([0x10, 0x89], 1500)).toEqual([0x50, 0x89]);
    expect(sent.filter((c) => c === '1000021089').length).toBe(2);
  }, 10_000);
});

// Bug review of 20 Nov 2026 (replica/review-2026-11-20/bugs-r1.md).
describe('requests of several frames', () => {
  const open = (reply: (c: string) => string) => {
    const sent: string[] = [];
    const s = new Tp20Session(async (c) => {
      sent.push(c);
      const r = c === '20C000100003011' ? '22000D00003390301' : c === 'A00F8AFF32FF1' ? '300A10F8AFF4AFF' : reply(c);
      return `${r || 'NO DATA'}\r\r>`;
    }, '6');
    return { s, sent };
  };
  // 2E 06 00 and 10 coding bytes: frame 0 "20 000D2E0600C0C1", frame 1 "21 C2..C8", frame 2 "12 C9".
  const write = [0x2e, 0x06, 0x00, 0xc0, 0xc1, 0xc2, 0xc3, 0xc4, 0xc5, 0xc6, 0xc7, 0xc8, 0xc9];

  it('carries on from the frame the module names, with the original numbers (H1)', async () => {
    let lastFrames = 0;
    const { s, sent } = open((c) => {
      // The module lost frame 1: after the last frame it still expects frame 1.
      if (c === '12C9') return ++lastFrames === 1 ? '300B1' : '300B3\r3001000036E0600';
      return '';
    });
    expect(await s.open(0x20)).toBe(true);
    expect(await s.request(write, 1500)).toEqual([0x6e, 0x06, 0x00]);
    const frames = sent.filter((c) => /^[12][0-9A-F]/.test(c) && c.length > 2 && c !== '20C000100003011');
    // Frame 0 once; frames 1 and 2 twice; never a second "20 000D..." joined on.
    expect(frames).toEqual(['20000D2E0600C0C1', '21C2C3C4C5C6C7C8', '12C9', '21C2C3C4C5C6C7C8', '12C9']);
  });

  it('sends the whole request again when the module took none of it', async () => {
    let lastFrames = 0;
    const { s, sent } = open((c) => {
      if (c === '12C9') return ++lastFrames === 1 ? '30090' : '300B3\r3001000036E0600';
      return '';
    });
    expect(await s.open(0x20)).toBe(true);
    expect(await s.request(write, 1500)).toEqual([0x6e, 0x06, 0x00]);
    expect(sent.filter((c) => c === '20000D2E0600C0C1').length).toBe(2);
  }, 10_000);

  it('does not take a late answer to another identifier for this one (L8)', async () => {
    const { s } = open((c) => {
      // A late 62 F1 87 arrives first, then the real 62 F1 97.
      if (c === '10000322F197') return '300B1\r3001000046' + '2F187AA';
      if (c === 'B1') return '3001100046' + '2F197BB';
      return '';
    });
    expect(await s.open(0x20)).toBe(true);
    expect(await s.request([0x22, 0xf1, 0x97], 2500)).toEqual([0x62, 0xf1, 0x97, 0xbb]);
  }, 10_000);
});

describe('old-style long coding record (M9)', () => {
  const { parseLongCodingRecord } = require('../src/obd/tp20');
  const head = [0x00, 0x06, 0x46, 0x22, 0x19, 0x29, 0xb2, 0x30, 0x30, 0x32];
  it('reads a record of the expected shape', () => {
    expect(parseLongCodingRecord([...head, 0x10, 0x04, 0xa1, 0xa2, 0xa3, 0xff])).toEqual({ wsc: head.slice(0, 6), sw: head.slice(6), coding: [0xa1, 0xa2, 0xa3] });
  });
  it('refuses a record with no FF at the end, a wrong length or another type', () => {
    expect(parseLongCodingRecord([...head, 0x10, 0x04, 0xa1, 0xa2, 0xa3, 0x00])).toBeNull();
    expect(parseLongCodingRecord([...head, 0x10, 0x05, 0xa1, 0xa2, 0xa3, 0xff])).toBeNull();
    expect(parseLongCodingRecord([...head, 0x03, 0x04, 0xa1, 0xa2, 0xa3, 0xff])).toBeNull();
  });
});

describe('adapter fixes from the bug review of 20 Nov 2026', () => {
  const { parseMessages } = require('../src/obd/elm');

  it('keeps an answer of more than 16 frames in one piece (M4)', () => {
    // 59 02 FF and 30 faults of 4 bytes: 123 bytes, 18 frames. The frame
    // index wraps from F: to 0: and 1:.
    const bytes = [0x59, 0x02, 0xff];
    for (let i = 0; i < 30; i++) bytes.push(0x01, i, 0x00, 0x08);
    const hex = bytes.map((b: number) => b.toString(16).toUpperCase().padStart(2, '0')).join('');
    const lines = ['07B', `0:${hex.slice(0, 12)}`];
    for (let at = 12, n = 1; at < hex.length; at += 14, n++) lines.push(`${(n % 16).toString(16).toUpperCase()}:${hex.slice(at, at + 14).padEnd(14, 'A')}`);
    const msgs = parseMessages(`${lines.join('\r')}\r\r>`, '1902FF');
    expect(msgs).toHaveLength(1);
    expect(msgs[0]).toEqual(bytes);
  });

  it('still starts a new message at 0: once the first is complete', () => {
    const msgs = parseMessages('008\r0:490201313233\r1:34353600000000\r008\r0:490201414243\r1:44454600000000\r\r>', '0902');
    expect(msgs).toHaveLength(2);
  });

  it('reads an older module again after its faults are cleared, even after a search (M5)', async () => {
    const c = new ElmClient(new SimTransport(a6, 0));
    await c.initialise();
    const before = await c.deepScan([0x22]);
    expect(before[0].faults.length).toBeGreaterThan(0);
    await c.clearTp20(0x22);
    // The address is now tied to a named module: a plain search skips it.
    expect(await c.deepScan([0x22])).toEqual([]);
    const [after] = await c.deepScan([0x22], undefined, undefined, undefined, { known: true });
    expect(after.address).toBe(0x22);
    expect(after.faults).toEqual([]);
  });
});
