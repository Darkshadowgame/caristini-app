import { decodeFreezeValue, freezeData, readFreezeFrames } from '../src/diag/freeze';
import { monitorMeaning, readinessSummary } from '../src/diag/readiness';
import { diffScans, diffSummary, isFullCheck, previousFull } from '../src/diag/scanDiff';
import { monitorName, parseMode06, readMode06, scale, supportedMids, testName } from '../src/diag/service06';
import { parseCalIds, parseCvns, parseInUse, parseWords, payloads, readMode09 } from '../src/diag/service09';
import { csvField, putBackState, timelineCsv, timelineRows, timelineText } from '../src/diag/timeline';
import type { HistoryEntry } from '../src/history';
import { ElmClient } from '../src/obd/elm';
import { decodeReadiness } from '../src/obd/pids';
import { DEMO_CARS, SimTransport } from '../src/obd/simTransport';

const scanAt = (at: number, faults: { module: string; code: string }[], extra: Partial<HistoryEntry> = {}): HistoryEntry => ({
  id: `s${at}`,
  vin: 'VIN1',
  at,
  kind: 'scan',
  title: '',
  faults,
  complete: true,
  ...extra,
});

describe('scan diff', () => {
  it('finds the previous full check of the same car only', () => {
    const list = [
      scanAt(400, []),
      scanAt(300, [], { complete: false }),
      scanAt(250, [], { noAnswer: true }),
      scanAt(200, [], { vin: 'OTHER' }),
      scanAt(100, []),
      { ...scanAt(350, []), kind: 'change' as const },
    ];
    expect(isFullCheck(list[1])).toBe(false);
    expect(previousFull(list, list[0])?.id).toBe('s100');
    expect(previousFull(list, { at: 50, vin: 'VIN1' })).toBeNull();
  });

  it('splits new, recurring and cleared faults per module', () => {
    const prev = scanAt(100, [
      { module: 'Engine', code: 'P0011B5' },
      { module: 'ABS', code: 'C1234' },
      { module: 'Airbag', code: 'B0001' },
    ]);
    const d = diffScans(prev, {
      faults: [
        { module: 'Engine (OBD2)', code: 'P0011' }, // same fault, read the standard way
        { module: 'ABS', code: 'C9999' },
      ],
      read: ['Engine (OBD2)', 'ABS'],
    })!;
    expect(d.recurring).toBe(1);
    expect(d.added).toBe(1);
    expect(d.cleared).toBe(1);
    expect(d.notRead).toBe(1); // the airbag module did not answer this time
    const abs = d.modules.find((m) => m.module === 'ABS')!;
    expect(abs.added.map((f) => f.code)).toEqual(['C9999']);
    expect(abs.cleared.map((f) => f.code)).toEqual(['C1234']);
    expect(d.modules[0].module).toBe('ABS'); // something new first
    expect(diffSummary(d)).toBe('1 new, 1 seen before, 1 cleared.');
  });

  it('treats every module as read for checks saved without the list', () => {
    const d = diffScans(scanAt(1, [{ module: 'Airbag', code: 'B0001' }]), { faults: [] })!;
    expect(d.cleared).toBe(1);
    expect(d.notRead).toBe(0);
  });

  it('gives nothing without a previous check', () => {
    expect(diffScans(null, { faults: [] })).toBeNull();
  });
});

describe('readiness', () => {
  it('has a meaning for every monitor name the decoder can give', () => {
    const all = [...decodeReadiness(0x07, 0xff, 0x00).monitors, ...decodeReadiness(0x0f, 0xff, 0x00).monitors];
    for (const m of all) expect(monitorMeaning(m.name)).not.toBe('An emissions self-test the car reports.');
  });

  it('summarises complete and not yet run', () => {
    const s = readinessSummary([
      { name: 'Misfire', state: 'complete' },
      { name: 'Catalyst', state: 'incomplete' },
    ]);
    expect(s.text).toBe('1 of 2 complete. Not yet run: Catalyst.');
  });
});

describe('freeze frame', () => {
  it('decodes standard PIDs with units and keeps the rest raw', () => {
    expect(decodeFreezeValue(0x0c, [0x0b, 0xb8]).text).toBe('750 rpm');
    expect(decodeFreezeValue(0x05, [128]).text).toBe('88 °C');
    expect(decodeFreezeValue(0x03, [2, 0]).text).toBe('Closed loop, using oxygen sensor feedback');
    const raw = decodeFreezeValue(0x9f, [1, 2]);
    expect(raw.decoded).toBe(false);
    expect(raw.text).toBe('01 02');
  });

  it('takes only the frame asked for, except frame 0', () => {
    expect(freezeData([[0x42, 0x0c, 0x01, 0x0b, 0xb8]], 0x0c, 1)).toEqual([0x0b, 0xb8]);
    expect(freezeData([[0x42, 0x0c, 0x00, 0x0b, 0xb8]], 0x0c, 1)).toBeNull();
    expect(freezeData([[0x42, 0x0c, 0x01, 0x0b, 0xb8]], 0x0c, 0)).toEqual([0x0b, 0xb8]);
  });

  it('reads support masks and every frame the car keeps', async () => {
    const answers: Record<string, number[][]> = {
      '020200': [[0x42, 0x02, 0x00, 0x01, 0x71]],
      '020000': [[0x42, 0x00, 0x00, 0x30, 0x00, 0x00, 0x00]], // PIDs 03 and 04
      '020300': [[0x42, 0x03, 0x00, 0x02, 0x00]],
      '020400': [[0x42, 0x04, 0x00, 0xff]],
      '020201': [[0x42, 0x02, 0x01, 0x03, 0x00]],
      '020001': [[0x42, 0x00, 0x01, 0x10, 0x00, 0x00, 0x00]], // PID 04
      '020401': [[0x42, 0x04, 0x01, 0x80]],
    };
    const client = { request: async (cmd: string) => answers[cmd] ?? Promise.reject(new Error('NO DATA')) };
    const frames = await readFreezeFrames(client, { isCan: true });
    expect(frames.map((f) => f.code)).toEqual(['P0171', 'P0300']);
    expect(frames[0].values.map((v) => v.label)).toEqual(['Fuel system status', 'Engine load']);
    expect(frames[1].values[0].text).toBe('50 %');
    expect(await readFreezeFrames(client, { isCan: false })).toHaveLength(1);
  });

  it('reads the demo car through the adapter client', async () => {
    const c = new ElmClient(new SimTransport(DEMO_CARS[0], 0));
    const info = await c.initialise();
    const frames = await readFreezeFrames(c, { isCan: info.isCan });
    expect(frames).toHaveLength(1);
    expect(frames[0].code).toBe('P0420');
    expect(frames[0].values.find((v) => v.pid === 0x0c)?.text).toBe('750 rpm');
  });
});

describe('service 06', () => {
  it('scales values with the unit table, signed IDs included', () => {
    expect(scale(0x0b, 0x01, 0xc2)?.text).toBe('0.450 V');
    expect(scale(0x16, 0x03, 0x20)?.text).toBe('40.0 °C'); // 800 x 0.1 - 40
    expect(scale(0x81, 0xff, 0xfe)?.value).toBe(-2);
    expect(scale(0x2e, 0, 1)?.text).toBe('Yes');
    expect(scale(0x50, 0, 1)).toBeNull();
  });

  it('names monitors and tests, and marks maker tests', () => {
    expect(monitorName(0x01)).toBe('Oxygen sensor bank 1 sensor 1');
    expect(monitorName(0x46)).toBe('Oxygen sensor heater bank 2 sensor 2');
    expect(monitorName(0xa4)).toBe('Misfire, cylinder 3');
    expect(monitorName(0xe2)).toBe('Maker monitor E2');
    expect(testName(0x05)).toEqual({ name: 'Rich to lean sensor switch time', known: true });
    expect(testName(0x85).known).toBe(false);
  });

  it('parses blocks of 9 bytes and checks the limits', () => {
    const r = parseMode06([0x46, 0x01, 0x05, 0x10, 0x00, 0x48, 0x00, 0x00, 0x00, 0x78, 0x01, 0x06, 0x10, 0x00, 0x90, 0x00, 0x00, 0x00, 0x78]);
    expect(r).toHaveLength(2);
    expect(r[0]).toMatchObject({ mid: 1, tid: 5, pass: true, test: 'Rich to lean sensor switch time' });
    expect(r[0].value?.text).toBe('72 ms');
    expect(r[1].pass).toBe(false); // 144 ms over 120
    const raw = parseMode06([0x46, 0xe1, 0x91, 0x50, 0x01, 0x23, 0x00, 0x00, 0x04, 0x00]);
    expect(raw[0].value).toBeNull();
    expect(raw[0].pass).toBeNull();
    expect(raw[0].raw).toBe('E1 91 50 01 23 00 00 04 00');
  });

  it('reads support masks', () => {
    expect(supportedMids(0, [[0x46, 0x00, 0xc0, 0x00, 0x00, 0x01]])).toEqual([0x01, 0x02, 0x20]);
  });

  it('reads the demo car', async () => {
    const c = new ElmClient(new SimTransport(DEMO_CARS[0], 0));
    await c.initialise();
    const r = await readMode06(c, { isCan: true });
    expect(r.decoded).toBe(true);
    expect(r.supported).toEqual([0x01, 0x02, 0x21, 0xa1, 0xa2, 0xa3, 0xe1]);
    expect(r.results.length).toBe(8);
    expect(r.results.find((x) => x.mid === 0xe1)?.value).toBeNull();
  });

  it('keeps older protocols raw', async () => {
    const client = { request: async () => [[0x46, 0x00, 0x01, 0x02]] };
    const r = await readMode06(client, { isCan: false });
    expect(r).toMatchObject({ decoded: false, raw: ['46 00 01 02'] });
  });
});

describe('service 09', () => {
  it('splits calibration IDs and CVNs', () => {
    const cal = [...'ABC123'].map((c) => c.charCodeAt(0)).concat(Array(10).fill(0), [...'XYZ'].map((c) => c.charCodeAt(0)), Array(13).fill(0));
    expect(parseCalIds(cal)).toEqual(['ABC123', 'XYZ']);
    expect(parseCvns([0x1a, 0x2b, 0x3c, 0x4d, 0, 0, 0, 1])).toEqual(['1A2B3C4D', '00000001']);
  });

  it('joins messages on older protocols and keeps units apart on CAN', () => {
    const msgs = [
      [0x49, 0x06, 0x01, 1, 2, 3, 4],
      [0x49, 0x06, 0x02, 5, 6, 7, 8],
    ];
    expect(payloads(msgs, 0x06, false)).toEqual([[1, 2, 3, 4, 5, 6, 7, 8]]);
    expect(payloads(msgs, 0x06, true)).toEqual([[1, 2, 3, 4], [5, 6, 7, 8]]);
  });

  it('pairs in-use counters in the standard order', () => {
    const words = parseWords([0, 120, 1, 84, 0, 45, 0, 110]);
    const u = parseInUse(words, 'petrol');
    expect(u.obdConditions).toBe(120);
    expect(u.ignitions).toBe(340);
    expect(u.ratios).toEqual([{ monitor: 'Catalyst bank 1', completed: 45, conditions: 110, ratio: 45 / 110 }]);
    const d = parseInUse([1, 2, 3, 4, 5, 0, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18], 'diesel');
    expect(d.ratios.map((r) => r.monitor)).toEqual(['NMHC catalyst', 'NOx catalyst', 'NOx adsorber', 'Particulate filter', 'Exhaust gas sensor', 'EGR and valve timing', 'Boost pressure', 'Fuel system']);
    expect(d.ratios[1].ratio).toBeNull(); // no chances yet
  });

  it('reads the demo cars', async () => {
    const petrol = new ElmClient(new SimTransport(DEMO_CARS[0], 0));
    const info = await petrol.initialise();
    const r = await readMode09(petrol, { isCan: true, diesel: info.diesel });
    expect(r.units).toHaveLength(1);
    expect(r.units[0]).toMatchObject({ name: 'ECM-EngineControl', calIds: ['DEMOCAL0001'], cvns: ['1A2B3C4D'] });
    expect(r.units[0].inUse?.kind).toBe('petrol');
    expect(r.units[0].inUse?.ratios[0]).toMatchObject({ monitor: 'Catalyst bank 1', completed: 45, conditions: 110 });
    const dieselCar = DEMO_CARS.find((c) => c.diesel)!;
    const diesel = new ElmClient(new SimTransport(dieselCar, 0));
    await diesel.initialise();
    const d = await readMode09(diesel, { isCan: true, diesel: true });
    expect(d.units[0].inUse?.kind).toBe('diesel');
  });
});

describe('change timeline', () => {
  const at = new Date(2026, 10, 15, 14, 3).getTime();
  const history: HistoryEntry[] = [
    {
      id: 'new',
      vin: 'V',
      at,
      kind: 'change',
      title: 'Needle sweep on',
      odometerKm: 120500.4,
      changes: [{ module: 'Instrument cluster', key: 'vag-17', setting: 'Needle sweep', from: 'Off', to: 'On', before: '0102', after: '0103', backup: '0102', source: 'Customise' }],
    },
    // Saved before one line per module was kept: two modules in one entry.
    { id: 'old', vin: 'V', at: at - 86400000, kind: 'change', title: 'Mirror dip on', detail: 'Body, Door, driver', before: 'AA BB', after: 'AB BC' },
    { id: 'ws', vin: 'V', at: at - 2 * 86400000, kind: 'change', title: 'Engine coding saved', detail: 'Workshop', before: '00', after: '01' },
    { id: 'scan', vin: 'V', at, kind: 'scan', title: 'No faults found' },
  ];

  it('makes one row per module, newest first', () => {
    const rows = timelineRows(history);
    expect(rows.map((r) => r.module)).toEqual(['Instrument cluster', 'Body, Door, driver', 'Not recorded']);
    expect(rows[0]).toMatchObject({ setting: 'Needle sweep', from: 'Off', to: 'On', backup: '0102', older: false });
    expect(rows[1]).toMatchObject({ before: 'AA BB', older: true });
    expect(rows[2].source).toBe('Workshop');
  });

  it('splits older entries when module names and bytes line up', () => {
    const rows = timelineRows([{ id: 'x', vin: 'V', at, kind: 'change', title: 'Lights on', detail: 'Body, Cluster', before: 'AA BB', after: 'AB BC' }]);
    expect(rows.map((r) => [r.module, r.before, r.after])).toEqual([
      ['Body', 'AA', 'AB'],
      ['Cluster', 'BB', 'BC'],
    ]);
  });

  it('escapes CSV fields', () => {
    expect(csvField('a,b')).toBe('"a,b"');
    expect(csvField('say "hi"')).toBe('"say ""hi"""');
    expect(csvField('=SUM(A1)')).toBe("'=SUM(A1)");
    expect(csvField(undefined)).toBe('');
  });

  it('exports CSV and text', () => {
    const rows = timelineRows(history);
    const csv = timelineCsv(rows).split('\r\n');
    expect(csv[0]).toBe('Date,Time,Module,Setting,Old value,New value,Old bytes,New bytes,Backup,Made in,Odometer km');
    expect(csv[1]).toBe('2026-11-15,14:03,Instrument cluster,Needle sweep,Off,On,0102,0103,0102,Customise,120500');
    expect(csv[2]).toBe('2026-11-14,14:03,"Body, Door, driver",Mirror dip on,,,AA BB,AB BC,Not recorded,Customise,');
    const text = timelineText(rows, 'Test car');
    expect(text).toContain('2026-11-15 14:03  Instrument cluster: Needle sweep');
    expect(text).toContain('  Value: Off to On');
    expect(text).toContain('  Backup: Not recorded');
    expect(text.startsWith('Change timeline: Test car\n3 changes, newest first.')).toBe(true);
  });

  it('exports the odometer in the owner’s unit', () => {
    const rows = timelineRows(history);
    const csv = timelineCsv(rows, { miles: true }).split('\r\n');
    expect(csv[0]).toBe('Date,Time,Module,Setting,Old value,New value,Old bytes,New bytes,Backup,Made in,Odometer mi');
    expect(csv[1].endsWith(',Customise,74875')).toBe(true);
    expect(timelineText(rows, 'Test car', { miles: true })).toContain('74,875 mi');
    expect(timelineText(rows, 'Test car')).toContain('120,500 km');
  });

  it('keeps the module key, so Put back can find the backup', () => {
    const rows = timelineRows(history);
    expect(rows[0].key).toBe('vag-17');
    expect(rows[1].key).toBeUndefined();
  });

  it('offers Put back only while the module differs from its backup', () => {
    const originals = { 'vag-17': '0A02' };
    expect(putBackState({ key: 'vag-17' }, originals, { 'vag-17': '0A03' })).toBe('offer');
    // Coding not read since: still offered; Customise reads it before asking.
    expect(putBackState({ key: 'vag-17' }, originals, {})).toBe('offer');
    expect(putBackState({ key: 'vag-17' }, originals, { 'vag-17': '0A02' })).toBe('original');
    expect(putBackState({ key: 'vag-17' }, originals, { 'vag-17': '0a02' })).toBe('original');
    // No key (older entries) or no backup: nothing to put back.
    expect(putBackState({}, originals, {})).toBe('none');
    expect(putBackState({ key: 'vag-09' }, originals, {})).toBe('none');
    expect(putBackState({ key: 'vag-17' }, undefined, undefined)).toBe('none');
  });
});

describe('scan changes after review', () => {
  const { diffScans: diff, isFullCheck: full } = jest.requireActual('../src/diag/scanDiff');
  const prev = { id: 'a', vin: 'X', at: 1, kind: 'scan', title: '', detail: '', faults: [{ module: 'Engine', code: 'U0101', text: '' }], read: ['Engine'] };
  it('keeps an engine module fault as not read when only the standard codes were read', () => {
    const d = diff(prev, { faults: [], read: ['Engine (OBD2)'] });
    expect(d.cleared).toBe(0);
    expect(d.notRead).toBe(1);
  });
  it('calls it cleared when the engine module answered', () => {
    expect(diff(prev, { faults: [], read: ['Engine'] }).cleared).toBe(1);
  });
  it('does not compare with a check that read nothing', () => {
    expect(full({ ...prev, faults: [], read: [] })).toBe(false);
    expect(full(prev)).toBe(true);
  });
});
