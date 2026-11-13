// BleTransport against a mockFake BLE adapter (react-native-ble-plx mocked).
import { asciiToBase64 } from '../src/obd/base64';

type Cb = (err: Error | null, c: { value: string } | null) => void;

const mockFake = {
  notifyCb: null as Cb | null,
  disconnectCb: null as (() => void) | null,
  pendingLate: null as ReturnType<typeof setTimeout> | null,
  writes: [] as string[],
  last: '',
  // Commands that answer late (simulating a slow protocol search).
  slow: new Set<string>(),
};

function mockEmit(text: string) {
  mockFake.notifyCb?.(null, { value: asciiToBase64(text) });
}

function mockAnswer(cmd: string): string {
  if (cmd === 'ATI') return 'ELM327 v2.2\r\r>';
  if (cmd === '0100') return '4100BE3FA813\r\r>';
  if (cmd === '010C') return '410C1AF8\r\r>';
  return 'OK\r\r>';
}

jest.mock('react-native-ble-plx', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { base64ToAscii } = require('../src/obd/base64') as typeof import('../src/obd/base64');
  const notifyChar = {
    uuid: '0000fff1-0000-1000-8000-00805f9b34fb',
    isNotifiable: true,
    isIndicatable: false,
    isWritableWithoutResponse: false,
    isWritableWithResponse: false,
    monitor: (cb: Cb) => {
      mockFake.notifyCb = cb;
      return { remove: () => { mockFake.notifyCb = null; } };
    },
  };
  const writeChar = {
    uuid: '0000fff2-0000-1000-8000-00805f9b34fb',
    isNotifiable: false,
    isIndicatable: false,
    isWritableWithoutResponse: true,
    isWritableWithResponse: true,
    writeWithoutResponse: async (b64: string) => {
      const text = base64ToAscii(b64);
      mockFake.writes.push(text);
      // Any new input interrupts a command still running, like a real ELM327.
      if (mockFake.pendingLate) {
        clearTimeout(mockFake.pendingLate);
        mockFake.pendingLate = null;
        setTimeout(() => mockEmit('STOPPED\r\r>'), 5);
        return;
      }
      // A real ELM327 ignores a space when idle, and repeats the last command
      // on a bare return.
      if (text === ' ') return;
      const cmd = text === '\r' ? mockFake.last : text.replace(/\r/g, '').trim();
      mockFake.last = cmd;
      if (!cmd) return setTimeout(() => mockEmit('\r>'), 5);
      if (mockFake.slow.has(cmd)) {
        mockFake.pendingLate = setTimeout(() => {
          mockFake.pendingLate = null;
          mockEmit(mockAnswer(cmd));
        }, 200);
        return;
      }
      setTimeout(() => mockEmit(mockAnswer(cmd)), 5);
    },
    writeWithResponse: async () => undefined,
  };
  const device = {
    discoverAllServicesAndCharacteristics: async () => undefined,
    services: async () => [{ uuid: '0000fff0-0000-1000-8000-00805f9b34fb', characteristics: async () => [notifyChar, writeChar] }],
    onDisconnected: (cb: () => void) => {
      mockFake.disconnectCb = cb;
      return { remove: () => { mockFake.disconnectCb = null; } };
    },
    cancelConnection: async () => undefined,
  };
  return {
    BleManager: class {
      stopDeviceScan() {}
      async connectToDevice() {
        return device;
      }
    },
  };
});

// Imported after the mock is registered.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { BleTransport } = require('../src/obd/bleTransport') as typeof import('../src/obd/bleTransport');

beforeEach(() => {
  mockFake.writes = [];
  mockFake.slow.clear();
  mockFake.pendingLate = null;
});

describe('BleTransport', () => {
  it('finds the channel pair by asking ATI', async () => {
    const t = await BleTransport.connect('dev', 'Carista');
    expect(mockFake.writes[0]).toBe('ATI\r');
    expect(await t.send('010C', 500)).toContain('410C1AF8');
    await t.close();
  });

  it('does not hand a late reply to the next command after a timeout', async () => {
    const t = await BleTransport.connect('dev', 'Carista');
    mockFake.slow.add('0100');
    await expect(t.send('0100', 50)).rejects.toThrow('did not answer');
    // The next command first resyncs, so it gets its own answer, not STOPPED.
    const reply = await t.send('010C', 1000);
    expect(reply).toContain('410C1AF8');
    expect(reply).not.toContain('STOPPED');
    // Never a bare return, which would repeat the last command on the car.
    expect(mockFake.writes).not.toContain('\r');
    await t.close();
  });

  it('reports a dropped link and fails the waiting command', async () => {
    const t = await BleTransport.connect('dev', 'Carista');
    const lost = jest.fn();
    t.onLost = lost;
    mockFake.slow.add('0100');
    const waiting = t.send('0100', 5000);
    mockFake.disconnectCb?.();
    await expect(waiting).rejects.toThrow('disconnected');
    expect(lost).toHaveBeenCalledTimes(1);
    await expect(t.send('010C', 500)).rejects.toThrow();
    if (mockFake.pendingLate) clearTimeout(mockFake.pendingLate);
  });
});
