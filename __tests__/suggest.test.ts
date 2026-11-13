import { vagSensors } from '../src/data/sensors';

const VAG_SENSORS = vagSensors();
import { suggestedSensors } from '../src/obd/sensorSearch';
import { unitOf } from '../src/obd/sensors';
test('suggested values for an Audi are the headline readings', () => {
  const s = suggestedSensors(VAG_SENSORS, unitOf, 6).map((r) => `${r.n} [${unitOf(r)}]`);
  console.log(s.join('\n'));
  expect(s.length).toBeGreaterThanOrEqual(3);
});
