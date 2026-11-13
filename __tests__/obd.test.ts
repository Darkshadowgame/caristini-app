import { asciiToBase64, base64ToAscii } from '../src/obd/base64';
import { decodeDtc, describeDtc, encodeDtc } from '../src/obd/dtc';
import { ElmClient, ObdError, parseMessages } from '../src/obd/elm';
import { decodeReadiness, LIVE_PIDS, supportedFromMask } from '../src/obd/pids';
import { DEMO_CARS, SimTransport } from '../src/obd/simTransport';

describe('parseMessages', () => {
  it('reads a single-frame reply with spaces and prompt', () => {
    expect(parseMessages('41 0C 1A F8 \r\r>', '010C')).toEqual([[0x41, 0x0c, 0x1a, 0xf8]]);
  });

  it('joins ISO-TP multi-frame output and drops padding', () => {
    const raw = '014\r0:490201575657\r1:5A5A5A41555A48\r2:57303030303031\r\r>';
    const [m] = parseMessages(raw, '0902');
    expect(m).toHaveLength(0x14);
    expect(String.fromCharCode(...m.slice(3))).toBe('WVWZZZAUZHW000001');
  });

  it('trims padding on the last frame to the declared length', () => {
    const [m] = parseMessages('008\r0:620600010000\r1:00000000000000\r\r>', '220600');
    expect(m).toEqual([0x62, 0x06, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00]);
  });

  it('keeps replies from two ECUs apart', () => {
    expect(parseMessages('4301013300\r43010420\r>', '03')).toHaveLength(2);
  });

  it('ignores SEARCHING and BUS INIT OK lines', () => {
    expect(parseMessages('SEARCHING...\rBUS INIT: ...OK\r4100BE3FA813\r>', '0100')).toEqual([[0x41, 0x00, 0xbe, 0x3f, 0xa8, 0x13]]);
  });

  it('throws NO DATA and adapter errors', () => {
    expect(() => parseMessages('NO DATA\r>', '0A')).toThrow('NO DATA');
    expect(() => parseMessages('CAN ERROR\r>', '0100')).toThrow(ObdError);
    expect(() => parseMessages('?\r>', 'XYZ')).toThrow('did not understand');
  });
});

describe('fault codes', () => {
  it.each([
    [[0x01, 0x71], 'P0171'],
    [[0x04, 0x20], 'P0420'],
    [[0x24, 0x2f], 'P242F'],
    [[0xc1, 0x00], 'U0100'],
    [[0x41, 0x23], 'C0123'],
    [[0x80, 0x01], 'B0001'],
  ])('decodes %j as %s and back', (bytes, code) => {
    expect(decodeDtc(bytes[0], bytes[1])).toBe(code);
    expect(encodeDtc(code)).toEqual(bytes);
  });

  it('treats 0000 padding as no code', () => {
    expect(decodeDtc(0, 0)).toBeNull();
  });

  it('labels manufacturer codes per SAE J2012', () => {
    expect(describeDtc('P1234').text).toMatch(/Manufacturer/);
    expect(describeDtc('P3001').text).toMatch(/Manufacturer/);
    expect(describeDtc('P3401').text).not.toMatch(/Manufacturer/);
    expect(describeDtc('U3000').text).not.toMatch(/Manufacturer/);
    expect(describeDtc('B2000').text).toMatch(/Manufacturer/);
  });
});

describe('pids', () => {
  it('decodes the supported-PID mask', () => {
    // BE 1F A8 13: PIDs 01, 03-07, 0C-11, 13, 15, 1C, 1F, 20
    expect(supportedFromMask(0x00, [0xbe, 0x1f, 0xa8, 0x13])).toEqual([
      0x01, 0x03, 0x04, 0x05, 0x06, 0x07, 0x0c, 0x0d, 0x0e, 0x0f, 0x10, 0x11, 0x13, 0x15, 0x1c, 0x1f, 0x20,
    ]);
  });

  it('uses the SAE formulas', () => {
    const get = (pid: number) => LIVE_PIDS.find((p) => p.pid === pid)!;
    expect(get(0x0c).decode([0x1a, 0xf8])).toBe(1726);
    expect(get(0x05).decode([0x7b])).toBe(83);
    expect(get(0x06).decode([0x80])).toBe(0);
    expect(get(0x42).decode([0x36, 0xb0])).toBeCloseTo(14.0, 1);
  });

  it('reads readiness for petrol and diesel', () => {
    const petrol = decodeReadiness(0x07, 0x65, 0x04);
    expect(petrol.diesel).toBe(false);
    expect(petrol.monitors.find((m) => m.name === 'Evaporative system')?.state).toBe('incomplete');
    expect(petrol.monitors.find((m) => m.name === 'Catalyst')?.state).toBe('complete');
    const diesel = decodeReadiness(0x0f, 0xeb, 0x40);
    expect(diesel.diesel).toBe(true);
    expect(diesel.monitors.find((m) => m.name === 'Particulate filter')?.state).toBe('incomplete');
  });
});

describe('base64', () => {
  it('round-trips adapter text', () => {
    for (const s of ['ATZ\r', '0100\r', 'A', 'AB', 'ELM327 v2.2\r\r>']) {
      expect(base64ToAscii(asciiToBase64(s))).toBe(s);
    }
    expect(asciiToBase64('ATZ\r')).toBe('QVRaDQ==');
  });
});

describe('ElmClient against the simulated car', () => {
  it('identifies, reads, clears and keeps permanent codes', async () => {
    const c = new ElmClient(new SimTransport(DEMO_CARS[0], 0));
    const info = await c.initialise();
    expect(info.vin).toBe(DEMO_CARS[0].vin);
    expect(info.isCan).toBe(true);
    expect(info.milOn).toBe(true);
    expect(info.storedCount).toBe(3);

    const codes = await c.readFaultCodes();
    expect(codes.stored).toEqual(['P0420', 'P0171', 'P0300']);
    expect(codes.pending).toEqual(['P0171']);
    expect(codes.permanent).toEqual(['P0420']);

    const ff = await c.readFreezeFrame();
    expect(ff?.code).toBe('P0420');
    expect(ff?.values.find((v) => v.pid === 0x0c)?.value).toBe(750);

    await c.clearFaultCodes();
    const after = await c.readFaultCodes();
    expect(after.stored).toEqual([]);
    expect(after.permanent).toEqual(['P0420']);
    const status = await c.readStatus();
    expect(status.milOn).toBe(false);
    expect(status.monitors.every((m) => m.name === 'Misfire' || m.name === 'Fuel system' || m.name === 'Components' || m.state === 'incomplete')).toBe(true);
    expect(await c.readFreezeFrame()).toBeNull();
  });

  it('lists the live values the car supports and reads them', async () => {
    const c = new ElmClient(new SimTransport(DEMO_CARS[0], 0));
    await c.initialise();
    const pids = await c.livePidsForCar();
    expect(pids.length).toBeGreaterThan(20);
    const rpm = await c.readLive(pids.find((p) => p.pid === 0x0c)!);
    expect(rpm).toBeGreaterThanOrEqual(700);
  });

  it('scans modules for the detected maker and restores OBD addressing', async () => {
    const c = new ElmClient(new SimTransport(DEMO_CARS.find((c) => c.id === 'ford')!, 0));
    await c.initialise();
    const mods = await c.scanModules('ford');
    expect(mods.filter((m) => m.responded).map((m) => m.def.id)).toEqual(['engine', 'ford-abs', 'ford-rcm', 'ford-bcm', 'ford-pscm']);
    expect(mods.find((m) => m.def.id === 'ford-bcm')?.partNumber).toBe('DEMO-14A073-ST');
    // The ST cluster is on the second bus: no answer with this adapter.
    expect(mods.find((m) => m.def.id === 'ford-ipc')?.responded).toBe(false);
    expect(mods.find((m) => m.def.id === 'gearbox')?.responded).toBe(false);
    // Normal OBD requests still work after the scan.
    expect((await c.readStatus()).storedCount).toBe(3);
  });

  it('sets flow control only for the VW cluster and resets it after', async () => {
    const sim = new SimTransport(DEMO_CARS[0], 0);
    const sent: string[] = [];
    const send = sim.send.bind(sim);
    sim.send = (cmd: string) => {
      sent.push(cmd);
      return send(cmd);
    };
    const c = new ElmClient(sim);
    await c.initialise();
    await c.scanModules('vag');
    expect(sent).toContain('ATFCSH714');
    expect(sent).toContain('ATFCSM1');
    expect(sent.lastIndexOf('ATFCSM0')).toBeGreaterThan(sent.lastIndexOf('ATFCSM1'));
  });

  it('does not cache an empty supported list after a failed read', async () => {
    const sim = new SimTransport(DEMO_CARS[0], 0);
    const c = new ElmClient(sim);
    await c.initialise();
    const send = sim.send.bind(sim);
    sim.send = async (cmd: string) => (cmd === '0100' ? 'NO DATA' : send(cmd));
    expect((await c.supportedPids()).size).toBe(0);
    sim.send = send;
    expect((await c.supportedPids()).size).toBeGreaterThan(20);
  });
});
