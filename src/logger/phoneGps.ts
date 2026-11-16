// The phone's GPS for the data logger, through expo-location's location
// updates. Running the updates also keeps Caristini working while the screen
// is off: iOS lets an app that is following the phone's position keep running
// in the background (a blue pill shows at the top of the screen), so the
// logger keeps reading the car and saving the log.
//
// Only "While using the app" location permission is needed: the updates start
// while the app is open, which iOS allows to carry on in the background.
//
// This file must be imported when the app starts (src/app/_layout.tsx): iOS
// may hand over positions as soon as the app opens, and the task that takes
// them has to be defined by then.
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { Platform } from 'react-native';
import type { GpsFix, GpsSource, GpsStart } from './gps';

export const GPS_TASK = 'caristini-logger-gps';

let newest: GpsFix | null = null;
// Users of the updates (the logger while recording or waiting to start).
let users = 0;

function take(loc: Location.LocationObject): void {
  const c = loc.coords;
  if (!Number.isFinite(c.latitude) || !Number.isFinite(c.longitude)) return;
  // iOS gives a speed of -1 when it has none.
  const kmh = c.speed != null && c.speed >= 0 ? c.speed * 3.6 : null;
  newest = { lat: c.latitude, lon: c.longitude, kmh, at: loc.timestamp || Date.now() };
}

const native = Platform.OS === 'ios' || Platform.OS === 'android';

if (native) {
  try {
    TaskManager.defineTask<{ locations?: Location.LocationObject[] }>(GPS_TASK, async ({ data, error }) => {
      if (error || !data?.locations?.length) return;
      take(data.locations[data.locations.length - 1]);
    });
  } catch {
    // Task manager not in this build.
  }
  // Updates left running by a log the app did not finish (closed by iOS or a
  // crash) are stopped, so the GPS does not run on for nothing.
  Location.hasStartedLocationUpdatesAsync(GPS_TASK)
    .then((on) => (on && users === 0 ? Location.stopLocationUpdatesAsync(GPS_TASK) : undefined))
    .catch(() => undefined);
}

async function startUpdates(): Promise<GpsStart> {
  if (!native) return 'unavailable';
  try {
    const perm = await Location.requestForegroundPermissionsAsync();
    if (perm.status !== 'granted') return 'denied';
    if (!(await Location.hasServicesEnabledAsync())) return 'off';
    if (!(await Location.hasStartedLocationUpdatesAsync(GPS_TASK).catch(() => false))) {
      await Location.startLocationUpdatesAsync(GPS_TASK, {
        accuracy: Location.Accuracy.BestForNavigation,
        distanceInterval: 0,
        timeInterval: 1000,
        activityType: Location.ActivityType.AutomotiveNavigation,
        pausesUpdatesAutomatically: false,
        showsBackgroundLocationIndicator: true,
      });
    }
    return 'on';
  } catch {
    return 'unavailable';
  }
}

function stopUpdates(): void {
  if (!native) return;
  Location.hasStartedLocationUpdatesAsync(GPS_TASK)
    .then((on) => (on && users === 0 ? Location.stopLocationUpdatesAsync(GPS_TASK) : undefined))
    .catch(() => undefined);
}

// One user of the phone's GPS. Several can be open; the updates stop when the last one stops.
export function phoneGps(): GpsSource {
  let started = false;
  return {
    name: 'phone',
    async start() {
      if (!started) {
        started = true;
        users++;
      }
      const r = await startUpdates();
      if (r !== 'on' && started) {
        started = false;
        users = Math.max(0, users - 1);
      }
      return r;
    },
    latest() {
      return newest;
    },
    stop() {
      if (!started) return;
      started = false;
      users = Math.max(0, users - 1);
      if (users === 0) {
        newest = null;
        stopUpdates();
      }
    },
  };
}
