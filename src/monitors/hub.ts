// Drive monitors hub: which tools work on a car, for the hub page and the
// Car tab row. Tested in __tests__/monitors.test.ts.
// - Knock: only where knock values are known (older VW petrol engines,
//   group 020). Other petrol cars get timing advance only; diesels get none.
// - DPF: diesels only.
// - Trip computer: every car (speed is a standard value).
import { knockSupport } from './knock';

export type DriveTool = 'knock' | 'timing' | 'dpf' | 'trip';

export function driveTools(v: { group: string; fuel: 'Petrol' | 'Diesel' | null } | null | undefined, diesel: boolean): DriveTool[] {
  const isDiesel = diesel || v?.fuel === 'Diesel';
  const knock = knockSupport(v, isDiesel);
  const out: DriveTool[] = [];
  if (knock.kind === 'groups') out.push('knock');
  else if (knock.kind === 'timing-only') out.push('timing');
  if (isDiesel) out.push('dpf');
  out.push('trip');
  return out;
}

const WORD: Record<DriveTool, string> = { knock: 'knock', timing: 'timing', dpf: 'DPF', trip: 'trip' };

// "Knock, trip" on the Leon, "DPF, trip" on a diesel.
export function driveToolsSummary(tools: DriveTool[]): string {
  const s = tools.map((x) => WORD[x]).join(', ');
  return s.charAt(0).toUpperCase() + s.slice(1);
}
