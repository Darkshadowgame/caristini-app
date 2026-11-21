// The shared wording for time left, dates and shared file names
// (src/timeText.ts): every screen calls these, so the words are tested once.
import { clockText, dateText, dateTimeText, fileDate, leftText, shareFileName, timeLeft } from '../src/timeText';

describe('time left', () => {
  it('says under a minute, minutes, then hours and minutes', () => {
    expect(leftText(0)).toBe('under a minute left');
    expect(leftText(45)).toBe('under a minute left');
    expect(leftText(59.9)).toBe('under a minute left');
    expect(leftText(60)).toBe('about 1 min left');
    expect(leftText(240)).toBe('about 4 min left');
    expect(leftText(89 * 60)).toBe('about 89 min left');
    expect(leftText(130 * 60)).toBe('about 2 h 10 min left');
  });

  it('never shows a long wait in seconds', () => {
    // The health check used to say "about 240 s left".
    expect(leftText(240)).not.toMatch(/\d s\b/);
  });

  it('waits for 5 items and 5 seconds before it judges', () => {
    expect(timeLeft(4, 100, 0, 60000)).toBeNull();
    expect(timeLeft(50, 100, 0, 4000)).toBeNull();
    expect(timeLeft(100, 100, 0, 60000)).toBeNull();
  });

  it('works the time out from the pace so far', () => {
    // 10 of 100 in 60 s: 90 more at 6 s each is 9 minutes.
    expect(timeLeft(10, 100, 0, 60000)).toBe('about 9 min left');
    expect(timeLeft(90, 100, 0, 60000)).toBe('under a minute left');
  });
});

describe('dates and times', () => {
  // Built from local parts, so the test reads the same in any time zone.
  const at = new Date(2026, 10, 9, 17, 2, 33);

  it('writes a date as 9 Nov 2026', () => {
    expect(dateText(at)).toBe('9 Nov 2026');
    expect(dateText(at.getTime())).toBe('9 Nov 2026');
    expect(dateText(new Date(2026, 0, 1))).toBe('1 Jan 2026');
  });

  it('writes a date and time as 9 Nov 2026, 17:02', () => {
    expect(dateTimeText(at)).toBe('9 Nov 2026, 17:02');
    expect(dateTimeText(at.getTime())).toBe('9 Nov 2026, 17:02');
    expect(dateTimeText(new Date(2026, 10, 20, 8, 5))).toBe('20 Nov 2026, 08:05');
  });

  it('writes the time on the 24-hour clock', () => {
    expect(clockText(at)).toBe('17:02');
    expect(clockText(new Date(2026, 10, 9, 0, 0))).toBe('00:00');
  });

  it('reads a diary date as that day on this phone', () => {
    expect(dateText('2026-11-09')).toBe('9 Nov 2026');
    expect(dateText('2026-01-31')).toBe('31 Jan 2026');
  });

  it('gives text that is not a date back as it was', () => {
    expect(dateText('not a date')).toBe('not a date');
    expect(dateTimeText('not a date')).toBe('not a date');
    expect(clockText('not a date')).toBe('');
  });

  it('has no weekday, no seconds and no slashes', () => {
    expect(dateTimeText(at)).not.toMatch(/Mon|\/|:33/);
  });
});

describe('shared file names', () => {
  const at = new Date(2026, 10, 20, 9, 30);

  it('stamps the date as yyyymmdd', () => {
    expect(fileDate(at)).toBe('20261120');
    expect(fileDate(new Date(2026, 0, 5))).toBe('20260105');
  });

  it('names every file Pin16-what-VIN-date', () => {
    expect(shareFileName('health report', 'WVWZZZ1KZBW000001', at)).toBe('Pin16-health-report-WVWZZZ1KZBW000001-20261120');
    expect(shareFileName('live data', 'WVWZZZ1KZBW000001', at)).toBe('Pin16-live-data-WVWZZZ1KZBW000001-20261120');
    expect(shareFileName('changes', 'wvwzzz1kzbw000001', at)).toBe('Pin16-changes-WVWZZZ1KZBW000001-20261120');
  });

  it('leaves the VIN out when there is none', () => {
    expect(shareFileName('live data', undefined, at)).toBe('Pin16-live-data-20261120');
    expect(shareFileName('live data', null, at)).toBe('Pin16-live-data-20261120');
  });

  it('uses a log’s own start stamp, so 2 logs from 1 day keep their names', () => {
    expect(shareFileName('log', 'WVWZZZ1KZBW000001', at, '20261115-142233')).toBe('Pin16-log-WVWZZZ1KZBW000001-20261115-142233');
  });

  it('holds only characters that are safe in a file name', () => {
    expect(shareFileName('MOT check!', 'WVW/ZZZ 1K', at)).toMatch(/^[A-Za-z0-9-]+$/);
  });
});
