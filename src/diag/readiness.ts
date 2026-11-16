// Readiness monitors (service 01 PID 01): a one-line meaning for each self-test
// and a plain summary. The monitor names come from decodeReadiness in
// src/obd/pids.ts (SAE J1979 bit layout); the meanings are plain descriptions
// of what each named system is, written for drivers.
import type { Monitor } from '../obd/pids';

export const MONITOR_MEANING: Record<string, string> = {
  // Common to petrol and diesel engines.
  Misfire: 'Checks every cylinder fires properly.',
  'Fuel system': 'Checks the engine keeps the fuel mixture right.',
  Components: 'Checks engine sensors and parts for circuit faults.',
  // Petrol (spark ignition).
  Catalyst: 'Checks the catalytic converter still cleans the exhaust.',
  'Heated catalyst': 'Checks the heater that warms the catalyst quickly.',
  'Evaporative system': 'Checks the fuel tank vapour system for leaks.',
  'Secondary air': 'Checks the pump that adds air to the exhaust after a cold start.',
  'A/C refrigerant': 'Checks the air conditioning refrigerant system.',
  'Oxygen sensor': 'Checks the exhaust oxygen sensors react as they should.',
  'Oxygen sensor heater': 'Checks the heaters that warm the oxygen sensors.',
  'EGR system': 'Checks exhaust gas recirculation, and on some cars valve timing.',
  // Diesel (compression ignition).
  'NMHC catalyst': 'Checks the catalyst that burns unburnt fuel in the exhaust.',
  'NOx / SCR': 'Checks the system that cuts nitrogen oxides in the exhaust.',
  'Boost pressure': 'Checks the turbo reaches the boost the engine asks for.',
  'Exhaust gas sensor': 'Checks the exhaust gas sensors.',
  'Particulate filter': 'Checks the diesel particulate filter (DPF).',
  'EGR / VVT': 'Checks exhaust gas recirculation and variable valve timing.',
};

export function monitorMeaning(name: string): string {
  return MONITOR_MEANING[name] ?? 'An emissions self-test the car reports.';
}

export const MONITOR_STATE_LABEL: Record<Monitor['state'], string> = {
  complete: 'Complete',
  incomplete: 'Not yet run',
};

export interface ReadinessSummary {
  total: number;
  complete: number;
  incomplete: string[];
  text: string;
}

export function readinessSummary(monitors: Monitor[]): ReadinessSummary {
  const incomplete = monitors.filter((m) => m.state === 'incomplete').map((m) => m.name);
  const complete = monitors.length - incomplete.length;
  const text = !monitors.length
    ? 'The car did not report its self-tests.'
    : incomplete.length
      ? `${complete} of ${monitors.length} complete. Not yet run: ${incomplete.join(', ')}.`
      : `All ${monitors.length} complete.`;
  return { total: monitors.length, complete, incomplete, text };
}
