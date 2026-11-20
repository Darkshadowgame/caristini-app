import { describeDue, fromKm, odometerNow, serviceDue, typedService } from '../src/service/reminder';

describe('service reminder', () => {
  const now = new Date('2026-11-11T12:00:00Z');

  it('is due by distance or date, whichever comes first', () => {
    const d = serviceDue({ everyKm: 16093, everyMonths: 12, lastKm: 100000, lastDate: '2026-05-11' }, 110000, now);
    expect(d.kmLeft).toBe(6093);
    expect(d.daysLeft).toBe(181);
    expect(d.overdue).toBe(false);
    expect(describeDue(d)).toBe('Due in 3,786 mi or 6 months');
  });

  it('reports overdue and soon', () => {
    expect(serviceDue({ everyKm: 10000, everyMonths: 12, lastKm: 100000 }, 110500, now)).toMatchObject({ overdue: true });
    expect(describeDue(serviceDue({ everyKm: 10000, everyMonths: 12, lastKm: 100000 }, 110500, now))).toBe('Overdue by 311 mi');
    expect(serviceDue({ everyKm: 10000, everyMonths: 12, lastKm: 100000 }, 109000, now).soon).toBe(true);
  });

  it('needs a starting point', () => {
    expect(describeDue(serviceDue({ everyKm: 10000, everyMonths: 12 }, 50000, now))).toBe('Set the last service to start');
  });
});

// Functionality review of 20 Nov 2026, finding 6: the reminder can be set
// from a past service and a typed odometer, in the unit from Settings.
describe('typed last service and odometer', () => {
  const today = '2026-11-20';

  it('reads the typed fields in miles', () => {
    const r = typedService({ dateText: '12/05/2026', dateIso: '2026-05-12', lastText: '48200', odoText: '52,300' }, true, today);
    if ('error' in r) throw new Error(r.error);
    expect(r.value.lastDate).toBe('2026-05-12');
    expect(r.value.lastKm).toBeCloseTo(48200 * 1.609344, 3);
    expect(r.value.odoKm).toBeCloseTo(52300 * 1.609344, 3);
    // 10,000 miles after 48,200 is 58,200: 5,900 miles left at 52,300.
    const due = serviceDue({ everyKm: 16093, everyMonths: 12, ...r.value }, r.value.odoKm, new Date('2026-11-20T12:00:00Z'));
    expect(fromKm(due.kmLeft!, true)).toBe(5900);
    expect(due.overdue).toBe(false);
    expect(describeDue(due)).toMatch(/^Due in 5,900 mi or /);
  });

  it('reads the typed fields in kilometres and leaves empty ones out', () => {
    expect(typedService({ dateText: '', dateIso: null, lastText: '80000', odoText: '' }, false, today)).toEqual({ value: { lastKm: 80000 } });
    expect(typedService({ dateText: ' ', dateIso: null, lastText: '', odoText: '' }, true, today)).toEqual({ value: {} });
  });

  it('says what is wrong with a typed field', () => {
    const err = (i: Parameters<typeof typedService>[0]) => {
      const r = typedService(i, true, today);
      return 'error' in r ? r.error : null;
    };
    expect(err({ dateText: 'last May', dateIso: null, lastText: '', odoText: '' })).toMatch(/day\/month\/year/);
    expect(err({ dateText: '01/12/2026', dateIso: '2026-12-01', lastText: '', odoText: '' })).toMatch(/in the future/);
    expect(err({ dateText: '', dateIso: null, lastText: '12.5', odoText: '' })).toMatch(/whole number/);
    expect(err({ dateText: '', dateIso: null, lastText: '0', odoText: '' })).toMatch(/whole number/);
    expect(err({ dateText: '', dateIso: null, lastText: '52300', odoText: '48200' })).toMatch(/lower than the mileage at the last service/);
    // The service was today, at the odometer now: allowed.
    expect(err({ dateText: '20/11/2026', dateIso: today, lastText: '48200', odoText: '48200' })).toBeNull();
  });

  it('counts from the newer of the odometer read from the car and the typed one', () => {
    expect(odometerNow(undefined)).toBeNull();
    expect(odometerNow({})).toBeNull();
    expect(odometerNow({ odometerKm: 100000, odometerAt: 1000 })).toEqual({ km: 100000, at: 1000, typed: false });
    expect(odometerNow({ odometerTypedKm: 90000, odometerTypedAt: 500 })).toEqual({ km: 90000, at: 500, typed: true });
    expect(odometerNow({ odometerKm: 100000, odometerAt: 1000, odometerTypedKm: 101000, odometerTypedAt: 2000 })).toMatchObject({ km: 101000, typed: true });
    expect(odometerNow({ odometerKm: 102000, odometerAt: 3000, odometerTypedKm: 101000, odometerTypedAt: 2000 })).toMatchObject({ km: 102000, typed: false });
    // A reading from the car with no date counts as older than a typed figure.
    expect(odometerNow({ odometerKm: 100000, odometerTypedKm: 101000, odometerTypedAt: 2000 })).toMatchObject({ km: 101000, typed: true });
  });

  it('shows kilometres in the unit from Settings', () => {
    expect(fromKm(16093.44, true)).toBe(10000);
    expect(fromKm(1234.4, false)).toBe(1234);
  });
});

// Round 2 review, F-M1 and F-M2: one reminder for every screen, and a typed
// odometer that ages.
import { addMonthsClamped, markDoneKm, markDoneSkipsKm, shouldStoreTypedOdometer, vehicleServiceDue } from '../src/service/reminder';
import { chargeTooLow } from '../src/obd/battery';

describe('one reminder, typed odometer ageing', () => {
  const DAY = 86400000;
  const now = Date.parse('2026-11-20T12:00:00Z');
  const service = { everyKm: 16093, everyMonths: 12, lastKm: 100000, lastDate: '2026-10-01' };

  it('counts a typed odometer when the car gives none (Car tab and Service page agree)', () => {
    const v = { service, odometerTypedKm: 116500, odometerTypedAt: now - 2 * DAY };
    const r = vehicleServiceDue(v, now);
    expect(r.odo).toMatchObject({ km: 116500, typed: true });
    expect(r.due?.overdue).toBe(true);
    expect(r.due?.kmLeft).toBeLessThan(0);
  });

  it('drops a distance still to go once the typed figure is over 30 days old', () => {
    const fresh = vehicleServiceDue({ service, odometerTypedKm: 105000, odometerTypedAt: now - 10 * DAY }, now);
    expect(fresh.due?.kmLeft).toBe(11093);
    expect(fresh.distanceStale).toBe(false);
    const old = vehicleServiceDue({ service, odometerTypedKm: 105000, odometerTypedAt: now - 45 * DAY }, now);
    expect(old.due?.kmLeft).toBeNull();
    expect(old.distanceStale).toBe(true);
    expect(old.due?.daysLeft).not.toBeNull();
  });

  it('keeps an overdue distance overdue when the typed figure is old', () => {
    const r = vehicleServiceDue({ service, odometerTypedKm: 120000, odometerTypedAt: now - 90 * DAY }, now);
    expect(r.due?.overdue).toBe(true);
  });

  it('never ages a reading from the car', () => {
    const r = vehicleServiceDue({ service, odometerKm: 105000, odometerAt: now - 90 * DAY }, now);
    expect(r.distanceStale).toBe(false);
    expect(r.due?.kmLeft).toBe(11093);
  });

  it('says to retype the odometer when only the distance was known', () => {
    const r = vehicleServiceDue({ service: { everyKm: 16093, everyMonths: 12, lastKm: 100000 }, odometerTypedKm: 105000, odometerTypedAt: now - 60 * DAY }, now);
    expect(describeDue(r.due!, true, r.distanceStale)).toBe('Type the odometer again to count distance');
  });

  it('returns no reminder without a plan', () => {
    expect(vehicleServiceDue({ odometerKm: 5 }, now).due).toBeNull();
  });

  it('stores no mileage for Mark done from an old typed figure', () => {
    expect(markDoneKm({ odometerTypedKm: 105000, odometerTypedAt: now - 5 * DAY }, now)).toBeUndefined();
    expect(markDoneKm({ odometerTypedKm: 105000 }, now)).toBeUndefined();
    expect(markDoneKm({ odometerTypedKm: 105000, odometerTypedAt: now - 3600000 }, now)).toBe(105000);
    expect(markDoneKm({ odometerKm: 90000, odometerAt: now - 30 * DAY }, now)).toBe(90000);
    expect(markDoneKm({}, now)).toBeUndefined();
  });

  it('clamps month-end dates', () => {
    expect(addMonthsClamped('2026-08-31', 6).toISOString().slice(0, 10)).toBe('2027-02-28');
    expect(addMonthsClamped('2026-01-31', 1).toISOString().slice(0, 10)).toBe('2026-02-28');
    expect(addMonthsClamped('2024-02-29', 12).toISOString().slice(0, 10)).toBe('2025-02-28');
    expect(addMonthsClamped('2026-05-12', 12).toISOString().slice(0, 10)).toBe('2027-05-12');
  });

  it('flags an engine-off charging reading when no engine speed is given', () => {
    expect(chargeTooLow(12.4)).toMatch(/engine is off/);
    expect(chargeTooLow(13.8)).toBeNull();
  });

  it('refreshes the typed date when the same typed odometer is typed again', () => {
    const old = { km: 105000, typed: true };
    expect(shouldStoreTypedOdometer(105000, old, true, true)).toBe(true);
    expect(shouldStoreTypedOdometer(106000, old, true, true)).toBe(true);
    expect(shouldStoreTypedOdometer(undefined, old, true, true)).toBe(false);
    expect(shouldStoreTypedOdometer(105000, null, true, true)).toBe(true);
  });

  it('does not store the prefilled odometer when the owner did not change it', () => {
    expect(shouldStoreTypedOdometer(105000, { km: 105000, typed: true }, true, false)).toBe(false);
    expect(shouldStoreTypedOdometer(91000, { km: 90000, typed: false }, false, false)).toBe(false);
    expect(shouldStoreTypedOdometer(105000, null, true, false)).toBe(false);
  });

  it('keeps the date of a reading from the car when the same figure is typed', () => {
    expect(shouldStoreTypedOdometer(90000, { km: 90000, typed: false }, false, true)).toBe(false);
    expect(shouldStoreTypedOdometer(91000, { km: 90000, typed: false }, false, true)).toBe(true);
  });

  it('flags when Mark done drops a stale typed distance but not the date', () => {
    expect(markDoneSkipsKm({ odometerTypedKm: 105000, odometerTypedAt: now - 5 * DAY }, now)).toBe(true);
    expect(markDoneSkipsKm({ odometerTypedKm: 105000, odometerTypedAt: now - 3600000 }, now)).toBe(false);
    expect(markDoneSkipsKm({}, now)).toBe(false);
  });

  it('says Due today on the due day', () => {
    expect(describeDue({ kmLeft: null, daysLeft: 0, overdue: false, soon: true })).toBe('Due today');
  });
});
