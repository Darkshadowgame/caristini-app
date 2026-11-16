// Adaptive waits. A module that does not answer costs the adapter's whole
// wait (AT ST, in 4 ms steps) plus the Bluetooth round trip: 270 ms at the
// default AT ST 32 on the Leon's adapter and 225 ms on the Mazda's, while an
// answer comes back in 60 to 90 ms (owner's logs, replica/learn-speed-2026-11-16.md).
// So the wait is set from the answers timed on this connection: a safe
// multiple of the slowest normal reply, never below a floor, never above the
// fixed wait the caller used before.
//
// Only newer-protocol (UDS) and standard OBD requests are timed and shortened.
// The older VW protocol (TP2.0) keeps its own fixed listen time (AT ST 19) and
// ACK rules: changing them broke the 2007 Leon before.

// UDS modules must answer, or say "busy, wait", within 50 ms (ISO 14229-2
// P2 server); the floor is twice that.
export const PACE_FLOOR_MS = 100;
// The wait is this many times the slowest reply time seen (90th percentile).
export const PACE_MULTIPLE = 3;
// Answers timed before the wait is shortened.
export const PACE_MIN_SAMPLES = 3;

const KEEP = 60;

function percentile(list: number[], p: number): number {
  const s = [...list].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(p * s.length))];
}

export class PaceMeter {
  // Round trips of adapter commands (AT ...): the link's own time.
  private link: number[] = [];
  // Round trips of requests a module answered, with the adapter returning at
  // the answer (adaptive timing on).
  private answers: number[] = [];

  noteLink(ms: number): void {
    this.link.push(ms);
    if (this.link.length > KEEP) this.link.shift();
  }

  noteAnswer(ms: number): void {
    this.answers.push(ms);
    if (this.answers.length > KEEP) this.answers.shift();
  }

  // The link's round trip (median), or null before any command was timed.
  linkMs(): number | null {
    return this.link.length ? percentile(this.link, 0.5) : null;
  }

  // How long modules take to answer, without the link's own time: the slow
  // end (90th percentile) of the answers timed. Null until enough answers.
  replyMs(): number | null {
    if (this.answers.length < PACE_MIN_SAMPLES) return null;
    return Math.max(0, percentile(this.answers, 0.9) - (this.linkMs() ?? 0));
  }

  // The wait for a module that does not answer (ms): a multiple of the reply
  // time with a floor, and never longer than the fixed wait `cap` used before
  // (which is also the wait until enough answers were timed).
  silentWaitMs(cap: number): number {
    const r = this.replyMs();
    if (r == null) return cap;
    return Math.min(cap, Math.max(PACE_FLOOR_MS, Math.ceil(PACE_MULTIPLE * r)));
  }

  // What a Learn my car run measured, to save with the car for the next estimate.
  snapshot(): { linkMs: number; replyMs: number | null; silentMs: number } | null {
    const link = this.linkMs();
    if (link == null) return null;
    return { linkMs: link, replyMs: this.replyMs(), silentMs: this.silentWaitMs(200) + link };
  }
}

// The adapter command for a wait of `ms` (AT ST counts 4 ms steps).
export function atstFor(ms: number): string {
  const steps = Math.max(1, Math.min(0xff, Math.ceil(ms / 4)));
  return `ATST${steps.toString(16).toUpperCase().padStart(2, '0')}`;
}
