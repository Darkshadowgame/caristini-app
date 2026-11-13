// Service reminder: due by distance or by date, whichever comes first.
export interface ServicePlan {
  everyKm: number;
  everyMonths: number;
  lastKm?: number;
  lastDate?: string;
}

export interface ServiceDue {
  // Distance left (negative when overdue); null when either reading is unknown.
  kmLeft: number | null;
  // Days left (negative when overdue); null when no service date is set.
  daysLeft: number | null;
  overdue: boolean;
  // Due within 1,000 km or 30 days.
  soon: boolean;
}

export const PLANS: { label: string; everyKm: number; everyMonths: number }[] = [
  { label: 'Every 10,000 miles or 12 months', everyKm: 16093, everyMonths: 12 },
  { label: 'Every 6,000 miles or 6 months', everyKm: 9656, everyMonths: 6 },
  { label: 'Every 12,500 miles or 12 months', everyKm: 20117, everyMonths: 12 },
  { label: 'Every 18,000 miles or 24 months', everyKm: 28968, everyMonths: 24 },
];

export function serviceDue(plan: ServicePlan, odometerKm: number | undefined, now = new Date()): ServiceDue {
  const kmLeft = plan.lastKm != null && odometerKm != null ? plan.lastKm + plan.everyKm - odometerKm : null;
  let daysLeft: number | null = null;
  if (plan.lastDate) {
    const due = new Date(plan.lastDate);
    due.setMonth(due.getMonth() + plan.everyMonths);
    daysLeft = Math.round((due.getTime() - now.getTime()) / 86400000);
  }
  const overdue = (kmLeft != null && kmLeft < 0) || (daysLeft != null && daysLeft < 0);
  const soon = !overdue && ((kmLeft != null && kmLeft < 1609) || (daysLeft != null && daysLeft < 30));
  return { kmLeft, daysLeft, overdue, soon };
}

// "Due in 2,300 mi or 4 months" / "Overdue by 120 mi".
export function describeDue(d: ServiceDue, miles = true): string {
  const dist = (km: number) => (miles ? `${Math.round(Math.abs(km) / 1.609344).toLocaleString('en-GB')} mi` : `${Math.round(Math.abs(km)).toLocaleString('en-GB')} km`);
  const time = (days: number) => {
    const a = Math.abs(days);
    return a >= 60 ? `${Math.round(a / 30.4)} months` : `${a} day${a === 1 ? '' : 's'}`;
  };
  if (d.overdue) {
    const parts = [d.kmLeft != null && d.kmLeft < 0 ? dist(d.kmLeft) : null, d.daysLeft != null && d.daysLeft < 0 ? time(d.daysLeft) : null].filter(Boolean);
    return `Overdue by ${parts.join(' and ')}`;
  }
  const parts = [d.kmLeft != null ? dist(d.kmLeft) : null, d.daysLeft != null ? time(d.daysLeft) : null].filter(Boolean);
  return parts.length ? `Due in ${parts.join(' or ')}` : 'Set the last service to start';
}
