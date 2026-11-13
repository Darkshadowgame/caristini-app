// Several data identifiers in one UDS read (ISO 14229-1 service 22 takes a
// list). The answer is 62 followed by each supported identifier and its data,
// in the order asked; unsupported ones are left out, and NRC 31 means none of
// them is supported. Some modules break that rule (they refuse the whole list
// when one identifier is unknown), so the caller checks each module first.
// An ELM327 sends a request as one CAN frame (7 data bytes): 3 identifiers.
export const MAX_DIDS = 3;

const idAt = (b: number[], i: number) => ((b[i] << 8) | b[i + 1]).toString(16).toUpperCase().padStart(4, '0');

// Splits an answer when each identifier's data length is known from an
// earlier single read. Null when the answer does not fit those lengths
// exactly (a value that changes length, or a module that answers its own way).
export function splitKnown(answer: number[], dids: string[], lens: number[]): Map<string, number[]> | null {
  if (answer[0] !== 0x62) return null;
  const out = new Map<string, number[]>();
  let i = 1;
  let j = 0;
  while (i < answer.length) {
    if (i + 2 > answer.length) return null;
    const id = idAt(answer, i);
    let k = j;
    while (k < dids.length && dids[k] !== id) k++;
    if (k === dids.length) return null;
    const end = i + 2 + lens[k];
    if (end > answer.length) return null;
    out.set(id, answer.slice(i + 2, end));
    i = end;
    j = k + 1;
  }
  return out.size ? out : null;
}

// For a search, where data lengths are not known yet. The answer can be read
// only when exactly one identifier answered: none of the other identifiers
// asked appears anywhere in the rest. Otherwise null, and the caller asks
// them one at a time.
export function soleAnswer(answer: number[], dids: string[]): { did: string; data: number[] } | null {
  if (answer[0] !== 0x62 || answer.length < 3) return null;
  const first = idAt(answer, 1);
  const k = dids.indexOf(first);
  if (k < 0) return null;
  const others = dids.filter((d) => d !== first);
  for (let i = 3; i + 1 < answer.length; i++) if (others.includes(idAt(answer, i))) return null;
  return { did: first, data: answer.slice(3) };
}
