// Keeps the screen on during long reads (Health check, sensor search, Unknown
// values, Learn my car) and on every live page: one way for the whole app.
// Releasing a lock that never took throws on some platforms, so both calls are
// guarded: a missing lock must never stop the work itself.
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { useEffect } from 'react';

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

// For a screen, or a part of one: awake while it is shown and on is true.
export function useStayAwake(tag: string, on = true): void {
  useEffect(() => {
    if (!on) return undefined;
    stayAwake(tag);
    return () => allowSleep(tag);
  }, [tag, on]);
}
