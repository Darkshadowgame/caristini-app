import { ElmClient } from '../src/obd/elm';
import { soleAnswer, splitKnown } from '../src/obd/multiDid';
import { readKey, sensorsFor } from '../src/obd/sensors';
import { DEMO_CARS, SimTransport } from '../src/obd/simTransport';

describe('splitting a several-identifier answer', () => {
  it('splits by known lengths and allows left-out identifiers', () => {
    const answer = [0x62, 0x12, 0x34, 0xaa, 0xbb, 0x56, 0x78, 0xcc];
    expect([...splitKnown(answer, ['1234', '2222', '5678'], [2, 1, 1])!]).toEqual([
      ['1234', [0xaa, 0xbb]],
      ['5678', [0xcc]],
    ]);
  });

  it('refuses an answer that does not fit the lengths', () => {
    expect(splitKnown([0x62, 0x12, 0x34, 0xaa, 0xbb, 0xcc], ['1234'], [2])).toBeNull();
    expect(splitKnown([0x62, 0x12, 0x34, 0xaa], ['1234', '5678'], [2, 1])).toBeNull();
    expect(splitKnown([0x62, 0x99, 0x99, 0xaa], ['1234'], [1])).toBeNull();
  });

  it('reads a search answer only when one identifier answered', () => {
    expect(soleAnswer([0x62, 0x56, 0x78, 0x01, 0x02], ['1234', '5678', '9ABC'])).toEqual({ did: '5678', data: [0x01, 0x02] });
    // 9ABC appears after 5678: two may have answered, so ask them alone.
    expect(soleAnswer([0x62, 0x56, 0x78, 0x01, 0x9a, 0xbc, 0x03], ['1234', '5678', '9ABC'])).toBeNull();
    expect(soleAnswer([0x62, 0x11, 0x11, 0x01], ['1234'])).toBeNull();
  });
});

describe('sensor search and live reads on the demo A6', () => {
  const a6 = () => structuredClone(DEMO_CARS.find((c) => c.id === 'a6')!);
  const rows = sensorsFor('vag');

  const client = async (mode?: 'none' | 'strict' | 'first') => {
    const car = a6();
    if (mode) for (const m of Object.values(car.modules)) m.multiDid = mode;
    const t = new SimTransport(car, 0);
    const reads: string[] = [];
    const send = t.send.bind(t);
    t.send = (cmd: string) => {
      if (cmd.startsWith('22')) reads.push(cmd);
      return send(cmd);
    };
    const c = new ElmClient(t);
    await c.initialise();
    c.setMake('vag', 'MLB');
    return { c, reads };
  };

  it('searches one value per request, finding the same sensors whatever a module does with lists', async () => {
    const one = await client('none');
    const single = (await one.c.probeSensors(rows)).sort();
    const many = await client();
    const listed = (await many.c.probeSensors(rows)).sort();
    const strict = await client('strict');
    const careful = (await strict.c.probeSensors(rows)).sort();
    expect(single.length).toBeGreaterThan(20);
    expect(listed).toEqual(single);
    expect(careful).toEqual(single);
    const first = await client('first');
    expect((await first.c.probeSensors(rows)).sort()).toEqual(single);
    // Every value is asked on its own: no 22 request carries a list.
    expect(many.reads.every((r) => r.length === 6 || r === '22')).toBe(true);
  });

  it('reads live values 3 at a time once each has been read alone', async () => {
    const one = await client('none');
    const keys = new Set(await one.c.probeSensors(rows));
    const live = rows.filter((r) => keys.has(readKey(r)));
    const first = await one.c.readSensors(live);
    one.reads.length = 0;
    const again = await one.c.readSensors(live);
    const singles = one.reads.length;

    const many = await client();
    await many.c.probeSensors(rows);
    await many.c.readSensors(live);
    many.reads.length = 0;
    const listed = await many.c.readSensors(live);
    expect(Object.keys(listed).sort()).toEqual(Object.keys(again).sort());
    expect(Object.keys(first).length).toBeGreaterThan(10);
    expect(many.reads.length).toBeLessThan(singles * 0.5);
  });
});
