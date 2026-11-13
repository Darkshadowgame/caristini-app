// Keeps the screen on during long reads (sensor search, Discover, Learn my car).
// Releasing a lock that never took throws on some platforms, so both calls are
// guarded: a missing lock must never stop the work itself.
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';

export function stayAwake(tag: string): void {
  try {
    activateKeepAwakeAsync(tag).catch(() => undefined);
  } catch {
    // not available here
  }
}

export function allowSleep(tag: string): void {
  try {
    Promise.resolve(deactivateKeepAwake(tag)).catch(() => undefined);
  } catch {
    // the lock was never taken
  }
}
