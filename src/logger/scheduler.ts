// Data logger: which source to read next, and how fast the reads come back.
//
// The logger reads as fast as the adapter answers, with no fixed interval.
// Sources cost very different amounts of adapter time: all standard OBD values
// go in one or two requests, maker values need the adapter pointed at each
// module, and an older VW group opens its own channel. Taking turns would let
// one slow group hold the fast values back to its pace. So each source gets an
// equal share of adapter time: the next read goes to the source that has used
// the least so far. A fast source then reads many times for each slow read.
//
// A source that gives nothing several times in a row (a module asleep) rests
// for a while, then rejoins at the back of the queue.

export interface SchedulerOptions {
  // Empty reads in a row before a source rests.
  restAfterEmpty?: number;
  // How long it rests (ms).
  restMs?: number;
}

interface SourceState {
  id: string;
  used: number;
  reads: number;
  empty: number;
  restUntil: number;
  resting: boolean;
  // Smoothed time per read (ms).
  avgMs: number;
}

export class SampleScheduler {
  private list: SourceState[];
  private restAfterEmpty: number;
  private restMs: number;

  constructor(ids: string[], opts: SchedulerOptions = {}) {
    this.list = ids.map((id) => ({ id, used: 0, reads: 0, empty: 0, restUntil: 0, resting: false, avgMs: 0 }));
    this.restAfterEmpty = opts.restAfterEmpty ?? 3;
    this.restMs = opts.restMs ?? 5000;
  }

  get ids(): string[] {
    return this.list.map((s) => s.id);
  }

  // The source to read now, or null when every source is resting.
  next(now: number): string | null {
    const ready = this.list.filter((s) => s.restUntil <= now);
    if (!ready.length) return null;
    for (const s of ready) {
      if (!s.resting) continue;
      // Back from a rest: join behind the others, not ahead of them.
      s.resting = false;
      s.used = Math.max(s.used, ...this.list.filter((o) => o !== s).map((o) => o.used));
    }
    let best = ready[0];
    for (const s of ready) if (s.used < best.used) best = s;
    return best.id;
  }

  // A read finished: what it cost and whether it brought any value.
  record(id: string, startMs: number, endMs: number, gotAny: boolean): void {
    const s = this.list.find((x) => x.id === id);
    if (!s) return;
    const ms = Math.max(1, endMs - startMs);
    s.used += ms;
    s.reads++;
    s.avgMs = s.reads === 1 ? ms : s.avgMs * 0.8 + ms * 0.2;
    if (gotAny) {
      s.empty = 0;
      return;
    }
    s.empty++;
    if (s.empty >= this.restAfterEmpty) {
      s.empty = 0;
      s.restUntil = endMs + this.restMs;
      s.resting = true;
    }
  }

  stats(id: string): { reads: number; avgMs: number; resting: boolean } | null {
    const s = this.list.find((x) => x.id === id);
    return s ? { reads: s.reads, avgMs: s.avgMs, resting: s.resting } : null;
  }
}

// Reads a second over a sliding window of the latest reads.
export class RateMeter {
  private times: number[] = [];
  constructor(private windowMs = 5000) {}

  tick(now: number): void {
    this.times.push(now);
    while (this.times.length > 2 && now - this.times[0] > this.windowMs) this.times.shift();
  }

  rate(): number | null {
    const n = this.times.length;
    if (n < 2) return null;
    const span = this.times[n - 1] - this.times[0];
    return span > 0 ? (n - 1) / (span / 1000) : null;
  }

  reset(): void {
    this.times = [];
  }
}
