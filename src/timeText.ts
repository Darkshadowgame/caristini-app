// One way to say how long something takes, for the Car tab, Learn my car,
// Unknown values, the sensor search and their summaries. Pure, so it is tested
// without a phone (__tests__/uxRecheck.test.ts).

const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? '' : 's'}`;

// "40 seconds", "1 minute", "14 minutes", "2 hours 50 minutes". Under a
// minute in 5-second steps (10 seconds at least); minutes rounded.
export function durationText(seconds: number): string {
  const s = Math.max(0, seconds);
  if (s < 59.5) return plural(Math.max(10, Math.round(s / 5) * 5), 'second');
  const mins = Math.max(1, Math.round(s / 60));
  if (mins < 60) return plural(mins, 'minute');
  const h = Math.floor(mins / 60);
  const m = Math.round((mins % 60) / 10) * 10;
  if (m === 60) return plural(h + 1, 'hour');
  return `${plural(h, 'hour')}${m ? ` ${m} minutes` : ''}`;
}

// A range in plain words: "About 40 seconds", "About 3 minutes", "About 2 to
// 5 minutes", "About 30 seconds to 2 minutes". Lower case with lower: true.
export function aboutRange(loSeconds: number, hiSeconds: number, opts: { lower?: boolean } = {}): string {
  const lo = Math.min(loSeconds, hiSeconds);
  const hi = Math.max(loSeconds, hiSeconds);
  let text: string;
  if (hi < 59.5) {
    const a = durationText(lo);
    const b = durationText(hi);
    text = a === b ? a : `${a.replace(/ seconds?$/, '')} to ${b}`;
  } else if (lo < 59.5) {
    text = `${durationText(lo)} to ${durationText(Math.ceil(hi / 60) * 60)}`;
  } else {
    const a = Math.max(1, Math.round(lo / 60));
    const b = Math.max(a, Math.ceil(hi / 60));
    if (a === b) text = durationText(a * 60);
    else if (b < 60) text = `${a} to ${b} minutes`;
    else text = `${durationText(lo)} to ${durationText(hi)}`;
  }
  const out = `About ${text}`;
  return opts.lower ? out.charAt(0).toLowerCase() + out.slice(1) : out;
}

// Short form for a running clock or a summary: "4 s", "45 s", "2 min".
export function shortDuration(ms: number): string {
  const s = Math.max(0, ms / 1000);
  if (s < 59.5) return `${Math.max(1, Math.round(s))} s`;
  return `${Math.max(1, Math.round(s / 60))} min`;
}
