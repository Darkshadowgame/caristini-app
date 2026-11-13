/**
 * Fault code (DTC) library behind the search screen.
 *
 * Written in plain British English from general automotive knowledge.
 * Titles are the SAE J2012 generic definitions in short form.
 * Causes are ranked most likely first. Fixes are ordered as a diagnosis
 * path: cheapest and most likely first.
 */

export type Severity = 'low' | 'medium' | 'high';

export interface DtcEntry {
  code: string;
  title: string;
  system: string;
  severity: Severity;
  drive: string;
  meaning: string;
  causes: string[];
  fixes: string[];
  makes?: Partial<Record<'vag' | 'ford' | 'mazda', string>>;
}

type Makes = Partial<Record<'vag' | 'ford' | 'mazda', string>>;

function d(
  code: string,
  title: string,
  system: string,
  severity: Severity,
  drive: string,
  meaning: string,
  causes: string[],
  fixes: string[],
  makes?: Makes,
): DtcEntry {
  const entry: DtcEntry = { code, title, system, severity, drive, meaning, causes, fixes };
  if (makes) entry.makes = makes;
  return entry;
}

// ---------------------------------------------------------------------------
// Shared wording
// ---------------------------------------------------------------------------

const S = {
  cam: 'Cam and crank timing',
  o2: 'Oxygen sensors',
  fuel: 'Fuel and air metering',
  fuelP: 'Fuel pressure',
  air: 'Air flow and pressure sensors',
  cool: 'Engine cooling',
  throttle: 'Throttle and pedal',
  inj: 'Injector circuit',
  turbo: 'Turbo and boost',
  ign: 'Ignition and misfire',
  knock: 'Knock sensors',
  glow: 'Glow plugs (diesel)',
  egr: 'Exhaust gas recirculation (EGR)',
  sai: 'Secondary air injection',
  cat: 'Catalytic converter',
  evap: 'EVAP (fuel vapour)',
  dpf: 'Diesel particulate filter (DPF)',
  scr: 'AdBlue and NOx (SCR)',
  egt: 'Exhaust temperature sensors',
  speed: 'Speed, idle and inputs',
  oil: 'Oil pressure',
  volt: 'Charging and voltage',
  cruise: 'Cruise control and brake switch',
  ecu: 'Computer and outputs',
  trans: 'Transmission',
  hybrid: 'Hybrid propulsion',
  net: 'Network',
  abs: 'Chassis (ABS)',
  srs: 'Body (airbags)',
} as const;

const DRIVE = {
  ok: 'Safe to drive; get it checked when convenient.',
  soon: 'You can drive it, but book it in soon to avoid knock-on damage or poor economy.',
  limp: 'Drive gently and get it checked soon; the car may go into reduced-power (limp) mode.',
  stop: 'Stop driving as soon as it is safe and get it checked before driving further.',
  misfire:
    'If the engine light is flashing, stop driving as soon as it is safe; with a steady light, drive gently to a garage soon.',
  mot: 'Safe to drive in the short term, but it will fail an emissions test (MOT) until fixed.',
};

function lowCircuit(sensor: string): string[] {
  return [
    'Signal wire shorted to earth',
    `Faulty ${sensor}`,
    'Corroded or damaged connector',
    'Shared 5 V sensor supply pulled down by another faulty sensor',
    'Engine computer fault (rare)',
  ];
}

function highCircuit(sensor: string): string[] {
  return [
    'Open circuit: broken wire or unplugged connector',
    `Faulty ${sensor}`,
    'Signal wire shorted to a voltage supply',
    'Poor sensor earth',
    'Engine computer fault (rare)',
  ];
}

function circuitFixes(sensor: string): string[] {
  return [
    'Check the connector is fully plugged in and free of corrosion',
    `Look at the ${sensor} reading in live data and check it is sensible`,
    'Wiggle-test the wiring while watching live data',
    'Check the 5 V supply, earth and signal at the connector with a multimeter',
    `Replace the ${sensor} if the wiring checks out`,
    'Clear the code and confirm on a test drive',
  ];
}

// ---------------------------------------------------------------------------
// Cam and crank timing
// ---------------------------------------------------------------------------

function vvtCircuit(code: string, cam: 'A' | 'B', bank: number): DtcEntry {
  const which = cam === 'A' ? 'camshaft A (usually intake)' : 'camshaft B (usually exhaust)';
  return d(
    code,
    `"${cam}" Camshaft Position Actuator Circuit (Bank ${bank})`,
    S.cam,
    'medium',
    DRIVE.soon,
    `The engine computer has found an electrical fault in the variable valve timing (VVT) solenoid circuit for ${which} on bank ${bank}. Cam timing will be stuck in its default position, so power and economy drop.`,
    [
      'Faulty VVT oil control solenoid',
      'Damaged wiring or connector at the solenoid',
      'Oil leaking into the solenoid connector',
      'Blown fuse feeding the solenoid',
      'Engine computer driver fault (rare)',
    ],
    [
      'Check the connector and wiring at the VVT solenoid for oil, corrosion or damage',
      'Measure the solenoid resistance and compare with the spec',
      'Check the fuse and supply voltage to the solenoid',
      'Replace the solenoid if it reads open or shorted',
      'Clear the code and confirm the cam angle follows the command in live data',
    ],
  );
}

function vvtTiming(code: string, cam: 'A' | 'B', bank: number, kind: 'adv' | 'ret'): DtcEntry {
  const which = cam === 'A' ? 'camshaft A (usually intake)' : 'camshaft B (usually exhaust)';
  const title =
    kind === 'adv'
      ? `"${cam}" Camshaft Position - Timing Over-Advanced or System Performance (Bank ${bank})`
      : `"${cam}" Camshaft Position - Timing Over-Retarded (Bank ${bank})`;
  const meaning =
    kind === 'adv'
      ? `The actual timing of ${which} on bank ${bank} is further advanced than the computer asked for, or the variable valve timing is not responding as expected.`
      : `The actual timing of ${which} on bank ${bank} is further retarded (later) than the computer asked for.`;
  const causes =
    kind === 'adv'
      ? [
          'Low engine oil level or wrong oil grade',
          'Sticking VVT oil control solenoid or blocked solenoid filter screen',
          'Old or sludgy oil',
          'Faulty cam phaser (VVT unit)',
          'Stretched timing chain or worn tensioner and guides',
        ]
      : [
          'Low engine oil level or wrong oil grade',
          'Stretched timing chain or worn tensioner and guides',
          'Sticking VVT oil control solenoid',
          'Faulty cam phaser (VVT unit)',
          'Timing belt or chain one tooth out after a repair',
        ];
  return d(
    code,
    title,
    S.cam,
    'medium',
    'Drive gently and get it checked soon; low oil or a worn timing chain can lead to engine damage.',
    meaning,
    causes,
    [
      'Check the oil level and condition; top up or change it with the correct spec oil',
      'Compare commanded and actual cam angle in live data',
      'Remove, clean and test the VVT solenoid and its filter screen; replace if sticking',
      'Check timing chain stretch from cam and crank correlation values, or check belt alignment',
      'Replace the cam phaser or timing components (professional job)',
    ],
  );
}

function camCrank(code: string, bank: number, sensor: 'A' | 'B'): DtcEntry {
  return d(
    code,
    `Crankshaft Position - Camshaft Position Correlation (Bank ${bank} Sensor ${sensor})`,
    S.cam,
    'high',
    'Limit driving and get it checked soon; if the timing chain has stretched it can jump and badly damage the engine.',
    `The crankshaft and camshaft sensor signals do not line up as they should on bank ${bank}, so the cam timing is out compared with the crank.`,
    [
      'Stretched timing chain or worn tensioner and guides',
      'Timing belt jumped a tooth or fitted incorrectly',
      'Faulty cam phaser or VVT solenoid',
      'Low or dirty engine oil',
      'Faulty camshaft or crankshaft sensor, or a damaged reluctor ring',
    ],
    [
      'Check the oil level and condition',
      'Listen for a chain rattle in the first few seconds after a cold start',
      'Read cam and crank correlation values in live data or compare the signals on a scope',
      'Check both sensors and their wiring',
      'Inspect the timing marks and replace the chain or belt kit if out (professional job)',
    ],
    code === 'P0016'
      ? { vag: 'Common on 1.8 and 2.0 TSI (EA888) engines from timing chain stretch or a worn chain tensioner.' }
      : undefined,
  );
}

const CAM_TIMING: DtcEntry[] = [
  vvtCircuit('P0010', 'A', 1),
  vvtTiming('P0011', 'A', 1, 'adv'),
  vvtTiming('P0012', 'A', 1, 'ret'),
  vvtCircuit('P0013', 'B', 1),
  vvtTiming('P0014', 'B', 1, 'adv'),
  vvtTiming('P0015', 'B', 1, 'ret'),
  camCrank('P0016', 1, 'A'),
  camCrank('P0017', 1, 'B'),
  camCrank('P0018', 2, 'A'),
  camCrank('P0019', 2, 'B'),
  vvtCircuit('P0020', 'A', 2),
  vvtTiming('P0021', 'A', 2, 'adv'),
];

// ---------------------------------------------------------------------------
// Oxygen sensors
// ---------------------------------------------------------------------------

function o2Where(sensor: number): string {
  return sensor === 1
    ? 'the upstream sensor before the catalytic converter, which controls fuelling'
    : 'the downstream sensor after the catalytic converter, which checks the converter is working';
}

function o2Heater(code: string, bank: number, sensor: number, kind: 'control' | 'low' | 'high' | 'heater'): DtcEntry {
  const pos = `(Bank ${bank} Sensor ${sensor})`;
  const title =
    kind === 'heater'
      ? `O2 Sensor Heater Circuit ${pos}`
      : kind === 'control'
        ? `HO2S Heater Control Circuit ${pos}`
        : kind === 'low'
          ? `HO2S Heater Control Circuit Low ${pos}`
          : `HO2S Heater Control Circuit High ${pos}`;
  const extra =
    kind === 'low'
      ? ' The circuit reads lower than expected, which usually points to a short to earth or a failed heater.'
      : kind === 'high'
        ? ' The circuit reads higher than expected, which usually points to an open circuit or a short to power.'
        : '';
  const causes = [
    'Failed heater element inside the oxygen sensor',
    kind === 'low' ? 'Heater wiring shorted to earth' : 'Open circuit in the heater wiring',
    'Blown fuse or failed relay feeding the sensor heaters',
    'Wiring melted or chafed against the exhaust',
    'Corroded or loose sensor connector',
    'Engine computer heater driver fault (rare)',
  ];
  return d(
    code,
    title,
    S.o2,
    'low',
    'Safe to drive; fuel economy and emissions may suffer until it is fixed.',
    `The engine computer has found a fault in the heater circuit of the oxygen sensor at bank ${bank} sensor ${sensor}, ${o2Where(sensor)}. The heater brings the sensor up to working temperature quickly after a cold start.${extra}`,
    causes,
    [
      'Check the fuse for the oxygen sensor heaters',
      'Unplug the sensor and measure resistance across the heater pins; compare with the spec (often a few ohms when cold)',
      'Inspect the wiring along the exhaust for melting or chafing and repair it',
      'Replace the oxygen sensor if the heater reads open or shorted',
      'Clear the code and drive a full warm-up cycle to confirm',
    ],
  );
}

type O2Kind = 'circuit' | 'low' | 'high' | 'slow' | 'none';

function o2Circuit(code: string, bank: number, sensor: number, kind: O2Kind): DtcEntry {
  const pos = `(Bank ${bank} Sensor ${sensor})`;
  const titles: Record<O2Kind, string> = {
    circuit: `O2 Sensor Circuit ${pos}`,
    low: `O2 Sensor Circuit Low Voltage ${pos}`,
    high: `O2 Sensor Circuit High Voltage ${pos}`,
    slow: `O2 Sensor Circuit Slow Response ${pos}`,
    none: `O2 Sensor Circuit No Activity Detected ${pos}`,
  };
  const up = sensor === 1;
  const base = `This is the oxygen sensor at bank ${bank} sensor ${sensor}, ${o2Where(sensor)}.${
    up ? ' On many modern cars this is a wide-band air-fuel ratio sensor.' : ''
  }`;
  const meanings: Record<O2Kind, string> = {
    circuit: `The signal from the oxygen sensor is out of the expected range or its circuit is faulty. ${base}`,
    low: `The sensor voltage has stayed low, which reads as a lean mixture (too much air). ${base}`,
    high: `The sensor voltage has stayed high, which reads as a rich mixture (too much fuel). ${base}`,
    slow: `The sensor is switching between lean and rich more slowly than it should, so the computer cannot trust it. ${base}`,
    none: `The sensor signal is not changing at all, as if the sensor is dead or disconnected. ${base}`,
  };
  const causes: Record<O2Kind, string[]> = {
    circuit: [
      'Damaged, melted or chafed sensor wiring',
      'Corroded or loose connector',
      'Failed oxygen sensor',
      'Exhaust leak near the sensor',
      'Engine computer fault (rare)',
    ],
    low: up
      ? [
          'Exhaust leak before the sensor letting air in',
          'Real lean condition such as a vacuum leak',
          'Failed or contaminated oxygen sensor',
          'Signal wire shorted to earth',
          'Low fuel pressure',
        ]
      : [
          'Exhaust leak near the sensor',
          'Failed oxygen sensor',
          'Signal wire shorted to earth',
          'Real lean running from a vacuum leak or low fuel pressure',
        ],
    high: up
      ? [
          'Real rich condition such as a leaking injector or high fuel pressure',
          'Sensor contaminated by oil, coolant or silicone sealant',
          'Signal wire shorted to a voltage supply',
          'Failed oxygen sensor',
          'Faulty MAF sensor over-reading air flow',
        ]
      : [
          'Sensor contaminated by oil, coolant or fuel',
          'Real rich running upstream (leaking injector, high fuel pressure)',
          'Signal wire shorted to a voltage supply',
          'Failed oxygen sensor',
        ],
    slow: [
      'Ageing oxygen sensor (common past 100,000 miles)',
      'Sensor contaminated by oil burning or coolant',
      'Exhaust leak near the sensor',
      'Sensor heater fault keeping the sensor too cool',
      'Fuelling problem such as low fuel pressure',
    ],
    none: [
      'Failed oxygen sensor',
      'Broken wire or unplugged connector',
      'Sensor heater fault so the sensor never warms up',
      'Large exhaust leak near the sensor',
      'Engine computer fault (rare)',
    ],
  };
  const fixes =
    kind === 'low' || kind === 'high'
      ? [
          'Read live fuel trims to see whether the mixture is really lean or rich',
          'Look at the sensor in live data with the engine warm',
          'Check for exhaust leaks before the sensor (ticking noise, soot marks)',
          'Inspect wiring and connector for damage or shorts',
          'Fix any real fuelling fault first, then replace the sensor if it is still stuck',
          'Clear codes and confirm on a test drive',
        ]
      : [
          up
            ? 'Look at the sensor in live data with the engine warm: it should respond quickly to changes in throttle'
            : 'Look at the sensor in live data with the engine warm: it should hold a fairly steady reading',
          'Inspect the wiring and connector for melting, chafing or corrosion',
          'Check for exhaust leaks near the sensor',
          'Check for any heater code on the same sensor and fix that first',
          'Replace the sensor with the correct part if it is slow, stuck or dead',
          'Clear codes and confirm on a test drive',
        ];
  return d(
    code,
    titles[kind],
    S.o2,
    up ? 'medium' : 'low',
    up
      ? 'Usually safe to drive, but fuel use may rise; fix it soon to protect the catalytic converter.'
      : 'Safe to drive; it mainly affects catalytic converter monitoring.',
    meanings[kind],
    causes[kind],
    fixes,
  );
}

const O2_SENSORS: DtcEntry[] = [
  o2Heater('P0030', 1, 1, 'control'),
  o2Heater('P0031', 1, 1, 'low'),
  o2Heater('P0032', 1, 1, 'high'),
  o2Heater('P0036', 1, 2, 'control'),
  o2Heater('P0037', 1, 2, 'low'),
  o2Heater('P0038', 1, 2, 'high'),
  o2Heater('P0050', 2, 1, 'control'),
  o2Heater('P0051', 2, 1, 'low'),
  o2Heater('P0052', 2, 1, 'high'),
  o2Heater('P0056', 2, 2, 'control'),
  o2Heater('P0057', 2, 2, 'low'),
  o2Heater('P0058', 2, 2, 'high'),
  o2Circuit('P0130', 1, 1, 'circuit'),
  o2Circuit('P0131', 1, 1, 'low'),
  o2Circuit('P0132', 1, 1, 'high'),
  o2Circuit('P0133', 1, 1, 'slow'),
  o2Circuit('P0134', 1, 1, 'none'),
  o2Heater('P0135', 1, 1, 'heater'),
  o2Circuit('P0136', 1, 2, 'circuit'),
  o2Circuit('P0137', 1, 2, 'low'),
  o2Circuit('P0138', 1, 2, 'high'),
  o2Circuit('P0139', 1, 2, 'slow'),
  o2Circuit('P0140', 1, 2, 'none'),
  o2Heater('P0141', 1, 2, 'heater'),
  o2Circuit('P0150', 2, 1, 'circuit'),
  o2Circuit('P0151', 2, 1, 'low'),
  o2Circuit('P0152', 2, 1, 'high'),
  o2Circuit('P0153', 2, 1, 'slow'),
  o2Circuit('P0154', 2, 1, 'none'),
  o2Heater('P0155', 2, 1, 'heater'),
  o2Circuit('P0156', 2, 2, 'circuit'),
  o2Circuit('P0157', 2, 2, 'low'),
  o2Circuit('P0158', 2, 2, 'high'),
  o2Circuit('P0159', 2, 2, 'slow'),
  o2Circuit('P0160', 2, 2, 'none'),
  o2Heater('P0161', 2, 2, 'heater'),
  d(
    'P2195',
    'O2 Sensor Signal Stuck Lean (Bank 1 Sensor 1)',
    S.o2,
    'medium',
    'Usually safe to drive, but fuel use may rise; fix it soon to protect the catalytic converter.',
    'The upstream oxygen sensor keeps reporting a lean mixture even when the computer adds fuel, so it looks stuck lean.',
    [
      'Real lean condition: vacuum leak, weak fuel pump or dirty MAF sensor',
      'Exhaust leak before the sensor',
      'Ageing or contaminated oxygen sensor',
      'Wiring fault on the sensor signal',
    ],
    [
      'Read live fuel trims; high positive trims point to a real lean condition',
      'Smoke-test the intake and check the PCV system',
      'Check for exhaust leaks before the sensor',
      'Clean the MAF sensor and check fuel pressure',
      'Replace the sensor if fuelling checks out',
    ],
  ),
  d(
    'P2196',
    'O2 Sensor Signal Stuck Rich (Bank 1 Sensor 1)',
    S.o2,
    'medium',
    'Usually safe to drive, but fuel use will be high; fix it soon to protect the catalytic converter.',
    'The upstream oxygen sensor keeps reporting a rich mixture even when the computer takes fuel away, so it looks stuck rich.',
    [
      'Real rich condition: leaking injector or high fuel pressure',
      'Sensor contaminated by oil, coolant or fuel',
      'EVAP purge valve stuck open',
      'Faulty oxygen sensor',
      'Wiring fault on the sensor signal',
    ],
    [
      'Read live fuel trims; strongly negative trims point to a real rich condition',
      'Check the purge valve is not stuck open',
      'Test fuel pressure and check injectors for leaks',
      'Check for coolant loss or oil burning that could contaminate the sensor',
      'Replace the sensor if fuelling checks out',
    ],
  ),
  d(
    'P2270',
    'O2 Sensor Signal Biased/Stuck Lean (Bank 1 Sensor 2)',
    S.o2,
    'low',
    'Safe to drive; get it checked when convenient.',
    'The downstream oxygen sensor stays lean when the computer briefly richens the mixture to test it.',
    [
      'Exhaust leak near the downstream sensor (very common)',
      'Ageing or failed downstream sensor',
      'Real lean running',
      'Wiring fault',
    ],
    [
      'Check for exhaust leaks around the catalytic converter and sensor',
      'Watch the sensor in live data while giving a few quick revs; it should rise',
      'Check fuel trims for lean running',
      'Replace the downstream sensor',
    ],
  ),
  d(
    'P2271',
    'O2 Sensor Signal Biased/Stuck Rich (Bank 1 Sensor 2)',
    S.o2,
    'low',
    'Safe to drive; get it checked when convenient.',
    'The downstream oxygen sensor stays rich when the computer briefly leans the mixture to test it.',
    [
      'Failed or contaminated downstream sensor',
      'Real rich running upstream',
      'Signal wire shorted to voltage',
      'Oil or coolant reaching the exhaust',
    ],
    [
      'Watch the sensor in live data while lifting off the throttle; it should drop',
      'Check fuel trims for rich running',
      'Inspect wiring',
      'Replace the downstream sensor',
    ],
  ),
];

// ---------------------------------------------------------------------------
// Fuel and air metering, sensors, fuel pressure, throttle, cooling
// ---------------------------------------------------------------------------

function trim(code: string, bank: number, rich: boolean, when: '' | 'idle' | 'offidle'): DtcEntry {
  const whenTitle = when === 'idle' ? ' at Idle' : when === 'offidle' ? ' Off Idle' : '';
  const title = `System Too ${rich ? 'Rich' : 'Lean'}${whenTitle} (Bank ${bank})`;
  const whenText = when === 'idle' ? ' at idle' : when === 'offidle' ? ' when driving above idle' : '';
  const bankNote =
    bank === 2
      ? ' If bank 1 has the same code, look for a shared cause (MAF sensor, fuel pressure); if only bank 2, look for a leak or injector on that side.'
      : '';
  const meaning = rich
    ? `The engine computer has had to take away more fuel than it is allowed to${whenText}, so the mixture on bank ${bank} is running rich (too much fuel for the air).${bankNote}`
    : `The engine computer has had to add more fuel than it is allowed to${whenText}, so the mixture on bank ${bank} is running lean (too much air for the fuel).${bankNote}`;
  const leanCauses =
    when === 'offidle'
      ? [
          'Weak fuel pump or blocked fuel filter',
          'Dirty or failing MAF sensor under-reading air flow',
          'Partly blocked injectors',
          'Vacuum or boost leak',
          'Exhaust leak before the front oxygen sensor',
        ]
      : [
          'Vacuum leak (split hose, PCV valve, intake gasket)',
          'Dirty or failing MAF sensor under-reading air flow',
          'Weak fuel pump or blocked fuel filter',
          'Leaking injector seal or partly blocked injectors',
          'Exhaust leak before the front oxygen sensor',
        ];
  const richCauses = [
    'Dirty or faulty MAF sensor over-reading air flow',
    'Leaking or dripping injector',
    'Fuel pressure too high (faulty regulator)',
    'EVAP purge valve stuck open',
    'Faulty coolant temperature sensor reading cold',
    'Blocked air filter, or oil diluted with fuel',
  ];
  const leanFixes = [
    'Read live fuel trims: if long-term trim is high at idle but improves at higher revs, suspect a vacuum leak; if it gets worse under load, suspect fuel supply',
    'Listen for hissing and smoke-test the intake; check the PCV valve and hoses',
    'Clean the MAF sensor with MAF cleaner (never touch the element)',
    'Test fuel pressure and volume',
    'Check for exhaust leaks before the front sensor',
    'Clear trims and confirm on a test drive',
  ];
  const richFixes = [
    'Read live fuel trims and the coolant temperature reading (it should match the real engine temperature)',
    'Clean or test the MAF sensor and check the air filter',
    'Check the purge valve is not stuck open (pinch the purge hose and watch the trims)',
    'Test fuel pressure and look for leaking injectors',
    'Check the oil for a fuel smell',
    'Clear trims and confirm on a test drive',
  ];
  let makes: Makes | undefined;
  if (code === 'P0171')
    makes = {
      vag: 'On TSI and FSI petrol engines, a split diaphragm in the PCV or oil separator valve is a frequent cause, often with a whistle at idle.',
    };
  return d(
    code,
    title,
    S.fuel,
    'medium',
    'You can drive it, but book it in soon; long-term lean or rich running can damage the catalytic converter.',
    meaning,
    rich ? richCauses : leanCauses,
    rich ? richFixes : leanFixes,
    makes,
  );
}

function postCatTrim(code: string, bank: number, rich: boolean): DtcEntry {
  return d(
    code,
    `Post Catalyst Fuel Trim System Too ${rich ? 'Rich' : 'Lean'} (Bank ${bank})`,
    S.fuel,
    'low',
    'Safe to drive in the short term; get it checked soon.',
    `The downstream oxygen sensor on bank ${bank} shows the exhaust after the catalytic converter is ${rich ? 'richer' : 'leaner'} than expected, and the computer has run out of correction on its secondary fuel trim.`,
    rich
      ? [
          'Faulty or contaminated downstream oxygen sensor',
          'Rich running upstream (leaking injector, high fuel pressure)',
          'Worn upstream oxygen sensor',
          'Failing catalytic converter',
          'Oil or coolant entering the exhaust',
        ]
      : [
          'Exhaust leak near the downstream sensor',
          'Faulty downstream oxygen sensor',
          'Lean running upstream (vacuum leak, low fuel pressure)',
          'Worn upstream oxygen sensor',
          'Misfires',
        ],
    [
      'Check for other fuel trim or oxygen sensor codes and fix those first',
      'Check for exhaust leaks around the catalytic converter',
      'Compare upstream and downstream sensor readings in live data',
      'Replace the faulty oxygen sensor',
      'Clear codes and confirm on a test drive',
    ],
  );
}

function injCircuit(code: string, n: number | null): DtcEntry {
  const title = n === null ? 'Injector Circuit/Open' : `Cylinder ${n} Injector Circuit/Open`;
  const which = n === null ? 'one or more fuel injectors' : `the cylinder ${n} fuel injector`;
  return d(
    code,
    title,
    S.inj,
    'medium',
    'Drive gently to a garage soon; the engine will run rough and down on power.',
    `The engine computer has found an open or faulty electrical circuit to ${which}. That cylinder may get no fuel, so the engine runs rough.`,
    [
      'Damaged wiring or loose connector at the injector',
      'Failed injector coil (open circuit)',
      'Blown fuse or relay feeding the injectors',
      'Wiring harness chafed under the engine cover',
      'Engine computer injector driver fault',
    ],
    [
      'Check the injector connector is fully clipped on and free of corrosion',
      'Measure injector resistance and compare with the others and the spec',
      'Check the injector supply fuse and voltage',
      'Inspect the harness for chafing',
      'Replace the injector if open; diesel injectors may need coding (professional job)',
    ],
  );
}

const FUEL_AIR: DtcEntry[] = [
  d(
    'P0068',
    'MAP/MAF - Throttle Position Correlation',
    S.air,
    'medium',
    DRIVE.limp,
    'The air flow and manifold pressure readings do not match what the computer expects for the throttle opening.',
    [
      'Vacuum or intake leak after the throttle',
      'Dirty or failing MAF sensor',
      'Faulty MAP sensor',
      'Dirty or sticking throttle body',
      'Throttle position sensor fault',
    ],
    [
      'Check for intake leaks (smoke test)',
      'Compare MAF, MAP and throttle readings in live data',
      'Clean the MAF sensor with MAF cleaner',
      'Clean the throttle body and run the throttle adaptation',
      'Replace the faulty sensor',
    ],
  ),
  d(
    'P0069',
    'Manifold Absolute Pressure - Barometric Pressure Correlation',
    S.air,
    'low',
    DRIVE.soon,
    'With the engine stopped or just started, manifold pressure and outside (barometric) pressure should read almost the same, and they do not.',
    [
      'Faulty MAP or boost pressure sensor',
      'Faulty barometric sensor (often inside the engine computer)',
      'Blocked or split MAP sensor hose',
      'On turbo diesels, a sticking EGR valve or turbo vanes holding pressure',
      'Wiring or connector fault',
    ],
    [
      'With the key on and engine off, compare MAP and barometric readings in live data',
      'Check the MAP sensor hose and port for blockage',
      'Clean the sensor tip of oil and soot (diesels)',
      'Check wiring',
      'Replace the sensor that reads wrong',
    ],
  ),
  d(
    'P0087',
    'Fuel Rail/System Pressure - Too Low',
    S.fuelP,
    'medium',
    'Drive gently and get it checked soon; the engine may lose power, cut out or fail to start.',
    'The fuel pressure in the rail is lower than the computer asked for. On a diesel this is the high-pressure common rail; on a petrol it may be the direct injection rail or the low-pressure supply.',
    [
      'Blocked fuel filter (very common on diesels)',
      'Weak in-tank lift pump or low-pressure pump',
      'Air getting into the fuel supply, or a fuel leak',
      'Faulty pressure regulator or fuel metering valve',
      'Worn high-pressure pump',
      'Injectors leaking back too much fuel, or a faulty rail pressure sensor',
    ],
    [
      'Check the fuel level and look for leaks',
      'Replace the fuel filter if it is due (bleed air afterwards on a diesel)',
      'Compare desired and actual rail pressure in live data at idle and under load',
      'Test lift pump pressure and flow',
      'Injector back-leak test (diesel)',
      'High-pressure pump or regulator replacement by a specialist',
    ],
    { vag: 'On 2.0 TDI common rail engines, a blocked fuel filter or failing in-tank lift pump is a frequent cause.' },
  ),
  d(
    'P0088',
    'Fuel Rail/System Pressure - Too High',
    S.fuelP,
    'medium',
    DRIVE.limp,
    'The fuel pressure in the rail is higher than the computer asked for, so it may cut power to protect the system.',
    [
      'Faulty fuel pressure regulator or pressure control valve',
      'Faulty rail pressure sensor reading high',
      'Sticking fuel metering valve on the pump',
      'Blocked fuel return line',
      'Wiring fault to the regulator',
    ],
    [
      'Compare desired and actual rail pressure in live data',
      'Check the regulator wiring and connector',
      'Check the fuel return line for kinks or blockage',
      'Test or replace the rail pressure sensor',
      'Replace the regulator or metering valve (specialist on diesels)',
    ],
  ),
  d(
    'P0089',
    'Fuel Pressure Regulator 1 Performance',
    S.fuelP,
    'medium',
    DRIVE.limp,
    'The fuel pressure regulator is not controlling rail pressure as commanded; actual pressure drifts away from the target.',
    [
      'Sticking or faulty pressure regulator or control valve',
      'Contaminated fuel or water in the fuel',
      'Blocked fuel filter',
      'Faulty rail pressure sensor',
      'Wiring fault to the regulator',
    ],
    [
      'Watch desired and actual rail pressure together in live data',
      'Replace the fuel filter and drain any water (diesel)',
      'Check regulator wiring',
      'Test the rail pressure sensor',
      'Replace the regulator (specialist job on diesels)',
    ],
  ),
  d(
    'P0090',
    'Fuel Pressure Regulator 1 Control Circuit',
    S.fuelP,
    'medium',
    DRIVE.limp,
    'The engine computer has found an electrical fault in the control circuit of the fuel pressure regulator.',
    [
      'Damaged wiring or connector at the regulator',
      'Failed regulator coil',
      'Blown fuse',
      'Engine computer driver fault (rare)',
    ],
    [
      'Inspect the connector and wiring at the regulator',
      'Measure the regulator coil resistance against spec',
      'Check supply voltage and fuse',
      'Replace the regulator',
    ],
  ),
  d(
    'P0093',
    'Fuel System Leak Detected - Large Leak',
    S.fuelP,
    'high',
    'Stop driving and check for fuel leaks before going further; leaking fuel is a fire risk.',
    'Rail pressure has dropped faster than the engine could use the fuel, so the computer suspects a large leak.',
    [
      'Leaking high-pressure fuel pipe or union',
      'Injector leaking back excessively, or a cracked injector',
      'Faulty pressure limiting valve on the rail',
      'Running out of fuel or air in the system',
      'Faulty rail pressure sensor',
    ],
    [
      'With the engine off, look and smell for fuel around the pipes, rail and pump',
      'Check the fuel level',
      'Injector back-leak test',
      'Check the rail pressure relief valve',
      'Repair by a diesel or fuel injection specialist',
    ],
  ),
  d(
    'P0100',
    'Mass or Volume Air Flow Circuit',
    S.air,
    'medium',
    DRIVE.limp,
    'The engine computer has found an electrical fault in the mass air flow (MAF) sensor circuit, so it is estimating air flow instead.',
    [
      'Unplugged or damaged MAF connector',
      'Faulty MAF sensor',
      'Wiring fault in the power, earth or signal wire',
      'Blown fuse feeding the sensor',
      'Engine computer fault (rare)',
    ],
    circuitFixes('MAF sensor'),
  ),
  d(
    'P0101',
    'Mass or Volume Air Flow Circuit Range/Performance',
    S.air,
    'medium',
    DRIVE.soon,
    'The air flow reading does not agree with what the computer expects from engine speed, throttle and manifold pressure.',
    [
      'Dirty MAF sensor element',
      'Air leak between the MAF and the engine (split hose, loose clamp)',
      'Blocked or badly fitted air filter, or an over-oiled performance filter',
      'On diesels, a sticking EGR valve or a boost leak',
      'Faulty MAF sensor',
    ],
    [
      'Check the air filter and all intake hoses and clamps',
      'Compare the MAF reading with a known-good value for the engine',
      'Smoke-test the intake for leaks',
      'Clean the MAF sensor with MAF cleaner only',
      'On a diesel, check the EGR valve closes fully',
      'Replace the MAF with a quality part',
    ],
    { vag: 'On TDI engines, a soot-clogged EGR valve or split intercooler hose often sets this along with P0401 or P0299.' },
  ),
  d(
    'P0102',
    'Mass or Volume Air Flow Circuit Low Input',
    S.air,
    'medium',
    DRIVE.limp,
    'The MAF sensor signal is lower than possible, as if almost no air is flowing.',
    ['Faulty MAF sensor', 'Signal wire open or shorted to earth', 'Loose or corroded connector', 'Missing power supply to the sensor', 'Very dirty MAF element'],
    circuitFixes('MAF sensor'),
  ),
  d(
    'P0103',
    'Mass or Volume Air Flow Circuit High Input',
    S.air,
    'medium',
    DRIVE.limp,
    'The MAF sensor signal is higher than possible.',
    ['Faulty MAF sensor', 'Signal wire shorted to a voltage supply', 'Poor sensor earth', 'Water in the connector', 'Engine computer fault (rare)'],
    circuitFixes('MAF sensor'),
  ),
  d(
    'P0104',
    'Mass or Volume Air Flow Circuit Intermittent',
    S.air,
    'medium',
    DRIVE.soon,
    'The MAF sensor signal keeps dropping out or jumping.',
    ['Loose connector or broken wire inside the insulation', 'Faulty MAF sensor', 'Water in the connector', 'Poor earth'],
    circuitFixes('MAF sensor'),
  ),
  d(
    'P0105',
    'Manifold Absolute Pressure/Barometric Pressure Circuit',
    S.air,
    'medium',
    DRIVE.limp,
    'The engine computer has found a fault in the manifold absolute pressure (MAP) sensor circuit.',
    ['Damaged wiring or connector', 'Faulty MAP sensor', 'Shared 5 V supply fault', 'Engine computer fault (rare)'],
    circuitFixes('MAP sensor'),
  ),
  d(
    'P0106',
    'Manifold Absolute Pressure/Barometric Pressure Circuit Range/Performance',
    S.air,
    'medium',
    DRIVE.soon,
    'The MAP sensor reading does not match what the computer expects for the engine load.',
    [
      'Split, blocked or disconnected MAP sensor hose',
      'Vacuum leak',
      'Faulty MAP sensor, or sensor tip clogged with oil and soot',
      'On turbo engines, a boost leak',
      'Engine mechanical problem (low compression, valve timing)',
    ],
    [
      'Check the MAP hose and port, and clean the sensor tip',
      'Key on, engine off: MAP should match barometric pressure',
      'Smoke-test for vacuum or boost leaks',
      'Check wiring',
      'Replace the MAP sensor',
    ],
  ),
  d(
    'P0107',
    'Manifold Absolute Pressure/Barometric Pressure Circuit Low',
    S.air,
    'medium',
    DRIVE.limp,
    'The MAP sensor signal voltage is below its normal range.',
    lowCircuit('MAP sensor'),
    circuitFixes('MAP sensor'),
  ),
  d(
    'P0108',
    'Manifold Absolute Pressure/Barometric Pressure Circuit High',
    S.air,
    'medium',
    DRIVE.limp,
    'The MAP sensor signal voltage is above its normal range.',
    highCircuit('MAP sensor'),
    circuitFixes('MAP sensor'),
  ),
  d(
    'P0110',
    'Intake Air Temperature Sensor 1 Circuit',
    S.air,
    'low',
    DRIVE.ok,
    'The engine computer has found a fault in the intake air temperature sensor circuit. On many cars this sensor is built into the MAF sensor.',
    ['Damaged wiring or connector', 'Faulty intake air temperature sensor', 'MAF sensor fault where the sensor is built in', 'Engine computer fault (rare)'],
    circuitFixes('intake air temperature sensor'),
  ),
  d(
    'P0111',
    'Intake Air Temperature Sensor 1 Circuit Range/Performance',
    S.air,
    'low',
    DRIVE.ok,
    'The intake air temperature reading is not sensible compared with the other temperature sensors, or it does not change as expected.',
    ['Faulty intake air temperature sensor', 'Poor connection adding resistance', 'Sensor dislodged or mounted near a heat source', 'MAF sensor fault where the sensor is built in'],
    [
      'After a cold overnight soak, compare intake air, coolant and outside temperatures; they should be within a few degrees',
      'Check the connector and wiring',
      'Check the sensor is fitted correctly',
      'Replace the sensor (or the MAF if built in)',
    ],
  ),
  d(
    'P0112',
    'Intake Air Temperature Sensor 1 Circuit Low',
    S.air,
    'low',
    DRIVE.ok,
    'The intake air temperature signal is very low, which the computer reads as extremely hot air.',
    lowCircuit('intake air temperature sensor'),
    circuitFixes('intake air temperature sensor'),
  ),
  d(
    'P0113',
    'Intake Air Temperature Sensor 1 Circuit High',
    S.air,
    'low',
    DRIVE.ok,
    'The intake air temperature signal is very high, which the computer reads as extremely cold air. This usually means an open circuit.',
    [
      'MAF or air temperature sensor connector unplugged (often after an air filter change)',
      'Broken wire or open circuit',
      'Faulty sensor',
      'Poor sensor earth',
    ],
    circuitFixes('intake air temperature sensor'),
  ),
  d(
    'P0115',
    'Engine Coolant Temperature Circuit',
    S.cool,
    'medium',
    'Drive with care and watch the temperature gauge; the cooling fan may run all the time and starting may be harder.',
    'The engine computer has found a fault in the coolant temperature sensor circuit, so it is using a default temperature.',
    ['Damaged wiring or connector', 'Faulty coolant temperature sensor', 'Low coolant leaving the sensor in air', 'Engine computer fault (rare)'],
    circuitFixes('coolant temperature sensor'),
  ),
  d(
    'P0116',
    'Engine Coolant Temperature Circuit Range/Performance',
    S.cool,
    'medium',
    'Drive with care and watch the temperature gauge.',
    'The coolant temperature reading is not sensible: it does not rise as expected after a start, or it disagrees with the other temperature sensors.',
    ['Thermostat stuck open', 'Faulty coolant temperature sensor reading inaccurately', 'Low coolant or an air lock', 'High resistance in the wiring or connector'],
    [
      'Check the coolant level when cold',
      'After a cold soak, compare coolant temperature with air temperature in live data',
      'Watch the reading during warm-up; it should climb steadily to around 90 C',
      'Check the connector for corrosion',
      'Replace the sensor or thermostat as indicated',
    ],
  ),
  d(
    'P0117',
    'Engine Coolant Temperature Circuit Low',
    S.cool,
    'medium',
    'Drive with care and watch the temperature gauge; the cooling fan may run all the time.',
    'The coolant temperature signal is very low, which the computer reads as an extremely hot engine.',
    lowCircuit('coolant temperature sensor'),
    circuitFixes('coolant temperature sensor'),
  ),
  d(
    'P0118',
    'Engine Coolant Temperature Circuit High',
    S.cool,
    'medium',
    'Drive with care and watch the temperature gauge; starting may be harder and fuel use higher.',
    'The coolant temperature signal is very high, which the computer reads as an extremely cold engine. This usually means an open circuit.',
    highCircuit('coolant temperature sensor'),
    circuitFixes('coolant temperature sensor'),
  ),
  d(
    'P0120',
    'Throttle/Pedal Position Sensor/Switch "A" Circuit',
    S.throttle,
    'medium',
    DRIVE.limp,
    'The engine computer has found a fault in throttle or pedal position sensor A. On drive-by-wire cars this sensor is inside the throttle body.',
    ['Faulty throttle position sensor or throttle body', 'Damaged wiring or connector', 'Shared 5 V supply fault', 'Engine computer fault (rare)'],
    circuitFixes('throttle position sensor'),
  ),
  d(
    'P0121',
    'Throttle/Pedal Position Sensor/Switch "A" Circuit Range/Performance',
    S.throttle,
    'medium',
    DRIVE.limp,
    'Throttle position sensor A is giving a reading that does not match the other throttle sensor, the air flow or the commanded position.',
    ['Worn track in the throttle position sensor', 'Dirty or sticking throttle body', 'Poor connection adding resistance', 'Air flow sensor fault making the reading look wrong'],
    [
      'Watch the throttle sensor reading while slowly opening the throttle; it should rise smoothly with no jumps',
      'Clean the throttle body and run the throttle adaptation',
      'Check the connector and wiring',
      'Replace the sensor or throttle body',
    ],
  ),
  d(
    'P0122',
    'Throttle/Pedal Position Sensor/Switch "A" Circuit Low',
    S.throttle,
    'medium',
    DRIVE.limp,
    'The throttle position sensor A signal voltage is below its normal range.',
    lowCircuit('throttle position sensor'),
    circuitFixes('throttle position sensor'),
  ),
  d(
    'P0123',
    'Throttle/Pedal Position Sensor/Switch "A" Circuit High',
    S.throttle,
    'medium',
    DRIVE.limp,
    'The throttle position sensor A signal voltage is above its normal range.',
    highCircuit('throttle position sensor'),
    circuitFixes('throttle position sensor'),
  ),
  d(
    'P0221',
    'Throttle/Pedal Position Sensor/Switch "B" Circuit Range/Performance',
    S.throttle,
    'medium',
    DRIVE.limp,
    'Throttle position sensor B is giving a reading that does not agree with sensor A or the commanded throttle position.',
    ['Worn or faulty throttle body sensor', 'Dirty or sticking throttle body', 'Poor connection', 'Wiring fault'],
    [
      'Compare sensors A and B in live data while slowly opening the throttle',
      'Clean the throttle body and run the throttle adaptation',
      'Check connector and wiring',
      'Replace the throttle body',
    ],
  ),
  d(
    'P0222',
    'Throttle/Pedal Position Sensor/Switch "B" Circuit Low',
    S.throttle,
    'medium',
    DRIVE.limp,
    'The throttle position sensor B signal voltage is below its normal range.',
    lowCircuit('throttle position sensor'),
    circuitFixes('throttle position sensor'),
  ),
  d(
    'P0223',
    'Throttle/Pedal Position Sensor/Switch "B" Circuit High',
    S.throttle,
    'medium',
    DRIVE.limp,
    'The throttle position sensor B signal voltage is above its normal range.',
    highCircuit('throttle position sensor'),
    circuitFixes('throttle position sensor'),
  ),
  d(
    'P2101',
    'Throttle Actuator Control Motor Circuit Range/Performance',
    S.throttle,
    'medium',
    DRIVE.limp,
    'The electronic throttle motor is not moving the throttle to where the computer commands, or its circuit is out of range.',
    ['Dirty or carbon-fouled throttle body', 'Faulty throttle body motor', 'Damaged wiring or connector', 'Low battery voltage', 'Engine computer driver fault (rare)'],
    [
      'Check battery voltage and connections',
      'Inspect and clean the throttle body (ignition off)',
      'Check the throttle body connector and wiring',
      'Run the throttle adaptation or relearn',
      'Replace the throttle body',
    ],
  ),
  d(
    'P2135',
    'Throttle/Pedal Position Sensor/Switch "A"/"B" Voltage Correlation',
    S.throttle,
    'medium',
    DRIVE.limp,
    'The 2 throttle position sensors inside the throttle body disagree with each other, so the computer cannot be sure where the throttle is.',
    ['Worn throttle body sensor track', 'Corroded or loose throttle body connector', 'Wiring fault, often a chafed harness', 'Faulty throttle body'],
    [
      'Check the throttle body connector for corrosion or loose pins',
      'Compare sensors A and B in live data while slowly opening the throttle',
      'Wiggle-test the harness',
      'Replace the throttle body and run the adaptation',
    ],
  ),
  d(
    'P2138',
    'Throttle/Pedal Position Sensor/Switch "D"/"E" Voltage Correlation',
    S.throttle,
    'medium',
    DRIVE.limp,
    'The 2 sensors inside the accelerator pedal disagree with each other, so the computer limits power.',
    ['Worn accelerator pedal sensor', 'Corroded or loose pedal connector', 'Wiring fault', 'Low battery voltage'],
    [
      'Check battery voltage',
      'Check the pedal connector',
      'Compare both pedal sensor readings in live data while slowly pressing the pedal',
      'Replace the accelerator pedal assembly',
    ],
  ),
  d(
    'P0125',
    'Insufficient Coolant Temperature for Closed Loop Fuel Control',
    S.cool,
    'low',
    DRIVE.ok,
    'The engine is taking too long to warm up enough for the computer to start using the oxygen sensors to control fuelling.',
    ['Thermostat stuck open', 'Faulty coolant temperature sensor', 'Low coolant level', 'Very cold weather with short trips'],
    [
      'Check the coolant level',
      'Watch coolant temperature in live data during warm-up',
      'Check the heater gets hot',
      'Replace the thermostat or sensor as indicated',
    ],
  ),
  d(
    'P0128',
    'Coolant Thermostat (Coolant Temperature Below Thermostat Regulating Temperature)',
    S.cool,
    'low',
    'Safe to drive; heater output and fuel economy may be poor until fixed.',
    'The engine is not reaching its normal running temperature in the expected time, which usually means the thermostat is stuck open.',
    ['Thermostat stuck open', 'Faulty coolant temperature sensor', 'Low coolant level', 'Cooling fan running all the time'],
    [
      'Check the coolant level',
      'Watch coolant temperature in live data: it should reach around 85 to 95 C within 10 to 15 minutes of driving',
      'Check whether the fan runs on a cold engine',
      'Replace the thermostat (and the coolant sensor if it reads wrong)',
    ],
    { vag: 'On EA888 TSI engines, the thermostat sits in a plastic water pump housing that is also prone to coolant leaks.' },
  ),
  trim('P0171', 1, false, ''),
  trim('P0172', 1, true, ''),
  trim('P0174', 2, false, ''),
  trim('P0175', 2, true, ''),
  trim('P2177', 1, false, 'offidle'),
  trim('P2178', 1, true, 'offidle'),
  trim('P2187', 1, false, 'idle'),
  trim('P2188', 1, true, 'idle'),
  postCatTrim('P2096', 1, false),
  postCatTrim('P2097', 1, true),
  postCatTrim('P2098', 2, false),
  postCatTrim('P2099', 2, true),
  d(
    'P0190',
    'Fuel Rail Pressure Sensor "A" Circuit',
    S.fuelP,
    'medium',
    DRIVE.limp,
    'The engine computer has found a fault in the fuel rail pressure sensor circuit.',
    ['Damaged wiring or connector', 'Faulty rail pressure sensor', 'Shared 5 V supply fault', 'Engine computer fault (rare)'],
    circuitFixes('rail pressure sensor'),
  ),
  d(
    'P0191',
    'Fuel Rail Pressure Sensor "A" Circuit Range/Performance',
    S.fuelP,
    'medium',
    DRIVE.limp,
    'The fuel rail pressure reading does not match what the computer expects, or it is not changing as it should.',
    ['Faulty rail pressure sensor', 'Real fuel pressure problem (blocked filter, weak pump)', 'Poor connection at the sensor', 'Faulty pressure regulator'],
    [
      'Compare desired and actual rail pressure in live data',
      'Check sensor wiring and connector',
      'Replace the fuel filter if due',
      'Have the pressure checked with a gauge by a specialist',
      'Replace the sensor (often part of the rail on diesels)',
    ],
  ),
  d(
    'P0192',
    'Fuel Rail Pressure Sensor "A" Circuit Low',
    S.fuelP,
    'medium',
    DRIVE.limp,
    'The fuel rail pressure sensor signal voltage is below its normal range.',
    lowCircuit('rail pressure sensor'),
    circuitFixes('rail pressure sensor'),
  ),
  d(
    'P0193',
    'Fuel Rail Pressure Sensor "A" Circuit High',
    S.fuelP,
    'medium',
    DRIVE.limp,
    'The fuel rail pressure sensor signal voltage is above its normal range.',
    highCircuit('rail pressure sensor'),
    circuitFixes('rail pressure sensor'),
  ),
  injCircuit('P0200', null),
  injCircuit('P0201', 1),
  injCircuit('P0202', 2),
  injCircuit('P0203', 3),
  injCircuit('P0204', 4),
  injCircuit('P0205', 5),
  injCircuit('P0206', 6),
  injCircuit('P0207', 7),
  injCircuit('P0208', 8),
  d(
    'P0217',
    'Engine Coolant Over Temperature Condition',
    S.cool,
    'high',
    'Stop driving as soon as it is safe and switch off; driving an overheating engine can warp the cylinder head.',
    'The engine has got hotter than its safe limit.',
    [
      'Low coolant from a leak',
      'Cooling fan not working',
      'Thermostat stuck closed',
      'Failed water pump',
      'Blocked radiator',
      'Head gasket failure',
    ],
    [
      'Stop and let the engine cool; never open a hot coolant cap',
      'Check the coolant level once cold and look for leaks',
      'Check the fans run when the engine is hot or with the air conditioning on',
      'Pressure-test the cooling system',
      'Test for combustion gases in the coolant (head gasket check)',
    ],
  ),
  d(
    'P0219',
    'Engine Overspeed Condition',
    S.speed,
    'medium',
    'Usually safe if the engine now runs normally; get it checked if it was a large over-rev.',
    'The engine has run faster than its maximum allowed speed, for example after a missed gear change.',
    [
      'Wrong gear selected when changing down (manual)',
      'Clutch or gearbox slipping',
      'On diesels, the engine running on its own oil (runaway)',
      'Faulty crankshaft sensor signal',
    ],
    [
      'Note when it happened and whether the engine sounds normal',
      'Check for other codes, such as crank sensor faults',
      'Check the oil level (rising oil on a diesel can feed a runaway)',
      'If it was a big over-rev, have the valves and timing checked (professional job)',
    ],
  ),
  d(
    'P0230',
    'Fuel Pump Primary Circuit',
    S.fuelP,
    'medium',
    'The engine may cut out or not start; get it checked soon.',
    'The engine computer has found a fault in the circuit that switches the fuel pump on.',
    ['Failed fuel pump relay', 'Blown fuel pump fuse', 'Wiring or connector fault to the pump', 'Fuel pump control module fault', 'Failing fuel pump drawing too much current'],
    [
      'Check the fuel pump fuse and relay',
      'Listen for the pump priming at key-on',
      'Check supply voltage at the pump connector',
      'Check wiring and earths',
      'Replace the relay, module or pump as indicated',
    ],
  ),
  d(
    'P0627',
    'Fuel Pump "A" Control Circuit/Open',
    S.fuelP,
    'medium',
    'The engine may cut out or not start; get it checked soon.',
    'The fuel pump control circuit is open or faulty.',
    ['Fuel pump control module fault', 'Wiring or connector fault', 'Blown fuse', 'Failing fuel pump'],
    [
      'Check fuses and relays',
      'Inspect wiring and connectors to the pump and its module',
      'Check the pump module power and earth',
      'Replace the module or pump as indicated',
    ],
  ),
  d(
    'P2181',
    'Cooling System Performance',
    S.cool,
    'medium',
    'Drive with care and watch the temperature gauge.',
    'The engine is not reaching or holding the temperature the computer expects, which points to a cooling system problem.',
    ['Thermostat stuck open or slow to open', 'Low coolant or an air lock', 'Faulty coolant temperature sensor', 'Electric water pump or coolant valve fault (on some engines)'],
    [
      'Check the coolant level and bleed air from the system',
      'Watch coolant temperature in live data during warm-up',
      'Check the coolant temperature sensor reads correctly',
      'Replace the thermostat',
    ],
  ),
  d(
    'P0480',
    'Fan 1 Control Circuit',
    S.cool,
    'medium',
    'Watch the temperature gauge, especially in traffic; stop if it climbs into the red.',
    'The engine computer has found a fault in the cooling fan control circuit, so the fan may not run when needed.',
    ['Failed fan relay or fan control module', 'Blown fan fuse', 'Faulty fan motor', 'Damaged wiring or connector'],
    [
      'Check the fan fuse and relay',
      'Run the fan with a diagnostic output test if available',
      'Check power and earth at the fan',
      'Replace the relay, control module or fan motor as indicated',
    ],
  ),
  d(
    'P0481',
    'Fan 2 Control Circuit',
    S.cool,
    'medium',
    'Watch the temperature gauge, especially in traffic; stop if it climbs into the red.',
    'The engine computer has found a fault in the second (or high-speed) cooling fan circuit.',
    ['Failed fan relay or fan resistor', 'Blown fuse', 'Faulty fan motor', 'Damaged wiring or connector'],
    [
      'Check fuses and relays',
      'Run the fan with a diagnostic output test if available',
      'Check power and earth at the fan',
      'Replace the faulty part',
    ],
  ),
];

// ---------------------------------------------------------------------------
// Turbo and boost
// ---------------------------------------------------------------------------

const TURBO: DtcEntry[] = [
  d(
    'P0234',
    'Turbocharger/Supercharger "A" Overboost Condition',
    S.turbo,
    'high',
    'Limit driving and avoid hard acceleration; too much boost can damage the engine. Expect limp mode.',
    'Boost pressure has gone higher than the computer allows.',
    [
      'Variable vane turbo (VNT) vanes sticking from soot',
      'Faulty boost control solenoid, or a split vacuum line to it',
      'Wastegate stuck shut or actuator fault',
      'Faulty boost pressure sensor',
      'Engine remap or tuning box pushing boost too high',
    ],
    [
      'Check the vacuum hoses to the turbo actuator and boost control solenoid',
      'Compare requested and actual boost in live data',
      'Test the boost control solenoid',
      'Check the actuator rod moves freely through its full travel',
      'Clean or replace the turbo vanes or actuator (specialist job)',
    ],
    { vag: 'On TDI engines, sticking turbo vanes from soot and a failed N75 boost control valve are common causes.' },
  ),
  d(
    'P0236',
    'Turbocharger/Supercharger Boost Sensor "A" Circuit Range/Performance',
    S.turbo,
    'medium',
    DRIVE.limp,
    'The boost pressure sensor reading does not match what the computer expects, or it does not change with boost.',
    ['Faulty boost pressure sensor or sensor clogged with oil', 'Boost leak', 'Split hose to the sensor (on remote-mounted sensors)', 'Wiring fault'],
    [
      'Key on, engine off: boost sensor should match barometric pressure',
      'Clean the sensor tip',
      'Pressure-test the intake for boost leaks',
      'Check wiring',
      'Replace the sensor',
    ],
  ),
  d(
    'P0237',
    'Turbocharger/Supercharger Boost Sensor "A" Circuit Low',
    S.turbo,
    'medium',
    DRIVE.limp,
    'The boost pressure sensor signal voltage is below its normal range.',
    lowCircuit('boost pressure sensor'),
    circuitFixes('boost pressure sensor'),
  ),
  d(
    'P0238',
    'Turbocharger/Supercharger Boost Sensor "A" Circuit High',
    S.turbo,
    'medium',
    DRIVE.limp,
    'The boost pressure sensor signal voltage is above its normal range.',
    highCircuit('boost pressure sensor'),
    circuitFixes('boost pressure sensor'),
  ),
  d(
    'P0243',
    'Turbocharger/Supercharger Wastegate Solenoid "A"',
    S.turbo,
    'medium',
    DRIVE.limp,
    'The engine computer has found a fault in the solenoid that controls the turbo wastegate or vanes.',
    ['Faulty boost control solenoid', 'Damaged wiring or connector', 'Blown fuse', 'Engine computer driver fault (rare)'],
    [
      'Check the solenoid connector and wiring',
      'Measure solenoid resistance against spec',
      'Check supply voltage',
      'Replace the solenoid',
    ],
  ),
  d(
    'P0299',
    'Turbocharger/Supercharger "A" Underboost Condition',
    S.turbo,
    'medium',
    DRIVE.limp,
    'Boost pressure is lower than the computer asked for, so the engine feels flat and may go into limp mode.',
    [
      'Split boost hose or loose intercooler pipe (very common)',
      'Turbo vanes sticking or wastegate stuck open',
      'Faulty boost control solenoid or leaking vacuum line to the actuator',
      'Blocked air filter, or a restricted DPF or exhaust',
      'EGR valve stuck open (diesel)',
      'Worn turbo',
    ],
    [
      'Inspect all intercooler hoses and clamps, especially on the underside, for splits and oil',
      'Pressure or smoke-test the intake for boost leaks',
      'Compare requested and actual boost in live data on a test drive',
      'Check vacuum lines and the boost control solenoid',
      'Check DPF back-pressure and EGR operation on diesels',
      'Have the turbo checked by a specialist if all else passes',
    ],
    { vag: 'On TDI engines, split intercooler hoses and sticking turbo vanes are the usual causes.' },
  ),
  d(
    'P2263',
    'Turbocharger/Supercharger Boost System Performance',
    S.turbo,
    'medium',
    DRIVE.limp,
    'The boost system is not producing the boost the computer expects.',
    [
      'Boost leak from a split hose or loose clamp',
      'Sticking turbo vanes or wastegate',
      'Faulty boost control solenoid or vacuum leak',
      'Faulty boost pressure sensor',
      'EGR valve stuck open or a blocked DPF',
    ],
    [
      'Inspect intercooler hoses and clamps',
      'Smoke or pressure-test the intake',
      'Compare requested and actual boost in live data',
      'Check the boost control solenoid and vacuum lines',
      'Have the turbo inspected by a specialist',
    ],
  ),
  d(
    'P2279',
    'Intake Air System Leak',
    S.air,
    'medium',
    DRIVE.soon,
    'The computer has detected unmetered air getting into the intake.',
    [
      'Split or disconnected intake or vacuum hose',
      'Faulty PCV valve or oil separator',
      'Leaking intake manifold gasket',
      'Leaking brake servo hose',
      'Oil filler cap or dipstick not sealing',
    ],
    [
      'Check the oil filler cap and dipstick are seated',
      'Listen for hissing at idle',
      'Smoke-test the intake',
      'Check the PCV valve',
      'Repair the leak and clear fuel trims',
    ],
    { vag: 'On TSI and FSI engines, a failed PCV valve in the oil separator is a frequent cause.' },
  ),
];

// ---------------------------------------------------------------------------
// Ignition, misfire and engine position sensors
// ---------------------------------------------------------------------------

function misfire(code: string, n: number): DtcEntry {
  const makes: Makes | undefined =
    n <= 4
      ? {
          vag: 'On TSI and TFSI petrol engines, failed coil packs and worn plugs are common; carbon build-up on the intake valves of direct-injection engines can also cause misfires.',
        }
      : undefined;
  return d(
    code,
    `Cylinder ${n} Misfire Detected`,
    S.ign,
    'high',
    DRIVE.misfire,
    `The engine computer has seen cylinder ${n} misfire (fail to burn its fuel properly) more often than allowed. Unburnt fuel can overheat and ruin the catalytic converter.`,
    [
      `Worn or fouled spark plug in cylinder ${n}`,
      `Failing ignition coil on cylinder ${n}`,
      'Faulty or clogged injector, or its wiring',
      'Vacuum leak near that cylinder',
      'Low compression (valve, piston ring or head gasket problem)',
    ],
    [
      'Read misfire counters in live data to confirm which cylinder is affected',
      `Swap the cylinder ${n} coil with a neighbour, clear codes and see if the misfire moves`,
      'Check and replace the spark plug (and plugs on all cylinders if due)',
      'Swap or test the injector if the misfire stays with the cylinder',
      'Compression or leak-down test (professional job)',
      'On a diesel, test the injector with a balance or back-leak test',
    ],
    makes,
  );
}

function coil(code: string, letter: string, n: number): DtcEntry {
  return d(
    code,
    `Ignition Coil "${letter}" Primary/Secondary Circuit`,
    S.ign,
    'high',
    DRIVE.misfire,
    `The engine computer has found a fault in the circuit of ignition coil ${letter} (normally cylinder ${n}). That cylinder will misfire, and unburnt fuel can damage the catalytic converter.`,
    [
      'Failed ignition coil',
      'Loose or corroded coil connector',
      'Damaged wiring to the coil',
      'Worn spark plug overloading the coil',
      'Engine computer coil driver fault (rare)',
    ],
    [
      'Check the coil connector is fully clipped on and free of corrosion',
      'Swap the coil with another cylinder and see if the code moves',
      'Check the spark plug for wear or cracks',
      'Check power and control wires at the coil',
      'Replace the coil (and plugs if due)',
    ],
  );
}

function glowPlug(code: string, n: number): DtcEntry {
  return d(
    code,
    `Cylinder ${n} Glow Plug Circuit`,
    S.glow,
    'low',
    'Safe to drive; cold starts may be harder and the engine may smoke white until warm.',
    `The glow plug control has found an electrical fault in the cylinder ${n} glow plug circuit. Glow plugs preheat the cylinders of a diesel engine for cold starting.`,
    [
      `Failed (burnt out) glow plug in cylinder ${n}`,
      'Loose or corroded glow plug connector',
      'Damaged wiring to the glow plug',
      'Glow plug control module fault',
    ],
    [
      'Unplug the glow plug and measure its resistance (a good plug reads around 1 ohm or less)',
      'Check the connector and wiring',
      'Replace the glow plug; they can seize in the head, so use penetrating oil and the correct torque (professional job if stuck)',
      'Test the glow plug control module if the plug and wiring are good',
    ],
  );
}

const IGNITION: DtcEntry[] = [
  d(
    'P0300',
    'Random/Multiple Cylinder Misfire Detected',
    S.ign,
    'high',
    DRIVE.misfire,
    'The engine computer has seen misfires on more than one cylinder, or on cylinders that change. Unburnt fuel can overheat and ruin the catalytic converter.',
    [
      'Worn spark plugs or failing ignition coils',
      'Vacuum leak',
      'Low fuel pressure or dirty injectors',
      'Poor-quality or contaminated fuel',
      'Low compression or a valve timing problem',
      'Faulty crankshaft sensor or EGR valve stuck open',
    ],
    [
      'Read misfire counters per cylinder in live data',
      'Check fuel trims for a lean condition and smoke-test for vacuum leaks',
      'Inspect spark plugs and coils, and replace if due',
      'Test fuel pressure',
      'Check cam and crank timing codes and data',
      'Compression test (professional job)',
    ],
  ),
  misfire('P0301', 1),
  misfire('P0302', 2),
  misfire('P0303', 3),
  misfire('P0304', 4),
  misfire('P0305', 5),
  misfire('P0306', 6),
  misfire('P0307', 7),
  misfire('P0308', 8),
  d(
    'P0313',
    'Misfire Detected with Low Fuel',
    S.ign,
    'medium',
    'Fill up with fuel; if the misfire continues with a full tank, get it checked soon.',
    'Misfires were detected while the fuel level was low, which suggests the pump picked up air.',
    ['Running very low on fuel', 'Weak fuel pump', 'Fuel level sensor reading wrong', 'Any normal misfire cause showing up at the same time'],
    [
      'Fill the tank and clear the code',
      'Avoid running below a quarter tank',
      'If it returns, check fuel pressure and the fuel level sender',
      'Investigate as a normal misfire if it happens with plenty of fuel',
    ],
  ),
  d(
    'P0314',
    'Single Cylinder Misfire (Cylinder not Specified)',
    S.ign,
    'high',
    DRIVE.misfire,
    'One cylinder is misfiring, but the computer cannot tell which one.',
    ['Worn spark plug', 'Failing ignition coil', 'Faulty injector', 'Vacuum leak', 'Low compression'],
    [
      'Use live misfire counters, if available, to find the cylinder',
      'Inspect plugs and coils',
      'Swap parts between cylinders to see if the fault moves',
      'Compression test (professional job)',
    ],
  ),
  d(
    'P0320',
    'Ignition/Distributor Engine Speed Input Circuit',
    S.ign,
    'high',
    'The engine may cut out without warning; get it checked before relying on the car.',
    'The engine speed signal used for ignition timing is missing or faulty.',
    ['Faulty crankshaft or engine speed sensor', 'Damaged wiring or connector', 'Damaged reluctor ring', 'Ignition module fault (older cars)'],
    circuitFixes('engine speed sensor'),
  ),
  d(
    'P0321',
    'Ignition/Distributor Engine Speed Input Circuit Range/Performance',
    S.ign,
    'medium',
    'The engine may stumble or cut out; get it checked soon.',
    'The engine speed signal is erratic or out of the expected range.',
    ['Faulty engine speed sensor', 'Loose or corroded connector', 'Damaged reluctor ring', 'Interference from damaged high-tension leads'],
    circuitFixes('engine speed sensor'),
  ),
  d(
    'P0322',
    'Ignition/Distributor Engine Speed Input Circuit No Signal',
    S.ign,
    'high',
    'The engine may cut out or not start; do not rely on the car until fixed.',
    'There is no engine speed signal at all.',
    ['Failed engine speed sensor', 'Broken wire or unplugged connector', 'Damaged reluctor ring', 'Ignition module fault (older cars)'],
    circuitFixes('engine speed sensor'),
  ),
  d(
    'P0325',
    'Knock Sensor 1 Circuit (Bank 1 or Single Sensor)',
    S.knock,
    'medium',
    'Safe to drive gently; the computer will retard the timing, so expect less power and higher fuel use. Avoid heavy loads.',
    'The engine computer has found a fault in the knock sensor circuit. The knock sensor listens for harmful pinking so the computer can adjust the timing.',
    ['Damaged wiring or connector (often under the intake manifold)', 'Faulty knock sensor', 'Sensor loose or wrongly torqued', 'Engine computer fault (rare)'],
    [
      'Check the connector and wiring to the sensor',
      'Check the sensor is tightened to the correct torque',
      'Measure the sensor resistance or signal against spec',
      'Replace the knock sensor',
    ],
  ),
  d(
    'P0326',
    'Knock Sensor 1 Circuit Range/Performance (Bank 1 or Single Sensor)',
    S.knock,
    'medium',
    'Safe to drive gently; avoid heavy loads and use the correct fuel grade.',
    'The knock sensor signal is out of the expected range, either too noisy or too quiet.',
    ['Real engine knock from poor fuel or carbon build-up', 'Loose or wrongly torqued knock sensor', 'Faulty knock sensor', 'Mechanical noise such as a loose heat shield or worn bearings'],
    [
      'Fill with the correct fuel grade',
      'Check the sensor torque and connector',
      'Listen for mechanical noises',
      'Replace the knock sensor',
    ],
  ),
  d(
    'P0327',
    'Knock Sensor 1 Circuit Low (Bank 1 or Single Sensor)',
    S.knock,
    'medium',
    'Safe to drive gently; expect less power. Avoid heavy loads.',
    'The knock sensor signal is lower than expected.',
    ['Damaged wiring or connector', 'Faulty knock sensor', 'Sensor loose on the block', 'Engine computer fault (rare)'],
    ['Check the connector and wiring', 'Check the sensor torque', 'Measure the sensor against spec', 'Replace the knock sensor'],
  ),
  d(
    'P0328',
    'Knock Sensor 1 Circuit High (Bank 1 or Single Sensor)',
    S.knock,
    'medium',
    'Safe to drive gently; expect less power. Avoid heavy loads.',
    'The knock sensor signal is higher than expected.',
    ['Wiring shorted to voltage or picking up interference', 'Faulty knock sensor', 'Real heavy knock or mechanical noise', 'Engine computer fault (rare)'],
    ['Check the connector and wiring', 'Check for mechanical noise and use the correct fuel', 'Measure the sensor against spec', 'Replace the knock sensor'],
  ),
  d(
    'P0330',
    'Knock Sensor 2 Circuit (Bank 2)',
    S.knock,
    'medium',
    'Safe to drive gently; expect less power. Avoid heavy loads.',
    'The engine computer has found a fault in the second knock sensor circuit.',
    ['Damaged wiring or connector', 'Faulty knock sensor', 'Sensor loose or wrongly torqued', 'Engine computer fault (rare)'],
    ['Check the connector and wiring', 'Check the sensor torque', 'Measure the sensor against spec', 'Replace the knock sensor'],
  ),
  d(
    'P0332',
    'Knock Sensor 2 Circuit Low (Bank 2)',
    S.knock,
    'medium',
    'Safe to drive gently; expect less power. Avoid heavy loads.',
    'The second knock sensor signal is lower than expected.',
    ['Damaged wiring or connector', 'Faulty knock sensor', 'Sensor loose on the block', 'Engine computer fault (rare)'],
    ['Check the connector and wiring', 'Check the sensor torque', 'Measure the sensor against spec', 'Replace the knock sensor'],
  ),
  d(
    'P0335',
    'Crankshaft Position Sensor "A" Circuit',
    S.cam,
    'high',
    'The engine may cut out without warning or not restart; do not rely on the car until fixed.',
    'The engine computer has found a fault in the crankshaft position sensor circuit. This sensor tells the computer engine speed and position, and the engine cannot run without it.',
    ['Failed crankshaft position sensor (often heat-related)', 'Damaged wiring or connector', 'Damaged reluctor ring or flywheel teeth', 'Wrong air gap after a repair', 'Engine computer fault (rare)'],
    [
      'Check whether the rev counter moves while cranking; if not, the signal is missing',
      'Inspect the connector and wiring near the sensor',
      'Measure sensor resistance (inductive type) or check the signal on a scope',
      'Replace the sensor with a quality part',
      'Inspect the reluctor ring if a new sensor does not cure it',
    ],
  ),
  d(
    'P0336',
    'Crankshaft Position Sensor "A" Circuit Range/Performance',
    S.cam,
    'high',
    'The engine may stumble or cut out; get it checked before relying on the car.',
    'The crankshaft sensor signal is erratic or does not match the expected pattern.',
    ['Faulty crankshaft sensor', 'Damaged or dirty reluctor ring', 'Loose sensor or wrong air gap', 'Interference in the wiring', 'Slipped timing'],
    [
      'Check the sensor is secure and clean',
      'Inspect the wiring for chafing near the ignition parts',
      'Check the signal on a scope',
      'Replace the sensor',
      'Inspect the reluctor ring and timing',
    ],
  ),
  d(
    'P0337',
    'Crankshaft Position Sensor "A" Circuit Low',
    S.cam,
    'high',
    'The engine may cut out or not start; do not rely on the car until fixed.',
    'The crankshaft sensor signal is lower than expected.',
    lowCircuit('crankshaft sensor'),
    circuitFixes('crankshaft sensor'),
  ),
  d(
    'P0338',
    'Crankshaft Position Sensor "A" Circuit High',
    S.cam,
    'high',
    'The engine may cut out or not start; do not rely on the car until fixed.',
    'The crankshaft sensor signal is higher than expected.',
    highCircuit('crankshaft sensor'),
    circuitFixes('crankshaft sensor'),
  ),
  d(
    'P0339',
    'Crankshaft Position Sensor "A" Circuit Intermittent',
    S.cam,
    'high',
    'The engine may cut out without warning; get it checked before relying on the car.',
    'The crankshaft sensor signal keeps dropping out.',
    ['Failing crankshaft sensor (often when hot)', 'Loose connector or broken wire', 'Damaged reluctor ring', 'Wiring chafing'],
    [
      'Note whether the fault happens when the engine is hot',
      'Wiggle-test the wiring with the engine running',
      'Check the connector pins',
      'Replace the sensor',
    ],
  ),
  d(
    'P0340',
    'Camshaft Position Sensor "A" Circuit (Bank 1 or Single Sensor)',
    S.cam,
    'medium',
    'Usually drivable, but starting may take longer and power may drop; get it checked soon.',
    'The engine computer has found a fault in the camshaft position sensor circuit. The sensor tells the computer which stroke each cylinder is on.',
    ['Failed camshaft sensor', 'Damaged wiring or connector', 'Oil in the connector', 'Timing belt or chain slipped', 'Engine computer fault (rare)'],
    [
      'Check the connector and wiring at the sensor',
      'Check power, earth and signal with a multimeter or scope',
      'Replace the sensor',
      'Check cam timing if a new sensor does not cure it',
    ],
  ),
  d(
    'P0341',
    'Camshaft Position Sensor "A" Circuit Range/Performance (Bank 1 or Single Sensor)',
    S.cam,
    'medium',
    'Usually drivable, but starting may take longer; get it checked soon.',
    'The camshaft sensor signal does not line up with the crankshaft signal as expected.',
    ['Faulty camshaft sensor', 'Timing belt or chain stretched or slipped', 'Damaged cam sensor target wheel', 'Wiring interference', 'Low battery voltage when cranking'],
    [
      'Check battery and cranking voltage',
      'Check sensor wiring',
      'Compare cam and crank signals on a scope',
      'Replace the sensor',
      'Check the timing belt or chain (professional job)',
    ],
  ),
  d(
    'P0342',
    'Camshaft Position Sensor "A" Circuit Low (Bank 1 or Single Sensor)',
    S.cam,
    'medium',
    'Usually drivable, but starting may take longer; get it checked soon.',
    'The camshaft sensor signal voltage is below its normal range.',
    lowCircuit('camshaft sensor'),
    circuitFixes('camshaft sensor'),
  ),
  d(
    'P0343',
    'Camshaft Position Sensor "A" Circuit High (Bank 1 or Single Sensor)',
    S.cam,
    'medium',
    'Usually drivable, but starting may take longer; get it checked soon.',
    'The camshaft sensor signal voltage is above its normal range.',
    highCircuit('camshaft sensor'),
    circuitFixes('camshaft sensor'),
  ),
  d(
    'P0344',
    'Camshaft Position Sensor "A" Circuit Intermittent (Bank 1 or Single Sensor)',
    S.cam,
    'medium',
    'Usually drivable, but the engine may stumble; get it checked soon.',
    'The camshaft sensor signal keeps dropping out.',
    ['Loose connector or broken wire', 'Failing camshaft sensor', 'Oil in the connector', 'Wiring interference'],
    circuitFixes('camshaft sensor'),
  ),
  d(
    'P0345',
    'Camshaft Position Sensor "A" Circuit (Bank 2)',
    S.cam,
    'medium',
    'Usually drivable, but starting may take longer; get it checked soon.',
    'The engine computer has found a fault in the bank 2 camshaft position sensor circuit.',
    ['Failed camshaft sensor', 'Damaged wiring or connector', 'Oil in the connector', 'Timing belt or chain slipped'],
    circuitFixes('camshaft sensor'),
  ),
  coil('P0351', 'A', 1),
  coil('P0352', 'B', 2),
  coil('P0353', 'C', 3),
  coil('P0354', 'D', 4),
  coil('P0355', 'E', 5),
  coil('P0356', 'F', 6),
  coil('P0357', 'G', 7),
  coil('P0358', 'H', 8),
  d(
    'P0380',
    'Glow Plug/Heater Circuit "A"',
    S.glow,
    'low',
    'Safe to drive; cold starts may be harder and the engine may smoke white until warm.',
    'The engine computer has found a fault in the glow plug supply circuit of this diesel engine.',
    ['One or more failed glow plugs', 'Failed glow plug relay or control module', 'Blown glow plug fuse', 'Damaged wiring or connectors'],
    [
      'Check the glow plug fuse',
      'Measure each glow plug resistance at the plug',
      'Check the glow plug relay or module operates at key-on',
      'Replace failed glow plugs (seized plugs need a specialist)',
      'Replace the relay or module if the plugs are good',
    ],
  ),
  d(
    'P0381',
    'Glow Plug/Heater Indicator Circuit',
    S.glow,
    'low',
    DRIVE.ok,
    'The engine computer has found a fault in the circuit for the glow plug warning light on the dashboard.',
    ['Instrument cluster or bulb fault', 'Wiring fault to the warning light', 'Engine computer fault (rare)'],
    ['Check the light comes on at key-on', 'Check other codes on the instrument cluster', 'Check wiring'],
  ),
  d(
    'P0382',
    'Glow Plug/Heater Circuit "B"',
    S.glow,
    'low',
    'Safe to drive; cold starts may be harder.',
    'The engine computer has found a fault in the second glow plug supply circuit.',
    ['Failed glow plug', 'Failed glow plug relay or control module', 'Blown fuse', 'Damaged wiring or connectors'],
    [
      'Check the glow plug fuses',
      'Measure glow plug resistance',
      'Check the relay or module',
      'Replace the faulty part',
    ],
  ),
  d(
    'P0383',
    'Glow Plug Control Module Control Circuit Low',
    S.glow,
    'low',
    'Safe to drive; cold starts may be harder.',
    'The signal from the engine computer to the glow plug control module is lower than expected.',
    ['Wiring between computer and module shorted to earth', 'Faulty glow plug control module', 'Corroded connector', 'Engine computer fault (rare)'],
    ['Check the module connector', 'Check wiring between computer and module', 'Check module power and earth', 'Replace the module'],
  ),
  d(
    'P0384',
    'Glow Plug Control Module Control Circuit High',
    S.glow,
    'low',
    'Safe to drive; cold starts may be harder.',
    'The signal from the engine computer to the glow plug control module is higher than expected.',
    ['Wiring between computer and module open or shorted to power', 'Faulty glow plug control module', 'Corroded connector', 'Engine computer fault (rare)'],
    ['Check the module connector', 'Check wiring between computer and module', 'Check module power and earth', 'Replace the module'],
  ),
  d(
    'P0670',
    'Glow Plug Module Control Circuit',
    S.glow,
    'low',
    'Safe to drive; cold starts may be harder.',
    'The engine computer has found a fault in the control circuit of the glow plug module.',
    ['Faulty glow plug control module', 'Damaged wiring or connector', 'Blown fuse', 'Engine computer fault (rare)'],
    ['Check the fuse and module connector', 'Check module power and earth', 'Check wiring between computer and module', 'Replace the module'],
  ),
  glowPlug('P0671', 1),
  glowPlug('P0672', 2),
  glowPlug('P0673', 3),
  glowPlug('P0674', 4),
  d(
    'P0683',
    'Glow Plug Control Module to PCM Communication Circuit',
    S.glow,
    'low',
    'Safe to drive; cold starts may be harder.',
    'The glow plug control module and the engine computer are not talking to each other properly.',
    ['Faulty glow plug control module (it often reports a plug fault this way)', 'Failed glow plug causing the module to report an error', 'Damaged wiring or connector', 'Engine computer fault (rare)'],
    [
      'Measure each glow plug resistance first',
      'Check the module connector and wiring',
      'Check module power and earth',
      'Replace the module',
    ],
  ),
];

// ---------------------------------------------------------------------------
// Emissions: EGR, secondary air, catalyst, EVAP, DPF, AdBlue
// ---------------------------------------------------------------------------

const EGR_VAG: Makes = {
  vag: 'TDI engines often clog the EGR valve and cooler with soot; cleaning or replacing the valve is a common fix.',
};

function evapCircuit(code: string, title: string, part: string, detail: string): DtcEntry {
  return d(
    code,
    title,
    S.evap,
    'low',
    DRIVE.ok,
    `The engine computer has found an electrical fault in the EVAP ${part} circuit. ${detail}`,
    [`Faulty ${part}`, 'Damaged wiring or connector', 'Blown fuse', 'Engine computer driver fault (rare)'],
    [
      `Check the ${part} connector and wiring`,
      `Measure the ${part} resistance against spec`,
      'Check the supply fuse and voltage',
      `Replace the ${part}`,
    ],
  );
}

const EMISSIONS: DtcEntry[] = [
  d(
    'P0400',
    'Exhaust Gas Recirculation Flow',
    S.egr,
    'medium',
    DRIVE.soon,
    'The EGR system, which feeds some exhaust gas back into the intake to cut NOx emissions, is not flowing as expected.',
    ['EGR valve clogged with carbon or soot', 'EGR passages or cooler blocked', 'Faulty EGR valve or position sensor', 'Vacuum or wiring fault to the valve', 'Faulty MAF sensor (used to check EGR flow on many engines)'],
    [
      'Check other EGR, MAF and boost codes',
      'Command the EGR valve in live data and check it moves',
      'Remove and inspect the valve for carbon',
      'Clean or replace the EGR valve and clear the passages',
      'Run the EGR adaptation if required',
    ],
    EGR_VAG,
  ),
  d(
    'P0401',
    'Exhaust Gas Recirculation Flow Insufficient Detected',
    S.egr,
    'medium',
    DRIVE.soon,
    'Less exhaust gas is being recirculated than the computer asked for.',
    ['EGR valve clogged with carbon or soot', 'Blocked EGR cooler or passages', 'Faulty EGR valve or actuator', 'Split vacuum hose or faulty EGR solenoid (vacuum-operated valves)', 'Faulty MAF or pressure sensor misreading flow'],
    [
      'Command the EGR valve in live data and check it moves',
      'Check vacuum hoses on vacuum-operated valves',
      'Remove the valve and inspect for carbon',
      'Clean or replace the valve and clear the passages',
      'Check the EGR cooler for blockage (professional job)',
    ],
    EGR_VAG,
  ),
  d(
    'P0402',
    'Exhaust Gas Recirculation Flow Excessive Detected',
    S.egr,
    'medium',
    'Drive gently; the engine may idle roughly or stall. Get it checked soon.',
    'More exhaust gas is being recirculated than the computer asked for, often because the valve is stuck open.',
    ['EGR valve stuck open with carbon', 'Faulty EGR valve or position sensor', 'Faulty EGR control solenoid', 'Faulty MAF or pressure sensor'],
    [
      'Check whether the EGR valve fully closes (live data or visual check)',
      'Clean or replace the EGR valve',
      'Check the control solenoid and vacuum hoses',
      'Run the EGR adaptation if required',
    ],
    EGR_VAG,
  ),
  d(
    'P0403',
    'Exhaust Gas Recirculation "A" Control Circuit',
    S.egr,
    'medium',
    DRIVE.soon,
    'The engine computer has found an electrical fault in the EGR valve control circuit.',
    ['Faulty EGR valve motor or solenoid', 'Damaged wiring or connector', 'Blown fuse', 'Engine computer driver fault (rare)'],
    ['Check the EGR connector and wiring', 'Measure the valve motor or solenoid resistance', 'Check supply voltage and fuse', 'Replace the EGR valve'],
  ),
  d(
    'P0404',
    'Exhaust Gas Recirculation "A" Control Circuit Range/Performance',
    S.egr,
    'medium',
    DRIVE.soon,
    'The EGR valve is not reaching the position the computer commands.',
    ['EGR valve sticking from carbon or soot', 'Faulty EGR valve or position sensor', 'Wiring fault', 'Valve needs its adaptation run after cleaning or replacement'],
    ['Command the valve in live data and compare commanded and actual position', 'Clean or replace the valve', 'Check wiring', 'Run the EGR adaptation'],
    EGR_VAG,
  ),
  d(
    'P0405',
    'Exhaust Gas Recirculation Sensor "A" Circuit Low',
    S.egr,
    'medium',
    DRIVE.soon,
    'The EGR position sensor signal voltage is below its normal range.',
    lowCircuit('EGR position sensor (usually part of the valve)'),
    circuitFixes('EGR position sensor'),
  ),
  d(
    'P0406',
    'Exhaust Gas Recirculation Sensor "A" Circuit High',
    S.egr,
    'medium',
    DRIVE.soon,
    'The EGR position sensor signal voltage is above its normal range.',
    highCircuit('EGR position sensor (usually part of the valve)'),
    circuitFixes('EGR position sensor'),
  ),
  d(
    'P0407',
    'Exhaust Gas Recirculation Sensor "B" Circuit Low',
    S.egr,
    'medium',
    DRIVE.soon,
    'The second EGR sensor signal voltage is below its normal range.',
    lowCircuit('EGR sensor'),
    circuitFixes('EGR sensor'),
  ),
  d(
    'P0408',
    'Exhaust Gas Recirculation Sensor "B" Circuit High',
    S.egr,
    'medium',
    DRIVE.soon,
    'The second EGR sensor signal voltage is above its normal range.',
    highCircuit('EGR sensor'),
    circuitFixes('EGR sensor'),
  ),
  d(
    'P0409',
    'Exhaust Gas Recirculation Sensor "A" Circuit',
    S.egr,
    'medium',
    DRIVE.soon,
    'The engine computer has found a fault in the EGR sensor circuit.',
    ['Faulty EGR valve position sensor', 'Damaged wiring or connector', 'Shared 5 V supply fault', 'Engine computer fault (rare)'],
    circuitFixes('EGR position sensor'),
  ),
  d(
    'P046C',
    'Exhaust Gas Recirculation Sensor "A" Circuit Range/Performance',
    S.egr,
    'medium',
    DRIVE.soon,
    'The EGR position sensor reading does not match what the computer expects for the commanded position.',
    ['EGR valve sticking from carbon or soot', 'Worn EGR valve position sensor', 'Poor connection', 'Valve needs adaptation after cleaning'],
    ['Compare commanded and actual EGR position in live data', 'Clean or replace the EGR valve', 'Check the connector', 'Run the EGR adaptation'],
    EGR_VAG,
  ),
  d(
    'P0489',
    'Exhaust Gas Recirculation "A" Control Circuit Low',
    S.egr,
    'medium',
    DRIVE.soon,
    'The EGR valve control circuit reads lower than expected.',
    ['Control wire shorted to earth', 'Faulty EGR valve', 'Damaged connector', 'Engine computer fault (rare)'],
    ['Check the connector and wiring', 'Measure the valve resistance', 'Replace the EGR valve'],
  ),
  d(
    'P0490',
    'Exhaust Gas Recirculation "A" Control Circuit High',
    S.egr,
    'medium',
    DRIVE.soon,
    'The EGR valve control circuit reads higher than expected.',
    ['Open circuit or wire shorted to power', 'Faulty EGR valve', 'Damaged connector', 'Engine computer fault (rare)'],
    ['Check the connector and wiring', 'Measure the valve resistance', 'Replace the EGR valve'],
  ),
  d(
    'P0410',
    'Secondary Air Injection System',
    S.sai,
    'low',
    DRIVE.mot,
    'The secondary air system, which pumps fresh air into the exhaust after a cold start to heat the catalytic converter, is not working.',
    ['Failed secondary air pump (often from water ingress)', 'Stuck or leaking combination valve', 'Blown fuse or failed pump relay', 'Split hoses', 'Blocked air passages in the head'],
    [
      'Listen for the pump running for about a minute after a cold start',
      'Check the pump fuse and relay',
      'Check hoses and the combination valve',
      'Replace the pump or valve',
    ],
  ),
  d(
    'P0411',
    'Secondary Air Injection System Incorrect Flow Detected',
    S.sai,
    'low',
    DRIVE.mot,
    'The secondary air system is not producing the expected air flow during the cold-start test.',
    ['Weak or failed secondary air pump', 'Stuck or leaking combination valve', 'Blocked air passages', 'Split hoses or vacuum line to the valve'],
    ['Check the pump runs after a cold start', 'Check hoses and the valve', 'Watch upstream oxygen sensor during the test (it should read lean)', 'Replace the pump or valve'],
  ),
  d(
    'P0420',
    'Catalyst System Efficiency Below Threshold (Bank 1)',
    S.cat,
    'low',
    DRIVE.mot,
    'The downstream oxygen sensor is copying the upstream sensor too closely, which means the catalytic converter on bank 1 is not storing and cleaning the exhaust as well as it should.',
    [
      'Worn-out catalytic converter (age or mileage)',
      'Converter damaged by earlier misfires, oil burning or coolant loss',
      'Exhaust leak near the downstream oxygen sensor',
      'Faulty downstream or ageing upstream oxygen sensor',
      'Engine running rich or lean',
    ],
    [
      'Fix any misfire, fuel trim or oxygen sensor codes first',
      'Check for exhaust leaks around the converter and sensors',
      'Compare upstream and downstream sensor signals in live data; the downstream one should be steady',
      'Check the downstream sensor responds',
      'Replace the catalytic converter with a type-approved part',
    ],
  ),
  d(
    'P0421',
    'Warm Up Catalyst Efficiency Below Threshold (Bank 1)',
    S.cat,
    'low',
    DRIVE.mot,
    'The small warm-up catalytic converter close to the engine is not cleaning the exhaust well enough.',
    ['Worn or damaged warm-up converter', 'Exhaust leak near the sensors', 'Faulty oxygen sensor', 'Earlier misfires'],
    ['Fix any misfire or fuelling codes first', 'Check for exhaust leaks', 'Compare sensor signals in live data', 'Replace the converter'],
  ),
  d(
    'P0430',
    'Catalyst System Efficiency Below Threshold (Bank 2)',
    S.cat,
    'low',
    DRIVE.mot,
    'The catalytic converter on bank 2 is not cleaning the exhaust as well as it should.',
    [
      'Worn-out catalytic converter',
      'Converter damaged by misfires, oil burning or coolant loss',
      'Exhaust leak near the downstream oxygen sensor',
      'Faulty oxygen sensor',
      'Engine running rich or lean',
    ],
    [
      'Fix any misfire, fuel trim or oxygen sensor codes first',
      'Check for exhaust leaks',
      'Compare upstream and downstream sensor signals in live data',
      'Replace the catalytic converter with a type-approved part',
    ],
  ),
  d(
    'P0440',
    'Evaporative Emission System',
    S.evap,
    'low',
    DRIVE.ok,
    'The EVAP system, which stores petrol vapour from the tank in a charcoal canister and burns it in the engine, has a fault.',
    ['Loose, worn or wrong fuel cap', 'Leaking EVAP hose', 'Faulty purge or vent valve', 'Cracked charcoal canister', 'Faulty EVAP pressure sensor'],
    ['Check the fuel cap seal and tighten it until it clicks', 'Inspect hoses around the tank and canister', 'Smoke-test the EVAP system (garage)', 'Test the purge and vent valves'],
  ),
  d(
    'P0441',
    'Evaporative Emission System Incorrect Purge Flow',
    S.evap,
    'low',
    DRIVE.ok,
    'The computer did not see the expected change when it opened the purge valve to draw vapour into the engine.',
    ['Faulty purge valve (stuck open or shut)', 'Split or blocked purge hose', 'Blocked charcoal canister', 'Faulty EVAP pressure sensor'],
    ['Command the purge valve in live data and listen for clicking', 'Check purge hoses', 'Check the valve holds vacuum when closed', 'Replace the purge valve'],
  ),
  d(
    'P0442',
    'Evaporative Emission System Leak Detected (Small Leak)',
    S.evap,
    'low',
    DRIVE.ok,
    'The EVAP system has a small leak, roughly the size of a 1 mm hole.',
    ['Worn fuel cap seal', 'Cracked EVAP hose or loose connection', 'Leaking purge or vent valve', 'Cracked charcoal canister', 'Leaking fuel filler neck'],
    ['Check and replace the fuel cap if the seal is worn', 'Inspect visible EVAP hoses', 'Smoke-test the EVAP system (garage)', 'Replace the leaking part'],
  ),
  evapCircuit('P0443', 'Evaporative Emission System Purge Control Valve Circuit', 'purge valve', 'The purge valve lets stored fuel vapour into the engine.'),
  evapCircuit('P0444', 'Evaporative Emission System Purge Control Valve Circuit Open', 'purge valve', 'The circuit appears to be open (broken wire or failed coil).'),
  evapCircuit('P0445', 'Evaporative Emission System Purge Control Valve Circuit Shorted', 'purge valve', 'The circuit appears to be shorted.'),
  evapCircuit('P0446', 'Evaporative Emission System Vent Control Circuit', 'vent valve', 'The vent valve lets fresh air into the canister and seals the system for leak tests.'),
  evapCircuit('P0447', 'Evaporative Emission System Vent Control Circuit Open', 'vent valve', 'The circuit appears to be open (broken wire or failed coil).'),
  evapCircuit('P0448', 'Evaporative Emission System Vent Control Circuit Shorted', 'vent valve', 'The circuit appears to be shorted.'),
  evapCircuit('P0449', 'Evaporative Emission System Vent Valve/Solenoid Circuit', 'vent valve', 'The vent valve lets fresh air into the canister and seals the system for leak tests.'),
  d(
    'P0450',
    'Evaporative Emission System Pressure Sensor/Switch',
    S.evap,
    'low',
    DRIVE.ok,
    'The engine computer has found a fault with the EVAP pressure sensor, usually mounted on or near the fuel tank.',
    ['Faulty EVAP pressure sensor', 'Damaged wiring or connector', 'Shared 5 V supply fault', 'Engine computer fault (rare)'],
    circuitFixes('EVAP pressure sensor'),
  ),
  d(
    'P0451',
    'Evaporative Emission System Pressure Sensor/Switch Range/Performance',
    S.evap,
    'low',
    DRIVE.ok,
    'The EVAP pressure reading does not change as expected during the leak test.',
    ['Faulty EVAP pressure sensor', 'Blocked vent line', 'Overfilling the fuel tank', 'Wiring fault'],
    ['Stop filling at the first click of the pump', 'Check the vent line and filter', 'Compare the sensor reading with the cap off (should read zero)', 'Replace the sensor'],
  ),
  d(
    'P0452',
    'Evaporative Emission System Pressure Sensor/Switch Low',
    S.evap,
    'low',
    DRIVE.ok,
    'The EVAP pressure sensor signal is lower than expected.',
    lowCircuit('EVAP pressure sensor'),
    circuitFixes('EVAP pressure sensor'),
  ),
  d(
    'P0453',
    'Evaporative Emission System Pressure Sensor/Switch High',
    S.evap,
    'low',
    DRIVE.ok,
    'The EVAP pressure sensor signal is higher than expected.',
    highCircuit('EVAP pressure sensor'),
    circuitFixes('EVAP pressure sensor'),
  ),
  d(
    'P0454',
    'Evaporative Emission System Pressure Sensor/Switch Intermittent',
    S.evap,
    'low',
    DRIVE.ok,
    'The EVAP pressure sensor signal keeps dropping out.',
    ['Loose connector or broken wire', 'Faulty EVAP pressure sensor', 'Corrosion at the connector near the tank'],
    circuitFixes('EVAP pressure sensor'),
  ),
  d(
    'P0455',
    'Evaporative Emission System Leak Detected (Large Leak)',
    S.evap,
    'low',
    'Safe to drive; check the fuel cap first. If you smell fuel, get it checked straight away.',
    'The EVAP system has a large leak or is not holding any vacuum during the test.',
    ['Fuel cap missing, loose or not clicked shut', 'Disconnected or split EVAP hose', 'Purge or vent valve stuck open', 'Cracked charcoal canister', 'Leaking filler neck'],
    ['Check the fuel cap is fitted and tightened until it clicks', 'Inspect EVAP hoses for disconnection', 'Smoke-test the EVAP system (garage)', 'Test the purge and vent valves'],
  ),
  d(
    'P0456',
    'Evaporative Emission System Leak Detected (Very Small Leak)',
    S.evap,
    'low',
    DRIVE.ok,
    'The EVAP system has a very small leak, roughly the size of a 0.5 mm hole.',
    ['Worn fuel cap seal', 'Tiny crack in an EVAP hose or seal', 'Leaking purge or vent valve', 'Leaking canister or filler neck seal'],
    ['Replace the fuel cap if the seal is hard or cracked', 'Smoke-test the EVAP system (garage)', 'Replace the leaking part'],
  ),
  d(
    'P0457',
    'Evaporative Emission System Leak Detected (Fuel Cap Loose/Off)',
    S.evap,
    'low',
    DRIVE.ok,
    'The computer has seen a large EVAP leak straight after refuelling, which usually means the fuel cap was not tightened.',
    ['Fuel cap loose or left off', 'Worn fuel cap seal', 'Wrong fuel cap', 'Leaking filler neck'],
    ['Refit the fuel cap and tighten until it clicks', 'Replace the cap if the seal is worn', 'Clear the code; it may take a few drives to go out on its own'],
  ),
  d(
    'P0460',
    'Fuel Level Sensor "A" Circuit',
    S.fuel,
    'low',
    'Safe to drive, but do not trust the fuel gauge; keep track of mileage between fills.',
    'The engine computer has found a fault in the fuel level sender circuit.',
    ['Worn fuel level sender track', 'Damaged wiring or connector at the tank', 'Instrument cluster fault', 'Stuck float'],
    ['Compare the gauge with live data', 'Check the tank connector', 'Measure the sender resistance', 'Replace the sender (often part of the fuel pump unit)'],
  ),
  d(
    'P0461',
    'Fuel Level Sensor "A" Circuit Range/Performance',
    S.fuel,
    'low',
    'Safe to drive, but do not trust the fuel gauge.',
    'The fuel level reading does not change as expected with fuel use or refuelling.',
    ['Worn or sticking fuel level sender', 'Bent float arm', 'Poor connection', 'Deformed fuel tank'],
    ['Watch the reading change when refuelling', 'Check the connector', 'Replace the sender'],
  ),
  d(
    'P0462',
    'Fuel Level Sensor "A" Circuit Low',
    S.fuel,
    'low',
    'Safe to drive, but do not trust the fuel gauge.',
    'The fuel level sender signal is lower than expected.',
    ['Signal wire shorted to earth', 'Faulty fuel level sender', 'Damaged connector'],
    ['Check wiring at the tank', 'Measure sender resistance', 'Replace the sender'],
  ),
  d(
    'P0463',
    'Fuel Level Sensor "A" Circuit High',
    S.fuel,
    'low',
    'Safe to drive, but do not trust the fuel gauge.',
    'The fuel level sender signal is higher than expected, usually an open circuit.',
    ['Broken wire or unplugged connector', 'Faulty fuel level sender', 'Poor earth'],
    ['Check wiring at the tank', 'Measure sender resistance', 'Replace the sender'],
  ),
  d(
    'P0544',
    'Exhaust Gas Temperature Sensor Circuit (Bank 1 Sensor 1)',
    S.egt,
    'medium',
    'Usually safe to drive; on a diesel, DPF regeneration may be blocked until fixed, so get it checked soon.',
    'The engine computer has found a fault in the first exhaust temperature sensor circuit, usually before the turbo or catalytic converter.',
    ['Failed exhaust temperature sensor (common from heat)', 'Damaged wiring near the exhaust', 'Corroded connector', 'Engine computer fault (rare)'],
    ['Compare all exhaust temperature readings with a cold engine; they should match outside temperature', 'Check wiring and connector', 'Measure sensor resistance', 'Replace the sensor'],
  ),
  d(
    'P2031',
    'Exhaust Gas Temperature Sensor Circuit (Bank 1 Sensor 2)',
    S.egt,
    'medium',
    'Usually safe to drive; on a diesel, DPF regeneration may be blocked until fixed, so get it checked soon.',
    'The engine computer has found a fault in the second exhaust temperature sensor circuit, often just before the DPF.',
    ['Failed exhaust temperature sensor', 'Damaged wiring near the exhaust', 'Corroded connector', 'Engine computer fault (rare)'],
    ['Compare all exhaust temperature readings with a cold engine', 'Check wiring and connector', 'Measure sensor resistance', 'Replace the sensor'],
  ),
  d(
    'P2032',
    'Exhaust Gas Temperature Sensor Circuit Low (Bank 1 Sensor 2)',
    S.egt,
    'medium',
    'Usually safe to drive; DPF regeneration may be blocked, so get it checked soon.',
    'The second exhaust temperature sensor signal is lower than expected.',
    lowCircuit('exhaust temperature sensor'),
    circuitFixes('exhaust temperature sensor'),
  ),
  d(
    'P2033',
    'Exhaust Gas Temperature Sensor Circuit High (Bank 1 Sensor 2)',
    S.egt,
    'medium',
    'Usually safe to drive; DPF regeneration may be blocked, so get it checked soon.',
    'The second exhaust temperature sensor signal is higher than expected, often an open circuit from a failed sensor.',
    highCircuit('exhaust temperature sensor'),
    circuitFixes('exhaust temperature sensor'),
  ),
  d(
    'P2002',
    'Diesel Particulate Filter Efficiency Below Threshold (Bank 1)',
    S.dpf,
    'medium',
    DRIVE.mot,
    'The diesel particulate filter (DPF) does not seem to be trapping soot as it should. The pressure difference across it is too low for the conditions.',
    [
      'Split or disconnected DPF pressure sensor pipe',
      'Faulty DPF differential pressure sensor',
      'Cracked or damaged DPF',
      'DPF removed or hollowed out',
      'Exhaust leak before the DPF',
    ],
    [
      'Inspect the pressure sensor pipes for splits, blockage or swapped connections',
      'Check the differential pressure reading at idle and at higher revs in live data',
      'Check for exhaust leaks before the DPF',
      'Replace the pressure sensor if the readings are wrong',
      'Have the DPF inspected or replaced (specialist)',
    ],
  ),
  d(
    'P2003',
    'Diesel Particulate Filter Efficiency Below Threshold (Bank 2)',
    S.dpf,
    'medium',
    DRIVE.mot,
    'The bank 2 diesel particulate filter does not seem to be trapping soot as it should.',
    ['Split or disconnected DPF pressure pipe', 'Faulty DPF pressure sensor', 'Cracked or damaged DPF', 'Exhaust leak before the DPF'],
    ['Inspect the pressure sensor pipes', 'Check differential pressure in live data', 'Replace the pressure sensor if wrong', 'Have the DPF inspected (specialist)'],
  ),
  d(
    'P2463',
    'Diesel Particulate Filter Restriction - Soot Accumulation (Bank 1)',
    S.dpf,
    'medium',
    'Drive gently; if the car allows it, a 20 to 30 minute steady run at motorway speed may clear it. Do not ignore it, as a fully blocked DPF is costly.',
    'The diesel particulate filter is too full of soot, because regeneration (burning the soot off) has not been completing.',
    [
      'Lots of short trips that never let the DPF regenerate',
      'Faulty DPF pressure sensor or exhaust temperature sensor stopping regeneration',
      'Engine fault making extra soot (leaking injector, sticking EGR, boost leak)',
      'Wrong engine oil (must be low-ash spec for DPF cars)',
      'Other engine codes stored that block regeneration',
    ],
    [
      'Fix any other engine codes first, since they often block regeneration',
      'Check the soot load in live data',
      'Take a 20 to 30 minute steady drive at motorway speed if the load is not too high',
      'Have a forced regeneration done with diagnostic software',
      'Professional DPF clean or replacement if the soot load is too high or the filter is full of ash',
    ],
    {
      vag: 'On TDI engines, short-trip use is the usual cause; a forced regeneration with diagnostic software often clears it.',
      mazda: 'Skyactiv-D engines are sensitive to short trips; repeated failed regenerations can raise the oil level from fuel dilution, so check the dipstick.',
    },
  ),
  d(
    'P2459',
    'Diesel Particulate Filter Regeneration Frequency',
    S.dpf,
    'medium',
    DRIVE.soon,
    'The diesel particulate filter is needing regeneration more often than it should.',
    [
      'Engine making too much soot (leaking injector, sticking EGR, boost leak)',
      'Faulty DPF pressure sensor or blocked sensor pipe',
      'High ash load in an ageing DPF',
      'Lots of short trips',
      'Oil level rising from fuel dilution',
    ],
    [
      'Check for other engine codes and fix those first',
      'Check the DPF pressure sensor pipes and readings',
      'Check the oil level and condition',
      'Check the ash load in live data, where available',
      'Professional DPF clean or replacement if ash is high',
    ],
  ),
  d(
    'P242F',
    'Diesel Particulate Filter Restriction - Ash Accumulation',
    S.dpf,
    'medium',
    DRIVE.soon,
    'The diesel particulate filter has filled with ash, which cannot be burnt off by regeneration. This normally happens at high mileage.',
    ['Normal ash build-up at high mileage', 'Engine burning oil', 'Wrong (high-ash) engine oil used', 'Faulty DPF pressure sensor reading high'],
    [
      'Check the DPF pressure sensor and its pipes first',
      'Check for oil burning',
      'Reset the ash counter only after a DPF clean or replacement',
      'Professional DPF clean or replacement',
    ],
  ),
  d(
    'P244A',
    'Diesel Particulate Filter Differential Pressure Too Low (Bank 1)',
    S.dpf,
    'medium',
    DRIVE.soon,
    'The pressure difference across the DPF is lower than expected for the exhaust flow.',
    ['Split or disconnected pressure sensor pipe', 'Faulty DPF pressure sensor', 'Cracked or damaged DPF', 'Exhaust leak before the DPF'],
    ['Inspect the pressure pipes', 'Compare the sensor reading at idle and higher revs', 'Replace the pressure sensor', 'Have the DPF inspected (specialist)'],
  ),
  d(
    'P244B',
    'Diesel Particulate Filter Differential Pressure Too High (Bank 1)',
    S.dpf,
    'medium',
    'Drive gently and get it checked soon; a blocked DPF reduces power and can damage the turbo.',
    'The pressure difference across the DPF is higher than expected, which means it is blocked with soot or ash.',
    ['Soot build-up from failed regenerations', 'Ash build-up at high mileage', 'Blocked or swapped pressure sensor pipes', 'Faulty DPF pressure sensor'],
    [
      'Check the pressure sensor pipes for blockage or swapped connections',
      'Check soot and ash load in live data',
      'Forced regeneration with diagnostic software if the soot load allows',
      'Professional DPF clean or replacement',
    ],
  ),
  d(
    'P2452',
    'Diesel Particulate Filter Pressure Sensor "A" Circuit',
    S.dpf,
    'medium',
    'Usually drivable, but DPF regeneration may stop; get it checked soon.',
    'The engine computer has found a fault in the DPF differential pressure sensor circuit.',
    ['Faulty DPF pressure sensor', 'Damaged wiring or connector', 'Shared 5 V supply fault', 'Engine computer fault (rare)'],
    circuitFixes('DPF pressure sensor'),
  ),
  d(
    'P2453',
    'Diesel Particulate Filter Pressure Sensor "A" Circuit Range/Performance',
    S.dpf,
    'medium',
    'Usually drivable, but DPF regeneration may stop; get it checked soon.',
    'The DPF pressure sensor reading does not make sense for the engine conditions.',
    ['Split, blocked or swapped sensor pipes', 'Faulty DPF pressure sensor', 'Blocked DPF', 'Water in the sensor pipes'],
    ['Inspect and clear the sensor pipes', 'Key on, engine off: the reading should be close to zero', 'Replace the pressure sensor', 'Check the DPF load'],
  ),
  d(
    'P2454',
    'Diesel Particulate Filter Pressure Sensor "A" Circuit Low',
    S.dpf,
    'medium',
    'Usually drivable, but DPF regeneration may stop; get it checked soon.',
    'The DPF pressure sensor signal is lower than expected.',
    lowCircuit('DPF pressure sensor'),
    circuitFixes('DPF pressure sensor'),
  ),
  d(
    'P2455',
    'Diesel Particulate Filter Pressure Sensor "A" Circuit High',
    S.dpf,
    'medium',
    'Usually drivable, but DPF regeneration may stop; get it checked soon.',
    'The DPF pressure sensor signal is higher than expected.',
    highCircuit('DPF pressure sensor'),
    circuitFixes('DPF pressure sensor'),
  ),
  d(
    'P2458',
    'Diesel Particulate Filter Regeneration Duration',
    S.dpf,
    'medium',
    DRIVE.soon,
    'A DPF regeneration has taken too long or did not finish.',
    ['Regeneration interrupted by short trips', 'Faulty exhaust temperature sensor', 'Faulty DPF pressure sensor', 'Engine making excess soot'],
    ['Check for other engine codes', 'Check exhaust temperature and DPF pressure readings', 'Take a steady motorway drive', 'Forced regeneration with diagnostic software'],
  ),
  d(
    'P203F',
    'Reductant Level Too Low',
    S.scr,
    'medium',
    'Top up the AdBlue soon; when the countdown runs out, the car may not restart.',
    'The AdBlue (diesel exhaust fluid) tank level is too low.',
    ['AdBlue tank nearly empty', 'Faulty level sensor in the AdBlue tank', 'AdBlue frozen in very cold weather', 'Wiring fault'],
    ['Top up with fresh AdBlue (ISO 22241)', 'Clear the warning with a drive or diagnostic tool', 'If the warning stays, check the level sensor (often part of the tank heater unit)'],
  ),
  d(
    'P20E8',
    'Reductant Pressure Too Low',
    S.scr,
    'medium',
    'Get it checked soon; a start-limit countdown may begin.',
    'The AdBlue system cannot build the pressure it needs to dose the exhaust.',
    ['Low AdBlue level', 'Failed AdBlue pump', 'Crystallised or frozen AdBlue line', 'Blocked AdBlue filter', 'Leaking AdBlue line'],
    ['Check the AdBlue level and top up', 'Look for white crystal deposits at lines and the injector', 'Run an AdBlue pump test with diagnostic software', 'Replace the pump or heater unit (often a tank assembly)'],
  ),
  d(
    'P20EE',
    'SCR NOx Catalyst Efficiency Below Threshold (Bank 1)',
    S.scr,
    'medium',
    'Get it checked soon; the car may start a countdown to a no-restart condition.',
    'The NOx sensors show that the AdBlue catalyst (SCR) is not cutting NOx emissions as much as it should.',
    ['Poor-quality or diluted AdBlue', 'Blocked or crystallised AdBlue injector', 'Faulty NOx sensor', 'Worn SCR catalyst', 'Exhaust leak'],
    [
      'Test AdBlue quality with a refractometer (should be about 32.5%)',
      'Inspect the AdBlue injector for crystal build-up',
      'Run an AdBlue dosing quantity test with diagnostic software',
      'Check NOx sensor readings',
      'Replace the faulty part (specialist)',
    ],
  ),
  d(
    'P2200',
    'NOx Sensor Circuit (Bank 1 Sensor 1)',
    S.scr,
    'medium',
    'Usually drivable, but the car may start an AdBlue countdown; get it checked soon.',
    'The engine computer has found a fault in the circuit of the first NOx sensor.',
    ['Failed NOx sensor (the sensor and its control module are often one part)', 'Damaged wiring or connector', 'Blown fuse', 'Network fault to the sensor module'],
    ['Check the fuse and connector', 'Check for network codes', 'Read NOx sensor live data', 'Replace the NOx sensor'],
  ),
  d(
    'P2BAE',
    'NOx Exceedence',
    S.scr,
    'medium',
    'Get it checked soon; the car may start a countdown to a no-restart condition.',
    'The emissions monitor has seen NOx emissions above the legal limit for too long. The full SAE definition adds a reason category, which a garage tool will show.',
    ['AdBlue quality or dosing problem', 'Faulty NOx sensor', 'EGR system fault', 'Worn SCR catalyst', 'Other emissions faults stored at the same time'],
    ['Fix any other stored engine or AdBlue codes first', 'Test AdBlue quality', 'Run AdBlue dosing and EGR tests with diagnostic software', 'Check NOx sensor readings', 'Specialist diagnosis'],
  ),
  d(
    'P2004',
    'Intake Manifold Runner Control Stuck Open (Bank 1)',
    S.fuel,
    'low',
    DRIVE.soon,
    'The intake manifold runner flaps (swirl or tumble flaps), which change air flow at low revs, are stuck open.',
    ['Flaps seized with carbon (common on diesels)', 'Broken flap linkage', 'Faulty flap actuator or vacuum supply', 'Faulty flap position sensor'],
    ['Check the actuator moves when commanded', 'Check the vacuum hose to the actuator', 'Inspect the linkage', 'Clean or replace the intake manifold (professional job)'],
  ),
  d(
    'P2008',
    'Intake Manifold Runner Control Circuit/Open (Bank 1)',
    S.fuel,
    'low',
    DRIVE.soon,
    'The engine computer has found an electrical fault in the intake manifold runner flap control circuit.',
    ['Faulty flap actuator or solenoid', 'Damaged wiring or connector', 'Blown fuse', 'Engine computer fault (rare)'],
    ['Check the connector and wiring', 'Measure actuator resistance', 'Replace the actuator'],
  ),
  d(
    'P2015',
    'Intake Manifold Runner Position Sensor/Switch Circuit Range/Performance (Bank 1)',
    S.fuel,
    'low',
    DRIVE.soon,
    'The intake manifold runner flap position does not match what the computer commanded.',
    ['Worn or broken flap linkage', 'Flaps sticking with carbon', 'Faulty flap position sensor', 'Faulty actuator'],
    ['Check the actuator and linkage move freely', 'Watch flap position in live data', 'Replace the actuator or intake manifold (professional job)'],
    { vag: 'Common on 2.0 TFSI engines from wear of the intake manifold flap linkage; the fix is often a new intake manifold.' },
  ),
];

// ---------------------------------------------------------------------------
// Speed, idle, inputs, oil pressure, voltage, cruise, computer
// ---------------------------------------------------------------------------

function cruiseSignal(code: string, title: string, which: string): DtcEntry {
  return d(
    code,
    title,
    S.cruise,
    'low',
    'Safe to drive; cruise control may not work until fixed.',
    `The engine computer has found a fault with the cruise control ${which} signal from the steering wheel or stalk switch.`,
    ['Faulty cruise control switch or stalk', 'Worn clock spring (steering wheel buttons)', 'Damaged wiring or connector', 'Engine computer fault (rare)'],
    ['Check the switch reading in live data while pressing each button', 'Check the connector behind the switch', 'Check the clock spring if other wheel buttons also fail', 'Replace the switch'],
  );
}

function computer(code: string, title: string, meaning: string): DtcEntry {
  return d(
    code,
    title,
    S.ecu,
    'medium',
    'The engine may run badly or cut out; get it checked soon and do not attempt long trips.',
    meaning,
    [
      'Low or unstable battery voltage, or poor engine computer earths',
      'Interrupted software update or programming',
      'Water damage or corrosion in the computer',
      'Internal engine computer failure',
    ],
    [
      'Check battery voltage and the main earth straps',
      'Clear the code and see if it returns',
      'Check for software updates for the engine computer (dealer or specialist)',
      'Check the computer and its connectors for water ingress',
      'Repair, reprogram or replace the computer (specialist; immobiliser coding may be needed)',
    ],
  );
}

const INPUTS: DtcEntry[] = [
  d(
    'P0500',
    'Vehicle Speed Sensor "A"',
    S.speed,
    'medium',
    'Drive with care; the speedometer, ABS, cruise control and gear changes may be affected.',
    'The engine computer has lost or doubts the vehicle speed signal. On many modern cars this comes from the ABS wheel speed sensors.',
    ['Faulty wheel speed or gearbox speed sensor', 'Damaged wiring or connector', 'ABS module fault', 'Damaged reluctor ring'],
    ['Check for ABS codes as well', 'Compare vehicle speed in live data with the actual speed', 'Check the sensor wiring', 'Replace the faulty sensor'],
  ),
  d(
    'P0501',
    'Vehicle Speed Sensor "A" Range/Performance',
    S.speed,
    'medium',
    'Drive with care; the speedometer and gear changes may be affected.',
    'The vehicle speed signal does not match what the computer expects for engine speed and gear.',
    ['Faulty speed sensor', 'Wrong tyre size fitted', 'Poor connection', 'ABS module fault'],
    ['Check tyre sizes', 'Compare speed in live data with GPS speed', 'Check sensor wiring', 'Replace the sensor'],
  ),
  d(
    'P0502',
    'Vehicle Speed Sensor "A" Circuit Low Input',
    S.speed,
    'medium',
    'Drive with care; the speedometer and gear changes may be affected.',
    'The vehicle speed signal is lower than expected, often reading zero while moving.',
    ['Faulty speed sensor', 'Signal wire open or shorted to earth', 'Damaged connector', 'ABS module fault'],
    circuitFixes('vehicle speed sensor'),
  ),
  d(
    'P0503',
    'Vehicle Speed Sensor "A" Intermittent/Erratic/High',
    S.speed,
    'medium',
    'Drive with care; the speedometer may jump.',
    'The vehicle speed signal is jumping or reading too high.',
    ['Faulty speed sensor', 'Loose connector', 'Electrical interference in the wiring', 'Damaged reluctor ring'],
    circuitFixes('vehicle speed sensor'),
  ),
  d(
    'P0504',
    'Brake Switch "A"/"B" Correlation',
    S.cruise,
    'medium',
    'Check your brake lights work; cruise control may be disabled.',
    'The 2 brake pedal switch signals disagree with each other.',
    ['Faulty or badly adjusted brake light switch', 'Broken switch clip', 'Damaged wiring', 'Blown brake light fuse'],
    ['Check the brake lights come on', 'Watch both switch signals in live data while pressing the pedal', 'Check switch adjustment', 'Replace the brake light switch'],
  ),
  d(
    'P0505',
    'Idle Air Control System',
    S.speed,
    'medium',
    'Drive with care; the engine may stall when stopping.',
    'The idle speed control is not working, so idle speed may be wrong or unstable.',
    ['Dirty throttle body or idle control valve', 'Faulty idle control valve', 'Vacuum leak', 'Wiring fault'],
    ['Clean the throttle body or idle valve', 'Check for vacuum leaks', 'Check wiring', 'Run an idle relearn', 'Replace the valve or throttle body'],
  ),
  d(
    'P0506',
    'Idle Air Control System RPM Lower Than Expected',
    S.speed,
    'low',
    'Drive with care; the engine may stall when stopping.',
    'Idle speed is lower than the computer is aiming for.',
    ['Dirty throttle body or idle valve', 'Blocked air filter or intake', 'Extra load (alternator, power steering, A/C)', 'Faulty idle valve'],
    ['Clean the throttle body', 'Check the air filter', 'Run an idle relearn', 'Replace the throttle body or idle valve'],
  ),
  d(
    'P0507',
    'Idle Air Control System RPM Higher Than Expected',
    S.speed,
    'low',
    DRIVE.ok,
    'Idle speed is higher than the computer is aiming for.',
    ['Vacuum leak', 'Dirty or sticking throttle body', 'Faulty idle valve', 'PCV fault'],
    ['Smoke-test for vacuum leaks', 'Clean the throttle body', 'Run an idle relearn', 'Replace the throttle body or idle valve'],
  ),
  d(
    'P0520',
    'Engine Oil Pressure Sensor/Switch Circuit',
    S.oil,
    'medium',
    'Check the oil level now. If the red oil warning light is on or the engine is noisy, stop and do not drive.',
    'The engine computer has found a fault in the oil pressure sensor or switch circuit. This is usually an electrical fault, but real low oil pressure must be ruled out.',
    ['Faulty oil pressure sensor or switch', 'Damaged wiring or connector', 'Oil leaking into the connector', 'Low oil level or real low pressure'],
    [
      'Check the oil level first',
      'Check the sensor connector and wiring',
      'Have real oil pressure checked with a mechanical gauge',
      'Replace the sensor if the pressure is good',
    ],
  ),
  d(
    'P0521',
    'Engine Oil Pressure Sensor/Switch Range/Performance',
    S.oil,
    'medium',
    'Check the oil level now. If the red oil warning light is on or the engine is noisy, stop and do not drive.',
    'The oil pressure reading does not match what the computer expects for engine speed and temperature.',
    ['Low oil level or wrong oil grade', 'Faulty oil pressure sensor', 'Worn oil pump or engine bearings', 'Blocked oil pickup or filter'],
    [
      'Check the oil level and grade',
      'Change oil and filter if overdue',
      'Have real oil pressure checked with a mechanical gauge',
      'Replace the sensor if the pressure is good; investigate the engine if it is not',
    ],
  ),
  d(
    'P0522',
    'Engine Oil Pressure Sensor/Switch Low Voltage',
    S.oil,
    'medium',
    'Check the oil level now. If the red oil warning light is on or the engine is noisy, stop and do not drive.',
    'The oil pressure sensor signal is lower than expected.',
    lowCircuit('oil pressure sensor'),
    ['Check the oil level first', ...circuitFixes('oil pressure sensor').slice(0, 5)],
  ),
  d(
    'P0523',
    'Engine Oil Pressure Sensor/Switch High Voltage',
    S.oil,
    'medium',
    'Check the oil level now. If the red oil warning light is on or the engine is noisy, stop and do not drive.',
    'The oil pressure sensor signal is higher than expected.',
    highCircuit('oil pressure sensor'),
    ['Check the oil level first', ...circuitFixes('oil pressure sensor').slice(0, 5)],
  ),
  d(
    'P0524',
    'Engine Oil Pressure Too Low',
    S.oil,
    'high',
    'Stop the engine as soon as it is safe and check the oil. Driving with low oil pressure can wreck the engine within minutes.',
    'The engine computer has measured oil pressure below the safe minimum.',
    [
      'Low engine oil level',
      'Wrong oil grade or very old oil',
      'Blocked oil filter or oil pickup',
      'Worn oil pump or engine bearings',
      'Faulty oil pressure sensor (only once real pressure is confirmed good)',
    ],
    [
      'Stop and check the oil level; top up with the correct oil',
      'Do not drive if the oil warning light stays on',
      'Change the oil and filter if overdue',
      'Have oil pressure measured with a mechanical gauge',
      'Engine repair by a professional if the pressure is low',
    ],
  ),
  d(
    'P0530',
    'A/C Refrigerant Pressure Sensor "A" Circuit',
    S.speed,
    'low',
    'Safe to drive; air conditioning may not work.',
    'The engine computer has found a fault in the air conditioning pressure sensor circuit.',
    ['Low refrigerant charge', 'Faulty A/C pressure sensor', 'Damaged wiring or connector', 'Engine computer fault (rare)'],
    ['Check the A/C pressure reading in live data', 'Check the connector', 'Have the A/C system pressure-checked and re-gassed', 'Replace the sensor'],
  ),
  d(
    'P0560',
    'System Voltage',
    S.volt,
    'medium',
    'Drive with care; electrical systems may misbehave and the car may not restart.',
    'The supply voltage to the engine computer is outside its normal range.',
    ['Weak or failing battery', 'Faulty alternator or regulator', 'Loose or corroded battery terminals', 'Poor earth strap', 'Engine computer power supply fault'],
    ['Measure battery voltage: about 12.6 V engine off, 13.8 to 14.7 V running', 'Clean and tighten battery terminals and earths', 'Test the battery and alternator', 'Replace the faulty part'],
  ),
  d(
    'P0561',
    'System Voltage Unstable',
    S.volt,
    'medium',
    'Drive with care; electrical systems may misbehave.',
    'The supply voltage to the engine computer is jumping around.',
    ['Loose battery terminal or earth', 'Failing alternator or regulator', 'Worn alternator belt slipping', 'Failing battery'],
    ['Check battery terminals and earths', 'Check the alternator belt', 'Watch voltage in live data', 'Test the alternator and battery'],
  ),
  d(
    'P0562',
    'System Voltage Low',
    S.volt,
    'medium',
    'The car may not restart and could cut out; get the charging system checked soon.',
    'The supply voltage to the engine computer is too low.',
    ['Failing alternator or regulator', 'Weak battery', 'Loose or corroded battery terminals', 'Slipping alternator belt', 'Poor earth or high-resistance cable'],
    ['Measure battery voltage with the engine running (should be 13.8 to 14.7 V)', 'Check terminals, earths and the alternator belt', 'Test the battery and alternator', 'Replace the faulty part'],
  ),
  d(
    'P0563',
    'System Voltage High',
    S.volt,
    'medium',
    'Get it checked soon; high voltage can damage the battery and electronics.',
    'The supply voltage to the engine computer is too high.',
    ['Faulty alternator voltage regulator', 'Poor regulator sense wire or earth', 'Incorrect jump start or battery charger left connected', 'Wrong battery type registered (cars with smart charging)'],
    ['Measure voltage with the engine running; above about 15 V is too high', 'Check earths', 'Check battery registration on cars with battery monitoring', 'Replace the alternator or regulator'],
  ),
  cruiseSignal('P0564', 'Cruise Control Multi-Function Input "A" Circuit', 'multi-function input'),
  cruiseSignal('P0565', 'Cruise Control On Signal', 'on'),
  cruiseSignal('P0566', 'Cruise Control Off Signal', 'off'),
  cruiseSignal('P0567', 'Cruise Control Resume Signal', 'resume'),
  cruiseSignal('P0568', 'Cruise Control Set Signal', 'set'),
  cruiseSignal('P0569', 'Cruise Control Coast Signal', 'coast'),
  cruiseSignal('P0570', 'Cruise Control Accel Signal', 'accelerate'),
  d(
    'P0571',
    'Brake Switch "A" Circuit',
    S.cruise,
    'medium',
    'Check your brake lights work; cruise control may be disabled.',
    'The engine computer has found a fault in the brake pedal switch circuit.',
    ['Faulty or badly adjusted brake light switch', 'Blown brake light fuse', 'Damaged wiring', 'Broken switch mounting clip'],
    ['Check the brake lights come on', 'Watch the switch in live data while pressing the pedal', 'Check the fuse', 'Replace the brake light switch'],
  ),
  d(
    'P0572',
    'Brake Switch "A" Circuit Low',
    S.cruise,
    'medium',
    'Check your brake lights work; cruise control may be disabled.',
    'The brake switch signal is lower than expected, as if the pedal is never pressed.',
    ['Faulty brake light switch', 'Blown brake light fuse', 'Wire open or shorted to earth', 'Badly adjusted switch'],
    ['Check the brake lights and fuse', 'Watch the switch in live data', 'Check the switch adjustment', 'Replace the switch'],
  ),
  d(
    'P0573',
    'Brake Switch "A" Circuit High',
    S.cruise,
    'medium',
    'Check your brake lights are not stuck on; cruise control may be disabled.',
    'The brake switch signal is higher than expected, as if the pedal is always pressed.',
    ['Faulty or stuck brake light switch', 'Wire shorted to power', 'Badly adjusted switch', 'Broken pedal stop'],
    ['Check whether the brake lights stay on', 'Watch the switch in live data', 'Check the switch adjustment', 'Replace the switch'],
  ),
  computer('P0600', 'Serial Communication Link', 'The engine computer has found a fault in its internal or external data link to another module.'),
  computer('P0601', 'Internal Control Module Memory Check Sum Error', 'The engine computer has found its program memory does not pass its own self-check.'),
  computer('P0602', 'Control Module Programming Error', 'The engine computer is not programmed or its programming is incomplete.'),
  computer('P0603', 'Internal Control Module Keep Alive Memory (KAM) Error', 'The engine computer has lost its learned memory, often after the battery was disconnected or went flat.'),
  computer('P0604', 'Internal Control Module Random Access Memory (RAM) Error', 'The engine computer has found an error in its working memory.'),
  computer('P0605', 'Internal Control Module Read Only Memory (ROM) Error', 'The engine computer has found an error in its stored program memory.'),
  computer('P0606', 'Control Module Processor', 'The engine computer has found a fault with its own processor.'),
  computer('P0607', 'Control Module Performance', 'The engine computer has found an internal performance fault.'),
  d(
    'P0641',
    'Sensor Reference Voltage "A" Circuit/Open',
    S.ecu,
    'medium',
    DRIVE.limp,
    'The 5 V supply that the engine computer sends to a group of sensors is out of range. Several sensor codes often appear at the same time.',
    ['A shorted sensor pulling the shared 5 V supply down', 'Chafed wiring shorting the 5 V supply', 'Water in a sensor connector', 'Engine computer fault (rare)'],
    [
      'Note which other sensor codes are stored; they share this supply',
      'Unplug those sensors one at a time and see if the 5 V supply recovers',
      'Inspect the wiring for chafing',
      'Replace the sensor that drags the supply down',
    ],
  ),
  d(
    'P0651',
    'Sensor Reference Voltage "B" Circuit/Open',
    S.ecu,
    'medium',
    DRIVE.limp,
    'The second 5 V supply that the engine computer sends to a group of sensors is out of range.',
    ['A shorted sensor pulling the shared 5 V supply down', 'Chafed wiring', 'Water in a sensor connector', 'Engine computer fault (rare)'],
    [
      'Note which other sensor codes are stored',
      'Unplug those sensors one at a time and see if the supply recovers',
      'Inspect wiring for chafing',
      'Replace the sensor that drags the supply down',
    ],
  ),
  d(
    'P0650',
    'Malfunction Indicator Lamp (MIL) Control Circuit',
    S.ecu,
    'low',
    'Safe to drive, but the engine warning light may not warn you of new faults, so scan for codes regularly.',
    'The engine computer has found a fault in the circuit that lights the engine warning light.',
    ['Instrument cluster fault', 'Wiring fault to the warning light', 'Bulb failure (older cars)', 'Engine computer fault (rare)'],
    ['Check the light comes on at key-on', 'Check instrument cluster codes', 'Check wiring'],
  ),
];

// ---------------------------------------------------------------------------
// Transmission
// ---------------------------------------------------------------------------

type SolKind = 'gen' | 'off' | 'on' | 'elec' | 'int';

function solenoid(code: string, base: string, kind: SolKind, part: string): DtcEntry {
  const suffix: Record<SolKind, string> = {
    gen: '',
    off: ' Performance/Stuck Off',
    on: ' Stuck On',
    elec: ' Electrical',
    int: ' Intermittent',
  };
  const mean: Record<SolKind, string> = {
    gen: `The gearbox computer has found a fault with the ${part}.`,
    off: `The ${part} is not having the expected effect, as if it is stuck off or not working well.`,
    on: `The ${part} appears to be stuck on.`,
    elec: `The gearbox computer has found an electrical fault in the ${part} circuit.`,
    int: `The ${part} circuit keeps dropping out.`,
  };
  const causes =
    kind === 'elec' || kind === 'int'
      ? [
          'Damaged wiring or connector at the gearbox (oil inside the connector is common)',
          `${part[0].toUpperCase()}${part.slice(1)} coil open or shorted`,
          'Internal gearbox harness fault',
          'Gearbox control module fault (rare)',
        ]
      : [
          'Low, old or wrong-spec transmission fluid',
          `Sticking ${part} from debris`,
          'Valve body wear',
          'Internal mechanical wear (clutch packs or bands)',
          'Wiring fault (less likely for a performance code)',
        ];
  return d(
    code,
    `${base}${suffix[kind]}`,
    S.trans,
    'medium',
    'Drive gently and get it checked soon; harsh or missing gear changes can cause more wear. Expect limp mode.',
    `${mean[kind]} Automatic gearboxes use solenoids to control oil pressure for gear changes.`,
    causes,
    [
      'Check transmission fluid level and condition (the correct method for this gearbox often needs a specialist)',
      'Read all gearbox codes and freeze-frame data',
      'Check the wiring and connector at the gearbox for oil, corrosion or damage',
      'Measure the solenoid resistance against spec',
      'Fluid and filter service if the fluid is old or burnt',
      'Solenoid or valve body replacement by a gearbox specialist',
    ],
  );
}

function ratio(code: string, gear: number | null): DtcEntry {
  const title = gear === null ? 'Incorrect Gear Ratio' : `Gear ${gear} Incorrect Ratio`;
  const which = gear === null ? 'a gear' : `gear ${gear}`;
  return d(
    code,
    title,
    S.trans,
    'high',
    'Limit driving and get it checked soon; a slipping gearbox wears quickly and repair costs rise fast.',
    `The gearbox input and output speeds do not match the ratio expected in ${which}, which usually means the gearbox is slipping.`,
    [
      'Low or burnt transmission fluid',
      'Worn clutch packs or bands inside the gearbox',
      'Faulty shift or pressure control solenoid',
      'Faulty input or output speed sensor',
      'Valve body fault',
    ],
    [
      'Check transmission fluid level and condition',
      'Check speed sensor readings in live data',
      'Check for solenoid codes',
      'Fluid service if the fluid is old',
      'Gearbox specialist diagnosis and repair',
    ],
  );
}

function transSensor(code: string, title: string, sensor: string, kind: 'circuit' | 'range' | 'none' | 'low' | 'high'): DtcEntry {
  const meaning: Record<typeof kind, string> = {
    circuit: `The gearbox computer has found a fault in the ${sensor} circuit.`,
    range: `The ${sensor} reading does not make sense for the conditions.`,
    none: `There is no signal from the ${sensor}.`,
    low: `The ${sensor} signal is lower than expected.`,
    high: `The ${sensor} signal is higher than expected.`,
  };
  return d(
    code,
    title,
    S.trans,
    'medium',
    'Drive gently and get it checked soon; gear changes may be harsh or the gearbox may lock in one gear.',
    meaning[kind],
    [
      `Faulty ${sensor}`,
      'Damaged wiring or connector (oil in the connector is common)',
      kind === 'range' ? 'Low or contaminated transmission fluid' : 'Internal gearbox harness fault',
      'Gearbox control module fault (rare)',
    ],
    [
      'Check transmission fluid level and condition',
      `Check the ${sensor} reading in live data`,
      'Check the wiring and connector at the gearbox',
      `Replace the ${sensor} (some are inside the gearbox; specialist job)`,
    ],
  );
}

const TRANSMISSION: DtcEntry[] = [
  d(
    'P0700',
    'Transmission Control System (MIL Request)',
    S.trans,
    'medium',
    'Drive gently and get it checked soon; the gearbox may be in limp mode.',
    'The gearbox computer has stored its own fault code and asked the engine computer to switch on the warning light. The detailed code is in the gearbox computer.',
    ['Any gearbox fault: read the gearbox computer for the detailed code', 'Low or old transmission fluid', 'Solenoid or speed sensor fault', 'Wiring fault at the gearbox'],
    [
      'Read codes from the gearbox computer with a tool that can access it',
      'Check transmission fluid level and condition',
      'Follow the detailed gearbox code',
    ],
  ),
  transSensor('P0705', 'Transmission Range Sensor "A" Circuit (PRNDL Input)', 'gear selector position sensor', 'circuit'),
  transSensor('P0706', 'Transmission Range Sensor "A" Circuit Range/Performance', 'gear selector position sensor', 'range'),
  transSensor('P0710', 'Transmission Fluid Temperature Sensor "A" Circuit', 'transmission fluid temperature sensor', 'circuit'),
  transSensor('P0711', 'Transmission Fluid Temperature Sensor "A" Circuit Range/Performance', 'transmission fluid temperature sensor', 'range'),
  transSensor('P0712', 'Transmission Fluid Temperature Sensor "A" Circuit Low', 'transmission fluid temperature sensor', 'low'),
  transSensor('P0713', 'Transmission Fluid Temperature Sensor "A" Circuit High', 'transmission fluid temperature sensor', 'high'),
  transSensor('P0715', 'Input/Turbine Speed Sensor "A" Circuit', 'input speed sensor', 'circuit'),
  transSensor('P0716', 'Input/Turbine Speed Sensor "A" Circuit Range/Performance', 'input speed sensor', 'range'),
  transSensor('P0717', 'Input/Turbine Speed Sensor "A" Circuit No Signal', 'input speed sensor', 'none'),
  transSensor('P0720', 'Output Speed Sensor Circuit', 'output speed sensor', 'circuit'),
  transSensor('P0721', 'Output Speed Sensor Circuit Range/Performance', 'output speed sensor', 'range'),
  transSensor('P0722', 'Output Speed Sensor Circuit No Signal', 'output speed sensor', 'none'),
  ratio('P0730', null),
  ratio('P0731', 1),
  ratio('P0732', 2),
  ratio('P0733', 3),
  ratio('P0734', 4),
  ratio('P0735', 5),
  solenoid('P0740', 'Torque Converter Clutch Solenoid Circuit/Open', 'gen', 'torque converter clutch solenoid'),
  solenoid('P0741', 'Torque Converter Clutch Solenoid Circuit', 'off', 'torque converter clutch solenoid'),
  solenoid('P0742', 'Torque Converter Clutch Solenoid Circuit', 'on', 'torque converter clutch solenoid'),
  solenoid('P0743', 'Torque Converter Clutch Solenoid Circuit', 'elec', 'torque converter clutch solenoid'),
  solenoid('P0744', 'Torque Converter Clutch Solenoid Circuit', 'int', 'torque converter clutch solenoid'),
  solenoid('P0745', 'Pressure Control Solenoid "A"', 'gen', 'pressure control solenoid A'),
  solenoid('P0746', 'Pressure Control Solenoid "A"', 'off', 'pressure control solenoid A'),
  solenoid('P0747', 'Pressure Control Solenoid "A"', 'on', 'pressure control solenoid A'),
  solenoid('P0748', 'Pressure Control Solenoid "A"', 'elec', 'pressure control solenoid A'),
  solenoid('P0750', 'Shift Solenoid "A"', 'gen', 'shift solenoid A'),
  solenoid('P0751', 'Shift Solenoid "A"', 'off', 'shift solenoid A'),
  solenoid('P0752', 'Shift Solenoid "A"', 'on', 'shift solenoid A'),
  solenoid('P0753', 'Shift Solenoid "A"', 'elec', 'shift solenoid A'),
  solenoid('P0755', 'Shift Solenoid "B"', 'gen', 'shift solenoid B'),
  solenoid('P0756', 'Shift Solenoid "B"', 'off', 'shift solenoid B'),
  solenoid('P0757', 'Shift Solenoid "B"', 'on', 'shift solenoid B'),
  solenoid('P0758', 'Shift Solenoid "B"', 'elec', 'shift solenoid B'),
  d(
    'P0868',
    'Transmission Fluid Pressure Low',
    S.trans,
    'high',
    'Limit driving and get it checked soon; low fluid pressure lets clutches slip and burn.',
    'The gearbox oil pressure is lower than it should be.',
    ['Low transmission fluid from a leak', 'Blocked transmission filter', 'Worn transmission oil pump', 'Faulty pressure control solenoid or sensor'],
    ['Check fluid level and look for leaks', 'Check the fluid condition', 'Fluid and filter service', 'Gearbox specialist diagnosis'],
  ),
  d(
    'P0894',
    'Transmission Component Slipping',
    S.trans,
    'high',
    'Limit driving and get it checked soon; a slipping gearbox wears quickly.',
    'The gearbox computer has detected slipping inside the gearbox.',
    ['Low or burnt transmission fluid', 'Worn clutch packs or bands', 'Faulty solenoid or valve body', 'Torque converter fault'],
    ['Check fluid level and condition', 'Check for other gearbox codes', 'Fluid service if old', 'Gearbox specialist diagnosis and repair'],
  ),
  d(
    'P0897',
    'Transmission Fluid Deteriorated',
    S.trans,
    'medium',
    DRIVE.soon,
    'The gearbox computer has estimated that the transmission fluid is worn out, usually from age, mileage and heat.',
    ['Fluid past its service interval', 'Gearbox running hot (towing, heavy traffic)', 'Wrong fluid used'],
    ['Change the transmission fluid and filter with the correct spec', 'Reset the fluid age counter with a diagnostic tool where required', 'Check for overheating causes'],
  ),
];

// ---------------------------------------------------------------------------
// Hybrid
// ---------------------------------------------------------------------------

const HYBRID: DtcEntry[] = [
  d(
    'P0A80',
    'Replace Hybrid Battery Pack',
    S.hybrid,
    'medium',
    'Usually drivable, but power and economy will drop and the car may stop working; book in with a hybrid specialist soon.',
    'The hybrid control system has found that one or more blocks of cells in the high-voltage battery are weaker than the rest.',
    ['Ageing hybrid battery cells', 'Blocked hybrid battery cooling fan or filter causing overheating', 'Corroded bus bars between battery modules', 'Faulty battery sensor wiring'],
    [
      'Clean the hybrid battery cooling air intake and fan (often under or beside a rear seat)',
      'Read the block voltages with a hybrid-capable scanner',
      'Have the battery tested by a hybrid specialist',
      'Recondition or replace the battery pack (high-voltage work: professional only)',
    ],
  ),
];

// ---------------------------------------------------------------------------
// Network (U codes)
// ---------------------------------------------------------------------------

function lostComm(code: string, title: string, module: string, effect: string, severity: Severity, drive: string): DtcEntry {
  return d(
    code,
    title,
    S.net,
    severity,
    drive,
    `A module on the car network has stopped hearing from the ${module}. ${effect}`,
    [
      'Low or unstable battery voltage (very common after a flat battery or jump start)',
      `Blown fuse or failed power supply or earth to the ${module}`,
      'Damaged network wiring or connector (often water ingress)',
      `Failed ${module}`,
      'Another faulty module disturbing the network',
    ],
    [
      'Check battery voltage and charge the battery if low; then clear codes',
      `Check the fuses for the ${module}`,
      `Check whether a scan tool can talk to the ${module} at all`,
      'Inspect connectors and wiring for water or corrosion',
      `Repair wiring, or replace and code the ${module} (professional job)`,
    ],
  );
}

function invalidData(code: string, title: string, module: string, effect: string): DtcEntry {
  return d(
    code,
    title,
    S.net,
    'medium',
    'Drive with care and get it checked; some functions may be limited.',
    `A module on the car network is receiving data from the ${module} that does not make sense. ${effect}`,
    [
      `A fault code stored in the ${module} itself, which makes it send invalid data`,
      'Low battery voltage',
      'Software mismatch after a module replacement or update',
      'Network wiring fault',
    ],
    [
      `Read codes from the ${module} and fix those first`,
      'Check battery voltage',
      'Check for software updates (dealer or specialist)',
      'Inspect network wiring',
    ],
  );
}

const NETWORK: DtcEntry[] = [
  d(
    'U0001',
    'High Speed CAN Communication Bus',
    S.net,
    'high',
    'The car may run badly, go into limp mode or not start; get it checked before relying on it.',
    'The engine and other main modules have found a fault on the high-speed CAN network that links them.',
    ['Low battery voltage', 'Damaged or shorted CAN wiring', 'Water in a connector', 'A faulty module pulling the bus down', 'Aftermarket device plugged into the diagnostic port or tapped into the wiring'],
    [
      'Check and charge the battery; clear codes',
      'Unplug any aftermarket devices on the diagnostic port or wiring',
      'Measure resistance between the CAN high and CAN low pins at the diagnostic port with the battery disconnected (about 60 ohms is normal)',
      'Unplug modules one at a time to find one that pulls the bus down',
      'Repair wiring (professional job)',
    ],
  ),
  d(
    'U0002',
    'High Speed CAN Communication Bus (Performance)',
    S.net,
    'medium',
    'Drive with care and get it checked soon.',
    'Messages on the high-speed CAN network are corrupted or missing more often than allowed.',
    ['Low or unstable battery voltage', 'Loose or corroded network connector', 'Damaged CAN wiring', 'Faulty module', 'Aftermarket device on the network'],
    ['Check battery voltage', 'Unplug aftermarket devices', 'Check network connectors', 'Professional network diagnosis'],
  ),
  d(
    'U0073',
    'Control Module Communication Bus "A" Off',
    S.net,
    'high',
    'The car may run badly or not start; get it checked before relying on it.',
    'A module has switched off its connection to network bus A because of repeated errors.',
    ['Shorted CAN wiring', 'A faulty module pulling the bus down', 'Low battery voltage', 'Water in a connector'],
    ['Check battery voltage', 'Measure CAN resistance at the diagnostic port (about 60 ohms with battery disconnected)', 'Unplug modules one at a time to find the fault', 'Repair wiring (professional job)'],
  ),
  d(
    'U0074',
    'Control Module Communication Bus "B" Off',
    S.net,
    'medium',
    'Drive with care and get it checked soon.',
    'A module has switched off its connection to network bus B because of repeated errors.',
    ['Shorted network wiring', 'A faulty module on that bus', 'Low battery voltage', 'Water in a connector'],
    ['Check battery voltage', 'Check network connectors', 'Unplug modules one at a time', 'Professional network diagnosis'],
  ),
  lostComm('U0100', 'Lost Communication With ECM/PCM "A"', 'engine computer', 'The engine may cut out, not start, or run in limp mode.', 'high', 'The engine may cut out or not start; do not rely on the car until it is checked.'),
  lostComm('U0101', 'Lost Communication With TCM', 'gearbox computer', 'The gearbox may go into limp mode.', 'medium', 'Drive gently and get it checked soon; the gearbox may lock in one gear.'),
  lostComm('U0102', 'Lost Communication With Transfer Case Control Module', 'transfer case module', 'Four-wheel drive may not engage.', 'medium', 'Drive with care; four-wheel drive may not work.'),
  lostComm('U0121', 'Lost Communication With Anti-Lock Brake System (ABS) Control Module', 'ABS module', 'ABS, stability control and the speed signal may not work. Normal braking still works.', 'medium', 'Normal brakes still work, but ABS and stability control may not; drive with extra care and get it checked soon.'),
  lostComm('U0131', 'Lost Communication With Power Steering Control Module', 'power steering module', 'Power assistance may be lost, making steering heavy.', 'high', 'Steering may become heavy; drive with care to a garage and do not drive if the steering is very heavy.'),
  lostComm('U0140', 'Lost Communication With Body Control Module', 'body control module', 'Lights, locks, wipers and other body functions may misbehave.', 'medium', 'Check that lights and wipers work before driving; get it checked soon.'),
  lostComm('U0151', 'Lost Communication With Restraints Control Module', 'airbag module', 'The airbag warning light will be on and airbags may not deploy in a crash.', 'high', 'The car drives normally, but airbags may not deploy in a crash; get it checked promptly.'),
  lostComm('U0155', 'Lost Communication With Instrument Panel Cluster (IPC) Control Module', 'instrument cluster', 'Gauges and warning lights may not work.', 'medium', 'Drive with care, as warning lights and gauges may not work; get it checked soon.'),
  lostComm('U0164', 'Lost Communication With HVAC Control Module', 'heating and air conditioning module', 'Heating, demisting and air conditioning may not work.', 'low', 'Safe to drive if you can keep the windscreen clear.'),
  lostComm('U0184', 'Lost Communication With Radio', 'radio or infotainment unit', 'The radio and linked functions may not work.', 'low', DRIVE.ok),
  invalidData('U0401', 'Invalid Data Received From ECM/PCM "A"', 'engine computer', 'Other modules may limit functions such as cruise control or stability control.'),
  invalidData('U0402', 'Invalid Data Received From TCM', 'gearbox computer', 'Gear display and some engine functions may be affected.'),
  invalidData('U0415', 'Invalid Data Received From Anti-Lock Brake System (ABS) Control Module', 'ABS module', 'Often caused by a wheel speed sensor fault stored in the ABS module.'),
];

// ---------------------------------------------------------------------------
// Chassis and body (generic SAE codes)
// ---------------------------------------------------------------------------

function wheelSpeed(code: string, title: string, wheel: string): DtcEntry {
  return d(
    code,
    title,
    S.abs,
    'medium',
    'Normal brakes still work, but ABS and stability control may be off; drive with extra care and get it checked soon.',
    `The ABS module has found a fault in the ${wheel} wheel speed sensor circuit.`,
    [
      `Failed ${wheel} wheel speed sensor`,
      'Damaged sensor wiring (often near the suspension)',
      'Dirty sensor tip or rusty, cracked reluctor ring',
      'Worn wheel bearing (on bearings with a built-in magnetic ring)',
      'ABS module fault (rare)',
    ],
    [
      'Compare all 4 wheel speeds in live data on a slow drive',
      'Inspect and clean the sensor and wiring',
      'Check the reluctor ring and wheel bearing',
      'Replace the sensor',
    ],
  );
}

function airbag(code: string, title: string, seat: string): DtcEntry {
  return d(
    code,
    title,
    S.srs,
    'high',
    'The car drives normally, but airbags may not deploy in a crash; get it checked promptly.',
    `The airbag module has found a fault in the ${seat} front airbag deployment circuit.`,
    [
      'Worn clock spring in the steering column (driver airbag)',
      'Loose connector under the seat or behind the airbag',
      'Damaged wiring',
      'Faulty airbag unit',
      'Airbag module fault',
    ],
    [
      'Do not probe airbag circuits with a multimeter or test lamp',
      'Read the airbag module codes with a suitable scan tool',
      'Professional diagnosis: clock spring, connectors and airbag unit checks (airbag work is for trained technicians only)',
    ],
  );
}

const CHASSIS_BODY: DtcEntry[] = [
  wheelSpeed('C0035', 'Left Front Wheel Speed Sensor Circuit', 'left front'),
  wheelSpeed('C0040', 'Right Front Wheel Speed Sensor Circuit', 'right front'),
  wheelSpeed('C0045', 'Left Rear Wheel Speed Sensor Circuit', 'left rear'),
  wheelSpeed('C0050', 'Right Rear Wheel Speed Sensor Circuit', 'right rear'),
  airbag('B0001', 'Driver Frontal Stage 1 Deployment Control', 'driver'),
  airbag('B0002', 'Driver Frontal Stage 2 Deployment Control', 'driver'),
  airbag('B0010', 'Passenger Frontal Stage 1 Deployment Control', 'passenger'),
];

// ---------------------------------------------------------------------------
// Library and functions
// ---------------------------------------------------------------------------

export const DTC_LIBRARY: DtcEntry[] = [
  ...CAM_TIMING,
  ...O2_SENSORS,
  ...FUEL_AIR,
  ...TURBO,
  ...IGNITION,
  ...EMISSIONS,
  ...INPUTS,
  ...TRANSMISSION,
  ...HYBRID,
  ...NETWORK,
  ...CHASSIS_BODY,
].sort((a, b) => a.code.localeCompare(b.code));

const BY_CODE: Map<string, DtcEntry> = new Map(DTC_LIBRARY.map((e) => [e.code, e]));

const CODE_RE = /^[PCBU][0-3][0-9A-F]{3}$/;

/** Normalise user input to a 5-character code; accepts extras like 'p0171', 'P0171-00' or 'P242F00'. */
function normaliseCode(input: string): string | null {
  const raw = input.trim().toUpperCase().replace(/[\s-]/g, '');
  const five = raw.length === 7 && /^[PCBU][0-3][0-9A-F]{5}$/.test(raw) ? raw.slice(0, 5) : raw;
  return CODE_RE.test(five) ? five : null;
}

export function lookupDtc(code: string): DtcEntry | undefined {
  const c = normaliseCode(code);
  return c ? BY_CODE.get(c) : undefined;
}

/** True when `word` starts a word in `text` (so 'lean' does not match 'clean'). */
function hasWord(text: string, word: string): boolean {
  const escaped = word.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
  return new RegExp(`(^|[^a-z0-9])${escaped}`).test(text);
}

export function searchDtc(query: string, limit = 30): DtcEntry[] {
  const q = query.trim().toUpperCase();
  if (!q) return [];

  const exact = normaliseCode(q);
  const isPrefix = /^[PCBU][0-9A-F]{0,4}$/.test(q);
  const isDigits = /^[0-9A-F]{3,4}$/.test(q) && /\d/.test(q);
  const words = q
    .toLowerCase()
    .split(/[^a-z0-9/]+/)
    .filter((w) => w.length > 1);

  const scored: { e: DtcEntry; score: number }[] = [];
  for (const e of DTC_LIBRARY) {
    let score = 0;
    if (exact && e.code === exact) score = 100;
    else if (isPrefix && e.code.startsWith(q)) score = 80;
    else if (isDigits && e.code.slice(1).startsWith(q)) score = 70;
    else if (words.length > 0) {
      const title = e.title.toLowerCase();
      const system = e.system.toLowerCase();
      const other = `${system} ${e.meaning} ${e.causes.join(' ')}`.toLowerCase();
      const inTitle = words.every((w) => hasWord(title, w));
      const inAny = words.every((w) => hasWord(title, w) || hasWord(other, w));
      if (inTitle) score = 60;
      else if (inAny) score = words.some((w) => hasWord(system, w)) ? 50 : 40;
    }
    if (score > 0) scored.push({ e, score });
  }
  scored.sort((a, b) => b.score - a.score || a.e.code.localeCompare(b.e.code));
  return scored.slice(0, Math.max(0, limit)).map((s) => s.e);
}

export interface CodeAnatomy {
  system: string;
  scope: 'Generic (SAE)' | 'Manufacturer-specific';
  area: string;
}

const LETTER: Record<string, string> = { P: 'Powertrain', C: 'Chassis', B: 'Body', U: 'Network' };

const P_AREA: Record<string, string> = {
  '0': 'Fuel and air metering, and auxiliary emission controls',
  '1': 'Fuel and air metering',
  '2': 'Fuel and air metering (injector circuit)',
  '3': 'Ignition system and misfire',
  '4': 'Auxiliary emission controls',
  '5': 'Vehicle speed, idle control and auxiliary inputs',
  '6': 'Computer and output circuits',
  '7': 'Transmission',
  '8': 'Transmission',
  '9': 'Transmission',
  A: 'Hybrid propulsion',
  B: 'Hybrid propulsion',
  C: 'Hybrid propulsion',
};

const U_AREA: Record<string, string> = {
  '0': 'Network electrical (the data bus itself)',
  '1': 'Lost communication with a module',
  '2': 'Lost communication with a module',
  '3': 'Software or calibration mismatch',
  '4': 'Invalid data received from a module',
};

export function codeAnatomy(code: string): CodeAnatomy | null {
  const c = normaliseCode(code);
  if (!c) return null;
  const letter = c[0];
  const d2 = c[1];
  const d3 = c[2];

  let generic: boolean;
  if (letter === 'P') {
    if (d2 === '0' || d2 === '2') generic = true;
    else if (d2 === '1') generic = false;
    else generic = Number(d3) >= 4; // P30-P33 manufacturer, P34-P39 generic (P3A-P3F treated as manufacturer)
  } else {
    // C, B and U codes: 0 and 3 are SAE-controlled, 1 and 2 are manufacturer-controlled.
    generic = d2 === '0' || d2 === '3';
  }

  let area: string;
  if (letter === 'P') area = P_AREA[d3] ?? 'Reserved or not assigned';
  else if (letter === 'U') area = (generic && U_AREA[d3]) || 'Network communication';
  else if (letter === 'C') area = 'Chassis systems (brakes, ABS, steering, suspension)';
  else area = 'Body systems (airbags, climate, lighting, comfort)';

  return { system: LETTER[letter], scope: generic ? 'Generic (SAE)' : 'Manufacturer-specific', area };
}

const ADVICE: Record<string, { causes: string[]; fixes: string[] }> = {
  fuel: {
    causes: [
      'Vacuum or intake air leak',
      'Dirty or faulty air flow, pressure or temperature sensor',
      'Fuel supply problem (filter, pump, pressure regulator)',
      'Damaged wiring or corroded connector at the sensor named in the code',
      'Engine computer fault (rare)',
    ],
    fixes: [
      'Read the code description with a scan tool that shows manufacturer text',
      'Check live data for the sensor or system named in the code',
      'Inspect connectors and wiring for that part',
      'Check fuel trims and smoke-test the intake for leaks',
      'Replace the faulty part once confirmed',
    ],
  },
  injector: {
    causes: [
      'Damaged wiring or loose injector connector',
      'Faulty fuel injector',
      'Blown injector fuse or relay',
      'Engine computer injector driver fault',
    ],
    fixes: [
      'Inspect injector connectors and wiring',
      'Measure injector resistance against the others',
      'Check the injector supply fuse',
      'Replace the faulty injector (diesel injectors may need coding)',
    ],
  },
  ignition: {
    causes: [
      'Worn or fouled spark plugs',
      'Failing ignition coils',
      'Faulty injector',
      'Vacuum leak',
      'Crankshaft or camshaft sensor fault',
      'Low compression',
    ],
    fixes: [
      'Read misfire counters in live data',
      'Check plugs and coils; swap coils between cylinders to see if the fault moves',
      'Check crank and cam sensor wiring',
      'Check fuel trims for vacuum leaks',
      'Compression test (professional job)',
    ],
  },
  emissions: {
    causes: [
      'EGR valve sticking or clogged',
      'EVAP leak or faulty purge or vent valve (check the fuel cap first)',
      'Ageing catalytic converter or oxygen sensor',
      'On diesels, DPF or AdBlue system fault',
      'Damaged wiring or connector at the part named in the code',
    ],
    fixes: [
      'Check the fuel cap is tight',
      'Fix any misfire or fuelling codes first',
      'Check live data for the emissions part named in the code',
      'Inspect hoses, pipes and wiring',
      'Specialist diagnosis for DPF and AdBlue faults',
    ],
  },
  speed: {
    causes: [
      'Faulty speed, pressure or switch input sensor',
      'Dirty throttle body affecting idle',
      'Vacuum leak',
      'Damaged wiring or connector',
      'Battery or alternator fault (for voltage codes)',
    ],
    fixes: [
      'Check live data for the input named in the code',
      'Check battery and charging voltage',
      'Clean the throttle body and run an idle relearn',
      'Inspect connectors and wiring',
      'Replace the faulty sensor or switch',
    ],
  },
  computer: {
    causes: [
      'Low or unstable battery voltage',
      'Poor engine computer power or earth connection',
      'Faulty output circuit (relay, solenoid or lamp driven by the computer)',
      'Software problem',
      'Internal computer fault',
    ],
    fixes: [
      'Check battery voltage and earth straps',
      'Clear the code and see if it returns',
      'Check the output circuit named in the code',
      'Check for software updates (dealer or specialist)',
      'Repair or replace the computer (specialist)',
    ],
  },
  transmission: {
    causes: [
      'Low, old or wrong transmission fluid',
      'Faulty solenoid or speed sensor',
      'Damaged wiring or oil in the gearbox connector',
      'Internal gearbox wear',
      'Gearbox computer fault',
    ],
    fixes: [
      'Read codes from the gearbox computer',
      'Check fluid level and condition',
      'Inspect the gearbox connector and wiring',
      'Fluid and filter service if overdue',
      'Gearbox specialist diagnosis',
    ],
  },
  hybrid: {
    causes: [
      'Hybrid battery cell weakness or overheating',
      'Blocked hybrid battery cooling fan or filter',
      'Inverter or motor-generator fault',
      'Low 12 V battery',
      'High-voltage wiring or sensor fault',
    ],
    fixes: [
      'Check the 12 V battery',
      'Clean the hybrid battery cooling intake',
      'Read codes with a hybrid-capable scanner',
      'Hybrid specialist diagnosis (high-voltage work: professional only)',
    ],
  },
  chassis: {
    causes: [
      'Faulty wheel speed sensor or damaged sensor wiring',
      'Low brake fluid or worn brake pads (on some systems)',
      'Steering angle sensor needs calibration',
      'Low battery voltage',
      'ABS or chassis module fault',
    ],
    fixes: [
      'Check brake fluid level and battery voltage',
      'Read codes from the ABS or chassis module',
      'Compare wheel speeds in live data',
      'Inspect sensor wiring near the wheels',
      'Calibrate or replace the faulty part',
    ],
  },
  body: {
    causes: [
      'Loose connector (often under a seat or in a door)',
      'Damaged wiring',
      'Faulty switch, sensor or motor',
      'Low battery voltage',
      'Body or airbag module fault',
    ],
    fixes: [
      'Check battery voltage',
      'Read codes from the body or airbag module',
      'Inspect connectors under the seats and in the doors',
      'Airbag faults: professional diagnosis only',
    ],
  },
  network: {
    causes: [
      'Low or unstable battery voltage',
      'Blown fuse or lost power to a module',
      'Damaged network wiring or water in a connector',
      'Faulty module',
      'Aftermarket device on the network',
    ],
    fixes: [
      'Check and charge the battery; clear codes',
      'Check fuses for the module named in the code',
      'Check whether a scan tool can reach each module',
      'Inspect network connectors and wiring',
      'Professional network diagnosis',
    ],
  },
};

export function genericAdvice(code: string): { causes: string[]; fixes: string[] } | null {
  const c = normaliseCode(code);
  if (!c) return null;
  const letter = c[0];
  if (letter === 'U') return ADVICE.network;
  if (letter === 'C') return ADVICE.chassis;
  if (letter === 'B') return ADVICE.body;
  const d3 = c[2];
  if (d3 === '0' || d3 === '1') return ADVICE.fuel;
  if (d3 === '2') return ADVICE.injector;
  if (d3 === '3') return ADVICE.ignition;
  if (d3 === '4') return ADVICE.emissions;
  if (d3 === '5') return ADVICE.speed;
  if (d3 === '6') return ADVICE.computer;
  if (d3 === '7' || d3 === '8' || d3 === '9') return ADVICE.transmission;
  if (d3 === 'A' || d3 === 'B' || d3 === 'C') return ADVICE.hybrid;
  return null;
}
