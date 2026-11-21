// Ford and Mazda second CAN bus (medium-speed CAN, OBD pins 3 and 11).
// Pure helpers, tested in __tests__/monitors.test.ts.
//
// Which modules sit only on the second bus, by car:
//   Ford Focus Mk3: replica/focus-st-sources.md section 1.3, the rows marked
//     "Reachable on pins 6/14? No": IPC 720, HVAC/EATC 733, ACM (audio) 727,
//     GPSM 701 (all Medium). Modules whose bus is Unconfirmed there (APIM,
//     PAM, doors, RFA, SASM) are not listed.
//   Mazda6 GJ: replica/mazda6-sources.md section 1.3, RBCM 7B7 is "MS",
//     "not reachable on pins 6/14".
// A standard ELM327 has one CAN transceiver on pins 6 and 14 and cannot reach
// these (focus-st-sources 2.2, FS1). Pin16 switches bus with the STN
// command STP 53 (focus-st-sources 2.3, FS16), so only STN adapters (OBDLink
// MX+, EX, MX) are used for it. The vLinker FS is sold with automatic HS/MS
// switching for FORScan, but its commands are not published (2.3,
// "Unconfirmed"), so the text says so.
import type { ModuleDef } from './modules';

export const SECOND_BUS_ONLY: Record<'ford' | 'mazda', string[]> = {
  ford: ['ford-ipc', 'ford-hvac', 'ford-acm', 'ford-gpsm'],
  mazda: ['mazda-rbcm'],
};

export const SECOND_BUS_ADAPTER_TEXT = 'On the second CAN bus. Needs an OBDLink MX+ or vLinker FS; a standard ELM327 cannot reach it.';

export const SECOND_BUS_NOTICE =
  'Some modules on this car sit on a second CAN bus (OBD pins 3 and 11). A standard ELM327 adapter cannot reach them: they need an OBDLink MX+ or vLinker FS. Pin16 switches bus with OBDLink commands; the vLinker FS has not been tested.';

// True when this module is on the second bus only for this make.
export function onSecondBusOnly(def: Pick<ModuleDef, 'id'>, make: string): boolean {
  return (make === 'ford' || make === 'mazda') && SECOND_BUS_ONLY[make].includes(def.id);
}

// The note to show for a module that did not answer: the adapter is the
// reason when the module is second-bus only and the adapter cannot switch.
export function secondBusNote(def: Pick<ModuleDef, 'id'>, make: string, adapterCanSwitch: boolean): string | null {
  return !adapterCanSwitch && onSecondBusOnly(def, make) ? SECOND_BUS_ADAPTER_TEXT : null;
}
