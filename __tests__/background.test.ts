// Long reads in the background: the wording, and the Settings switch.
import { backgroundNote, keepRunning, letStop, setBackgroundRuns } from '../src/background';

test('the screen says what to expect', () => {
  expect(backgroundNote('on')).toMatch(/lock the phone/);
  expect(backgroundNote('on')).toMatch(/app switcher/);
  expect(backgroundNote('denied')).toMatch(/Keep Pin16 on the screen/);
  expect(backgroundNote('off')).toMatch(/Location Services are off/);
  expect(backgroundNote('unavailable')).toBeNull();
  expect(backgroundNote(null)).toBeNull();
});

test('switched off in Settings, nothing is asked', async () => {
  setBackgroundRuns(false);
  expect(await keepRunning('learn')).toBeNull();
  setBackgroundRuns(true);
});

test('location refused: the read is told, and stopping is safe', async () => {
  // The Jest stand-in for expo-location refuses permission.
  expect(await keepRunning('learn')).toBe('denied');
  expect(() => letStop('learn', true)).not.toThrow();
  expect(() => letStop('never-started')).not.toThrow();
});
