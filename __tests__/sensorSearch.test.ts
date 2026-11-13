import { vagSensors } from '../src/data/sensors';

const VAG_SENSORS = vagSensors();
import { byUsefulness, searchSensors } from '../src/obd/sensorSearch';
import { displaySensor, HEADER_NAMES } from '../src/obd/sensors';

const mod = (r: { h: string }) => HEADER_NAMES[r.h] ?? '';

test('owner words find the gearbox fluid temperature', () => {
  const hits = searchSensors(VAG_SENSORS, 'gearbox oil temp', mod).map((r) => r.n);
  expect(hits.some((n) => /transmission fluid temperature/i.test(n))).toBe(true);
});

test('boost finds charge pressure and dpf finds soot', () => {
  expect(searchSensors(VAG_SENSORS, 'boost', mod).length).toBeGreaterThan(0);
  expect(searchSensors(VAG_SENSORS, 'dpf soot', mod).some((r) => /soot/i.test(r.n))).toBe(true);
});

test('every word must match', () => {
  expect(searchSensors(VAG_SENSORS, 'zzzz oil', mod)).toHaveLength(0);
});

test('useful values come first', () => {
  const list = byUsefulness(VAG_SENSORS.filter((r) => /temperature|adaptation/i.test(r.n)).slice(0, 200));
  expect(/temperature/i.test(list[0].n)).toBe(true);
});

test('whole-number values show no decimals', () => {
  const r = { h: '7E0', d: '15AA', n: 'Selected gear', p: '', b: 0, l: 8, u: '', src: 'x' };
  expect(displaySensor(r, 12, { speed: false, temp: false }).text).toBe('12');
  expect(displaySensor({ ...r, m: 1, v: 10 }, 12.3, { speed: false, temp: false }).text).toBe('12.3');
});
