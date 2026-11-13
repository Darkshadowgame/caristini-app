import { describeDue, serviceDue } from '../src/service/reminder';

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
