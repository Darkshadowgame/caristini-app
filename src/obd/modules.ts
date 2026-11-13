// Control modules Caristini can talk to with UDS on 11-bit CAN, per maker.
// Request (tx) and response (rx) CAN IDs come from public sources; the full
// table with confidence ratings is in replica/uds-sources.md. Entries rated
// low or tied to other platforms there are left out. A module that is not
// fitted simply does not answer.
//
// Source keys (see replica/uds-sources.md):
//   ODIS   github.com/ConnorHowell/vag-uds-ids (IDs extracted from ODIS)
//   A7     github.com/DaSonOfPoseidon/OBDCracker issues 86 and 172, PR 230 (2014 Audi A7, MLB)
//   A6     Owner's Audi A6 C7, read by Caristini on 11 Nov 2026
//   ODBC   github.com/commaai/opendbc (Volkswagen, Ford, Mazda values)
//   RT     Ross-Tech wiki, Audi A6 (4G) address words
//   FFG    ffguide.net Focus service manual, module configuration
//   FSC    FORScan settings sheet (Ford Explorer 2016-17MY)
//   MIA    miatafy.com FORScan mod list (Mazda ND, CX-5, Mazda3)
export type ModuleGroup = 'all' | 'vag' | 'ford' | 'mazda';

// How Caristini can reach a module. A module may answer on more than one
// route depending on the car (a 2007 SEAT engine speaks KWP2000 over VW TP2.0,
// a 2012 Audi engine UDS), so each module lists every route a source supports
// and the client tries them in order, remembering the one that answered.
export type Route =
  // UDS (ISO 14229) on the main CAN bus, OBD pins 6 and 14.
  | { via: 'uds'; tx: string; rx: string }
  // VW TP2.0 transport with KWP2000 on top, by TP2.0 logical address.
  | { via: 'tp20'; address: number }
  // UDS on the Ford / Mazda medium-speed CAN bus (pins 3 and 11). Only
  // adapters that can switch to that bus (STN chips, for example OBDLink).
  | { via: 'mscan'; tx: string; rx: string };

export type RouteKind = Route['via'];

export const ROUTE_LABEL: Record<RouteKind, string> = {
  uds: 'UDS',
  tp20: 'KWP2000 over TP2.0',
  mscan: 'UDS on the second CAN bus',
};

export interface ModuleDef {
  id: string;
  name: string;
  // Maker address code shown by workshop tools (VW group: 01, 02, 17 ...).
  code?: string;
  // UDS request and response IDs on the main CAN bus.
  tx: string;
  rx: string;
  // Other routes, tried after UDS.
  alt?: Route[];
  groups: ModuleGroup[];
  source: string;
}

// Every route for a module, UDS on the main bus first.
export function routesOf(def: ModuleDef, extra: Route[] = []): Route[] {
  return [{ via: 'uds', tx: def.tx, rx: def.rx }, ...(def.alt ?? []), ...extra];
}

const tp20 = (address: number): Route => ({ via: 'tp20', address });
const ms = (tx: string, rx: string): Route => ({ via: 'mscan', tx, rx });

const vag = (code: string, name: string, tx: string, rx: string, source: string, alt?: Route[]): ModuleDef => ({
  id: `vag-${code.toLowerCase()}`,
  name,
  code,
  tx,
  rx,
  alt,
  groups: ['vag'],
  source,
});

// Ford and Mazda modules on the medium-speed bus also get that route.
const ford = (id: string, name: string, tx: string, rx: string, source: string, msBus = false): ModuleDef => ({
  id: `ford-${id}`,
  name,
  tx,
  rx,
  alt: msBus ? [ms(tx, rx)] : undefined,
  groups: ['ford'],
  source,
});
const mazda = (id: string, name: string, tx: string, rx: string, source: string, msBus = false): ModuleDef => ({
  id: `mazda-${id}`,
  name,
  tx,
  rx,
  alt: msBus ? [ms(tx, rx)] : undefined,
  groups: ['mazda'],
  source,
});

export const MODULES: ModuleDef[] = [
  // TP2.0 routes apply to VW group cars only (the client checks the make).
  { id: 'engine', name: 'Engine', code: '01', tx: '7E0', rx: '7E8', alt: [tp20(0x01)], groups: ['all'], source: 'ISO 15765-4 (OBD on CAN); ODIS; A6; TP2.0 0x01: leon-sources 1.3' },
  { id: 'gearbox', name: 'Transmission', code: '02', tx: '7E1', rx: '7E9', alt: [tp20(0x02)], groups: ['all'], source: 'ISO 15765-4 (OBD on CAN); ODIS; A6; TP2.0 0x02: leon-sources 1.3' },

  // VW group (VW, Audi, Skoda, SEAT), MQB and MLB. Response = request + 0x6A.
  // TP2.0 addresses on PQ cars (2007 SEAT Leon era), from replica/leon-sources.md 1.3.
  vag('19', 'CAN gateway', '710', '77A', 'ODIS; A7; RT; TP2.0 0x1F', [tp20(0x1f)]),
  vag('03', 'ABS and stability control', '713', '77D', 'ODIS; A7; RT; TP2.0 0x03', [tp20(0x03)]),
  vag('53', 'Parking brake', '752', '7BC', 'ODIS; A7; RT'),
  vag('44', 'Power steering', '712', '77C', 'ODIS; opendbc; A7; RT; TP2.0 0x09', [tp20(0x09)]),
  vag('16', 'Steering wheel electronics', '70C', '776', 'ODIS (name match to RT)'),
  vag('15', 'Airbags', '715', '77F', 'ODIS; opendbc; A7; RT; TP2.0 0x05 (one source)', [tp20(0x05)]),
  vag('17', 'Instrument cluster', '714', '77E', 'ODIS; A7; A6; RT; TP2.0 0x07 (kwp-write-sources F25)', [tp20(0x07)]),
  vag('09', 'Central electronics', '70E', '778', 'ODIS; OBDb Golf signalset; TP2.0 0x20 (kwp-write-sources F25, F26)', [tp20(0x20)]),
  vag('46', 'Comfort system', '70D', '777', 'ODIS (name match to RT); TP2.0 0x21 (kwp-write-sources F25)', [tp20(0x21)]),
  vag('08', 'Heating and air conditioning', '746', '7B0', 'ODIS; A7; RT; TP2.0 0x2C (kwp-write-sources F25)', [tp20(0x2c)]),
  vag('28', 'Rear climate control', '71A', '784', 'ODIS; A7'),
  vag('42', "Driver's door", '74A', '7B4', 'ODIS (name match to RT); TP2.0 0x22 (kwp-write-sources F25)', [tp20(0x22)]),
  vag('52', "Passenger's door", '74B', '7B5', 'ODIS (name match to RT); TP2.0 0x23 (kwp-write-sources F25)', [tp20(0x23)]),
  vag('6D', 'Boot lid', '723', '78D', 'A7'),
  vag('10', 'Parking aid', '70A', '774', 'ODIS; A7'),
  vag('55', 'Headlight range control', '754', '7BE', 'ODIS; A7'),
  vag('13', 'Adaptive cruise control', '757', '7C1', 'ODIS; A7'),
  vag('8B', 'Adaptive cruise control 2', '756', '7C0', 'ODIS; A7'),
  vag('3B', 'Sensor electronics', '721', '78B', 'A7'),
  vag('8F', 'Belt tensioner, front left', '75E', '7C8', 'A7 (address word by name match to RT)'),
  vag('90', 'Belt tensioner, front right', '75F', '7C9', 'A7 (address word by name match to RT)'),
  vag('82', 'Head-up display', '71B', '785', 'ODIS; A7'),
  vag('84', 'Night vision', '727', '791', 'A7'),
  vag('85', 'Front camera', '726', '790', 'ODIS; A7'),
  vag('8E', 'Image processing', '758', '7C2', 'A7'),
  vag('6C', 'Rear view camera', '769', '7D3', 'ODIS; A7'),
  vag('22', 'All-wheel drive', '70F', '779', 'ODIS; T6 forum (Haldex)'),
  vag('5F', 'Infotainment', '773', '7DD', 'ODIS (not found on the A7 capture)'),
  vag('69', 'Trailer', '747', '7B1', 'ODIS (name match to RT)'),
  vag('11', 'Engine 2', '7E2', '7EA', 'ODIS (name match)'),
  vag('65', 'Tyre pressure', '70B', '775', 'ODIS; OBDb RS 3 (the A7 capture used 72A/794)'),

  // Ford (Focus Mk3 era). Response = request + 8. Modules on the medium-speed
  // bus (pins 3 and 11) cannot be reached with a standard adapter and will not answer.
  ford('abs', 'ABS', '760', '768', 'FFG; opendbc'),
  ford('rcm', 'Airbags (RCM)', '737', '73F', 'FFG'),
  ford('ocsm', 'Occupant classification', '765', '76D', 'FFG'),
  ford('ipc', 'Instrument cluster (IPC)', '720', '728', 'FFG; FSC; on MS-CAN on Focus Mk3 (focus-st-sources)', true),
  ford('bcm', 'Body control (BCM / SJB)', '726', '72E', 'FFG; FSC'),
  ford('pscm', 'Power steering', '730', '738', 'opendbc; FSC'),
  ford('apim', 'SYNC (APIM)', '7D0', '7D8', 'FFG; opendbc; FSC'),
  ford('hvac', 'Heating and air conditioning', '733', '73B', 'FFG'),
  ford('acm', 'Audio', '727', '72F', 'FFG; FSC'),
  ford('fcim', 'Front controls', '7A7', '7AF', 'FFG'),
  ford('fdim', 'Front display', '7A6', '7AE', 'FFG'),

  // Mazda (2013-2020). Response = request + 8. Body modules are from CX-5,
  // Mazda3 and MX-5 sources; the Mazda6 GJ is not named in any source found.
  mazda('abs', 'ABS and stability control', '760', '768', 'opendbc (Mazda 6 2017-20)'),
  mazda('eps', 'Power steering', '730', '738', 'opendbc (Mazda 6 2017-20)'),
  mazda('ic', 'Instrument cluster', '720', '728', 'MIA (CX-5, Mazda3, MX-5)'),
  mazda('fbcm', 'Front body control', '726', '72E', 'MIA (CX-5, Mazda3, MX-5)'),
  mazda('rbcm', 'Rear body control', '7B7', '7BF', 'MIA (CX-5, Mazda3, MX-5); MS-CAN on Mazda6 GJ (mazda6-sources)', true),
  mazda('ssu', 'Start and stop unit', '731', '739', 'MIA (CX-5, Mazda3, MX-5)'),
  mazda('radar', 'Front radar', '764', '76C', 'opendbc (fitted cars only)'),
  mazda('camera', 'Front camera', '706', '70E', 'opendbc (fitted cars only)'),
];

export function modulesFor(group: 'vag' | 'ford' | 'mazda' | 'other'): ModuleDef[] {
  return MODULES.filter((m) => m.groups.includes('all') || (group !== 'other' && m.groups.includes(group)));
}
