// A rolling log of what Caristini sends to the adapter and what comes back,
// kept in memory for troubleshooting. With "Send the log automatically" on, new
// lines go to the owner's private findings store after each check or scan.

export interface LogEntry {
  t: number;
  dir: '>' | '<' | '!';
  text: string;
}

const MAX = 4000;
let entries: LogEntry[] = [];
let enabled = true;
// Entries already sent to the findings repo (src/share/sendLog.ts).
let sent = 0;

export const trafficLog = {
  setEnabled(on: boolean) {
    enabled = on;
  },
  add(dir: LogEntry['dir'], text: string) {
    if (!enabled) return;
    entries.push({ t: Date.now(), dir, text: text.replace(/\r/g, ' ').replace(/>$/, '').trim() });
    if (entries.length > MAX) {
      sent = Math.max(0, sent - (entries.length - MAX));
      entries = entries.slice(-MAX);
    }
  },
  count: () => entries.length,
  clear() {
    entries = [];
    sent = 0;
  },
  unsentCount: () => entries.length - sent,
  // The lines not sent yet, with real clock times so separate sends line up.
  unsentText(header: string): string {
    return [header, ...entries.slice(sent).map((e) => `${new Date(e.t).toISOString().slice(11, 23)} ${e.dir} ${e.text}`)].join('\n');
  },
  markSent() {
    sent = entries.length;
  },
  // Plain text, one line per entry, times in seconds from the first entry.
  text(header: string): string {
    const t0 = entries[0]?.t ?? Date.now();
    return [header, ...entries.map((e) => `${((e.t - t0) / 1000).toFixed(3)} ${e.dir} ${e.text}`)].join('\n');
  },
};
