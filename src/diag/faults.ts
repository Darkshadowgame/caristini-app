// One way to count and describe faults, shared by the health check, the Car
// tab, History, Lookup and the fault code page.
import { codeAnatomy, DtcEntry, genericAdvice, lookupDtc } from '../data/dtcLibrary';
import { vagFaultText } from '../data/vagFaults';
import { describeDtc } from '../obd/dtc';
import { isMakerNumbered } from '../obd/uds';

/**
 * The SAE code a VW 5-digit engine fault number stands for (16684 = P0300),
 * when the public VW lists give one (see src/data/vagFaults.ts). Engine
 * range only (16384 to 19999).
 */
export function vagPCode(code: string): string | null {
  const c = String(code).trim();
  if (!/^\d{5}$/.test(c)) return null;
  const n = Number(c);
  if (n < 16384 || n > 19999) return null;
  const m = /^(?:Engine: )?(P[0-3][0-9A-F]{3})(?![0-9A-F])/.exec(vagFaultText(c) ?? '');
  return m ? m[1] : null;
}

/**
 * The key a fault is counted under: the 5-character SAE code where there is
 * one, so the same fault read two ways (P0300 from the engine's standard
 * list, 16684 or P030000 from the engine module) counts once.
 */
export function faultKey(code: string): string {
  const c = String(code).trim().toUpperCase();
  if (/^[PCBU][0-9A-F]{4}([0-9A-F]{2})?$/.test(c)) return c.slice(0, 5);
  return vagPCode(c) ?? c;
}

/**
 * The engine's standard (OBD2) codes that no module fault already stands
 * for. Every module fault counts; these are added to them, each once.
 */
export function extraObdCodes(moduleCodes: string[], obdCodes: string[]): string[] {
  const seen = new Set(moduleCodes.map(faultKey));
  const out: string[] = [];
  for (const c of obdCodes) {
    const k = faultKey(c);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(c);
  }
  return out;
}

/** The fault count of one check: module faults plus the OBD2 codes not already among them. */
export function countFaults(moduleCodes: string[], obdCodes: string[]): number {
  return moduleCodes.length + extraObdCodes(moduleCodes, obdCodes).length;
}

/**
 * True when a module's faults can carry engine and gearbox (P) codes with
 * their standard meaning. No module (Lookup, the engine's standard list)
 * counts as the engine.
 */
export function isPowertrainModule(module?: string | null): boolean {
  return !module || /^(engine|transmission|gearbox)\b/i.test(String(module).trim());
}

export interface FaultMeaning {
  // The code people look up: P0011 (not P0011B5), or the VW or maker number.
  label: string;
  title: string;
  kind: 'sae' | 'vw' | 'maker' | 'invalid';
  scope: 'Generic (SAE)' | 'Manufacturer-specific' | null;
  // A P code from a module outside the engine and gearbox: the maker uses
  // the number for its own fault, so the engine meaning does not apply.
  makerUse: boolean;
  // The SAE code a VW number stands for (16684 = P0300).
  pcode: string | null;
  // Library entry and cause list, only when the code truly maps to them.
  entry: DtcEntry | null;
  advice: { causes: string[]; fixes: string[] } | null;
}

const adviceOf = (entry: DtcEntry | null | undefined) => (entry ? { causes: entry.causes, fixes: entry.fixes } : null);

/** What a fault code means, the same in the fault lists and on the code page. */
export function faultMeaning(code: string, opts: { module?: string | null; brand?: string | null } = {}): FaultMeaning {
  const c = String(code ?? '').trim().toUpperCase();
  const maker = opts.brand || 'Maker';
  const none = { scope: null, makerUse: false, pcode: null, entry: null, advice: null } as const;
  if (/^\d{5}$/.test(c)) {
    const pcode = isPowertrainModule(opts.module) ? vagPCode(c) : null;
    const entry = pcode ? (lookupDtc(pcode) ?? null) : null;
    return {
      ...none,
      label: c,
      kind: 'vw',
      title: sentenceCase(vagFaultText(c) ?? `${opts.brand || 'VW'} fault ${c}`),
      pcode,
      entry,
      advice: entry ? adviceOf(entry) : pcode ? genericAdvice(pcode) : null,
    };
  }
  if (isMakerNumbered(c)) return { ...none, label: c, kind: 'maker', title: `${maker} fault ${c}` };
  const base = /^[PCBU][0-9A-F]{4}[0-9A-F]{2}$/.test(c) ? c.slice(0, 5) : c;
  const anatomy = codeAnatomy(base);
  if (!anatomy) return { ...none, label: base, kind: 'invalid', title: 'Not a valid fault code' };
  if (base[0] === 'P' && !isPowertrainModule(opts.module)) {
    return { ...none, label: base, kind: 'sae', scope: 'Manufacturer-specific', makerUse: true, title: `${maker} fault ${base}` };
  }
  const entry = lookupDtc(base) ?? null;
  const generic = describeDtc(base);
  const title =
    entry?.title ?? (generic.known ? generic.text : anatomy.scope === 'Manufacturer-specific' ? `${maker} fault ${base}` : `${anatomy.scope} ${anatomy.system.toLowerCase()} code`);
  // A maker's own code has no standard area, so no general cause list.
  const advice = entry ? adviceOf(entry) : anatomy.scope === 'Generic (SAE)' ? genericAdvice(base) : null;
  return { ...none, label: base, kind: 'sae', scope: anatomy.scope, title: sentenceCase(title), entry, advice };
}

// Names kept as written inside a sentence.
const PROPER = new Set(['Audi', 'Volkswagen', 'Skoda', 'Cupra', 'Ford', 'Mazda', 'Bosch', 'Haldex', 'Bluetooth']);

/**
 * Fault titles in sentence case, the same on every screen: "Diesel
 * particulate filter efficiency below threshold (bank 1)". Words in capitals
 * (DPF, A/C, "A", G395, B+) and maker names stay as they are.
 */
export function sentenceCase(text: string): string {
  let first = true;
  return text.replace(/[A-Za-z][A-Za-z']*/g, (w) => {
    if (first) {
      first = false;
      return w.charAt(0).toUpperCase() + w.slice(1);
    }
    return /^[A-Z][a-z']+$/.test(w) && !PROPER.has(w) ? w.toLowerCase() : w;
  });
}

/**
 * The title a saved fault shows (History, the Car tab, the health check):
 * in sentence case, and one pattern for faults with no description, "Audi
 * fault 00471", "Audi fault 0000F3", "Audi fault P1741". Saved by older
 * versions as "Audi-specific code" or "Audi fault number 243".
 */
export function faultLabel(f: { code: string; text?: string | null }): string | null {
  const t = f.text?.trim();
  if (!t) return null;
  const c = String(f.code).trim().toUpperCase();
  const label = /^[PCBU][0-9A-F]{4}[0-9A-F]{2}$/.test(c) ? c.slice(0, 5) : c;
  const maker = /^(.+?)-specific code$/.exec(t) ?? /^(.+?) fault number \d+$/.exec(t);
  if (maker) return `${maker[1]} fault ${label}`;
  return sentenceCase(t);
}

// Every list a standard code is in, so a permanent code is never shown only as
// "Stored": "Stored, permanent".
export function obdStates(code: string, obd: { stored: string[]; pending: string[]; permanent: string[] }): string {
  const states = [obd.stored.includes(code) ? 'stored' : null, obd.pending.includes(code) ? 'pending' : null, obd.permanent.includes(code) ? 'permanent' : null].filter(Boolean) as string[];
  const text = states.join(', ');
  return text.charAt(0).toUpperCase() + text.slice(1);
}
