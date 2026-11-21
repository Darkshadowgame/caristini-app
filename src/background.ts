// Keeps long reads (Learn my car, Find my car's sensors, Unknown values) going
// when you switch to another app or lock the phone.
//
// iPhone pauses an app a few seconds after it leaves the screen, which would
// stop a read part-way. An app that follows the phone's position may keep
// running, so while a long read runs Pin16 holds the same GPS updates the
// data logger uses (src/logger/phoneGps.ts). A blue mark at the top of the
// screen shows it. No position is saved or sent: the read only stays awake.
//
// Closing Pin16 from the app switcher (swiping it away) still stops
// everything: iPhone ends the app and its Bluetooth link.
import { AppState } from 'react-native';
import type { GpsSource, GpsStart } from './logger/gps';
import { phoneGps } from './logger/phoneGps';
import { playSound } from './sound';

let allowed = true;
const holds = new Map<string, GpsSource>();

// Settings calls this when "Keep long reads going in the background" changes.
export function setBackgroundRuns(on: boolean): void {
  allowed = on;
  if (!on) for (const tag of [...holds.keys()]) letStop(tag);
}

// Starts holding for one long read. Returns 'on' when it can carry on in the
// background, otherwise why not (null: switched off in Settings).
export async function keepRunning(tag: string): Promise<GpsStart | null> {
  if (!allowed) return null;
  if (holds.has(tag)) return 'on';
  const g = phoneGps();
  holds.set(tag, g);
  const r = await g.start().catch((): GpsStart => 'unavailable');
  if (r !== 'on' && holds.get(tag) === g) holds.delete(tag);
  return r;
}

// The long read ended. finished: it ran to the end, so a chime plays if
// Pin16 is not on the screen.
export function letStop(tag: string, finished = false): void {
  const g = holds.get(tag);
  holds.delete(tag);
  g?.stop();
  if (finished && AppState.currentState !== 'active') playSound('done');
}

// What the screen says about running in the background.
export function backgroundNote(r: GpsStart | null): string | null {
  if (r === 'on') return 'You can switch to another app or lock the phone: it carries on, and a chime plays when it ends. Do not swipe Pin16 away in the app switcher, as that stops it.';
  if (r === 'denied') return 'Keep Pin16 on the screen: location is not allowed, so iPhone pauses it in the background. Allow it in iPhone Settings, Pin16, Location, While Using the App.';
  if (r === 'off') return 'Keep Pin16 on the screen: Location Services are off, so iPhone pauses it in the background.';
  return null;
}
