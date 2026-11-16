jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
import { DIARY_KINDS, parseUkDate, SETTING_CHANGED, shiftDate, ukDate } from '../src/diary';
import { aboutTime, Discovery, fullSeconds, modulesToExplore } from '../src/discover';
import { WHAT_IS_SENT } from '../src/help';
import { categoriesFor, modsForVehicle, STATUS_LABEL } from '../src/mods/catalogue';
import { trafficLog } from '../src/obd/trafficLog';
import { PLANS, planLabel } from '../src/service/reminder';
import { skipUnsentLog } from '../src/share/sendLog';
import { platformModels } from '../src/vehicle/vin';

// UX review of 16 Nov 2026: settings, customise, service, diary and others.

describe('diary', () => {
  it('shows and reads UK dates', () => {
    expect(ukDate('2026-11-05')).toBe('05/11/2026');
    expect(parseUkDate('05/11/2026')).toBe('2026-11-05');
    expect(parseUkDate('5/1/2026')).toBe('2026-01-05');
    expect(parseUkDate(' 15.11.2026 ')).toBe('2026-11-15');
    expect(parseUkDate('15-11-2026')).toBe('2026-11-15');
  });

  it('refuses dates that do not exist or are not day/month/year', () => {
    expect(parseUkDate('31/02/2026')).toBeNull();
    expect(parseUkDate('2026-11-15')).toBeNull();
    expect(parseUkDate('11/15/2026')).toBeNull();
    expect(parseUkDate('')).toBeNull();
  });

  it('steps a day back across a month end', () => {
    expect(shiftDate('2026-03-01', -1)).toBe('2026-02-28');
    expect(shiftDate('2026-12-31', 1)).toBe('2027-01-01');
  });

  it('has a Setting changed type for automatic coding entries', () => {
    expect(SETTING_CHANGED).toBe('Setting changed');
    expect(DIARY_KINDS).toContain(SETTING_CHANGED);
    expect(DIARY_KINDS[DIARY_KINDS.length - 1]).toBe('Other');
  });
});

describe('customise guides', () => {
  it('lists each guide once', () => {
    for (const [group, platform] of [['vag', 'PQ35'], ['vag', 'MQB'], ['vag', null], ['ford', null], ['mazda', null]] as const) {
      const ids = categoriesFor(modsForVehicle(group, platform)).flatMap((c) => c.items.map((m) => m.id));
      expect(new Set(ids).size).toBe(ids.length);
      expect(ids.length).toBe(modsForVehicle(group, platform).length);
    }
  });

  it('lists no empty category', () => {
    for (const c of categoriesFor(modsForVehicle('vag', 'PQ35'))) expect(c.items.length).toBeGreaterThan(0);
  });

  it('says plainly that the steps are not yet tested', () => {
    expect(STATUS_LABEL.documented).toBe('Steps known, not yet tested by Caristini');
  });
});

describe('unknown values', () => {
  const defs = [{ id: 'engine' }, { id: 'gearbox' }, { id: 'rear-climate' }, { id: 'boot' }];
  const disc: Discovery = { vin: 'V', started: 0, updated: 0, modules: { boot: { id: 'boot', name: 'Boot', tx: '7', rx: '8', found: { F190: { samples: ['00'] } } } } };

  it('offers only modules that answered, plus ones explored before', () => {
    expect(modulesToExplore(defs, ['engine', 'gearbox'], disc).map((d) => d.id)).toEqual(['engine', 'gearbox', 'boot']);
  });

  it('offers every module before a health check has run', () => {
    expect(modulesToExplore(defs, undefined, null)).toHaveLength(4);
    expect(modulesToExplore(defs, [], null)).toHaveLength(4);
  });

  it('gives the time per module and in all', () => {
    expect(aboutTime(fullSeconds(12288))).toBe('about 14 minutes');
    expect(aboutTime(fullSeconds(12288) * 12)).toBe('about 2 hours 50 minutes');
    expect(aboutTime(30)).toBe('about 30 seconds');
    expect(aboutTime(3600)).toBe('about 1 hour');
    expect(aboutTime(2 * 3600 + 58 * 60)).toBe('about 3 hours');
  });
});

describe('service plans', () => {
  it('show in the unit from Settings', () => {
    expect(planLabel(PLANS[0], true)).toBe('Every 10,000 miles or 12 months');
    expect(planLabel(PLANS[0], false)).toBe('Every 16,000 km or 12 months');
    expect(planLabel(PLANS[3], false)).toBe('Every 29,000 km or 24 months');
  });
});

describe('vehicle details', () => {
  it('names models on a platform from the VIN table', () => {
    expect(platformModels('PQ35')).toEqual(expect.arrayContaining(['Leon II', 'Octavia II', 'A3 (8P)']));
    expect(platformModels('MLB')).toEqual(expect.arrayContaining(['A4 B8', 'A6 C7']));
    expect(platformModels('No such platform')).toEqual([]);
  });
});

describe('what leaves the phone', () => {
  it('says where the data goes and that the VIN is included', () => {
    expect(WHAT_IS_SENT).toContain('VIN');
    expect(WHAT_IS_SENT).toContain('private findings store');
    expect(WHAT_IS_SENT).not.toMatch(/anonym|everyone|every install/i);
    expect(WHAT_IS_SENT).not.toContain('—');
  });

  it('keeps a run the owner chose not to send out of later automatic sends', () => {
    trafficLog.clear();
    trafficLog.add('>', '0100');
    trafficLog.add('<', '41 00 BE 3F A8 13');
    expect(trafficLog.unsentCount()).toBe(2);
    skipUnsentLog();
    expect(trafficLog.unsentCount()).toBe(0);
    trafficLog.add('>', '0101');
    expect(trafficLog.unsentCount()).toBe(1);
  });
});
