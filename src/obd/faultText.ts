// One plain description for any fault code: the generic SAE table first, then
// the VW 5-digit numbers from older modules, then the code library.
import { lookupDtc } from '../data/dtcLibrary';
import { vagFaultText } from '../data/vagFaults';
import { describeDtc } from './dtc';

export function faultText(code: string): string | undefined {
  if (/^\d{5}$/.test(code)) return vagFaultText(code);
  const d = describeDtc(code);
  return d.known ? d.text : lookupDtc(code)?.title;
}
