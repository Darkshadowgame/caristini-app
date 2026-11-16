// MOT check: what the car reports and what the owner sees on a walk-round,
// sorted into likely fails and advisories by the DVSA "MOT inspection manual:
// cars and passenger vehicles" (classes 3, 4, 5 and 7), read 15 Nov 2026.
// Every rule below cites its manual section; the wording, dates and URLs are
// in replica/mot-rules-sources.md. Where the manual says nothing the rule
// says "not known".
//
// Defect categories (manual Introduction, section 7): Dangerous and Major
// fail; Minor passes and is listed on the certificate. Advisories pass
// (Introduction, section 18).
//
// Pure logic with no React or storage, tested in __tests__/mot.test.ts.
import { chargeVerdict, restVerdict } from '../obd/battery';
import { faultText } from '../obd/faultText';
import { faultLabel } from '../diag/faults';

// The code people look up and the MOT list shows: P0011, not P0011B5.
export const baseCode = (c: string) => (/^[PCBU][0-9A-F]{4}[0-9A-F]{2}$/i.test(c) ? c.slice(0, 5).toUpperCase() : c);

export const MOT_MANUAL_URL = 'https://www.gov.uk/guidance/mot-inspection-manual-for-private-passenger-and-light-commercial-vehicles';
// Opened as is: the registration is never put in the address.
export const MOT_HISTORY_URL = 'https://www.gov.uk/check-mot-history';
export const MOT_MANUAL_READ = '15 Nov 2026';

export type Outcome = 'fail' | 'advisory' | 'info';
export type Category = 'Dangerous' | 'Major' | 'Minor';
export type Applies = 'yes' | 'no' | 'maybe';

export interface MotCar {
  fuel: 'Petrol' | 'Diesel' | null;
  // Model year from the VIN or the owner; the manual goes by date of first use.
  year: number | null;
}

export interface Finding {
  key: string;
  from: 'car' | 'walk';
  outcome: Outcome;
  title: string;
  // The rule, in a few words.
  why: string;
  // What to do about it.
  fix: string;
  // Manual section, for example 4.3.1(a)(ii), or "not known".
  section: string;
  category?: Category | 'not known';
  // The walk-round item that shows whether this defect is there now.
  itemId?: string;
  // A Pass on itemId means the defect is not showing: a likely fail becomes an advisory.
  confirmable?: boolean;
  module?: string;
  code?: string;
}

// A model year is not a date of first use: a car of the same year as the rule
// may fall either side of it, so that year is "maybe".
// A car is often first used in the calendar year after its model year, so
// the model year before the rule's year is "maybe" too.
export function firstUsedFrom(car: MotCar, year: number): Applies {
  if (car.year == null) return 'maybe';
  if (car.year > year) return 'yes';
  if (car.year < year - 1) return 'no';
  return 'maybe';
}

// Engine MIL. Manual 8.2.1.2(h) petrol (and hybrids), up to 8 passenger
// seats: first used on or after 1 July 2003. Manual 8.2.2.2(g) diesel: first
// used on or after 1 July 2008.
export function milApplies(car: MotCar): Applies {
  if (car.fuel === 'Diesel') return firstUsedFrom(car, 2008);
  if (car.fuel === 'Petrol') return firstUsedFrom(car, 2003);
  if (car.year == null) return 'maybe';
  return car.year > 2008 ? 'yes' : car.year < 2003 ? 'no' : 'maybe';
}

export function milSection(car: MotCar): string {
  return car.fuel === 'Diesel' ? '8.2.2.2(g)' : car.fuel === 'Petrol' ? '8.2.1.2(h)' : '8.2.1.2(h) or 8.2.2.2(g)';
}

// ---------------------------------------------------------------------------
// Faults read from the car
// ---------------------------------------------------------------------------

export interface CarFault {
  module: string;
  moduleId?: string;
  code: string;
  text?: string;
  // UDS state; KWP2000 faults and faults from a saved health check have none.
  state?: 'active' | 'stored' | 'pending' | 'intermittent';
  warningLamp?: boolean;
}

export type System = 'abs' | 'airbag' | 'epb' | 'eps' | 'tpms' | 'engine' | 'body' | 'cluster' | 'other';

const SYSTEM_BY_ID: Record<string, System> = {
  engine: 'engine',
  'vag-03': 'abs',
  'ford-abs': 'abs',
  'mazda-abs': 'abs',
  'vag-15': 'airbag',
  'vag-8f': 'airbag',
  'vag-90': 'airbag',
  'ford-rcm': 'airbag',
  'ford-ocsm': 'airbag',
  'mazda-rcm': 'airbag',
  'vag-53': 'epb',
  'vag-44': 'eps',
  'ford-pscm': 'eps',
  'mazda-eps': 'eps',
  'vag-65': 'tpms',
  'vag-09': 'body',
  'vag-46': 'body',
  'vag-55': 'body',
  'ford-bcm': 'body',
  'mazda-fbcm': 'body',
  'mazda-rbcm': 'body',
  'vag-17': 'cluster',
  'ford-ipc': 'cluster',
  'mazda-ic': 'cluster',
};

// Module ids whose faults can matter at an MOT (warning lamps, lamps, horn, wipers).
export const MOT_MODULE_IDS = Object.keys(SYSTEM_BY_ID);

export function systemOf(moduleId: string | undefined, name: string): System {
  if (moduleId && SYSTEM_BY_ID[moduleId]) return SYSTEM_BY_ID[moduleId];
  if (/^engine/i.test(name)) return 'engine';
  if (/\babs\b|stability/i.test(name)) return 'abs';
  if (/airbag|belt tensioner|occupant|restraint/i.test(name)) return 'airbag';
  if (/parking brake/i.test(name)) return 'epb';
  if (/power steering/i.test(name)) return 'eps';
  if (/tyre pressure/i.test(name)) return 'tpms';
  if (/central electronics|body control|comfort|headlight range/i.test(name)) return 'body';
  if (/instrument cluster/i.test(name)) return 'cluster';
  return 'other';
}

const BRAKE_SWITCH = /brake (light|lamp|pedal) (switch|position)|stop (lamp|light) switch|brake switch|brake pedal (pressed|monitoring|position)/;
// Lamps inside the car and dashboard tell-tales: not exterior lighting.
// VW names dashboard lamps K-number (K86); "(MIL)" is the engine lamp.
const NOT_EXTERIOR = /interior|glove|footwell|ambien|reading|luggage|boot light|exit light|puddle|instrument|illuminat|warning (lamp|light)|indicator light|tell.?tale|\(k\d+\)|\(mil\)|fault indicator|malfunction indicator|terminal 30|lighting|photo|recognition|sunlight/;

type Partial0 = Omit<Finding, 'key' | 'from' | 'module' | 'code' | 'title'> & { title?: string };

// A fault that is there now: UDS active or stored, or the module says its
// warning lamp is on. KWP2000 and saved faults carry no state: taken as now.
function current(f: CarFault): boolean {
  return f.warningLamp === true || f.state == null || f.state === 'active' || f.state === 'stored';
}

// One fault from a module: a likely fail, an advisory, information, or null
// when it is not an MOT item as far as the manual shows.
export function classifyFault(f: CarFault, car: MotCar, ctx: { milOn?: boolean | null } = {}): Finding | null {
  const text = (faultLabel({ code: f.code, text: f.text }) ?? faultText(f.code) ?? '').trim();
  const t = text.toLowerCase();
  const sys = systemOf(f.moduleId, f.module);
  const now = current(f);
  const what = text || `Fault ${baseCode(f.code)}`;
  const done = (p: Partial0): Finding => ({ key: `fault:${f.module}:${f.code}`, from: 'car', module: f.module, code: baseCode(f.code), title: p.title ?? what, ...p });
  const lampSystem = (name: string, section: string, rule: string, applies: Applies = 'yes'): Finding =>
    applies === 'no'
      ? done({ outcome: 'info', why: `${name}: not an MOT item for this car (${rule}).`, fix: 'Fix it when convenient.', section, category: 'Major' })
      : done({
          outcome: now ? 'fail' : 'advisory',
          why: now
            ? `${name} fault: its warning lamp showing a malfunction is a Major defect.${applies === 'maybe' ? ` Applies ${rule}.` : ''}`
            : `${name} fault, ${f.state === 'pending' ? 'pending' : 'intermittent'}: fails if it lights the warning lamp at the test.`,
          fix: `Find and fix the cause, clear the fault, then check the ${name.toLowerCase()} lamp goes out after starting the engine.`,
          section,
          category: 'Major',
          itemId: 'dash-lamps',
          confirmable: true,
        });

  // Brake light switch, in any module (engine, ABS or body). Manual 4.3.2:
  // stop lamp switching; (a)(iii) lamps stay on when the brakes are released
  // is Dangerous, (a)(ii) a delay is Major. A fault code alone does not show it.
  if (BRAKE_SWITCH.test(t)) {
    return done({
      outcome: 'advisory',
      why: 'Brake light switch fault: fails if the brake lights do not come on, come on late or stay on.',
      fix: 'Check the brake lights with a helper. Replace the switch if they fail or the fault comes back.',
      section: '4.3.2(a)',
      category: 'Dangerous',
      itemId: 'brake-lights',
    });
  }

  switch (sys) {
    // Manual 1.6(b): ABS "Warning device shows system malfunction", Major.
    // Manual 7.12(e): "ESC MIL indicates a system malfunction", Major.
    case 'abs':
      return lampSystem('ABS or stability control', '1.6(b) and 7.12(e)', '');
    // Manual 7.1.6(a): "An SRS malfunction indicator lamp (MIL) indicates a
    // system malfunction", Major. Pretensioner faults show through this lamp (7.1.4).
    case 'airbag':
      return lampSystem('Airbag', '7.1.6(a)', '');
    // Manual 1.1.6(e): "Electronic parking brake MIL indicates a malfunction", Major.
    case 'epb':
      return lampSystem('Electronic parking brake', '1.1.6(e)', '');
    // Manual 2.6(a): "EPS MIL indicating a system malfunction", Major.
    case 'eps':
      return lampSystem('Power steering', '2.6(a)', '');
    // Manual 5.2.3(h): TPMS "malfunctioning or obviously not working", Major,
    // for M1 vehicles first used on or after 1 January 2012.
    case 'tpms':
      return lampSystem('Tyre pressure monitor', '5.2.3(h)', 'to cars first used from 1 January 2012', firstUsedFrom(car, 2012));
    // Engine codes: the MOT checks the engine light (8.2.1.2(h) petrol,
    // 8.2.2.2(g) diesel), not the codes behind it.
    case 'engine':
      return done({
        outcome: 'advisory',
        why: ctx.milOn
          ? 'A likely cause of the engine warning light.'
          : f.state === 'pending'
            ? 'Pending engine code: not a fail while the engine light is off, but it can light it.'
            : 'Stored engine code: not a fail while the engine light is off, but it can light it.',
        fix: 'Fix the cause, then clear the code with the engine off. Clearing also resets the emissions self-tests.',
        section: milSection(car),
        category: 'Major',
        itemId: 'dash-lamps',
      });
    default:
      return bodyFault(f, t, car, done, lampSystem);
  }
}

// Faults from body modules, the instrument cluster and others, by their text.
function bodyFault(
  f: CarFault,
  t: string,
  car: MotCar,
  done: (p: Partial0) => Finding,
  lampSystem: (name: string, section: string, rule: string, applies?: Applies) => Finding,
): Finding | null {
  if (!t) return null;
  const lampFail = (section: string, why: string, itemId: string, category: Category = 'Major', fix = 'Replace the bulb or fix the wiring, clear the fault, then check the lamp works.'): Finding =>
    done({ outcome: 'fail', why, fix, section, category, itemId, confirmable: true });
  const notThisCar = (section: string, why: string): Finding => done({ outcome: 'info', why, fix: 'Fix it when convenient.', section });

  // Systems named in the text, whichever module logged them.
  // Manual 5.2.3(h), M1 first used on or after 1 January 2012.
  if (/tyre pressure|tire pressure|tpms/.test(t)) return lampSystem('Tyre pressure monitor', '5.2.3(h)', 'to cars first used from 1 January 2012', firstUsedFrom(car, 2012));
  // Manual 1.1.6(e).
  if (/electric(al|ronic)? parking brake|parking brake (motor|control unit|actuator)|\bepb\b/.test(t)) return lampSystem('Electronic parking brake', '1.1.6(e)', '');
  // Manual 1.1.10(f): "Brake fluid warning light illuminated or defective", Minor.
  // 1.1.10(d): fluid below the minimum mark Minor, significantly below Major.
  if (/brake fluid/.test(t)) {
    return done({ outcome: 'advisory', why: 'Brake fluid warning: a Minor defect if lit, Major if the level is well below the minimum mark.', fix: 'Check the brake fluid level and look for leaks before topping up.', section: '1.1.10(d) and (f)', category: 'Minor', itemId: 'brake-fluid' });
  }
  // Manual 1.1.13: "An illuminated brake wear indicator is not a reason for
  // failure"; pads worn down to the indicator are Major (1.1.13(a)(i)).
  if (/pad wear|brake (pad|lining)|broke pod/.test(t)) {
    return done({ outcome: 'advisory', why: 'Brake pad wear warning: the lamp itself does not fail, worn pads do.', fix: 'Check the pad thickness. Pads worn to the wear indicator fail.', section: '1.1.13(a)', category: 'Major', itemId: 'pads' });
  }
  // Manual 7.8(b)(ii): "Speedometer not working", Major.
  if (/speedometer/.test(t)) {
    return done({ outcome: 'advisory', why: 'Speedometer fault: fails if the speedometer does not work.', fix: 'Check the speedometer reads while driving.', section: '7.8(b)(ii)', category: 'Major', itemId: 'speedo' });
  }
  // Manual 7.3(a): "Steering lock missing or not functioning", Minor.
  if (/steering (column )?lock/.test(t)) {
    return done({ outcome: 'advisory', why: 'Steering lock fault: a Minor defect if the lock does not work.', fix: 'Check the steering lock works with the key out.', section: '7.3(a)', category: 'Minor' });
  }
  // Manual 7.7(a): "Audible warning not working", Major.
  if (/\bhorn\b|audible warning|fanfare/.test(t)) return lampFail('7.7(a)', 'Horn circuit fault: fails if the horn does not work.', 'horn', 'Major', 'Fix the horn or its wiring, clear the fault, then check it sounds.');
  // Manual 3.4(a): "Wiper not operating or missing", Major.
  if (/wiper/.test(t)) return lampFail('3.4(a)', 'Wiper fault: fails if a wiper does not work.', 'wipers', 'Major', 'Fix the wiper motor or wiring, clear the fault, then check the wipers.');
  // Manual 4.1.6(a): headlamp cleaning inoperative, Minor; (a)(ii) Major on
  // LED or gas discharge (HID) headlamps. Inspected from 1 September 2009, if fitted.
  if (/headl(amp|ight)s? (wash|clean)/.test(t)) {
    if (firstUsedFrom(car, 2009) === 'no') return notThisCar('4.1.6(a)', 'Headlamp washers are inspected on cars first used from 1 September 2009 only.');
    return lampFail('4.1.6(a)', 'Headlamp washer fault: Major on LED or xenon headlamps, Minor on others.', 'washers-head', 'Major', 'Fix the headlamp washer pump or wiring and top up the washer fluid.');
  }
  // Manual 3.5(a): washers "not working or not providing sufficient fluid", Major.
  if (/washer|windscreen fluid/.test(t)) {
    if (/low|level/.test(t)) return done({ outcome: 'advisory', why: 'Washer fluid low: fails if the washers cannot clear the screen.', fix: 'Top up the washer fluid.', section: '3.5(a)', category: 'Major', itemId: 'washers' });
    return lampFail('3.5(a)', 'Washer fault: fails if the washers do not work.', 'washers', 'Major', 'Fix the washer pump or wiring, clear the fault, then check the washers.');
  }

  if (NOT_EXTERIOR.test(t)) return null;

  // Exterior lamps. Manual section 4.
  // 4.3.1(a)(ii) a stop lamp missing or inoperative, Major; (a)(iii) all, Dangerous.
  if (/brake (light|lamp)|stop (lamp|light)|high.?level/.test(t)) return lampFail('4.3.1(a)', 'Brake light fault: one brake light out is Major, all out is Dangerous.', 'brake-lights');
  // 4.4.1(a)(ii) a direction indicator missing or inoperative, Major.
  if (/turn signal|direction indicator|indicator (bulb|lamp)|hazard warning|blinker|flasher/.test(t)) return lampFail('4.4.1(a)(ii)', 'Indicator fault: an indicator not working is Major.', 'indicators');
  // 4.6.1(a) "A reversing lamp inoperative", Major; vehicles first used from 1 September 2009.
  if (/revers(e|ing) (light|lamp|bulb)|back.?up (light|lamp)/.test(t)) {
    if (firstUsedFrom(car, 2009) === 'no') return notThisCar('4.6.1(a)', 'Reversing lamps are inspected on cars first used from 1 September 2009 only.');
    return lampFail('4.6.1(a)', 'Reversing lamp fault: a reversing lamp not working is Major.', 'reversing');
  }
  // 4.5.1(a)(ii): a rear fog lamp missing, or a front or rear fog lamp inoperative, Major.
  if (/\bfog\b/.test(t)) return lampFail('4.5.1(a)(ii)', 'Fog lamp fault: a fog lamp not working is Major.', 'fog');
  // 4.7.1(b)(ii): plate lamp out where it is the only one, Major; (b)(i) Minor with 2 or more.
  if (/(licen[cs]e|number|registration) plate/.test(t)) return lampFail('4.7.1(b)', 'Number plate lamp fault: Major if it is the only plate lamp, Minor if another still works.', 'plate-lamp');
  // 4.2: daytime running lamps inspected on vehicles first used from 1 March 2018. Defect line not captured: not known.
  if (/daytime running|\bdrl\b/.test(t)) {
    if (firstUsedFrom(car, 2018) === 'no') return notThisCar('4.2', 'Daytime running lamps are inspected on cars first used from 1 March 2018 only.');
    return done({ outcome: 'advisory', why: 'Daytime running lamp fault: inspected on cars first used from 1 March 2018 (category not known).', fix: 'Replace the bulb or fix the wiring.', section: '4.2', category: 'not known', itemId: 'position' });
  }
  // 4.1.5(a) "Headlamp levelling device inoperative", Major.
  if (/headl(amp|ight)s? range|levell?ing|range adjust/.test(t)) {
    return done({ outcome: 'fail', why: 'Headlamp levelling fault: a levelling device not working is Major.', fix: 'Fix the levelling motor or sensor, clear the fault, then have the headlamp aim checked.', section: '4.1.5(a)', category: 'Major', itemId: 'headlamps' });
  }
  // 4.1.2(a): aim outside the limits, Major.
  if (/headl(amp|ight)s? not adjusted|basic setting/.test(t)) {
    return done({ outcome: 'advisory', why: 'Headlamps not set: fails if the aim is outside the limits.', fix: 'Have the headlamp aim set before the test.', section: '4.1.2(a)', category: 'Major', itemId: 'headlamps' });
  }
  // 4.1.1(a)(ii): "A headlamp missing, inoperative ...", Major.
  if (/low beam|dipped|high.?beam|main beam|headl(amp|ight)|xenon|gas discharge/.test(t)) return lampFail('4.1.1(a)(ii)', 'Headlamp fault: a headlamp not working is Major.', 'headlamps');
  // 4.2.1(a)(ii): a front or rear position lamp missing or inoperative, Major.
  if (/parking (lamp|light)|side ?(light|lamp)|tail ?(light|lamp)|position (lamp|light)|rear (light|lamp)|clearance/.test(t)) return lampFail('4.2.1(a)(ii)', 'Side or tail lamp fault: a position lamp not working is Major.', 'position');
  // Any other lamp circuit: which lamp is not known from the text.
  if (/\b(lamp|bulb|light)s?\b/.test(t)) {
    return done({ outcome: 'advisory', why: 'A lamp circuit fault. Which lamp is not known from the fault text.', fix: 'Check every outside lamp in the walk-round.', section: '4.1 to 4.7', category: 'Major', itemId: 'position' });
  }
  return null;
}

// The engine warning light, read with Mode 01 PID 01.
export function engineLight(milOn: boolean | null, car: MotCar, list: string[] = []): Finding | null {
  if (!milOn) return null;
  const codes = [...new Set(list.map(baseCode))];
  const applies = milApplies(car);
  const section = milSection(car);
  const fix = codes.length
    ? `Fix the cause (${codes.slice(0, 4).join(', ')}${codes.length > 4 ? ' and more' : ''}), clear the codes with the engine off, then check the light goes out.`
    : 'Read the engine codes, fix the cause and clear them with the engine off.';
  if (applies === 'no') {
    // Outside the dates in 8.2.1.2 and 8.2.2.2.
    return { key: 'mil', from: 'car', outcome: 'info', title: 'Engine warning light on', why: 'The engine light rule applies to petrol cars first used from 1 July 2003 and diesels from 1 July 2008.', fix, section, category: 'Major' };
  }
  // Manual 8.2.1.2(h) / 8.2.2.2(g): "Engine MIL inoperative or indicating a malfunction", Major.
  return {
    key: 'mil',
    from: 'car',
    outcome: 'fail',
    title: 'Engine warning light on',
    why: `The engine light showing a malfunction is a Major defect.${applies === 'maybe' ? ' Applies to petrol cars first used from 1 July 2003 and diesels from 1 July 2008.' : ''}`,
    fix,
    section,
    category: 'Major',
    itemId: 'dash-lamps',
  };
}

// What the app read from the car, or took from a recent health check.
export interface CarRead {
  at: number;
  from: 'read' | 'health-check';
  // Read by Learn my car (the MOT screen says so).
  by?: 'learn';
  // When from a health check: when that check ran.
  healthCheckAt?: number;
  milOn: boolean | null;
  stored: string[];
  pending: string[];
  // True when the engine module's own fault list was read (it holds the OBD2 codes too).
  engineModuleRead: boolean;
  faults: CarFault[];
  volts: number | null;
  modulesAsked: number;
  modulesAnswered: number;
  notRead: string[];
  monitorsIncomplete: number | null;
  complete: boolean;
}

export function carFindings(read: CarRead, car: MotCar): Finding[] {
  const out: Finding[] = [];
  const engineCodes = [...read.stored, ...read.pending];
  const fromEngine = read.faults.filter((f) => systemOf(f.moduleId, f.module) === 'engine').map((f) => f.code);
  const mil = engineLight(read.milOn, car, engineCodes.length ? engineCodes : fromEngine);
  if (mil) out.push(mil);
  const faults: CarFault[] = [...read.faults];
  // The standard OBD2 codes count only when the engine module was not read.
  if (!read.engineModuleRead) {
    for (const c of read.stored) faults.push({ module: 'Engine (OBD2)', moduleId: 'engine', code: c, state: 'stored' });
    for (const c of read.pending) if (!read.stored.includes(c)) faults.push({ module: 'Engine (OBD2)', moduleId: 'engine', code: c, state: 'pending' });
  }
  const seen = new Set<string>();
  for (const f of faults) {
    const r = classifyFault(f, car, { milOn: read.milOn });
    if (!r || seen.has(r.key)) continue;
    seen.add(r.key);
    out.push(r);
  }
  return out;
}

// Faults read that are not MOT items as far as the manual shows.
export function otherFaultCount(read: CarRead, car: MotCar): number {
  return read.faults.filter((f) => !classifyFault(f, car, { milOn: read.milOn })).length;
}

// Battery and self-tests: shown for information, not MOT items.
export function carNotes(read: CarRead): string[] {
  const out: string[] = [];
  if (read.volts != null) {
    const v = read.volts >= 13.3 ? chargeVerdict(read.volts) : restVerdict(read.volts);
    out.push(`Battery ${read.volts.toFixed(1)} V, ${v.word.toLowerCase()}. Not an MOT item.`);
  }
  // The manual (8.2) does not mention the OBD self-tests (readiness monitors).
  if (read.monitorsIncomplete) out.push(`${read.monitorsIncomplete} emissions self-test${read.monitorsIncomplete === 1 ? '' : 's'} not complete. The MOT manual does not mention them; whether a tester reads them is not known.`);
  return out;
}

// ---------------------------------------------------------------------------
// Walk-round
// ---------------------------------------------------------------------------

export type ItemState = 'pass' | 'advisory' | 'fail' | 'unchecked';

export interface Answer {
  state: ItemState;
  note?: string;
}

export interface WalkItem {
  id: string;
  title: string;
  // How to check it, in one line.
  how?: string;
  // One line from the manual: what fails.
  failIf: string;
  failIfDiesel?: string;
  section: string;
  sectionDiesel?: string;
  // The worst category the item can have. Minor only: a fail is an advisory.
  worst: Category;
  fix: string;
  applies?: (car: MotCar) => Applies;
  // Shown when the item does not apply to this car.
  notApplicable?: string;
}

export interface WalkGroup {
  id: string;
  title: string;
  items: WalkItem[];
}

// In the order of the owner's checklist: lights first, the doors last.
export const WALK: WalkGroup[] = [
  {
    id: 'lights',
    title: 'Lights and signals',
    items: [
      {
        id: 'dash-lamps',
        title: 'Dashboard warning lamps',
        how: 'Ignition on: each lamp lights. Engine running: they all go out.',
        // 8.2.1.2(h)/8.2.2.2(g) engine MIL; 1.6(a)(b) ABS; 7.12(e) ESC; 7.1.6(a) SRS;
        // 1.1.6(e) EPB; 2.6(a) EPS; 5.2.3(h) TPMS (from 1 January 2012). All Major.
        failIf: 'Engine, ABS, ESP, airbag, power steering, electronic parking brake or tyre pressure lamp stays on, or the engine or ABS lamp never lights.',
        section: '8.2.1.2(h), 1.6, 7.12(e), 7.1.6(a), 2.6(a), 1.1.6(e), 5.2.3(h)',
        sectionDiesel: '8.2.2.2(g), 1.6, 7.12(e), 7.1.6(a), 2.6(a), 1.1.6(e), 5.2.3(h)',
        worst: 'Major',
        fix: 'Read the faults for the lamp that stays on and fix the cause.',
      },
      {
        id: 'headlamps',
        title: 'Headlamps, dipped and main beam',
        how: 'Both sides on dipped and main beam, against a wall. The blue main beam lamp lights.',
        // 4.1.1(a)(ii) headlamp inoperative Major; 4.1.2(a) aim Major; 4.9.1(a)(ii) main beam tell-tale Major.
        failIf: 'A headlamp not working, aim obviously wrong, or the main beam tell-tale not working.',
        section: '4.1.1(a)(ii), 4.1.2(a), 4.9.1(a)(ii)',
        worst: 'Major',
        fix: 'Replace the bulb; have the aim set if the beam pattern looks wrong.',
      },
      {
        id: 'position',
        title: 'Side and tail lamps',
        how: 'Front side lamps and rear tail lamps, both sides.',
        // 4.2.1(a)(ii) Major.
        failIf: 'A front or rear position lamp missing or not working.',
        section: '4.2.1(a)(ii)',
        worst: 'Major',
        fix: 'Replace the bulb or fix the wiring.',
      },
      {
        id: 'brake-lights',
        title: 'Brake lights (with a helper)',
        how: 'Get a helper to watch all brake lights, the high level one too, as you press the pedal, and check they go out when you let go.',
        // 4.3.1(a)(ii) Major, (a)(iii) all out Dangerous; 4.3.2(a)(iii) stay on Dangerous.
        failIf: 'A brake light not working (Major); all out, or staying on with the pedal released (Dangerous).',
        section: '4.3.1(a), 4.3.2(a)(iii)',
        worst: 'Dangerous',
        fix: 'Replace the bulb; if they stay on or do nothing, check the brake light switch.',
      },
      {
        id: 'indicators',
        title: 'Indicators and hazard lights',
        how: 'Left, right and hazards, front, rear and side repeaters. The dashboard arrows flash too.',
        // 4.4.1(a)(ii) Major; 4.4.4(a) flash rate Minor; 4.9.1(a)(i) tell-tale Minor.
        failIf: 'An indicator not working (Major). Flashing outside 60 to 120 a minute, or the tell-tale out, is Minor.',
        section: '4.4.1(a)(ii), 4.4.4(a), 4.9.1(a)(i)',
        worst: 'Major',
        fix: 'Replace the bulb; a fast flash usually means a bulb is out.',
      },
      {
        id: 'fog',
        title: 'Rear fog lamp',
        how: 'Switch it on; its dashboard lamp lights.',
        // 4.5.1(a)(ii) Major, first used from 1 April 1980; 4.9.1(a)(ii) tell-tale Major.
        failIf: 'The rear fog lamp, or a front fog lamp if fitted, not working, or its tell-tale not working.',
        section: '4.5.1(a)(ii), 4.9.1(a)(ii)',
        worst: 'Major',
        fix: 'Replace the bulb or fix the switch.',
      },
      {
        id: 'reversing',
        title: 'Reversing lamps',
        how: 'Ignition on, reverse gear selected, engine off.',
        // 4.6.1(a) Major, vehicles first used from 1 September 2009.
        failIf: 'A reversing lamp not working.',
        section: '4.6.1(a)',
        worst: 'Major',
        fix: 'Replace the bulb or the reverse switch.',
        applies: (car) => firstUsedFrom(car, 2009),
        notApplicable: 'Inspected on cars first used from 1 September 2009 only.',
      },
      {
        id: 'plate-lamp',
        title: 'Number plate lamp',
        // 4.7.1(b)(ii) Major when the only lamp; (b)(i) Minor with 2 or more.
        failIf: 'The plate lamp out where it is the only one (Major); one of 2 or more out is Minor.',
        section: '4.7.1(b)',
        worst: 'Major',
        fix: 'Replace the bulb.',
      },
      {
        id: 'reflectors',
        title: 'Rear reflectors',
        // 4.8.2(a)(ii) Major.
        failIf: 'A reflector missing or reflecting white to the rear.',
        section: '4.8.2(a)(ii)',
        worst: 'Major',
        fix: 'Fit a new reflector.',
      },
      {
        id: 'washers-head',
        title: 'Headlamp washers, if fitted',
        // 4.1.6(a)(i) Minor, (a)(ii) Major on LED or HID; first used from 1 September 2009.
        failIf: 'Headlamp washers not working: Major on LED or xenon headlamps, Minor on others.',
        section: '4.1.6(a)',
        worst: 'Major',
        fix: 'Top up the washer fluid; fix the pump or jets.',
        applies: (car) => firstUsedFrom(car, 2009),
        notApplicable: 'Inspected on cars first used from 1 September 2009 only.',
      },
    ],
  },
  {
    id: 'tyres',
    title: 'Tyres and wheels',
    items: [
      {
        id: 'tread',
        title: 'Tread depth, every tyre',
        how: 'Use a tread depth gauge across the middle and both sides, all the way round.',
        // 5.2.3(e) Dangerous; 1.6 mm across the central three-quarters and the whole circumference.
        failIf: 'Less than 1.6 mm in the central three-quarters of the tread, anywhere round the tyre.',
        section: '5.2.3(e)',
        worst: 'Dangerous',
        fix: 'Replace the tyre.',
      },
      {
        id: 'tyre-damage',
        title: 'Cuts, bulges and cords',
        how: 'Look along both sidewalls of each tyre, turning the steering to see the fronts.',
        // 5.2.3(d)(i) cut to the ply or cords Major; (d)(ii) lump, bulge or tear Dangerous.
        failIf: 'A cut deep enough to reach the ply or cords (Major), or a lump, bulge or tear (Dangerous).',
        section: '5.2.3(d)',
        worst: 'Dangerous',
        fix: 'Replace the tyre.',
      },
      {
        id: 'pressures',
        title: 'Tyre pressures',
        // 5.2.3(l) "Tyre obviously under-inflated", Minor.
        failIf: 'A tyre obviously under-inflated (Minor: passes, noted).',
        section: '5.2.3(l)',
        worst: 'Minor',
        fix: 'Set the pressures from the door pillar label.',
      },
      {
        id: 'wheel-nuts',
        title: 'Wheel nuts or bolts',
        // 5.2.1(a)(i) one loose or missing Major; (a)(ii) more than one Dangerous.
        failIf: 'A loose or missing wheel nut or bolt (Major); more than one (Dangerous).',
        section: '5.2.1(a)',
        worst: 'Dangerous',
        fix: 'Fit and tighten to the correct torque.',
      },
    ],
  },
  {
    id: 'brakes',
    title: 'Brakes and handbrake',
    items: [
      {
        id: 'handbrake',
        title: 'Handbrake',
        how: 'It holds the car on a slope and the ratchet holds. Electronic: no warning lamp.',
        // 1.1.6(a) ratchet Major; (c) excessive movement Major; (d) inoperative Major; (e) EPB MIL Major.
        failIf: 'Ratchet not holding, too much lever travel, not working, or the electronic parking brake lamp on.',
        section: '1.1.6',
        worst: 'Major',
        fix: 'Adjust or repair the handbrake.',
      },
      {
        id: 'brake-fluid',
        title: 'Brake fluid level',
        how: 'Bonnet up: the level is between the marks on the reservoir.',
        // 1.1.10(d)(i) below minimum Minor; (d)(ii) well below Major; (d)(iii) not visible Dangerous; 1.8(a) contaminated Major.
        failIf: 'Below the minimum mark (Minor), well below (Major), not visible (Dangerous), or contaminated (Major).',
        section: '1.1.10(d), 1.8(a)',
        worst: 'Dangerous',
        fix: 'Top up with the right fluid and look for leaks; change contaminated fluid.',
      },
      {
        id: 'pedal',
        title: 'Brake pedal',
        // 1.1.2(a) insufficient reserve travel Major; (c) anti-slip missing or worn smooth Major.
        failIf: 'The pedal sinks too far, or its rubber is missing, loose or worn smooth.',
        section: '1.1.2(a), 1.1.2(c)',
        worst: 'Major',
        fix: 'Have the brakes bled or repaired; fit a new pedal rubber.',
      },
      {
        id: 'pads',
        title: 'Pads and discs you can see',
        how: 'Look through the wheel spokes at the pad and the disc face.',
        // 1.1.13(a)(i) worn to indicator Major; (a)(ii) below 1.5 mm Dangerous; 1.1.14(a)(i) disc obviously worn Major.
        failIf: 'A pad worn to its wear indicator (Major) or below 1.5 mm (Dangerous), or a disc obviously worn.',
        section: '1.1.13(a), 1.1.14(a)(i)',
        worst: 'Dangerous',
        fix: 'Replace the pads, and the discs if worn.',
      },
      {
        id: 'brake-pipes',
        title: 'Brake pipes and hoses',
        // 1.1.11(b)(ii) and 1.1.12(c)(ii) leaking, Dangerous.
        failIf: 'A brake pipe, hose or connection leaking.',
        section: '1.1.11(b)(ii), 1.1.12(c)(ii)',
        worst: 'Dangerous',
        fix: 'Replace the pipe or hose and bleed the brakes.',
      },
    ],
  },
  {
    id: 'steering',
    title: 'Steering and suspension',
    items: [
      {
        id: 'steering-play',
        title: 'Steering free play',
        how: 'Engine running, wheels straight: rock the wheel gently until the front wheels start to move.',
        // 2.3(a)(i) excessive Major; (a)(ii) affecting safe steering Dangerous.
        failIf: 'Too much free play at the rim (Major), or enough to affect safe steering (Dangerous).',
        section: '2.3(a)',
        worst: 'Dangerous',
        fix: 'Have the track rod ends, rack and column checked.',
      },
      {
        id: 'power-steering',
        title: 'Power steering',
        // 2.1.5(a) fluid leaking or system malfunctioning Major; (b)(i) below minimum Minor; 2.6(c) assistance not working Major.
        failIf: 'Fluid leaking, assistance not working, or the system faulty (Major); fluid below the minimum mark is Minor.',
        section: '2.1.5, 2.6(c)',
        worst: 'Major',
        fix: 'Fix the leak or fault; top up hydraulic systems.',
      },
      {
        id: 'springs',
        title: 'Springs',
        // 5.3.1(b)(i) fractured or seriously weakened, Major.
        failIf: 'A spring broken or seriously weakened (the car sits low at one corner).',
        section: '5.3.1(b)(i)',
        worst: 'Major',
        fix: 'Replace the spring, in pairs across the axle.',
      },
      {
        id: 'shocks',
        title: 'Shock absorbers',
        // 5.3.2(b) not functioning or severe leakage, Major; (a)(ii) missing Dangerous.
        failIf: 'A shock absorber not working or leaking badly. A light film of fluid is not a fail.',
        section: '5.3.2(b)',
        worst: 'Major',
        fix: 'Replace the shock absorbers in pairs.',
      },
      {
        id: 'cv-boots',
        title: 'Drive shaft boots',
        how: 'Full lock each way and look behind the front wheels.',
        // 6.1.7(g)(ii) missing or split Major; (g)(i) severely deteriorated Minor.
        failIf: 'A CV joint boot missing or split (Major); badly perished is Minor.',
        section: '6.1.7(g)',
        worst: 'Major',
        fix: 'Replace the boot and regrease the joint.',
      },
      {
        id: 'joints',
        title: 'Suspension joints and bushes',
        // 5.3.4(a)(i) "pin, bush, joint or bearing excessively worn", Major.
        failIf: 'A suspension joint, bush or bearing excessively worn (knocks, play or torn rubber).',
        section: '5.3.4(a)(i)',
        worst: 'Major',
        fix: 'Replace the worn joint or bush.',
      },
    ],
  },
  {
    id: 'visibility',
    title: 'Windscreen, wipers and washers',
    items: [
      {
        id: 'windscreen',
        title: 'Windscreen damage',
        how: 'Zone A is 290 mm wide, centred on the steering wheel, in the wiped area.',
        // 3.2(a)(ii) Major: damage over 10 mm in zone A, over 40 mm in the rest of the swept area.
        failIf: 'Damage over 10 mm across in zone A, or over 40 mm elsewhere in the wiped area.',
        section: '3.2(a)',
        worst: 'Dangerous',
        fix: 'Have the chip repaired or the screen replaced.',
      },
      {
        id: 'wipers',
        title: 'Wipers',
        // 3.4(a) not operating Major; 3.4(b)(ii) blade missing or not clearing Major; (b)(i) defective Minor.
        failIf: 'A wiper not working, or a blade missing or not clearing the screen.',
        section: '3.4',
        worst: 'Major',
        fix: 'Fit new blades; fix the motor if it does not run.',
      },
      {
        id: 'washers',
        title: 'Windscreen washers',
        // 3.5(a) Major.
        failIf: 'Washers not working, or not giving enough fluid to clear the screen.',
        section: '3.5(a)',
        worst: 'Major',
        fix: 'Top up the washer fluid; clear the jets or fix the pump.',
      },
    ],
  },
  {
    id: 'horn',
    title: 'Horn and speedometer',
    items: [
      {
        id: 'horn',
        title: 'Horn',
        // 7.7(a) Major.
        failIf: 'The horn not working.',
        section: '7.7(a)',
        worst: 'Major',
        fix: 'Check the fuse, the horn and the steering wheel contact.',
      },
      {
        id: 'speedo',
        title: 'Speedometer',
        // 7.8(b)(ii) not working Major; 7.8(c)(ii) not illuminated Major.
        failIf: 'The speedometer not working or not lit.',
        section: '7.8',
        worst: 'Major',
        fix: 'Have the speed sensor or cluster checked.',
      },
    ],
  },
  {
    id: 'mirrors',
    title: 'Mirrors',
    items: [
      {
        id: 'mirrors',
        title: 'Mirrors',
        // 3.3(a) missing Major; 3.3(b)(ii) inoperative, badly damaged or insecure Major; (b)(i) slightly damaged Minor.
        failIf: 'A required mirror missing, badly damaged or loose (Major); slightly damaged is Minor.',
        section: '3.3',
        worst: 'Major',
        fix: 'Replace the glass or the mirror.',
      },
    ],
  },
  {
    id: 'belts',
    title: 'Seat belts and airbags',
    items: [
      {
        id: 'belts',
        title: 'Every seat belt',
        how: 'Pull each belt out fully, check the webbing, then buckle and unbuckle it. Give it a sharp tug: it locks.',
        // 7.1.2(a) to (e), Major.
        failIf: 'A belt missing, webbing cut or frayed, buckle not working, or retractor not working.',
        section: '7.1.2',
        worst: 'Major',
        fix: 'Replace the belt.',
      },
      {
        id: 'airbags',
        title: 'Airbags and pretensioners',
        // 7.1.5(a) airbag missing Major; 7.1.4(a) pretensioner missing or deployed Major; 7.1.6(a) SRS lamp Major.
        failIf: 'An airbag or pretensioner missing or deployed, or the airbag lamp on. A passenger airbag switched off is not a defect.',
        section: '7.1.4(a), 7.1.5(a), 7.1.6(a)',
        worst: 'Major',
        fix: 'Have the airbag system repaired.',
      },
    ],
  },
  {
    id: 'plates',
    title: 'Number plates',
    items: [
      {
        id: 'plates',
        title: 'Number plates',
        how: 'Both plates secure, clean and readable, in the standard font and spacing.',
        // 0.1(a) to (d), Major.
        failIf: 'A plate missing, loose, unreadable, wrong, or not to the rules (font, spacing, background).',
        section: '0.1',
        worst: 'Major',
        fix: 'Fit legal plates from a registered supplier.',
      },
      {
        id: 'vin',
        title: 'VIN plate',
        // 0.2(a) missing Major.
        failIf: 'The VIN missing, unreadable or more than one different VIN shown.',
        section: '0.2',
        worst: 'Major',
        fix: 'Clean the VIN so it can be read.',
      },
    ],
  },
  {
    id: 'exhaust',
    title: 'Exhaust and emissions',
    items: [
      {
        id: 'exhaust',
        title: 'Exhaust leaks and mountings',
        how: 'Engine running: listen and feel for blowing along the system, and check it is secure.',
        // 6.1.2(a) major leak or insecure, Major.
        failIf: 'A major leak, or the exhaust insecure.',
        section: '6.1.2(a)',
        worst: 'Major',
        fix: 'Replace the leaking section or the mounting.',
      },
      {
        id: 'smoke',
        title: 'Exhaust smoke',
        how: 'Warm engine at idle, then a few blips of the throttle.',
        // Petrol 8.2.1.2(f) Major. Diesel with a DPF 8.2.2.2(d) Major; 8.2.2.2(c) excessive smoke Dangerous.
        failIf: 'Dense blue or clearly visible black smoke for 5 seconds at idle.',
        failIfDiesel: 'Any visible smoke on a car with a particulate filter (DPF), or smoke that would hide other road users.',
        section: '8.2.1.2(f)',
        sectionDiesel: '8.2.2.2(c) and (d)',
        worst: 'Major',
        fix: 'Find the cause of the smoke before the emissions test.',
      },
      {
        id: 'emission-kit',
        title: 'Catalyst and particulate filter',
        // 8.2.1.1(a) / 8.2.2.1(a) emission control equipment missing, modified or defective, Major; 8.2.2.1(c) DPF tampered, Major.
        failIf: 'A catalyst missing, modified or obviously faulty.',
        failIfDiesel: 'A catalyst or DPF missing, modified, obviously faulty or tampered with.',
        section: '8.2.1.1(a)',
        sectionDiesel: '8.2.2.1(a) and (c)',
        worst: 'Major',
        fix: 'Refit or repair the original emission equipment.',
      },
      {
        id: 'fuel',
        title: 'Fuel cap and fuel leaks',
        // 6.1.3(b)(i) leaking or missing filler cap Major; (b)(ii) excessive or fire risk Dangerous.
        failIf: 'A fuel leak, or the filler cap missing or not sealing.',
        section: '6.1.3(b)',
        worst: 'Dangerous',
        fix: 'Fix the leak; fit a new cap.',
      },
    ],
  },
  {
    id: 'leaks',
    title: 'Fluid leaks',
    items: [
      {
        id: 'leaks',
        title: 'Oil and other fluid leaks',
        how: 'Park on clean dry ground with the engine running for 5 minutes, then look underneath.',
        // 8.4.1(a)(i) Major; (a)(ii) Dangerous. Fail: a pool over 75 mm across within 5 minutes.
        failIf: 'A leak that makes a pool over 75 mm across within 5 minutes.',
        section: '8.4.1(a)',
        worst: 'Dangerous',
        fix: 'Find and fix the leak, then clean the area.',
      },
    ],
  },
  {
    id: 'body',
    title: 'Doors, bonnet and boot',
    items: [
      {
        id: 'doors',
        title: 'Doors',
        how: 'Each door opens from inside and outside and shuts properly.',
        // 6.2.3(a) Major.
        failIf: 'A door that will not open with its handle or will not close properly.',
        section: '6.2.3(a)',
        worst: 'Major',
        fix: 'Fix the handle, lock or catch.',
      },
      {
        id: 'bonnet',
        title: 'Bonnet catch',
        // 3.1(b)(i) cannot be secured Major; (b)(ii) at risk of opening Dangerous. Primary catch only.
        failIf: 'The bonnet cannot be shut securely on its main catch.',
        section: '3.1(b)',
        worst: 'Dangerous',
        fix: 'Free and lubricate the catch, or replace it.',
      },
      {
        id: 'boot',
        title: 'Boot or tailgate',
        // 6.2.1(e) cannot be secured closed, Major.
        failIf: 'The boot lid or tailgate cannot be secured shut.',
        section: '6.2.1(e)',
        worst: 'Major',
        fix: 'Fix the lock or striker.',
      },
    ],
  },
];

export const WALK_ITEMS: WalkItem[] = WALK.flatMap((g) => g.items);

export function itemApplies(item: WalkItem, car: MotCar): Applies {
  return item.applies ? item.applies(car) : 'yes';
}

export function failIfFor(item: WalkItem, car: MotCar): string {
  return car.fuel === 'Diesel' && item.failIfDiesel ? item.failIfDiesel : item.failIf;
}

export function sectionFor(item: WalkItem, car: MotCar): string {
  return car.fuel === 'Diesel' && item.sectionDiesel ? item.sectionDiesel : item.section;
}

// Walk-round answers as findings. A fail on an item whose worst defect is
// Minor passes the MOT (Introduction, section 7): it becomes an advisory.
export function walkFindings(answers: Record<string, Answer>, car: MotCar): Finding[] {
  const out: Finding[] = [];
  for (const item of WALK_ITEMS) {
    const a = answers[item.id];
    if (!a || (a.state !== 'fail' && a.state !== 'advisory')) continue;
    if (itemApplies(item, car) === 'no') continue;
    const minorOnly = item.worst === 'Minor';
    const outcome: Outcome = a.state === 'fail' && !minorOnly ? 'fail' : 'advisory';
    out.push({
      key: `walk:${item.id}`,
      from: 'walk',
      outcome,
      title: item.title,
      why: a.note ? `${a.note}` : failIfFor(item, car),
      fix: item.fix,
      section: sectionFor(item, car),
      category: a.state === 'fail' ? item.worst : undefined,
      itemId: item.id,
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Result
// ---------------------------------------------------------------------------

export type Verdict = 'fail' | 'incomplete' | 'advisories' | 'clear';

export interface Summary {
  verdict: Verdict;
  fails: Finding[];
  advisories: Finding[];
  info: Finding[];
  checked: number;
  unchecked: WalkItem[];
  applicable: number;
  carRead: boolean;
  // What the car read missed (engine light, stopped early, modules).
  gaps?: string[];
}

const RANK: Record<string, number> = { Dangerous: 0, Major: 1, Minor: 2, 'not known': 3 };

export function summarise(read: CarRead | null, answers: Record<string, Answer>, car: MotCar): Summary {
  const fromCar = read ? carFindings(read, car) : [];
  // A walk-round Pass on the matching item means the defect is not showing now.
  const adjusted = fromCar.map((f): Finding => {
    if (f.outcome === 'fail' && f.confirmable && f.itemId && answers[f.itemId]?.state === 'pass') {
      return { ...f, outcome: 'advisory', why: `${f.why} Your walk-round found it working, so it may come and go.` };
    }
    return f;
  });
  const all = [...adjusted, ...walkFindings(answers, car)];
  const byRank = (a: Finding, b: Finding) => (RANK[a.category ?? 'not known'] ?? 3) - (RANK[b.category ?? 'not known'] ?? 3);
  const fails = all.filter((f) => f.outcome === 'fail').sort(byRank);
  const advisories = all.filter((f) => f.outcome === 'advisory');
  const info = all.filter((f) => f.outcome === 'info');
  const applicable = WALK_ITEMS.filter((i) => itemApplies(i, car) !== 'no');
  const unchecked = applicable.filter((i) => (answers[i.id]?.state ?? 'unchecked') === 'unchecked');
  // Never "no likely fails" from a partial read: the engine light unread, the
  // read stopped, or a module the MOT checks not answering.
  const partial = !!read && (read.milOn == null || !read.complete || read.notRead.length > 0);
  const verdict: Verdict = fails.length ? 'fail' : !read || partial || unchecked.length ? 'incomplete' : advisories.length ? 'advisories' : 'clear';
  const gaps = !read ? [] : [read.milOn == null ? 'engine light not read' : null, !read.complete ? 'car read stopped early' : null, read.notRead.length ? `${read.notRead.length} module${read.notRead.length === 1 ? '' : 's'} not read` : null].filter((x): x is string => !!x);
  return { verdict, fails, advisories, info, checked: applicable.length - unchecked.length, unchecked, applicable: applicable.length, carRead: !!read, gaps };
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

// What is left before the result is complete: "read the car and check 41 items".
export function stillToDo(s: Summary): string {
  // Gaps in the car read (engine light, stopped early, modules not read) say
  // what to read again.
  const gaps = s.gaps?.length ? `read the car again (${s.gaps.join(', ')})` : null;
  return [!s.carRead ? 'read the car' : gaps, s.unchecked.length ? `check ${plural(s.unchecked.length, 'item')}` : null].filter(Boolean).join(' and ');
}

export function headline(s: Summary): string {
  if (s.verdict === 'fail') return `Likely to fail: ${plural(s.fails.length, 'item')} to fix`;
  if (s.verdict === 'incomplete') {
    // Nothing done yet: no verdict to give.
    if (!s.carRead && !s.checked) return `Not checked yet. To do: ${stillToDo(s)}.`;
    return `No likely fails so far. Still to do: ${stillToDo(s)}.`;
  }
  if (s.verdict === 'advisories') return `No likely fails, ${plural(s.advisories.length, 'advisory', 'advisories')}`;
  return 'No likely fails found';
}

// Short title and detail for History.
export function historyTitle(s: Summary): string {
  return s.fails.length ? `MOT check: ${plural(s.fails.length, 'likely fail')}` : 'MOT check: no likely fails';
}

export function historyDetail(s: Summary): string {
  return [plural(s.advisories.length, 'advisory', 'advisories'), `${s.checked} of ${s.applicable} checked`, s.carRead ? null : 'car not read'].filter(Boolean).join(', ');
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export function stamp(ms: number): string {
  const d = new Date(ms);
  const two = (n: number) => String(n).padStart(2, '0');
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}, ${two(d.getHours())}:${two(d.getMinutes())}`;
}

function line(f: Finding): string {
  const where = f.code ? ` [${f.code}${f.module ? `, ${f.module}` : ''}]` : '';
  const cat = f.category && f.category !== 'not known' && f.outcome === 'fail' ? ` ${f.category}.` : '';
  return `- ${f.title}${where}.${cat} ${f.why} Fix: ${f.fix} (manual ${f.section})`;
}

// Plain text for Messages, Mail or Notes. No registration and no VIN.
export function shareText(s: Summary, ctx: { car: string; at: number; read: CarRead | null }): string {
  const out: string[] = [`MOT check: ${ctx.car}`, stamp(ctx.at), headline(s)];
  if (s.fails.length) out.push('', 'Likely fails', ...s.fails.map(line));
  if (s.advisories.length) out.push('', 'Advisories', ...s.advisories.map(line));
  if (ctx.read) {
    const r = ctx.read;
    const src = r.from === 'health-check' && r.healthCheckAt ? `from the health check of ${stamp(r.healthCheckAt)}` : `read ${stamp(r.at)}`;
    out.push(
      '',
      `From the car (${src}): engine light ${r.milOn == null ? 'not read' : r.milOn ? 'on' : 'off'}, ${plural(r.modulesAnswered, 'module')} answered${r.notRead.length ? `, could not read ${r.notRead.join(', ')}` : ''}.`,
      ...carNotes(r),
    );
  } else {
    out.push('', 'The car was not read: warning lamps and faults were not checked.');
  }
  if (s.unchecked.length) out.push('', `Not checked: ${s.unchecked.map((i) => i.title).join('; ')}.`);
  out.push('', 'A guide from the DVSA MOT inspection manual for cars (gov.uk). The tester decides.', `Check MOT history: ${MOT_HISTORY_URL}`);
  return out.join('\n');
}
