import { CODING_ITEMS, codingItemsFor, isOn, withItem } from '../src/coding/items';
import { ElmClient } from '../src/obd/elm';
import { MODULES } from '../src/obd/modules';
import { DEMO_CARS, DemoCar, SimTransport } from '../src/obd/simTransport';

const a6 = DEMO_CARS.find((c) => c.id === 'a6')!;
const cluster = MODULES.find((m) => m.id === 'vag-17')!;
const sweep = CODING_ITEMS.find((i) => i.id === 'c7-needle-sweep')!;

describe('coding items', () => {
  it('are offered per VW group platform, and not for other makes', () => {
    expect(codingItemsFor('vag', 'MLB').length).toBeGreaterThan(1);
    expect(codingItemsFor('vag', 'MQB').map((i) => i.id)).toEqual(expect.arrayContaining(['mqb-needle-sweep', 'mqb-lap-timer']));
    expect(codingItemsFor('vag', 'PQ35').every((i) => i.platforms.includes('PQ35'))).toBe(true);
    // No setting is offered twice for the same bits.
    for (const p of ['MLB', 'MQB', 'PQ35', 'PQ46', 'MLB evo']) {
      const keys = codingItemsFor('vag', p).map((i) => `${i.module}|${i.byte}|${i.bits.join()}|${i.field?.mask ?? ''}|${i.field?.on ?? ''}`);
      expect(new Set(keys).size).toBe(keys.length);
    }
    expect(codingItemsFor('ford', null)).toEqual([]);
  });

  it('set and clear only their own bits', () => {
    const coding = [0x13, 0x03, 0x08, 0, 0, 0, 0, 0, 0, 0, 0];
    expect(isOn(sweep, coding)).toBe(true);
    const off = withItem(sweep, coding, false);
    expect(off[1]).toBe(0x02);
    expect(off.filter((_, i) => i !== 1)).toEqual(coding.filter((_, i) => i !== 1));
    expect(withItem(sweep, off, true)).toEqual(coding);
  });
});

describe('coding writes on the demo A6', () => {
  it('writes, reads back and keeps the change', async () => {
    const c = new ElmClient(new SimTransport(a6, 0));
    await c.initialise();
    const before = (await c.readCoding(cluster))!;
    expect(before).toHaveLength(11);
    const after = withItem(sweep, before, false);
    const res = await c.writeCoding(cluster, before, after);
    expect(res.ok).toBe(true);
    expect(await c.readCoding(cluster)).toEqual(after);
    expect((await c.readStatus()).storedCount).toBeGreaterThanOrEqual(0);
  });

  it('refuses when the coding changed since it was read', async () => {
    const c = new ElmClient(new SimTransport(a6, 0));
    await c.initialise();
    const before = (await c.readCoding(cluster))!;
    const stale = withItem(sweep, before, false);
    await expect(c.writeCoding(cluster, stale, withItem(sweep, stale, true))).rejects.toThrow('changed since it was read');
  });

  it('reports a write the module did not keep, with the original still in place', async () => {
    const odd: DemoCar = JSON.parse(JSON.stringify(a6));
    odd.modules['714'].ignoresWrites = true;
    const c = new ElmClient(new SimTransport(odd, 0));
    await c.initialise();
    const before = (await c.readCoding(cluster))!;
    const res = await c.writeCoding(cluster, before, withItem(sweep, before, false));
    expect(res.ok).toBe(false);
    expect(res.restored).toBe(true);
    expect(await c.readCoding(cluster)).toEqual(before);
  });
});

describe('adaptation values', () => {
  const fresh = () => {
    const car = structuredClone(DEMO_CARS.find((c) => c.id === 'a6')!);
    return new ElmClient(new SimTransport(car, 0));
  };

  it('finds values with a sweep', async () => {
    const c = fresh();
    await c.initialise();
    const found = await c.sweepDids(cluster, 0x0100, 0x0500);
    expect(found).toEqual({ '0123': '01', '0456': '0032' });
  });

  it('asks for a login code, then writes with it and reads back', async () => {
    const c = fresh();
    await c.initialise();
    await expect(c.writeDid(cluster, '0456', [0x00, 0x32], [0x00, 0x40])).rejects.toThrow(/login code/);
    await expect(c.writeDid(cluster, '0456', [0x00, 0x32], [0x00, 0x40], 11111)).rejects.toThrow(/refused/);
    const ok = await c.writeDid(cluster, '0456', [0x00, 0x32], [0x00, 0x40], 20103);
    expect(ok).toMatchObject({ ok: true, coding: [0x00, 0x40] });
  });
});

describe('multi-bit fields', () => {
  it('sets and reads a field value without touching other bits', () => {
    const item = { ...sweep, id: 'x', byte: 0, bits: [], field: { mask: 0x1c, on: 0x08, off: 0x04 } };
    const coding = [0b1110_0101];
    expect(isOn(item, coding)).toBe(true === ((coding[0] & 0x1c) === 0x08));
    const on = withItem(item, coding, true);
    expect(on[0]).toBe(0b1110_1001);
    expect(isOn(item, on)).toBe(true);
    expect(withItem(item, on, false)[0]).toBe(0b1110_0101);
  });
});
