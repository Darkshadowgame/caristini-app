import { ElmClient } from '../src/obd/elm';
import { DEMO_CARS, SimTransport } from '../src/obd/simTransport';
import { changedValues, decodeRecording, holdsDate, holdsDistance, resetFromCompare, resetFromRecording, ServiceReset } from '../src/service/obdReset';

const hex = (b: number[]) => b.map((x) => x.toString(16).toUpperCase().padStart(2, '0')).join('');

// Listen-mode lines for one ISO-TP message (single or multi-frame).
function frames(t: number, id: string, data: number[]): string[] {
  if (data.length <= 7) return [`${t.toFixed(3)} ${id}${hex([data.length, ...data])}`];
  const out = [`${t.toFixed(3)} ${id}${hex([0x10 | (data.length >> 8), data.length & 0xff, ...data.slice(0, 6)])}`];
  for (let i = 6, sn = 1; i < data.length; i += 7, sn++) out.push(`${t.toFixed(3)} ${id}${hex([0x20 | (sn & 0x0f), ...data.slice(i, i + 7)])}`);
  return out;
}

const cluster = { id: 'vag-17', tx: '714', rx: '77E', name: 'Instrument cluster' };
const seed = [0x12, 0x34, 0x56, 0x78];
const key = (() => {
  const n = (0x12345678 + 20103) >>> 0;
  return [n >>> 24, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff];
})();

function recording(extra: [string, number[]][] = []): string {
  const msgs: [string, number[]][] = [
    ['714', [0x10, 0x03]],
    ['77E', [0x50, 0x03, 0x00, 0x32, 0x01, 0xf4]],
    ['714', [0x22, 0x07, 0x00]],
    ['77E', [0x62, 0x07, 0x00, 0x00, 0x00, 0x3a, 0x98]],
    ['714', [0x27, 0x03]],
    ['77E', [0x67, 0x03, ...seed]],
    ['714', [0x27, 0x04, ...key]],
    ['77E', [0x67, 0x04]],
    ['714', [0x2e, 0xf1, 0x98, 0x00, 0x01, 0x02, 0x03, 0x04, 0x05]],
    ['77E', [0x6e, 0xf1, 0x98]],
    ['714', [0x31, 0x01, 0x0e, 0x10]],
    ['77E', [0x7f, 0x31, 0x78]],
    ['77E', [0x71, 0x01, 0x0e, 0x10, 0x00]],
    ['714', [0x2e, 0x04, 0x56, 0x00, 0x40]],
    ['77E', [0x7f, 0x2e, 0x31]],
    ...extra,
  ];
  return ['# Caristini listen test', ...msgs.flatMap(([id, d], i) => frames(i * 0.1, id, d)), '7E8 noise'].join('\n');
}

describe('service reset from a recording', () => {
  it('rebuilds multi-frame messages', () => {
    const m = decodeRecording(recording());
    expect(m.find((x) => x.data[0] === 0x2e)?.data).toEqual([0x2e, 0xf1, 0x98, 0x00, 0x01, 0x02, 0x03, 0x04, 0x05]);
  });

  it('keeps only accepted steps and works out the login code', () => {
    const r = resetFromRecording(recording(), cluster);
    if ('error' in r) throw new Error(r.error);
    // The refused write (7F 2E 31) and the workshop stamp (F198) are left out.
    expect(r.reset.steps).toEqual([
      { kind: 'session', value: 0x03 },
      { kind: 'login', code: 20103, level: 3 },
      { kind: 'routine', id: '0E10' },
    ]);
  });

  it('refuses recordings with a module restart or flashing', () => {
    const r = resetFromRecording(recording([['714', [0x11, 0x01]], ['77E', [0x51, 0x01]]]), cluster);
    expect('error' in r && r.error).toMatch(/does not replay/);
    const p = resetFromRecording(recording([['714', [0x10, 0x02]], ['77E', [0x50, 0x02]]]), cluster);
    expect('error' in p && p.error).toMatch(/programming/);
  });

  it('drops a message with a missing frame', () => {
    const nl = String.fromCharCode(10);
    const lines = recording().split(nl);
    // Remove the first follow-on frame of the F198 write.
    const k = lines.findIndex((l) => / 71421/.test(l));
    const m = decodeRecording(lines.filter((_, i) => i !== k).join(nl));
    expect(m.some((x) => x.data[0] === 0x2e && x.data[1] === 0xf1)).toBe(false);
  });

  it('refuses a recorded write holding the date, or a login it cannot work out', () => {
    const dated = recording([['714', [0x2e, 0x07, 0x01, 0x26, 0x11, 0x12]], ['77E', [0x6e, 0x07, 0x01]]]).replace('# Caristini listen test', '# Caristini listen 2026-11-12T10:00:00.000Z A6');
    const r = resetFromRecording(dated, cluster);
    expect('error' in r && r.error).toMatch(/date/);
    const flash = resetFromRecording(recording([['714', [0x27, 0x11]], ['77E', [0x67, 0x11, 1, 2, 3, 4]]]), cluster);
    expect('error' in flash && flash.error).toMatch(/level 11/);
    const ford = resetFromRecording(recording(), { ...cluster, id: 'ford-ipc' });
    expect('error' in ford && ford.error).toMatch(/key method/);
  });

  it('says when nothing was written to the cluster', () => {
    const r = resetFromRecording(frames(0, '714', [0x22, 0xf1, 0x87]).join('\n'), cluster);
    expect('error' in r).toBe(true);
  });
});

describe('service reset by compare', () => {
  const day = new Date(2026, 10, 12);
  it('holds back values with the date, the odometer, or that move', () => {
    expect(holdsDate([0x00, 0x26, 0x11, 0x12, 0xff], day)).toBe(true);
    expect(holdsDate([0x00, 0x01], day)).toBe(false);
    expect(holdsDistance([0x00, 0x02, 0x49, 0xf0], 150000)).toBe(true);
    expect(holdsDistance([0x00, 0x00, 0x00, 0x00], 150000)).toBe(false);
    const c = changedValues(
      { '0700': '00003A98', '0701': '0000', '0702': '00000000', '0703': '11', '0704': '22' },
      { '0700': '00000000', '0701': '0016', '0702': '000249F0', '0703': '12', '0704': '2233' },
      { date: day, odometerKm: 150000 },
      new Set(['0703']),
    );
    expect(c.map((x) => [x.did, x.hold ?? 'write'])).toEqual([
      ['0700', 'write'],
      ['0701', 'write'],
      ['0702', 'It holds the odometer reading'],
      ['0703', 'It keeps changing on its own (a live value)'],
      ['0704', 'Its length changed'],
    ]);
    const r = resetFromCompare(c, cluster, null, day)!;
    expect(r.steps.map((s) => (s.kind === 'write' ? s.did : s.kind))).toEqual(['session', '0700', '0701']);
  });
});

describe('running a service reset on the demo A6', () => {
  const a6 = () => structuredClone(DEMO_CARS.find((c) => c.id === 'a6')!);
  const start = async () => {
    const c = new ElmClient(new SimTransport(a6(), 0));
    await c.initialise();
    c.setMake('vag', 'MLB');
    return c;
  };
  const read = async (c: ElmClient, did: string) => {
    const r = await c.readRawDid(c.moduleById('vag-17')!, did);
    return 'data' in r ? hex(r.data) : r.error;
  };

  it('runs a recorded reset', async () => {
    const c = await start();
    const r = resetFromRecording(recording(), cluster);
    if ('error' in r) throw new Error(r.error);
    expect(await read(c, '0700')).toBe('00003A98');
    const res = await c.runServiceReset({ ...r.reset, checks: [{ did: '0700' }] });
    expect(res.ok).toBe(true);
    expect(res.checks['0700']).toBe('00000000');
    // The cluster said "busy, wait" first: the routine still went once only.
    expect(((c as unknown as { transport: { routinesRun: number } }).transport).routinesRun).toBe(1);
    // Normal OBD afterwards.
    expect((await c.readStatus()).milOn).toBeDefined();
  });

  it('puts back what it wrote when a later step is refused', async () => {
    const c = await start();
    const reset: ServiceReset = {
      id: 'x',
      title: 'test',
      module: 'vag-17',
      tx: '714',
      rx: '77E',
      source: 'compared',
      learnedAt: '',
      steps: [
        { kind: 'session', value: 3 },
        { kind: 'login', code: 20103 },
        { kind: 'write', did: '0123', value: '02' },
        // Wrong length: the cluster refuses it (7F 2E 13).
        { kind: 'write', did: '0456', value: '004000' },
      ],
    };
    const res = await c.runServiceReset(reset);
    expect(res.ok).toBe(false);
    expect(res.changed).toBe(true);
    expect(res.restored).toBe(true);
    expect(await read(c, '0123')).toBe('01');
    expect(await read(c, '0456')).toBe('0032');
  });
});
