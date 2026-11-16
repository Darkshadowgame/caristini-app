// One plain description for any fault code: the generic SAE table first, then
// the VW 5-digit numbers from older modules, then the code library.
import { lookupDtc } from '../data/dtcLibrary';
import { vagFaultText } from '../data/vagFaults';
import { describeDtc } from './dtc';
import { sentenceCase } from '../diag/faults';

export function faultText(code: string): string | undefined {
  const t = /^\d{5}$/.test(code) ? vagFaultText(code) : describeDtc(code).known ? describeDtc(code).text : lookupDtc(code)?.title;
  // Sentence case, as every fault list shows it.
  return t ? sentenceCase(t) : undefined;
}
