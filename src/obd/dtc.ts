// Fault code decoding and descriptions for generic SAE J2012 codes.
// Codes whose second character is 1 (P1xxx and so on) are set by each car
// maker, so the app labels them as manufacturer-specific.

const LETTERS = ['P', 'C', 'B', 'U'];

export function decodeDtc(b1: number, b2: number): string | null {
  if (b1 === 0 && b2 === 0) return null;
  const letter = LETTERS[b1 >> 6];
  const d1 = (b1 >> 4) & 0x3;
  const rest = ((b1 & 0x0f) << 8) | b2;
  return `${letter}${d1}${rest.toString(16).toUpperCase().padStart(3, '0')}`;
}

export function encodeDtc(code: string): [number, number] {
  const letter = LETTERS.indexOf(code[0]);
  const d1 = parseInt(code[1], 10);
  const rest = parseInt(code.slice(2), 16);
  return [(letter << 6) | (d1 << 4) | (rest >> 8), rest & 0xff];
}

const GENERIC: Record<string, string> = {
  P0010: 'Camshaft position actuator circuit (bank 1)',
  P0011: 'Camshaft timing over-advanced (bank 1)',
  P0016: 'Crankshaft and camshaft position correlation (bank 1 sensor A)',
  P0030: 'O2 sensor heater control circuit (bank 1 sensor 1)',
  P0100: 'Mass air flow circuit',
  P0101: 'Mass air flow circuit range or performance',
  P0102: 'Mass air flow circuit low',
  P0103: 'Mass air flow circuit high',
  P0106: 'Manifold pressure sensor range or performance',
  P0112: 'Intake air temperature sensor circuit low',
  P0113: 'Intake air temperature sensor circuit high',
  P0115: 'Engine coolant temperature circuit',
  P0117: 'Engine coolant temperature circuit low',
  P0118: 'Engine coolant temperature circuit high',
  P0121: 'Throttle position sensor range or performance',
  P0128: 'Coolant thermostat below regulating temperature',
  P0130: 'O2 sensor circuit (bank 1 sensor 1)',
  P0133: 'O2 sensor slow response (bank 1 sensor 1)',
  P0135: 'O2 sensor heater circuit (bank 1 sensor 1)',
  P0136: 'O2 sensor circuit (bank 1 sensor 2)',
  P0141: 'O2 sensor heater circuit (bank 1 sensor 2)',
  P0171: 'System too lean (bank 1)',
  P0172: 'System too rich (bank 1)',
  P0174: 'System too lean (bank 2)',
  P0175: 'System too rich (bank 2)',
  P0201: 'Injector circuit, cylinder 1',
  P0202: 'Injector circuit, cylinder 2',
  P0203: 'Injector circuit, cylinder 3',
  P0204: 'Injector circuit, cylinder 4',
  P0234: 'Turbocharger overboost',
  P0299: 'Turbocharger underboost',
  P0300: 'Random or multiple cylinder misfire',
  P0301: 'Cylinder 1 misfire',
  P0302: 'Cylinder 2 misfire',
  P0303: 'Cylinder 3 misfire',
  P0304: 'Cylinder 4 misfire',
  P0305: 'Cylinder 5 misfire',
  P0306: 'Cylinder 6 misfire',
  P0325: 'Knock sensor 1 circuit (bank 1)',
  P0335: 'Crankshaft position sensor A circuit',
  P0340: 'Camshaft position sensor A circuit (bank 1)',
  P0380: 'Glow plug or heater circuit A',
  P0400: 'Exhaust gas recirculation flow',
  P0401: 'Exhaust gas recirculation flow insufficient',
  P0402: 'Exhaust gas recirculation flow excessive',
  P0403: 'Exhaust gas recirculation control circuit',
  P0420: 'Catalyst efficiency below threshold (bank 1)',
  P0430: 'Catalyst efficiency below threshold (bank 2)',
  P0440: 'Evaporative emission system',
  P0441: 'Evaporative emission system incorrect purge flow',
  P0442: 'Evaporative emission system small leak',
  P0446: 'Evaporative emission vent control circuit',
  P0455: 'Evaporative emission system large leak',
  P0456: 'Evaporative emission system very small leak',
  P0470: 'Exhaust pressure sensor',
  P0471: 'Exhaust pressure sensor range or performance',
  P0480: 'Cooling fan 1 control circuit',
  P0500: 'Vehicle speed sensor A',
  P0505: 'Idle air control system',
  P0507: 'Idle air control system RPM higher than expected',
  P0520: 'Engine oil pressure sensor or switch circuit',
  P0562: 'System voltage low',
  P0563: 'System voltage high',
  P0571: 'Brake switch A circuit',
  P0600: 'Serial communication link',
  P0601: 'Internal control module memory checksum error',
  P0606: 'Control module processor',
  P0700: 'Transmission control system (MIL request)',
  P0715: 'Input or turbine speed sensor A circuit',
  P0720: 'Output speed sensor circuit',
  P0741: 'Torque converter clutch solenoid circuit performance',
  P2002: 'Diesel particulate filter efficiency below threshold (bank 1)',
  P2004: 'Intake manifold runner control stuck open (bank 1)',
  P2096: 'Post catalyst fuel trim system too lean (bank 1)',
  P2097: 'Post catalyst fuel trim system too rich (bank 1)',
  P2135: 'Throttle or pedal position sensor A/B voltage correlation',
  P242F: 'Diesel particulate filter restriction, ash accumulation',
  P2463: 'Diesel particulate filter restriction, soot accumulation',
  U0100: 'Lost communication with engine control module',
  U0101: 'Lost communication with transmission control module',
  U0121: 'Lost communication with ABS control module',
  U0155: 'Lost communication with instrument cluster',
};

export function describeDtc(code: string): { text: string; known: boolean } {
  const text = GENERIC[code];
  if (text) return { text, known: true };
  // SAE J2012: P1, P30-P33, and B/C/U 1 and 2 are manufacturer-controlled.
  const d2 = code[1];
  const manufacturer = code[0] === 'P' ? d2 === '1' || (d2 === '3' && Number(code[2]) < 4) : d2 === '1' || d2 === '2';
  if (manufacturer) {
    return { text: 'Manufacturer-specific code. Look it up for your make.', known: false };
  }
  return { text: 'Not in the built-in list. Search the code for your make.', known: false };
}
