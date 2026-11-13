import { vagFaultText } from '../src/data/vagFaults';
import { parseMessages } from '../src/obd/elm';
import { decodeSensor, displaySensor } from '../src/obd/sensors';

test('a single frame between multi-frame parts does not split the longer message', () => {
  const msgs = parseMessages('00A\r0:430401710300\r4300\r1:04200101555555\r>', '03');
  expect(msgs).toContainEqual([0x43, 0x04, 0x01, 0x71, 0x03, 0x00, 0x04, 0x20, 0x01, 0x01]);
  expect(msgs).toContainEqual([0x43, 0x00]);
});

test('adapter error codes are errors, not empty answers', () => {
  expect(() => parseMessages('ERR94\r>', '03')).toThrow();
  expect(() => parseMessages('7E80643<RX ERROR\r>', '03')).toThrow();
  expect(() => parseMessages('LV RESET\r>', '03')).toThrow();
});

test('sensor values are not clamped to a list maximum', () => {
  const odo = { h: '710', d: '2A0A', n: 'Odometer', p: '', b: 0, l: 32, hi: 255, u: 'km', src: 'x' };
  expect(decodeSensor(odo, [0x00, 0x01, 0xe2, 0x40])).toBe(123456);
  const oil = { h: '714', d: '202F', n: 'Oil temperature', p: '', b: 0, l: 8, a: -58, u: '', src: 'x' };
  expect(decodeSensor(oil, [0x32])).toBe(-8);
  expect(displaySensor(oil, -8, { speed: false, temp: false }).unit).toBe('°C');
});

test('VW 5-digit numbers outside the table map to P0 to P3', () => {
  expect(vagFaultText('18010')).toMatch(/^P1602/);
  expect(vagFaultText('18103')).toBe('Engine: P1695');
});
