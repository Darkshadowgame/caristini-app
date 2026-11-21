// A dropped adapter link: the last adapter is tried again a few times before
// the owner has to open Connect. Pure: src/state.tsx runs the timers.
//
// Only the connection comes back. A recording or trip that ended when the
// link dropped stays ended, with what it had saved.

export const RECONNECT_TRIES = 4;
// The wait before each try (ms). With the time each try takes (up to 15 s to
// find the adapter) the 4 tries span about 60 seconds.
export const RECONNECT_WAITS_MS = [2000, 8000, 12000, 15000];

export interface Reconnecting {
  // 1-based: the try waiting or running now, of how many.
  attempt: number;
  of: number;
}

// The wait before a try (1-based), or null when every try has been used.
export function reconnectWait(attempt: number): number | null {
  if (!Number.isInteger(attempt) || attempt < 1 || attempt > RECONNECT_TRIES) return null;
  return RECONNECT_WAITS_MS[attempt - 1];
}

// What the Car tab says while it tries.
export function reconnectingText(r: Reconnecting, adapter?: string | null): string {
  return `Reconnecting${adapter ? ` to ${adapter}` : ''}: try ${r.attempt} of ${r.of}. Keep the ignition on and the phone near the car.`;
}

// What it says when every try has failed.
export function reconnectGaveUp(reason: string): string {
  return `Connection lost: ${reason} Pin16 tried the adapter ${RECONNECT_TRIES} times. Check the ignition is on, then tap Connect adapter.`;
}
