import { dtcBytes, ElmClient } from '../src/obd/elm';
import { EXTRAS, extrasFor, formatExtra } from '../src/obd/extras';
import { MODULES } from '../src/obd/modules';
import { DEMO_CARS, SimTransport } from '../src/obd/simTransport';
import { cleanText, describeFailureType, faultState, formatUdsDtc, negativeCode, parseDtcReport } from '../src/obd/uds';

describe('UDS fault codes', () => {
  it('formats 3-byte codes the way workshop tools show them', () => {
    expect(formatUdsDtc(0xd1, 0x13, 0x00)).toBe('U111300');
    expect(formatUdsDtc(0x07, 0x16, 0x00)).toBe('P071600');
    expect(formatUdsDtc(0x01, 0x71, 0x1c)).toBe('P01711C');
    expect(formatUdsDtc(0, 0, 0)).toBeNull();
  });

  it('reads a 19 02 report and its status bits', () => {
    const faults = parseDtcReport([0x59, 0x02, 0xff, 0xd1, 0x13, 0x00, 0x28, 0x07, 0x16, 0x00, 0x09, 0x00, 0x00, 0x00, 0x00])!;
    expect(faults.map((f) => f.code)).toEqual(['U111300', 'P071600']);
    expect(faults[0].state).toBe('stored');
    expect(faults[1].state).toBe('active');
    expect(faultState(0x04)).toBe('pending');
    expect(faultState(0x20)).toBe('intermittent');
    expect(parseDtcReport([0x7f, 0x19, 0x11])).toBeNull();
  });

  it('reads negative responses and failure types', () => {
    expect(negativeCode([0x7f, 0x19, 0x78], 0x19)).toBe(0x78);
    expect(negativeCode([0x59, 0x02], 0x19)).toBeNull();
    expect(describeFailureType(0x13)).toBe('Circuit open');
  });

  it('strips identification padding', () => {
    const bytes = [...'03L906018LB '].map((c) => c.charCodeAt(0));
    expect(cleanText(bytes)).toBe('03L906018LB');
    expect(cleanText([...'4G0927155T'].map((c) => c.charCodeAt(0)).concat([0x20, 0x00]))).toBe('4G0927155T');
  });
});

describe('module scan on the demo VW', () => {
  it('lists faults per module, clears one module and leaves the rest', async () => {
    const c = new ElmClient(new SimTransport(DEMO_CARS[0], 0));
    await c.initialise();
    const seen: number[] = [];
    const res = await c.scanAllFaults('vag', (_r, done) => seen.push(done));
    expect(seen.length).toBe(res.length);
    expect(seen[seen.length - 1]).toBe(res.length);
    expect(res.filter((r) => r.state !== 'no-answer').length).toBe(10);
    const cluster = res.find((r) => r.def.id === 'vag-17')!;
    expect(cluster.state).toBe('faults');
    expect(cluster.faults[0].code).toBe('U111300');
    expect(res.find((r) => r.def.id === 'gearbox')!.faults.map((f) => f.code)).toEqual(['P071600', 'P171E00']);

    await c.clearModuleFaults(cluster.def);
    const after = await c.readModuleFaults(cluster.def);
    expect(after.state).toBe('ok');
    expect((await c.readModuleFaults(res.find((r) => r.def.id === 'gearbox')!.def)).faults).toHaveLength(2);
    // OBD addressing is restored afterwards.
    expect((await c.readStatus()).storedCount).toBe(3);
  });

  it('reads full module details and battery voltage', async () => {
    const c = new ElmClient(new SimTransport(DEMO_CARS[0], 0));
    await c.initialise();
    const engine = await c.readModuleDetails(MODULES[0]);
    expect(engine.partNumber).toBe('04E906016DE');
    expect(engine.systemName).toBe('R4 1.4l TSI');
    expect(engine.coding).toBe('0100000000');
    const v = await c.batteryVoltage();
    expect(v).toBeGreaterThan(13);
  });

  it('reports modules that do not answer', async () => {
    const c = new ElmClient(new SimTransport(DEMO_CARS.find((c) => c.id === 'mazda')!, 0));
    await c.initialise();
    const res = await c.scanAllFaults('mazda');
    expect(res.find((r) => r.def.id === 'gearbox')!.state).toBe('no-answer');
  });
});

describe('maker data', () => {
  it('reads only the values the car answers', async () => {

    const c = new ElmClient(new SimTransport(DEMO_CARS[0], 0));
    await c.initialise();
    const got = await c.readExtras(extrasFor('vag'));
    expect(got['odo-cluster']).toBe(98765);
    expect(got['oil-temp']).toBe(90);
    expect(got['crash-front']).toBe(0);
    expect(got['dpf-soot-calc']).toBeUndefined();
    expect(formatExtra(EXTRAS[0], 98765)).toBe('61,370 mi (98,765 km)');
    expect((await c.readStatus()).storedCount).toBe(3);
  });
});

describe('behaviours seen on the A6 C7', () => {
  const find = (id: string) => MODULES.find((m) => m.id === id)!;

  it('waits for a gearbox that answers "busy, wait" first', async () => {
    const c = new ElmClient(new SimTransport(DEMO_CARS[0], 0));
    await c.initialise();
    const r = await c.readModuleFaults(find('gearbox'));
    expect(r.state).toBe('faults');
    expect(r.faults.map((f) => f.code)).toEqual(['P071600', 'P171E00']);
  });

  it('retries an airbag module that answers "busy, repeat"', async () => {
    const c = new ElmClient(new SimTransport(DEMO_CARS[0], 0));
    await c.initialise();
    const r = await c.readModuleFaults(find('vag-15'));
    expect(r.state).toBe('ok');
  });

  it('clears an engine that only allows it in the extended session', async () => {
    const c = new ElmClient(new SimTransport(DEMO_CARS[0], 0));
    await c.initialise();
    await c.clearModuleFaults(find('engine'));
    expect((await c.readModuleFaults(find('engine'))).faults).toHaveLength(0);
  });

  it('shows maker-numbered faults without inventing an SAE code', async () => {
    const c = new ElmClient(new SimTransport(DEMO_CARS[0], 0));
    await c.initialise();
    const r = await c.readModuleFaults(find('vag-08'));
    expect(r.faults[0].code).toBe('0000F3');
    expect(r.faults[0].base).toBe('');
  });
});

describe('Ford and Mazda maker data', () => {
  it('reads the Focus ST body module and engine values', async () => {
    const c = new ElmClient(new SimTransport(DEMO_CARS.find((x) => x.id === 'ford')!, 0));
    await c.initialise();
    const got = await c.readExtras(extrasFor('ford'));
    expect(got['ford-odo']).toBe(101418);
    expect(got['ford-bat-v']).toBeCloseTo(13);
    expect(got['ford-oil-life']).toBe(86);
    expect(got['ford-oil-temp']).toBeUndefined();
  });

  it('reads the Mazda6 diesel DPF values', async () => {
    const c = new ElmClient(new SimTransport(DEMO_CARS.find((x) => x.id === 'mazda')!, 0));
    await c.initialise();
    const got = await c.readExtras(extrasFor('mazda'));
    expect(got['mazda-oil-temp']).toBeCloseTo(90.56);
    expect(got['mazda-regen-count']).toBe(130);
    expect(got['mazda-regen']).toBe(0);
    expect(got['mazda-map']).toBe(104);
    expect(got['mazda-bat-v']).toBeCloseTo(12.7);
  });
});

describe('fault details', () => {
  it('turns codes back into the 3 bytes a module uses', () => {
    expect(dtcBytes('P0011B5')).toEqual([0x00, 0x11, 0xb5]);
    expect(dtcBytes('U111300')).toEqual([0xd1, 0x13, 0x00]);
    expect(dtcBytes('0000F3')).toEqual([0x00, 0x00, 0xf3]);
    expect(dtcBytes('00256')).toBeNull();
  });

  it('reads the records the module keeps for a fault', async () => {
    const c = new ElmClient(new SimTransport(DEMO_CARS.find((x) => x.id === 'a6')!, 0));
    await c.initialise();
    const d = await c.readFaultDetails(MODULES.find((m) => m.id === 'engine')!, 'P0011B5');
    expect(d.extended).toBe('0103002A');
  });
});
