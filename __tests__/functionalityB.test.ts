// Functionality review of 20 Nov 2026, findings 2, 3, 4, 5, 10, 14, 15, 18, 21
// and 22: the pure logic behind each fix.
jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
import * as fs from 'fs';
import * as path from 'path';
import { mergeRetried, recheckMessage, retriedHistoryPatch, uniqueFaultCodes } from '../src/diag/recheck';
import { diaryCars, diaryMileage, entryCarKey, entryCarName } from '../src/diaryCars';
import { HistoryEntry } from '../src/history';
import { learnAgainVerb, learnRunLabel } from '../src/learn/runLabel';
import { answerRate, loadKnock, peaksText, saveKnock } from '../src/monitors/knockStore';
import { addKnockSample, newKnockSession } from '../src/monitors/knock';
import { ageText, completeHealthCheck, newerHealthCheck, readAgeLine, readTakenAt, REUSE_MS } from '../src/mot/read';
import { reconnectGaveUp, reconnectingText, reconnectWait, RECONNECT_TRIES, RECONNECT_WAITS_MS } from '../src/reconnect';
import { detailsPatch, recordRows } from '../src/vehicle/records';

const MIN = 60000;
const T0 = Date.UTC(2026, 10, 20, 16, 0);
const scan = (patch: Partial<HistoryEntry> = {}): HistoryEntry => ({ id: 'h1', vin: 'VIN1', at: T0, kind: 'scan', title: 'No faults found', complete: true, faults: [], modules: 6, ...patch });

describe('finding 2: a newer health check replaces the MOT car read', () => {
  it('uses a complete check that is newer than the read, whatever its age', () => {
    const read = { at: T0 - 3 * 24 * 60 * MIN, from: 'read' as const };
    expect(newerHealthCheck(read, scan({ at: T0 - 26 * 60 * MIN }), T0)?.id).toBe('h1');
  });
  it('leaves a read that is newer than the check alone', () => {
    expect(newerHealthCheck({ at: T0 + MIN, from: 'read' }, scan(), T0 + 2 * MIN)).toBeNull();
  });
  it('does not apply the same health check twice', () => {
    // Applied 5 minutes after the check ran: the read still dates from the check.
    const read = { at: T0 + 5 * MIN, from: 'health-check' as const, healthCheckAt: T0 };
    expect(readTakenAt(read)).toBe(T0);
    expect(newerHealthCheck(read, scan(), T0 + 6 * MIN)).toBeNull();
    expect(newerHealthCheck(read, scan({ id: 'h2', at: T0 + 10 * MIN }), T0 + 11 * MIN)?.id).toBe('h2');
  });
  it('covers the review case: Learn my car read, faults cleared, new check', () => {
    // Learn my car built its MOT read from its own check at 16:02; the check after the clear ran at 16:03.
    const learn = { at: T0 + 2 * MIN, from: 'health-check' as const, healthCheckAt: T0 + 2 * MIN, by: 'learn' as const };
    expect(newerHealthCheck(learn, scan({ id: 'after-clear', at: T0 + 3 * MIN }), T0 + 4 * MIN)?.id).toBe('after-clear');
  });
  it('never uses a check that stopped early or where no module answered', () => {
    const read = { at: T0 - 60 * MIN, from: 'read' as const };
    expect(newerHealthCheck(read, scan({ complete: false }), T0)).toBeNull();
    expect(newerHealthCheck(read, scan({ noAnswer: true }), T0)).toBeNull();
    expect(newerHealthCheck(read, scan({ kind: 'clear' }), T0)).toBeNull();
    expect(completeHealthCheck(null)).toBeNull();
  });
  it('with no read yet, uses only a check from the last hour', () => {
    expect(newerHealthCheck(null, scan(), T0 + REUSE_MS - 1)?.id).toBe('h1');
    expect(newerHealthCheck(null, scan(), T0 + REUSE_MS + 1)).toBeNull();
  });
  it('says how old the read is', () => {
    expect(ageText(T0, T0 + 20000)).toBe('just now');
    expect(ageText(T0, T0 + MIN)).toBe('1 minute ago');
    expect(ageText(T0, T0 + 59 * MIN)).toBe('59 minutes ago');
    expect(ageText(T0, T0 + 60 * MIN)).toBe('1 hour ago');
    expect(ageText(T0, T0 + 47 * 60 * MIN)).toBe('47 hours ago');
    expect(ageText(T0, T0 + 72 * 60 * MIN)).toBe('3 days ago');
    expect(readAgeLine({ at: T0, from: 'read' }, T0 + 4 * MIN)).toBe('Car read 4 minutes ago');
    expect(readAgeLine({ at: T0, from: 'read', by: 'learn' }, T0 + 4 * MIN)).toBe('From Learn my car 4 minutes ago');
    expect(readAgeLine({ at: T0 + 30 * MIN, from: 'health-check', healthCheckAt: T0 }, T0 + 60 * MIN)).toBe('From the health check 1 hour ago');
  });
});

describe('finding 3: Save on Vehicle details writes only its own fields', () => {
  it('leaves Parts and IDs and everything else on the car alone', () => {
    const draft = { nickname: 'Cupra', brand: 'SEAT', model: 'Leon', group: 'vag' as const, platform: 'PQ35', fuel: 'Petrol' as const, ids: { codes: {} }, lastCodes: ['P0300'], odometerKm: 1 };
    const patch = detailsPatch(draft, '2007');
    expect(Object.keys(patch).sort()).toEqual(['brand', 'edited', 'fuel', 'group', 'model', 'nickname', 'platform', 'year']);
    expect(patch).toMatchObject({ nickname: 'Cupra', year: 2007, edited: true });
  });
  it('saves no year unless 4 digits were typed', () => {
    expect(detailsPatch({ nickname: '', brand: '', model: '', group: 'other', platform: null, fuel: null }, '20').year).toBeNull();
  });
});

describe('finding 4: records reachable with no adapter', () => {
  const base = { carVin: 'A', connectedVin: null, lastVin: 'A', hasBattery: true, logs: 2, hasEmissions: true };
  it('offers all 4 for the last car when not connected', () => {
    expect(recordRows(base)).toEqual(['mot', 'logs', 'battery', 'emissions']);
  });
  it('shows only rows whose page has something saved', () => {
    expect(recordRows({ ...base, hasBattery: false, logs: 0, hasEmissions: false })).toEqual(['mot']);
  });
  it('offers them all for the connected car, which can be read now', () => {
    expect(recordRows({ ...base, connectedVin: 'A', hasBattery: false, logs: 0, hasEmissions: false })).toEqual(['mot', 'logs', 'battery', 'emissions']);
  });
  it('keeps Battery and Emissions to the car those pages show', () => {
    // Another car is the last one used: its pages would show that car.
    expect(recordRows({ ...base, lastVin: 'B' })).toEqual(['mot', 'logs']);
    // Connected to another car: the logs page shows the connected car's recorder.
    expect(recordRows({ ...base, connectedVin: 'B' })).toEqual(['mot']);
  });
});

describe('finding 5: going back during a long run asks first', () => {
  const src = (p: string) => fs.readFileSync(path.join(__dirname, '..', 'src', p), 'utf8');
  it('asks the agreed question with the shared sheet', () => {
    const guard = src('leaveRun.tsx');
    expect(guard).toContain("'Stop the run and keep what was found?'");
    expect(guard).toContain('usePreventRemove');
    expect(guard).toContain('ConfirmSheet');
    // Leaving the app or locking the phone must not ask or stop anything.
    expect(guard).not.toContain('AppState');
  });
  it('guards the 5 long runs', () => {
    for (const screen of ['app/learn-car.tsx', 'app/diagnostics.tsx', 'app/sensors.tsx', 'app/discover.tsx', 'app/mot.tsx']) {
      expect(src(screen)).toContain('<LeaveRunGuard');
    }
  });
});

describe('finding 10: a dropped link is tried again', () => {
  it('tries 4 times over about 60 seconds', () => {
    expect(RECONNECT_TRIES).toBe(4);
    expect(RECONNECT_WAITS_MS).toHaveLength(RECONNECT_TRIES);
    const waits = [1, 2, 3, 4].map((n) => reconnectWait(n)!);
    expect(waits.every((w) => w > 0)).toBe(true);
    // The waits alone, before the time each try takes, stay under a minute.
    const total = waits.reduce((a, b) => a + b, 0);
    expect(total).toBeGreaterThanOrEqual(30000);
    expect(total).toBeLessThanOrEqual(60000);
  });
  it('stops after the last try', () => {
    expect(reconnectWait(5)).toBeNull();
    expect(reconnectWait(0)).toBeNull();
    expect(reconnectWait(1.5)).toBeNull();
  });
  it('says what is happening', () => {
    expect(reconnectingText({ attempt: 2, of: 4 }, 'Carista')).toBe('Reconnecting to Carista: try 2 of 4. Keep the ignition on and the phone near the car.');
    expect(reconnectingText({ attempt: 1, of: 4 })).toMatch(/^Reconnecting: try 1 of 4\./);
    expect(reconnectGaveUp('The adapter disconnected.')).toBe('Connection lost: The adapter disconnected. Pin16 tried the adapter 4 times. Check the ignition is on, then tap Connect adapter.');
  });
});

describe('finding 14: a first read that stopped early is not called done', () => {
  it('needs learnFullAt before saying done', () => {
    const run = { at: T0, modules: 5, sensors: 0, full: true };
    expect(learnRunLabel({ learnRun: run })).toBe('First read stopped early');
    expect(learnRunLabel({ learnRun: run, learnFullAt: T0 })).toBe('First read done');
    expect(learnRunLabel({ learnRun: { ...run, full: false }, learnFullAt: T0, learnTimes: { repeat: { faults: 40 } } })).toBe('Last run');
    expect(learnRunLabel({})).toBe('Last run');
  });
  it('says what running it again does', () => {
    expect(learnAgainVerb('First read stopped early')).toBe('finish');
    expect(learnAgainVerb('First read done')).toBe('refresh');
    expect(learnAgainVerb('Last run')).toBe('refresh');
  });
});

describe('finding 15: the message after a clear says what came back', () => {
  it('reports the result of the check that followed', () => {
    expect(recheckMessage({ stopped: false, faults: 0, milOn: false })).toBe('Faults cleared. Saved to History and your diary. Nothing came back.');
    expect(recheckMessage({ stopped: false, faults: 2, milOn: true })).toBe('Faults cleared. Saved to History and your diary. 2 faults came straight back, so the cause is still there.');
    expect(recheckMessage({ stopped: false, faults: 1, milOn: null })).toContain('1 fault came straight back');
    expect(recheckMessage({ stopped: false, faults: 0, milOn: true })).toContain('The engine light is still on.');
  });
  it('never claims a result the check did not give', () => {
    for (const m of [recheckMessage(null), recheckMessage({ stopped: true, faults: 0, milOn: false })]) {
      expect(m).toContain('did not finish');
      expect(m).not.toContain('Nothing came back');
    }
    expect(recheckMessage({ stopped: false, faults: 0, milOn: false })).not.toContain('Checking again');
  });
});

describe('finding 21: cleared faults are listed once, and a retry reaches History', () => {
  it('lists one fault once when it was read two ways', () => {
    // The review case: P0300 from the standard list and VW 16684 from the engine module.
    expect(uniqueFaultCodes(['P0420', 'P0171', 'P0300', '00532', '16684'])).toEqual(['P0420', 'P0171', 'P0300', '00532']);
    expect(uniqueFaultCodes(['P030000', 'P0300', 'P0300'])).toEqual(['P030000']);
    expect(uniqueFaultCodes([])).toEqual([]);
  });
  const check = {
    logged: [
      { module: 'ABS', code: '00532' },
      { module: 'Engine (OBD2)', code: 'P0300' },
    ],
    read: ['Engine (OBD2)', 'ABS'],
    answered: 1,
    codesCounted: ['00532', 'P0300'],
  };
  it('adds a module that answered on the retry', () => {
    const m = mergeRetried(check, [{ name: 'Airbags', state: 'faults', faults: [{ code: 'B100000' }] }]);
    expect(m.changed).toBe(true);
    expect(m.answered).toBe(2);
    expect(m.read).toEqual(['Engine (OBD2)', 'ABS', 'Airbags']);
    expect(m.logged.map((f) => `${f.module}|${f.code}`)).toEqual(['ABS|00532', 'Engine (OBD2)|P0300', 'Airbags|B100000']);
    expect(m.codesCounted).toEqual(['00532', 'P0300', 'B100000']);
  });
  it('counts an engine fault once when the engine module now reports it', () => {
    const m = mergeRetried(check, [{ name: 'Engine', state: 'faults', faults: [{ code: '16684' }] }]);
    expect(m.logged.map((f) => `${f.module}|${f.code}`)).toEqual(['ABS|00532', 'Engine|16684']);
    expect(m.codesCounted).toEqual(['00532', '16684']);
  });
  it('changes nothing for a module that still did not answer, or was already read', () => {
    expect(mergeRetried(check, [{ name: 'Airbags', state: 'error', faults: [] }]).changed).toBe(false);
    expect(mergeRetried(check, [{ name: 'ABS', state: 'ok', faults: [] }]).changed).toBe(false);
    expect(mergeRetried(check, []).logged).toBe(check.logged);
  });
  it('rewrites the History entry in the words of a new check', () => {
    const m = mergeRetried(check, [{ name: 'Airbags', state: 'ok', faults: [] }]);
    expect(retriedHistoryPatch(m, '1 module answered; engine light on')).toMatchObject({ title: '2 faults found', detail: '2 modules answered; engine light on', modules: 2, noAnswer: false });
    expect(retriedHistoryPatch({ logged: [], read: ['Engine'], answered: 1, codesCounted: [] }, "No control module answered; only the engine's standard codes were read; engine light on")).toMatchObject({
      title: 'No faults found',
      detail: '1 module answered; engine light on',
    });
    expect(retriedHistoryPatch(m).detail).toBeUndefined();
  });
});

describe('finding 18: the knock monitor counts real answers and keeps the last session', () => {
  it('gives no rate until 2 answers held values', () => {
    expect(answerRate([])).toBeNull();
    expect(answerRate([1000])).toBeNull();
    expect(answerRate([1000, 1000])).toBeNull();
    expect(answerRate([0, 500, 1000])).toBe(2);
  });
  it('keeps the last session with readings on the phone', async () => {
    const empty = newKnockSession();
    expect(await saveKnock('VIN1', empty)).toBeNull();
    expect(await loadKnock('VIN1')).toBeNull();
    const s = addKnockSample(addKnockSample(empty, [0, 1.5, 0, 0]), [0, 3, 0, 0.75]);
    const saved = await saveKnock('VIN1', s, T0);
    expect(saved?.session.samples).toBe(2);
    // A later session with no readings does not hide it.
    await saveKnock('VIN1', newKnockSession());
    const back = await loadKnock('VIN1');
    expect(back?.at).toBe(T0);
    expect(peaksText(back!.session)).toBe('0.0°, 3.0°, 0.0°, 0.8°');
    expect(await loadKnock('OTHER')).toBeNull();
  });
});

describe('finding 22: the Diary groups cars by VIN', () => {
  const names: Record<string, string> = { V1: 'Phil’s Cupra', V2: 'Leon', V3: 'Leon' };
  const nameOf = (vin: string) => names[vin] ?? null;
  it('keeps a renamed car’s entries together under its name now', () => {
    const entries = [
      { vin: 'V1', vehicleName: 'SEAT Leon 2007' },
      { vin: 'V1', vehicleName: 'Phil’s Cupra' },
    ];
    expect(diaryCars(entries, nameOf)).toEqual([{ key: 'vin:V1', label: 'Phil’s Cupra' }]);
    expect(entryCarName(entries[0], nameOf)).toBe('Phil’s Cupra');
    expect(entryCarKey(entries[0])).toBe(entryCarKey(entries[1]));
  });
  it('keeps 2 cars with one name apart', () => {
    const cars = diaryCars(
      [
        { vin: 'WVWZZZ1KZ7W000001', vehicleName: 'Leon' },
        { vin: 'WVWZZZ1KZ7W000000', vehicleName: 'Leon' },
      ],
      () => 'Leon',
    );
    expect(cars.map((c) => c.label)).toEqual(['Leon (0001)', 'Leon (0000)']);
    expect(new Set(cars.map((c) => c.key)).size).toBe(2);
  });
  it('falls back to the saved name for a removed car or an entry with no VIN', () => {
    expect(diaryCars([{ vin: 'GONE', vehicleName: 'Old Focus' }, { vin: null, vehicleName: 'Trailer' }], nameOf)).toEqual([
      { key: 'vin:GONE', label: 'Old Focus' },
      { key: 'name:Trailer', label: 'Trailer' },
    ]);
  });
  it('writes the odometer in the unit from Settings', () => {
    expect(diaryMileage(160934.4, true)).toEqual({ mileage: 100000, unit: 'mi' });
    expect(diaryMileage(123456.7, false)).toEqual({ mileage: 123457, unit: 'km' });
    expect(diaryMileage(undefined, true)).toEqual({ mileage: null });
    expect(diaryMileage(null, false)).toEqual({ mileage: null });
  });
});

describe('finding 26: DPF sources in owner words, regenerations kept', () => {
  // Loaded here so the storage mock above is in place.
  const { loadRegens, mergeRegens, ownerSource, saveRegens, MAX_REGENS } = require('../src/monitors/dpfStore') as typeof import('../src/monitors/dpfStore');
  it('does not show a research file name as the source', () => {
    expect(ownerSource('mazda6-sources Z5 capture')).toBe('Mazda6 research notes');
    expect(ownerSource('vag-sources L2 (2012 A6)')).toBe('VW group research notes');
    expect(ownerSource('OBDb Focus captures (focus-st-sources)')).toBe('OBDb Focus captures');
    expect(ownerSource('T6 forum (2016 2.0 TDI)')).toBe('T6 forum (2016 2.0 TDI)');
    expect(ownerSource(undefined)).toBe('');
  });
  it('keeps one entry per regeneration, with its end once seen', () => {
    const merged = mergeRegens([{ start: 100 }, { start: 50, end: 80 }], [{ start: 100, end: 160 }, { start: 300 }]);
    expect(merged).toEqual([{ start: 50, end: 80 }, { start: 100, end: 160 }, { start: 300 }]);
    // A saved end is not lost to a copy without one.
    expect(mergeRegens([{ start: 100, end: 160 }], [{ start: 100 }])).toEqual([{ start: 100, end: 160 }]);
    expect(mergeRegens(Array.from({ length: MAX_REGENS + 5 }, (_, i) => ({ start: i, end: i })), [])).toHaveLength(MAX_REGENS);
  });
  it('saves them per car', async () => {
    await saveRegens('DIESEL1', [{ start: 1000 }]);
    await saveRegens('DIESEL1', [{ start: 1000, end: 1900 }]);
    expect(await loadRegens('DIESEL1')).toEqual([{ start: 1000, end: 1900 }]);
    expect(await loadRegens('OTHER')).toEqual([]);
  });
});
