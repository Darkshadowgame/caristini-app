// Coding changes Caristini can write, each a bit (or bits) in a module's
// long coding (UDS DID 0600). Every item names its public sources and a
// confidence; see replica/coding-sources.md. An item is only offered when the
// module answers and its coding is exactly the length the source describes.
import { CATALOGUE_ITEMS } from './catalogue';
import { ENRICHED_ITEMS } from './enriched';

export interface CodingItem {
  id: string;
  title: string;
  summary: string;
  category: 'Instrument cluster' | 'Lights' | 'Locking and alarm' | 'Comfort' | 'Mirrors' | 'Wipers' | 'Warnings and chimes' | 'Driving' | 'Infotainment' | 'Parking';
  platforms: string[];
  // Module id from src/obd/modules.ts.
  module: string;
  // Coding length (bytes) the sources describe; when not given, any coding
  // long enough to hold the byte is accepted.
  length?: number;
  byte: number;
  // Bits set together when the item is on (cleared when off).
  bits: number[];
  // A multi-bit field instead: the bits under mask hold on or off.
  field?: { mask: number; on: number; off: number };
  // low: offered only as "Unconfirmed, try it", always through Try mode.
  confidence: 'high' | 'medium' | 'low';
  // Login code the module asks for before this change, when sources give one.
  login?: number;
  note?: string;
  sources: { label: string; url: string }[];
}

const CLUSTER_SOURCES = [
  { label: 'Ross-Tech label for the C7 cluster (vagcode.info, 2012 A7)', url: 'https://vagcode.info/en/components/31efa0ba8917e512d6ff0c1465c23711.html' },
  { label: 'AudiWorld: VCDS coding for A6/A7 C7', url: 'https://www.audiworld.com/forums/a6-c7-platform-discussion-194/vag-com-vcds-coding-2016-fl-a6-a7-2882436/' },
  { label: 'Ross-Tech wiki: A4/A5 (8K/8T) tweaks (MLB sibling)', url: 'https://wiki.ross-tech.com/wiki/index.php/Audi_A4/S4/A5/S5_(8K/8T)_Tweaks' },
];

const C7_DOC = { label: 'Audi C7 VCDS tweaks (community document)', url: 'https://docs.google.com/document/d/1v-dzsYc6OlPT-RGjtRTecjr8Shj85WCZhlQpruSH5XM/mobilebasic' };
const MQB_DALBY = { label: 'Stuart Dalby: Golf Mk7 VCDS coding', url: 'https://www.stuartdalby.co.uk/vwgolfmk7/VCDS' };
const MQB_AUTOINSTRUCT = { label: 'AutoInstruct: MK7 Golf OBDeleven / VCDS tweaks (2017)', url: 'https://www.autoinstruct.com.au/manufacturer/volkswagen/mk7-golf/mk7-golf-obdeleven-vcds-tweaks/' };
const EVO_SWEEP = { label: 'vag-coding.net: Q7 (4M) needle check', url: 'https://www.vag-coding.net/audi/q7-4m/q7-4m-needle-check' };
const EVO_LAP = { label: 'vag-coding.net: A7 (C8) lap timer', url: 'https://www.vag-coding.net/audi/a7-c8/a7-c8-lap-timer' };
const MLB_TWEAKS = { label: 'Ross-Tech wiki: A4/A5 (8K/8T) tweaks (MLB sibling)', url: 'https://wiki.ross-tech.com/wiki/index.php/Audi_A4/S4/A5/S5_(8K/8T)_Tweaks' };

export const CODING_ITEMS: CodingItem[] = [
  // MQB (Golf 7, Octavia III, A3 8V, Leon 5F) and MLB evo: same cluster bits (replica/vag-sources.md section 3).
  {
    id: 'mqb-needle-sweep',
    title: 'Needle sweep',
    summary: 'The dials sweep to the end and back when you switch on.',
    category: 'Instrument cluster',
    platforms: ['MQB', 'MQB evo'],
    module: 'vag-17',
    byte: 1,
    bits: [0],
    confidence: 'high',
    sources: [MQB_DALBY, MQB_AUTOINSTRUCT],
  },
  {
    id: 'mqb-lap-timer',
    title: 'Lap timer',
    summary: 'Adds a lap timer to the driver information display.',
    category: 'Instrument cluster',
    platforms: ['MQB', 'MQB evo'],
    module: 'vag-17',
    byte: 1,
    bits: [3],
    confidence: 'medium',
    sources: [MQB_AUTOINSTRUCT],
  },
  {
    id: 'evo-needle-sweep',
    title: 'Needle sweep',
    summary: 'The dials sweep to the end and back when you switch on.',
    category: 'Instrument cluster',
    platforms: ['MLB evo'],
    module: 'vag-17',
    byte: 1,
    bits: [0],
    confidence: 'medium',
    sources: [EVO_SWEEP],
  },
  {
    id: 'evo-lap-timer',
    title: 'Lap timer',
    summary: 'Adds a lap timer to the driver information display.',
    category: 'Instrument cluster',
    platforms: ['MLB evo'],
    module: 'vag-17',
    byte: 1,
    bits: [3],
    confidence: 'medium',
    sources: [EVO_LAP],
  },
  {
    id: 'c7-needle-sweep',
    title: 'Needle sweep',
    summary: 'The speedo and rev counter needles sweep to the end and back when you switch on.',
    category: 'Instrument cluster',
    platforms: ['MLB'],
    module: 'vag-17',
    length: 11,
    byte: 1,
    bits: [0],
    confidence: 'high',
    note: 'Some clusters ignore it.',
    sources: CLUSTER_SOURCES,
  },
  {
    id: 'c7-lap-timer',
    title: 'Lap timer',
    summary: 'Adds a lap timer to the driver information display, worked with the wiper stalk.',
    category: 'Instrument cluster',
    platforms: ['MLB'],
    module: 'vag-17',
    length: 11,
    byte: 1,
    bits: [3],
    confidence: 'high',
    sources: CLUSTER_SOURCES,
  },
  {
    id: 'c7-drl-off-indicating',
    title: 'Daytime light dims with the indicator',
    summary: 'The daytime running light on the indicating side goes off while that indicator flashes.',
    category: 'Lights',
    platforms: ['MLB'],
    module: 'vag-09',
    length: 30,
    byte: 3,
    bits: [7],
    confidence: 'medium',
    sources: [C7_DOC, MLB_TWEAKS],
  },
  {
    id: 'c7-drl-mmi',
    title: 'Daytime lights switchable in MMI',
    summary: 'Adds an on/off setting for the daytime running lights to the MMI.',
    category: 'Lights',
    platforms: ['MLB'],
    module: 'vag-09',
    length: 30,
    byte: 3,
    bits: [0],
    confidence: 'medium',
    sources: [C7_DOC],
  },
  {
    id: 'c7-tail-with-drl',
    title: 'Tail lights with daytime lights',
    summary: 'The rear lights come on with the daytime running lights.',
    category: 'Lights',
    platforms: ['MLB'],
    module: 'vag-09',
    length: 30,
    byte: 2,
    bits: [7],
    confidence: 'medium',
    sources: [C7_DOC],
  },
  {
    id: 'c7-tourist',
    title: 'Tourist light mode in MMI',
    summary: 'Adds the tourist (drive on the other side) headlight setting to the MMI.',
    category: 'Lights',
    platforms: ['MLB'],
    module: 'vag-09',
    length: 30,
    byte: 4,
    bits: [6],
    // Two sources since the 12 Nov 2026 research (replica/a6-enrich.md).
    confidence: 'high',
    sources: [C7_DOC, { label: 'vag-coding.net: A6 C7 display travel mode on MMI', url: 'https://www.vag-coding.net/audi/a6-c7/a6-c7-display-travel-mode-on-mmi/' }],
  },
  {
    id: 'c7-lock-horn',
    title: 'Horn chirp when locking',
    summary: 'A short horn chirp confirms locking with the key. Needs the factory alarm.',
    category: 'Locking and alarm',
    platforms: ['MLB'],
    module: 'vag-46',
    length: 30,
    byte: 1,
    bits: [2],
    confidence: 'medium',
    sources: [C7_DOC],
  },
  {
    id: 'c7-adaptive-brake',
    title: 'Flashing brake lights in an emergency stop',
    summary: 'The brake lights flash under very hard braking.',
    category: 'Lights',
    platforms: ['MLB'],
    module: 'vag-46',
    length: 30,
    byte: 8,
    bits: [0, 1],
    confidence: 'medium',
    sources: [C7_DOC],
  },
];

// One item per setting (platform, module, byte, bits). When several sources
// describe the same setting, the best-supported one is kept (higher
// confidence, then more sources; hand-checked first on a tie), with every
// source listed, and the coding length taken from whichever gives one.
const RANK = { high: 3, medium: 2, low: 1 } as const;
export function mergeItems(lists: CodingItem[][]): CodingItem[] {
  const key = (i: CodingItem) => `${i.platforms.join()}|${i.module}|${i.byte}|${i.bits.join()}|${i.field?.mask ?? ''}`;
  const out = new Map<string, CodingItem>();
  for (const list of lists) {
    for (const i of list) {
      const k = key(i);
      const old = out.get(k);
      if (!old) {
        out.set(k, i);
        continue;
      }
      const better = RANK[i.confidence] > RANK[old.confidence] || (RANK[i.confidence] === RANK[old.confidence] && i.sources.length > old.sources.length);
      const keep = better ? i : old;
      const urls = new Set(keep.sources.map((x) => x.url));
      const other = better ? old : i;
      out.set(k, { ...keep, length: keep.length ?? other.length, sources: [...keep.sources, ...other.sources.filter((x) => !urls.has(x.url))] });
    }
  }
  return [...out.values()];
}

// Hand-checked items, the catalogue (replica/vag-tweaks.md) and the A6 C7
// research of 12 Nov 2026 (src/coding/enriched.ts).
export const ALL_ITEMS: CodingItem[] = mergeItems([CODING_ITEMS, CATALOGUE_ITEMS, ENRICHED_ITEMS]);

export function codingItemsFor(group: string, platform: string | null): CodingItem[] {
  if (group !== 'vag' || !platform) return [];
  return ALL_ITEMS.filter((i) => i.platforms.includes(platform));
}

export function isOn(item: CodingItem, coding: number[]): boolean {
  const b = coding[item.byte] ?? 0;
  if (item.field) return (b & item.field.mask) === item.field.on;
  return item.bits.every((bit) => (b & (1 << bit)) !== 0);
}

// New coding with the item's bits set or cleared; everything else unchanged.
export function withItem(item: CodingItem, coding: number[], on: boolean): number[] {
  const next = [...coding];
  let b = next[item.byte];
  if (item.field) b = (b & ~item.field.mask) | (on ? item.field.on : item.field.off);
  else for (const bit of item.bits) b = on ? b | (1 << bit) : b & ~(1 << bit);
  next[item.byte] = b & 0xff;
  return next;
}

// "bit 2" or "bits 4 and 5" for a setting, including multi-bit fields.
export function bitsLabel(item: CodingItem): string {
  const bits = item.field ? [0, 1, 2, 3, 4, 5, 6, 7].filter((b) => (item.field!.mask >> b) & 1) : item.bits;
  return bits.length === 1 ? `bit ${bits[0]}` : `bits ${bits.slice(0, -1).join(', ')} and ${bits[bits.length - 1]}`;
}
