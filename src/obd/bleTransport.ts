// Bluetooth LE link to an ELM327-type adapter (iPhone only supports BLE adapters).
// Known adapter layouts, from public sources:
//   FFF0 service, FFF1 notify, FFF2 write  (OBDLink CX vendor notes, generic ELM327 BLE clones)
//   18F0 service, 2AF0 notify, 2AF1 write  (Vgate iCar Pro BLE, user GATT dumps)
//   FFE0 service, FFE1 notify and write    (common HM-10 style modules, not confirmed for OBD)
// Unknown layouts: every notify plus write pair is tried with ATI until one answers.
import { NativeModules, PermissionsAndroid, Platform } from 'react-native';
import { asciiToBase64, base64ToAscii } from './base64';
import { AdapterTimeout, LinkLost, Transport } from './transport';

type BleManagerT = import('react-native-ble-plx').BleManager;
type DeviceT = import('react-native-ble-plx').Device;
type CharacteristicT = import('react-native-ble-plx').Characteristic;
type SubscriptionT = import('react-native-ble-plx').Subscription;
type StateT = import('react-native-ble-plx').State;

const PREFERRED = ['fff0', '18f0', 'ffe0'];
const PROBE_MS = 1500;
// How long to wait for a prompt after interrupting the adapter.
const RESYNC_MS = 400;
const MAX_PROBES = 8;

let manager: BleManagerT | null = null;

export function bluetoothUnavailableReason(): string | null {
  if (Platform.OS === 'web') return 'Bluetooth is not available in the web preview. Use the simulated car here.';
  if (!NativeModules.BlePlx) {
    return 'This build has no Bluetooth module (Expo Go). Install the development build to connect a real adapter.';
  }
  return null;
}

function getManager(): BleManagerT {
  if (!manager) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { BleManager } = require('react-native-ble-plx') as typeof import('react-native-ble-plx');
    manager = new BleManager();
  }
  return manager;
}

async function ensurePermissions(): Promise<void> {
  if (Platform.OS !== 'android') return;
  if (Platform.Version >= 31) {
    const res = await PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
    ]);
    if (Object.values(res).some((r) => r !== PermissionsAndroid.RESULTS.GRANTED)) {
      throw new Error('Bluetooth permission was not granted.');
    }
  } else {
    const r = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);
    if (r !== PermissionsAndroid.RESULTS.GRANTED) throw new Error('Location permission is needed to scan on this Android version.');
  }
}

// On iPhone the state reads "Unknown" until CoreBluetooth reports in, and
// "Unauthorized" while the permission prompt is open. Wait for a settled state.
function waitForBluetooth(m: BleManagerT, ms = 8000): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    let sub: SubscriptionT | null = null;
    const finish = (err?: Error) => {
      clearTimeout(timer);
      sub?.remove();
      if (err) reject(err);
      else resolve();
    };
    const timer = setTimeout(() => finish(new Error('Bluetooth did not get ready. Check it is switched on and try again.')), ms);
    sub = m.onStateChange((s: StateT) => {
      if (s === 'PoweredOn') finish();
      else if (s === 'PoweredOff') finish(new Error('Bluetooth is off. Switch it on and try again.'));
      else if (s === 'Unsupported') finish(new Error('This phone does not support Bluetooth LE.'));
      // Unauthorized can be temporary while the permission prompt shows; give it the timeout.
    }, true);
  }).catch(async (e) => {
    if ((await m.state()) === 'Unauthorized') {
      throw new Error('Caristini is not allowed to use Bluetooth. Turn it on in Settings > Privacy & Security > Bluetooth.');
    }
    throw e;
  });
}

export interface FoundAdapter {
  id: string;
  name: string;
  rssi: number | null;
}

// Scans for nearby BLE devices. Named devices are listed, likely OBD adapters first.
export async function scanForAdapters(
  onFound: (a: FoundAdapter) => void,
  ms = 10000,
  onError?: (message: string) => void,
): Promise<() => void> {
  await ensurePermissions();
  const m = getManager();
  await waitForBluetooth(m);
  m.startDeviceScan(null, { allowDuplicates: false }, (error, device) => {
    if (error) {
      onError?.(error.message);
      return;
    }
    if (!device) return;
    const name = device.name ?? device.localName;
    if (!name) return;
    onFound({ id: device.id, name, rssi: device.rssi });
  });
  const timer = setTimeout(() => m.stopDeviceScan(), ms);
  return () => {
    clearTimeout(timer);
    m.stopDeviceScan();
  };
}

export function looksLikeObd(name: string): boolean {
  return /obd|elm|carista|vgate|vlink|veepeak|obdlink|lelink|kiwi|icar|v-link|scan/i.test(name);
}

interface Pending {
  resolve: (text: string) => void;
  reject: (e: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

export class BleTransport implements Transport {
  readonly kind = 'bluetooth' as const;
  onLost?: (reason: string) => void;
  private buffer = '';
  private pending: Pending | null = null;
  private sub: SubscriptionT | null = null;
  private disconnectSub: SubscriptionT | null = null;
  // Set after a timeout: the adapter may still send the late reply.
  private dirty = false;
  private closed = false;

  private constructor(
    private device: DeviceT,
    private writeChar: CharacteristicT,
    readonly label: string,
  ) {}

  static async connect(id: string, name: string): Promise<BleTransport> {
    const m = getManager();
    m.stopDeviceScan();
    const device = await m.connectToDevice(id, { timeout: 15000 });
    try {
      await device.discoverAllServicesAndCharacteristics();
      const services = [...(await device.services())].sort((a, b) => rank(a.uuid) - rank(b.uuid));

      // Candidate pairs, best first: within a service prefer a write channel
      // that is not also the notify channel (FFF2 over FFF1).
      const pairs: { notify: CharacteristicT; write: CharacteristicT }[] = [];
      for (const s of services) {
        const chars = await s.characteristics();
        const notifies = chars.filter((c) => c.isNotifiable || c.isIndicatable);
        const writes = chars
          .filter((c) => c.isWritableWithoutResponse || c.isWritableWithResponse)
          .sort((a, b) => Number(a.isNotifiable) - Number(b.isNotifiable));
        for (const n of notifies) for (const w of writes) pairs.push({ notify: n, write: w });
      }

      for (const { notify, write } of pairs.slice(0, MAX_PROBES)) {
        const t = new BleTransport(device, write, name);
        t.attach(notify);
        try {
          await t.send('ATI', PROBE_MS);
          t.dirty = false;
          t.watchDisconnect();
          return t;
        } catch {
          t.closed = true; // so the unsubscribe error is not reported as a lost link
          t.sub?.remove();
          t.sub = null;
        }
      }
    } catch (e) {
      await device.cancelConnection().catch(() => undefined);
      throw e;
    }
    await device.cancelConnection().catch(() => undefined);
    throw new Error('Connected, but the device did not answer like an OBD2 adapter. Check it is the adapter and the ignition is on.');
  }

  private attach(notify: CharacteristicT) {
    this.sub = notify.monitor((err, c) => {
      if (err) {
        // Removing the subscription ourselves also reports an error; ignore it.
        if (!this.closed) this.lost(err.message);
        return;
      }
      if (c?.value) this.onData(base64ToAscii(c.value));
    });
  }

  private watchDisconnect() {
    this.disconnectSub = this.device.onDisconnected(() => this.lost('The adapter disconnected.'));
  }

  private lost(reason: string) {
    if (this.closed) return;
    this.closed = true;
    this.failPending(new LinkLost(reason));
    this.sub?.remove();
    this.disconnectSub?.remove();
    this.onLost?.(reason);
  }

  private failPending(e: Error) {
    const p = this.pending;
    if (!p) return;
    this.pending = null;
    clearTimeout(p.timer);
    p.reject(e);
  }

  private streamCb: ((text: string) => void) | null = null;
  private streamEnded: (() => void) | null = null;

  private onData(text: string) {
    if (this.streamCb) {
      const end = text.indexOf('>');
      this.streamCb(end < 0 ? text : text.slice(0, end));
      if (end >= 0) this.streamEnded?.();
      return;
    }
    this.buffer += text;
    const end = this.buffer.indexOf('>');
    if (end < 0) return;
    const out = this.buffer.slice(0, end);
    this.buffer = this.buffer.slice(end + 1);
    const p = this.pending;
    if (!p) return; // A late reply nobody waits for: dropped.
    this.pending = null;
    clearTimeout(p.timer);
    p.resolve(out);
  }

  private wait(command: string, timeoutMs: number): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending = null;
        this.dirty = true;
        reject(new AdapterTimeout(command));
      }, timeoutMs);
      this.pending = { resolve, reject, timer };
    });
  }

  private async write(text: string): Promise<void> {
    const payload = asciiToBase64(text);
    const c = this.writeChar;
    if (c.isWritableWithoutResponse) {
      try {
        await c.writeWithoutResponse(payload);
        return;
      } catch (e) {
        if (!c.isWritableWithResponse) throw e;
      }
    }
    await c.writeWithResponse(payload);
  }

  // After a timeout, send one space and wait briefly for a prompt, so the next
  // reply belongs to the next command. Any character stops an adapter that is
  // still busy. Never a bare return: on an idle ELM327 that repeats the last
  // command, which could send a write or a login key to the car a second time.
  // A space is ignored by an idle adapter and by the command that follows.
  private async resync(): Promise<void> {
    this.buffer = '';
    const prompt = this.wait('resync', RESYNC_MS).catch(() => '');
    await this.write(' ').catch(() => undefined);
    await prompt;
    this.buffer = '';
    this.dirty = false;
  }

  async send(command: string, timeoutMs: number): Promise<string> {
    if (this.closed) throw new LinkLost();
    if (this.dirty) await this.resync();
    this.buffer = '';
    const reply = this.wait(command, timeoutMs);
    try {
      await this.write(`${command}\r`);
    } catch (e) {
      this.failPending(e instanceof Error ? e : new Error(String(e)));
    }
    return reply;
  }

  async stream(command: string, onText: (text: string) => void, until: Promise<void>): Promise<'stopped' | 'ended'> {
    if (this.closed) throw new LinkLost();
    if (this.dirty) await this.resync();
    this.buffer = '';
    const ended = new Promise<'ended'>((resolve) => {
      this.streamEnded = () => resolve('ended');
    });
    this.streamCb = onText;
    try {
      await this.write(`${command}\r`);
      return await Promise.race([until.then(() => 'stopped' as const), ended]);
    } finally {
      this.streamCb = null;
      this.streamEnded = null;
      // Any character stops monitoring; wait for the prompt so replies line up
      // again. A space, not a return: if monitoring had already ended, a bare
      // return would start it again (it repeats the last command).
      const prompt = this.wait('stop', PROBE_MS).catch(() => '');
      await this.write(' ').catch(() => undefined);
      await prompt;
      this.buffer = '';
    }
  }

  async close(): Promise<void> {
    this.closed = true;
    this.failPending(new LinkLost('Disconnected.'));
    this.disconnectSub?.remove();
    const sub = this.sub;
    this.sub = null;
    sub?.remove();
    await this.device.cancelConnection().catch(() => undefined);
  }
}

function rank(uuid: string): number {
  const short = uuid.toLowerCase().slice(4, 8);
  const i = PREFERRED.indexOf(short);
  return i < 0 ? PREFERRED.length : i;
}
