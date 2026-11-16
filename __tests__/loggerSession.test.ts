// The recording loop against a fake adapter: manual record with a marker, and
// an auto-start log that starts above the level and stops after the delay.
import { LIVE_PIDS, LivePid } from '../src/obd/pids';
import type { ElmClient } from '../src/obd/elm';
import type { DataLog } from '../src/logger/format';
import { obdKey } from '../src/logger/format';
import { channelOptions, LoggerSession, LoggerStatus } from '../src/logger/recorder';
import type { GpsSource, GpsStart } from '../src/logger/gps';
import { saveLog } from '../src/logger/store';

jest.mock('../src/logger/store', () => ({ saveLog: jest.fn(async () => undefined) }));

const saved = saveLog as jest.MockedFunction<typeof saveLog>;
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

function fakeClient(rpm: () => number) {
  const reads: number[][] = [];
  const client = {
    moduleBusy: false,
    supportsModules: false,
    whenIdle: async () => undefined,
    livePidsForCar: async () => LIVE_PIDS.filter((p) => [0x0c, 0x0d, 0x11].includes(p.pid)),
    readLiveMany: async (list: LivePid[]) => {
      await wait(5);
      reads.push(list.map((p) => p.pid));
      return new Map<number, number | null>(list.map((p) => [p.pid, p.pid === 0x0c ? rpm() : 20]));
    },
  };
  return { client: client as unknown as ElmClient, reads };
}

beforeEach(() => saved.mockClear());

test('manual record saves rows and markers', async () => {
  const { client } = fakeClient(() => 1500);
  const statuses: LoggerStatus[] = [];
  const s = new LoggerSession(client, { vin: 'VIN1', title: 'Leon' }, (x) => statuses.push(x), () => null);
  const options = await channelOptions(client, null);
  s.configure(options, [obdKey(0x0c), obdKey(0x0d)], { on: false, kind: 'rpm', above: 3000, stopAfterS: 5 });
  s.record();
  await wait(80);
  expect(s.mark()).toBe(1);
  await wait(40);
  await s.stop();
  expect(saved).toHaveBeenCalledTimes(1);
  const log = saved.mock.calls[0][0] as DataLog;
  expect(log.channels.map((c) => c.key)).toEqual([obdKey(0x0c), obdKey(0x0d)]);
  expect(log.rows.length).toBeGreaterThan(3);
  expect(log.rows[0].v).toEqual([1500, 20]);
  expect(log.markers).toHaveLength(1);
  expect(log.start).toBe('manual');
  expect(s.phase).toBe('idle');
  expect(statuses.some((x) => x.phase === 'recording')).toBe(true);
  await s.dispose();
});

function fakeGps(result: GpsStart = 'on') {
  const calls = { start: 0, stop: 0 };
  const source: GpsSource = {
    name: 'phone',
    start: async () => {
      calls.start++;
      return result;
    },
    latest: () => ({ lat: 51.5, lon: -0.1, kmh: 40, at: Date.now() }),
    stop: () => {
      calls.stop++;
    },
  };
  return { source, calls };
}

test('with GPS on, rows get the position and the GPS stops after saving', async () => {
  const { client } = fakeClient(() => 1500);
  const gps = fakeGps();
  const s = new LoggerSession(client, { vin: 'VIN3', title: 'Leon' }, () => undefined, () => gps.source);
  const options = await channelOptions(client, null);
  s.configure(options, [obdKey(0x0c)], { on: false, kind: 'rpm', above: 3000, stopAfterS: 5 }, true);
  s.record();
  await wait(80);
  await s.stop();
  const log = saved.mock.calls[0][0] as DataLog;
  expect(log.gps).toEqual({ source: 'phone' });
  expect(log.rows.every((r) => r.lat === 51.5 && r.lon === -0.1 && r.gpsKmh === 40)).toBe(true);
  expect(gps.calls).toEqual({ start: 1, stop: 1 });
  await s.dispose();
});

test('with GPS off or refused, the log has no position', async () => {
  for (const [on, result] of [
    [false, 'on'],
    [true, 'denied'],
  ] as [boolean, GpsStart][]) {
    saved.mockClear();
    const { client } = fakeClient(() => 1500);
    const gps = fakeGps(result);
    const statuses: LoggerStatus[] = [];
    const s = new LoggerSession(client, { vin: 'VIN4', title: 'Leon' }, (x) => statuses.push(x), () => gps.source);
    const options = await channelOptions(client, null);
    s.configure(options, [obdKey(0x0c)], { on: false, kind: 'rpm', above: 3000, stopAfterS: 5 }, on);
    s.record();
    await wait(60);
    await s.stop();
    const log = saved.mock.calls[0][0] as DataLog;
    expect('gps' in log).toBe(false);
    expect(log.rows.some((r) => r.lat != null)).toBe(false);
    expect(gps.calls.start).toBe(on ? 1 : 0);
    if (result === 'denied') expect(statuses.some((x) => x.gps === 'denied')).toBe(true);
    await s.dispose();
  }
});

test('auto-start records while above the level, then saves and waits again', async () => {
  let n = 0;
  // 10 reads at idle, 20 above 3000 rpm, then idle.
  const { client, reads } = fakeClient(() => {
    n++;
    return n > 10 && n <= 30 ? 4000 : 850;
  });
  const gps = fakeGps();
  const s = new LoggerSession(client, { vin: 'VIN2', title: 'Focus' }, () => undefined, () => gps.source);
  const options = await channelOptions(client, null);
  // Throttle chosen; engine speed is added as the trigger.
  s.configure(options, [obdKey(0x11)], { on: true, kind: 'rpm', above: 3000, stopAfterS: 1 });
  expect(s.phase).toBe('armed');
  await wait(60);
  // While waiting only the trigger is read.
  expect(reads[0]).toEqual([0x0c]);
  for (let i = 0; i < 60 && !saved.mock.calls.length; i++) await wait(50);
  expect(saved).toHaveBeenCalledTimes(1);
  const log = saved.mock.calls[0][0] as DataLog;
  expect(log.start).toBe('auto');
  expect(log.channels.map((c) => c.key)).toEqual([obdKey(0x0c), obdKey(0x11)]);
  // The first row is the reading that started it.
  expect(log.rows[0]).toEqual({ t: 0, v: [4000, null] });
  expect(log.durationMs).toBeGreaterThanOrEqual(1000);
  expect(s.phase).toBe('armed');
  // The GPS is held while waiting for the next start, and let go when the screen closes.
  expect(gps.calls.stop).toBe(0);
  await s.dispose();
  expect(s.phase).toBe('idle');
  expect(gps.calls.stop).toBe(1);
}, 10_000);
