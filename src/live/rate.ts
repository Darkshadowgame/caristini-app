// Refresh-rate meter: readings and screen updates per second over the last
// few seconds, so the owner sees what each added value costs.
export class RateMeter {
  private passes: { at: number; n: number }[] = [];
  constructor(private windowMs = 5000) {}

  // One pass of reads finished at `at` with n values answered.
  add(n: number, at: number): void {
    this.passes.push({ at, n });
    const from = at - this.windowMs;
    while (this.passes.length > 2 && this.passes[0].at < from) this.passes.shift();
  }

  // null until 2 passes are in. The first pass only marks the start time.
  rate(): { readings: number; updates: number } | null {
    if (this.passes.length < 2) return null;
    const first = this.passes[0];
    const last = this.passes[this.passes.length - 1];
    const secs = (last.at - first.at) / 1000;
    if (secs <= 0) return null;
    const readings = this.passes.slice(1).reduce((a, p) => a + p.n, 0);
    return { readings: readings / secs, updates: (this.passes.length - 1) / secs };
  }

  reset(): void {
    this.passes = [];
  }
}

// "4.5 readings a second" style text; whole numbers from 10 up.
export function rateText(perSecond: number): string {
  const v = perSecond >= 10 ? Math.round(perSecond).toString() : (Math.round(perSecond * 10) / 10).toString();
  return v;
}
