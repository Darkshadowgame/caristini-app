import { ElmClient } from '../src/obd/elm';
import { DEMO_CARS, SimTransport } from '../src/obd/simTransport';
import { vinInBytes } from '../src/vehicle/vin';

const leon = DEMO_CARS.find((c) => c.id === 'leon')!;
const bytes = (s: string) => [...s].map((c) => c.charCodeAt(0));

describe('VIN when the car does not answer 09 02', () => {
  it('finds a VIN among other identification bytes', () => {
    expect(vinInBytes([0x00, 0x03, ...bytes('VSSZZZ1PZ7R000000'), 0x20, ...bytes('VWZ7Z0F0254041')])).toBe('VSSZZZ1PZ7R000000');
    // Joined to the immobiliser ID with no gap: the known maker code decides.
    expect(vinInBytes(bytes('XXVSSZZZ1PZ7R000000VWZ7Z0F0'))).toBe('VSSZZZ1PZ7R000000');
    // Part numbers and unknown maker codes are not taken.
    expect(vinInBytes(bytes('1P0920823A  KOMBI+WEGFAHRSP VDO'))).toBeNull();
    expect(vinInBytes(bytes('ZZZ12345678901234'))).toBeNull();
  });

  it('reads it from the cluster over TP2.0 on a PQ35 Leon', async () => {
    const c = new ElmClient(new SimTransport({ ...leon, noObdVin: true, vinAt: [0x07] }, 0));
    const info = await c.initialise();
    expect(info.vin).toBeNull();
    expect(await c.readVinFromModules()).toBe(leon.vin);
    // Normal OBD works again afterwards.
    expect((await c.readStatus()).milOn).toBeDefined();
  });

  it('gives null when no module has it', async () => {
    const c = new ElmClient(new SimTransport({ ...leon, noObdVin: true }, 0));
    await c.initialise();
    expect(await c.readVinFromModules()).toBeNull();
  });
});
