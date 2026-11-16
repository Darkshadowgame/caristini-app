import { batchCommand, batchVerdict, chunkPids, MAX_PIDS_PER_REQUEST, parseBatch } from '../src/obd/livePidBatch';
import { ElmClient } from '../src/obd/elm';
import { DEMO_CARS, SimTransport } from '../src/obd/simTransport';
import { LIVE_PIDS, LivePid } from '../src/obd/pids';
import { Transport } from '../src/obd/transport';
import { bandWords, trimBand, trimDirection, trimPids, trimPosition, trimTotal } from '../src/live/trims';
import { boostDeviation, BoostSample, boostSummary, decodePid70, leonBoost, pushSample } from '../src/live/boost';
import { parseMeasuringBlock } from '../src/obd/tp20';

const pid = (n: number) => LIVE_PIDS.find((p) => p.pid === n)!;

describe('combined Mode 01 requests', () => {
  test('chunks fit one CAN frame and at most 6 values', () => {
    const one = Array.from({ length: 9 }, () => ({ bytes: 0 }));
    expect(chunkPids(one).map((c) => c.length)).toEqual([MAX_PIDS_PER_REQUEST, 3]);
    // 1-byte values: 3 per frame (PID + 1 byte each, 6 bytes).
    const ones = [pid(0x05), pid(0x0d), pid(0x04), pid(0x0b), pid(0x0f)];
    expect(chunkPids(ones).map((c) => c.length)).toEqual([3, 2]);
    // A 2-byte value and a 1-byte value: 5 bytes.
    expect(chunkPids([pid(0x0c), pid(0x05), pid(0x10)]).map((c) => c.map((p) => p.pid))).toEqual([[0x0c, 0x05], [0x10]]);
    expect(batchCommand([pid(0x0c), pid(0x05)])).toBe('010C05');
  });

  test('reads every value of a combined answer, in any order', () => {
    const chunk = [pid(0x0c), pid(0x05)];
    // 41 05 5A 0C 1A F8: coolant 50 °C, then 1726 rpm.
    const { values, got } = parseBatch([[0x41, 0x05, 0x5a, 0x0c, 0x1a, 0xf8]], chunk);
    expect(got).toBe(2);
    expect(values.get(0x05)).toBe(50);
    expect(values.get(0x0c)).toBe(1726);
    expect(batchVerdict([[0x41, 0x05, 0x5a, 0x0c, 0x1a, 0xf8]], chunk, got)).toBe(true);
  });

  test('a cut-short or partial answer keeps what was read', () => {
    const chunk = [pid(0x0c), pid(0x05), pid(0x0d)];
    const { values, got } = parseBatch([[0x41, 0x0c, 0x1a, 0xf8, 0x05]], chunk);
    expect(got).toBe(1);
    expect([...values.keys()]).toEqual([0x0c]);
    // Only the first value's worth of data: this car reads one PID per request.
    expect(batchVerdict([[0x41, 0x0c, 0x1a, 0xf8]], chunk, 1)).toBe(false);
    // No answer, or not a Mode 01 answer: decide later.
    expect(batchVerdict([], chunk, 0)).toBeNull();
    expect(batchVerdict([[0x7f, 0x01, 0x12]], chunk, 0)).toBeNull();
  });

  test('two modules answering: a value replaces a null, not the other way', () => {
    const o2: LivePid = pid(0x14);
    const chunk = [o2, pid(0x05)];
    const { values } = parseBatch(
      [
        [0x41, 0x14, 0xff, 0xff, 0x05, 0x5a],
        [0x41, 0x14, 0x5a, 0xff],
      ],
      chunk,
    );
    expect(values.get(0x14)).toBeCloseTo(0.45);
    expect(values.get(0x05)).toBe(50);
  });

  test('a car that answers only the first PID falls back to one PID per request', async () => {
    const a6 = DEMO_CARS.find((c) => c.id === 'a6')!;
    const sim = new SimTransport(a6, 0);
    const asked: string[] = [];
    const firstOnly: Transport = {
      kind: 'simulated',
      label: 'first only',
      send: (cmd) => {
        const c = cmd.replace(/\s/g, '').toUpperCase();
        if (/^01([0-9A-F]{2}){2,}$/.test(c)) {
          asked.push(c);
          return sim.send(c.slice(0, 4));
        }
        return sim.send(cmd);
      },
      close: () => sim.close(),
    };
    const c = new ElmClient(firstOnly);
    await c.initialise();
    const list = [pid(0x0c), pid(0x05), pid(0x0d), pid(0x04)];
    const got = await c.readLiveMany(list);
    for (const p of list) expect(got.get(p.pid)).not.toBeNull();
    expect(c.batching).toBe(false);
    const before = asked.length;
    await c.readLiveMany(list);
    expect(asked.length).toBe(before);
  });

  test('a car that answers combined requests reads several values per request', async () => {
    const a6 = DEMO_CARS.find((c) => c.id === 'a6')!;
    const c = new ElmClient(new SimTransport(a6, 0));
    await c.initialise();
    const got = await c.readLiveMany([pid(0x0c), pid(0x05), pid(0x0d)]);
    expect(got.size).toBe(3);
    expect(c.batching).toBe(true);
  });
});

describe('fuel trims', () => {
  test('bands', () => {
    expect(trimBand(3)).toBe('ok');
    expect(trimBand(-10)).toBe('ok');
    expect(trimBand(-12.5)).toBe('watch');
    expect(trimBand(20)).toBe('watch');
    expect(trimBand(24)).toBe('high');
    expect(trimBand(null)).toBeNull();
    expect(bandWords('high')).toBe('High');
  });

  test('total, direction and bar position', () => {
    expect(trimTotal(4, 9)).toBe(13);
    expect(trimTotal(null, -3)).toBe(-3);
    expect(trimTotal(null, null)).toBeNull();
    expect(trimDirection(8)).toBe('adding');
    expect(trimDirection(-8)).toBe('removing');
    expect(trimDirection(0.4)).toBe('none');
    expect(trimPosition(0)).toBe(0.5);
    expect(trimPosition(-40)).toBe(0);
    expect(trimPosition(12.5)).toBe(0.75);
  });

  test('which banks and sensors to read', () => {
    const one = trimPids([0x06, 0x07, 0x14, 0x15, 0x44, 0x34]);
    expect(one.banks.map((b) => b.bank)).toEqual([1]);
    expect(one.pids.sort((a, b) => a - b)).toEqual([0x06, 0x07, 0x14, 0x15, 0x34, 0x44]);
    expect(trimPids([0x06, 0x07, 0x08, 0x09]).banks).toHaveLength(2);
    expect(trimPids([0x0c, 0x44]).pids).toEqual([]);
  });
});

describe('boost actual vs requested', () => {
  test('Cupra group 115 from the measuring block', () => {
    // 01 C8 4B: 3000 rpm; 21 64 50: load; 12 FA C8: 2000 mbar; 12 FA BE: 1900 mbar.
    const cells = parseMeasuringBlock([0x61, 115, 0x01, 0xc8, 0x4b, 0x21, 0x64, 0x50, 0x12, 0xfa, 0xc8, 0x12, 0xfa, 0xbe], 115);
    const b = leonBoost(cells);
    expect(b?.rpm).toBeCloseTo(3000);
    expect(b?.requested).toBeCloseTo(2000);
    expect(b?.actual).toBeCloseTo(1900);
    // A different layout (no mbar) is refused.
    expect(leonBoost([{ value: 1, unit: 'rpm' }, { value: 1, unit: '%' }, { value: 1, unit: '%' }, { value: 1, unit: '%' }])).toBeNull();
    expect(leonBoost(null)).toBeNull();
  });

  test('PID 70 boost pressure control', () => {
    // Both reported: 160 kPa requested (5120/32), 150 kPa actual (4800/32).
    expect(decodePid70([0x03, 0x14, 0x00, 0x12, 0xc0, 0, 0, 0, 0, 0])).toEqual({ requested: 1600, actual: 1500 });
    // Only the sensor reported.
    expect(decodePid70([0x02, 0x14, 0x00, 0x12, 0xc0])).toEqual({ requested: null, actual: 1500 });
    expect(decodePid70([0x03])).toEqual({ requested: null, actual: null });
  });

  test('deviation and summary', () => {
    expect(boostDeviation(2000, 1900)).toEqual({ diff: -100, state: 'ok' });
    expect(boostDeviation(2000, 1800).state).toBe('under');
    expect(boostDeviation(1500, 1700).state).toBe('over');
    const s = [
      { at: 0, rpm: 2000, requested: 1500, actual: 1400 },
      { at: 1, rpm: 3000, requested: 2000, actual: 1750 },
      { at: 2, rpm: 4000, requested: 1900, actual: 2000 },
    ];
    expect(boostSummary(s)).toEqual({ worstUnder: -250, worstOver: 100, peakActual: 2000 });
    let list: BoostSample[] = s;
    for (let i = 0; i < 5; i++) list = pushSample(list, s[0], 4);
    expect(list).toHaveLength(4);
  });
});
