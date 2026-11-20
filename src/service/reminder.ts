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
  // Due within 1,000 miles (1,609 km, whichever unit is shown) or 30 days.
  soon: boolean;
}

export const PLANS: { label: string; everyKm: number; everyMonths: number }[] = [
  { label: 'Every 10,000 miles or 12 months', everyKm: 16093, everyMonths: 12 },
  { label: 'Every 6,000 miles or 6 months', everyKm: 9656, everyMonths: 6 },
  { label: 'Every 12,500 miles or 12 months', everyKm: 20117, everyMonths: 12 },
  { label: 'Every 18,000 miles or 24 months', everyKm: 28968, everyMonths: 24 },
];

// A plan in the owner's unit: the miles label as it is, or kilometres to the
// nearest 1,000 (the plans are set in miles).
export function planLabel(p: { label: string; everyKm: number; everyMonths: number }, miles = true): string {
  if (miles) return p.label;
  return `Every ${(Math.round(p.everyKm / 1000) * 1000).toLocaleString('en-GB')} km or ${p.everyMonths} months`;
}

// A year-month-day date plus whole months, clamped to the last day of the
// target month (31 Aug plus 6 months is 28 Feb, not 3 Mar). Noon UTC.
export function addMonthsClamped(iso: string, months: number): Date {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  const first = Date.UTC(y, m - 1 + months, 1, 12);
  const last = new Date(Date.UTC(y, m + months, 0, 12)).getUTCDate();
  return new Date(first + (Math.min(d, last) - 1) * 86400000);
}

export function serviceDue(plan: ServicePlan, odometerKm: number | undefined, now = new Date()): ServiceDue {
  const kmLeft = plan.lastKm != null && odometerKm != null ? plan.lastKm + plan.everyKm - odometerKm : null;
  let daysLeft: number | null = null;
  if (plan.lastDate) {
    daysLeft = Math.round((addMonthsClamped(plan.lastDate, plan.everyMonths).getTime() - now.getTime()) / 86400000);
  }
  const overdue = (kmLeft != null && kmLeft < 0) || (daysLeft != null && daysLeft < 0);
  const soon = !overdue && ((kmLeft != null && kmLeft < 1609) || (daysLeft != null && daysLeft < 30));
  return { kmLeft, daysLeft, overdue, soon };
}

const KM_PER_MILE = 1.609344;

// A distance in kilometres as a whole number in the owner's unit.
export function fromKm(km: number, miles: boolean): number {
  return Math.round(miles ? km / KM_PER_MILE : km);
}

// The odometer the reminder counts from: the newer of the reading from the
// car and the figure the owner typed. A reading with no date counts as older
// than a typed one. Null when neither is known.
export function odometerNow(v: { odometerKm?: number; odometerAt?: number; odometerTypedKm?: number; odometerTypedAt?: number } | null | undefined): { km: number; at?: number; typed: boolean } | null {
  if (!v) return null;
  const car = v.odometerKm != null ? { km: v.odometerKm, at: v.odometerAt, typed: false } : null;
  const typed = v.odometerTypedKm != null ? { km: v.odometerTypedKm, at: v.odometerTypedAt, typed: true } : null;
  if (car && typed) return (typed.at ?? 0) >= (car.at ?? 0) ? typed : car;
  return car ?? typed;
}

export interface TypedService {
  // Year-month-day.
  lastDate?: string;
  lastKm?: number;
  odoKm?: number;
}

// A typed distance ("48200", "48,200") in kilometres, undefined when empty,
// null when it is not a whole number between 1 and 2,000,000.
function typedKm(text: string, miles: boolean): number | undefined | null {
  const clean = text.replace(/[\s,]/g, '');
  if (!clean) return undefined;
  if (!/^\d{1,7}$/.test(clean)) return null;
  const n = Number(clean);
  if (n < 1 || n > 2000000) return null;
  return miles ? n * KM_PER_MILE : n;
}

// Checks the fields typed under Reminder: the last service (date and
// mileage) and the odometer now, in the owner's unit. dateIso is the typed
// date already read as year-month-day (null when it is not a real date).
// Empty fields are left out of the result.
export function typedService(
  input: { dateText: string; dateIso: string | null; lastText: string; odoText: string },
  miles: boolean,
  todayIso: string,
): { value: TypedService } | { error: string } {
  const value: TypedService = {};
  if (input.dateText.trim()) {
    if (!input.dateIso) return { error: 'Type the date as day/month/year, for example 12/11/2026.' };
    if (input.dateIso > todayIso) return { error: 'The last service date is in the future. Check the date.' };
    value.lastDate = input.dateIso;
  }
  const last = typedKm(input.lastText, miles);
  const odo = typedKm(input.odoText, miles);
  if (last === null || odo === null) return { error: `Type the ${miles ? 'miles' : 'kilometres'} as a whole number, for example 48200.` };
  if (last != null && odo != null && odo < last) return { error: 'The odometer now is lower than the mileage at the last service. Check both figures.' };
  if (last != null) value.lastKm = last;
  if (odo != null) value.odoKm = odo;
  return { value };
}

// "Due in 2,300 mi or 4 months" / "Overdue by 120 mi".
export function describeDue(d: ServiceDue, miles = true, distanceStale = false): string {
  const dist = (km: number) => (miles ? `${Math.round(Math.abs(km) / 1.609344).toLocaleString('en-GB')} mi` : `${Math.round(Math.abs(km)).toLocaleString('en-GB')} km`);
  const time = (days: number) => {
    const a = Math.abs(days);
    if (days === 0) return 'today';
    return a >= 60 ? `${Math.round(a / 30.4)} months` : `${a} day${a === 1 ? '' : 's'}`;
  };
  if (d.overdue) {
    const parts = [d.kmLeft != null && d.kmLeft < 0 ? dist(d.kmLeft) : null, d.daysLeft != null && d.daysLeft < 0 ? time(d.daysLeft) : null].filter(Boolean);
    return `Overdue by ${parts.join(' and ')}`;
  }
  const parts = [d.kmLeft != null ? dist(d.kmLeft) : null, d.daysLeft != null ? time(d.daysLeft) : null].filter(Boolean);
  if (parts.length === 1 && parts[0] === 'today') return 'Due today';
  if (!parts.length && distanceStale) return 'Type the odometer again to count distance';
  return parts.length ? `Due in ${parts.join(' or ')}` : 'Set the last service to start';
}

// A typed odometer is a figure from one day. After this many days the
// distance left is no longer trusted while it still shows time to go.
export const TYPED_ODOMETER_STALE_DAYS = 30;
const DAY_MS = 86400000;

export interface VehicleOdometer {
  odometerKm?: number;
  odometerAt?: number;
  odometerTypedKm?: number;
  odometerTypedAt?: number;
}

// Whole days since the odometer figure was read or typed; null when it has no date.
export function odometerAgeDays(o: { at?: number } | null, now = Date.now()): number | null {
  return o?.at != null ? Math.max(0, Math.floor((now - o.at) / DAY_MS)) : null;
}

// A typed figure with no date, or older than the limit, is stale.
function typedStale(o: { typed: boolean; at?: number }, now: number): boolean {
  if (!o.typed) return false;
  const age = odometerAgeDays(o, now);
  return age == null || age > TYPED_ODOMETER_STALE_DAYS;
}

// The one reminder both the Car tab and the Service page show. A typed
// odometer that is stale drops a distance still to go (the car has been
// driven since); a distance already overdue stays overdue, as it only grows.
export function vehicleServiceDue(
  v: (VehicleOdometer & { service?: ServicePlan }) | null | undefined,
  now = Date.now(),
): { due: ServiceDue | null; odo: ReturnType<typeof odometerNow>; distanceStale: boolean } {
  const odo = odometerNow(v);
  if (!v?.service) return { due: null, odo, distanceStale: false };
  const raw = serviceDue(v.service, odo?.km, new Date(now));
  const stale = !!odo && typedStale(odo, now);
  if (!stale || raw.kmLeft == null || raw.kmLeft < 0) return { due: raw, odo, distanceStale: stale && raw.kmLeft != null };
  const overdue = raw.daysLeft != null && raw.daysLeft < 0;
  const soon = !overdue && raw.daysLeft != null && raw.daysLeft < 30;
  return { due: { kmLeft: null, daysLeft: raw.daysLeft, overdue, soon }, odo, distanceStale: true };
}

// The mileage to store for a service marked done now: the car's reading, or
// a typed figure from today or yesterday. Undefined when the figure is older
// (it would start the next count from the wrong place).
export function markDoneKm(v: VehicleOdometer | null | undefined, now = Date.now()): number | undefined {
  const odo = odometerNow(v);
  if (!odo) return undefined;
  if (odo.typed) {
    const age = odometerAgeDays(odo, now);
    if (age == null || age > 1) return undefined;
  }
  return odo.km;
}

// Whether Save stores the typed odometer with today's date. Only when the
// owner changed the Odometer field (the field is prefilled, so saving another
// field must not refresh it). A changed field is stored when there is no
// figure yet, when it differs, or when it is typed again over a typed figure
// (which refreshes its date). A reading from the car keeps its own date when
// the same figure is typed.
export function shouldStoreTypedOdometer(odoKm: number | undefined, current: { km: number; typed: boolean } | null, miles: boolean, edited: boolean): boolean {
  if (odoKm == null || !edited) return false;
  if (!current) return true;
  return current.typed || fromKm(odoKm, miles) !== fromKm(current.km, miles);
}

export const DISTANCE_RESTARTS_NOTICE = 'The distance part of the reminder restarts when the odometer is typed or read again.';

// True when Mark done cannot store a mileage although an odometer figure exists.
export function markDoneSkipsKm(v: VehicleOdometer | null | undefined, now = Date.now()): boolean {
  return odometerNow(v) != null && markDoneKm(v, now) === undefined;
}
