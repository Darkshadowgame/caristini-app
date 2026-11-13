// Customisations documented in public community sources, filtered per car.
// Caristini does not write coding yet: no public source confirms the diagnostic
// identifiers and security access needed for these writes, and a wrong write
// can leave warning lights or a module that needs a dealer. Each entry says
// where the setting lives and links its source, so a write can be added once
// it is verified on the owner's own car with a backup taken first.
import type { MakeGroup } from '../vehicle/vin';

export type ModStatus = 'owner' | 'documented' | 'dealer';

export interface ModEntry {
  id: string;
  title: string;
  category: string;
  popular?: boolean;
  group: MakeGroup;
  platforms?: string[]; // empty or missing = any platform of the group
  summary: string;
  options: string[];
  module: string;
  location: string;
  status: ModStatus;
  caution?: string;
  sources: { label: string; url: string }[];
}

export const STATUS_LABEL: Record<ModStatus, string> = {
  owner: 'Owner procedure',
  documented: 'Documented, write not verified',
  dealer: 'Dealer tool only',
};

export const STATUS_HELP: Record<ModStatus, string> = {
  owner: 'You can change this yourself with the car’s own controls. Steps are in the source.',
  documented:
    'Community sources say where this setting lives. Caristini reads but does not write it yet: the write command and security access are not publicly confirmed for your car.',
  dealer: 'Public sources only report this being changed with the maker’s dealer tool.',
};

const MQB = ['MQB', 'MQB A0'];
const PQ = ['PQ35', 'PQ25', 'PQ26', 'PQ46'];

export const MODS: ModEntry[] = [
  // VW group, MQB (about 2013 to 2019; SFD-protected cars from 2020 are locked)
  {
    id: 'vag-mqb-needle-sweep',
    title: 'Needle sweep on start-up',
    category: 'Instrument cluster',
    popular: true,
    group: 'vag',
    platforms: MQB,
    summary: 'The speedo and rev counter needles sweep to full scale and back when you switch on.',
    options: ['Off (factory)', 'On'],
    module: '17 Instrument cluster',
    location: 'Long coding, byte 1 bit 0 (one forum post says bit 3: sources disagree)',
    status: 'documented',
    sources: [{ label: 'vag-coding.net: Golf 7 needle check', url: 'https://www.vag-coding.net/vw/golf-7-5g/golf-7-5g-needle-check/' }],
  },
  {
    id: 'vag-mqb-belt-warning',
    title: 'Seat belt warning',
    category: 'Warnings',
    popular: true,
    group: 'vag',
    platforms: MQB,
    summary: 'Turns the unbuckled seat belt chime and lamp on or off.',
    options: ['On (factory)', 'Off'],
    module: '17 Instrument cluster',
    location: 'Long coding, byte 0 bits 2 to 4, or adaptation channel "Deactivate Seat belt warning"',
    status: 'documented',
    caution: 'A seat belt reminder is required on new EU cars. Turning it off removes a safety warning.',
    sources: [
      { label: 'vag-coding.net: Golf 7 belt alarm', url: 'https://www.vag-coding.net/vw/golf-7-5g/golf-7-5g-delete-belt-alarm/' },
      { label: 'Regulation (EU) 2019/2144', url: 'https://legislation.gov.uk/eur/2019/2144/2020-01-31/data.html' },
    ],
  },
  {
    id: 'vag-mqb-mirror-dip',
    title: 'Dip passenger mirror in reverse',
    category: 'Mirrors',
    popular: true,
    group: 'vag',
    platforms: MQB,
    summary: 'The passenger door mirror tilts down when you select reverse, so you can see the kerb.',
    options: ['Off (factory)', 'On'],
    module: '52 Passenger door, plus 09 Central electrics',
    location: '52: long coding byte 4 bits 2 to 3. 09: 2 adaptation channels',
    status: 'documented',
    caution: 'Needs electric mirror memory hardware. Owners report partial results on some cars.',
    sources: [{ label: 'vag-coding.net: Golf 7 mirror dip', url: 'https://www.vag-coding.net/vw/golf-7-5g/golf-7-5g-lower-passenger-mirror-when-reversing/' }],
  },
  {
    id: 'vag-mqb-lock-beep',
    title: 'Beep when locking',
    category: 'Locking',
    popular: true,
    group: 'vag',
    platforms: MQB,
    summary: 'The horn gives a short confirmation chirp when you lock or unlock with the key.',
    options: ['Off (factory)', 'On'],
    module: '09 Central electrics',
    location: '6 adaptation channels named "Acknowledgement signals..."',
    status: 'documented',
    sources: [{ label: 'vag-coding.net: Golf 7 lock beep', url: 'https://www.vag-coding.net/vw/golf-7-5g/golf-7-5g-door-lock-unlock-confirmation-beep-horn/' }],
  },
  {
    id: 'vag-mqb-kessy-windows',
    title: 'Close windows with keyless locking',
    category: 'Windows and sunroof',
    group: 'vag',
    platforms: MQB,
    summary: 'Holding the door handle sensor closes the windows (keyless entry cars).',
    options: ['Off (factory)', 'On'],
    module: '09 Central electrics',
    location: 'Adaptation "Access control 2 - Kessy Komfort oeffnen/schliessen"',
    status: 'documented',
    caution: 'Keyless entry (KESSY) cars only. No public source found for closing via the remote on the Golf 7.',
    sources: [{ label: 'vag-coding.net (Golf 7 section)', url: 'https://www.vag-coding.net/' }],
  },

  // VW group, PQ platforms (about 2004 to 2013)
  {
    id: 'vag-pq-staging',
    title: 'Needle sweep on start-up',
    category: 'Instrument cluster',
    popular: true,
    group: 'vag',
    platforms: PQ,
    summary: 'The needles sweep to full scale and back when you switch on.',
    options: ['Off (factory)', 'On'],
    module: '17 Instrument cluster',
    location: 'Adaptation "Staging"',
    status: 'documented',
    sources: [{ label: 'Ross-Tech: Golf 5K tweaks', url: 'https://wiki.ross-tech.com/wiki/index.php/VW_Golf/Golf_Plus_(5K/52)_Tweaks' }],
  },
  {
    id: 'vag-pq-windows',
    title: 'Open and close windows with the remote',
    category: 'Windows and sunroof',
    popular: true,
    group: 'vag',
    platforms: PQ,
    summary: 'Hold lock or unlock on the key to close or open all windows.',
    options: ['Off (factory)', 'On'],
    module: '09 Central electrics',
    location: 'Adaptation channel 6',
    status: 'documented',
    sources: [{ label: 'Ross-Tech: Golf 5K tweaks', url: 'https://wiki.ross-tech.com/wiki/index.php/VW_Golf/Golf_Plus_(5K/52)_Tweaks' }],
  },
  {
    id: 'vag-pq-drl',
    title: 'Daytime running lights',
    category: 'Lights',
    group: 'vag',
    platforms: PQ,
    summary: 'Turns daytime running lights on or off, or changes which lamps are used.',
    options: ['Factory', 'Off', 'On'],
    module: '09 Central electrics',
    location: 'Long coding bytes 11, 14 and 15',
    status: 'documented',
    caution: 'Daytime running lights are inspected at the MOT on cars first used from 1 March 2018.',
    sources: [
      { label: 'Ross-Tech: Golf 5K tweaks', url: 'https://wiki.ross-tech.com/wiki/index.php/VW_Golf/Golf_Plus_(5K/52)_Tweaks' },
      { label: 'MOT inspection manual, section 4', url: 'https://www.gov.uk/guidance/mot-inspection-manual-for-private-passenger-and-light-commercial-vehicles/4-lamps-reflectors-and-electrical-equipment' },
    ],
  },
  {
    id: 'vag-pq-belt',
    title: 'Seat belt warning',
    category: 'Warnings',
    group: 'vag',
    platforms: PQ,
    summary: 'Turns the unbuckled seat belt chime on or off.',
    options: ['On (factory)', 'Off'],
    module: '17 Instrument cluster',
    location: 'Long coding (byte not given in the source)',
    status: 'documented',
    caution: 'Turning it off removes a safety warning.',
    sources: [{ label: 'Ross-Tech: Golf 5K tweaks', url: 'https://wiki.ross-tech.com/wiki/index.php/VW_Golf/Golf_Plus_(5K/52)_Tweaks' }],
  },

  // Ford
  {
    id: 'ford-belt-minder',
    title: 'Belt-Minder chime',
    category: 'Warnings',
    popular: true,
    group: 'ford',
    summary: 'Ford lets owners switch the repeating Belt-Minder chime off with a buckle and unbuckle routine.',
    options: ['On (factory)', 'Off'],
    module: 'None, uses the car’s own controls',
    location: 'Owner manual procedure (Belt-Minder section)',
    status: 'owner',
    caution: 'Turning it off removes a safety warning.',
    sources: [{ label: 'Ford 2014 Focus owner manual', url: 'https://www.manualsdir.com/manuals/602021/ford-2014-focus-v3.html?page=42' }],
  },
  {
    id: 'ford-global-windows',
    title: 'Open and close windows with the key',
    category: 'Windows and sunroof',
    popular: true,
    group: 'ford',
    summary: 'Hold lock or unlock on the key to close or open all windows.',
    options: ['Off', 'On'],
    module: 'BCM (726)',
    location: 'As-built 726-17-01/02. From an Explorer sheet; Fiesta ST owners report it does not work',
    status: 'documented',
    sources: [{ label: 'FORScan Explorer as-built sheet', url: 'https://www.scribd.com/document/679158282/FORScan-2011-2020-Explorers' }],
  },
  {
    id: 'ford-belt-screen',
    title: 'Seat belt information screen',
    category: 'Warnings',
    group: 'ford',
    summary: 'Hides the seat belt pop-up screen in the cluster.',
    options: ['On (factory)', 'Off'],
    module: 'IPC (720)',
    location: 'As-built 720-13-01/02 set to zeros. Reported on the Maverick',
    status: 'documented',
    caution: 'Turning it off removes a safety warning.',
    sources: [{ label: 'Maverick Truck Club forum', url: 'https://www.mavericktruckclub.com/forum/threads/finally-forscan-coding-to-disable-the-seatbelt-information-screen-confirmed-working.45892/post-1257379' }],
  },

  // Mazda
  {
    id: 'mazda-belt-chime',
    title: 'Seat belt chime',
    category: 'Warnings',
    group: 'mazda',
    summary: 'Owners report the chime can be turned off with Mazda’s dealer tool.',
    options: ['On (factory)', 'Off'],
    module: 'Not documented',
    location: 'Dealer tool setting',
    status: 'dealer',
    sources: [{ label: 'MX-5 Owners Club forum', url: 'https://forum.mx5oc.co.uk/t/remove-seat-belt-annoying-chime/147437' }],
  },
];

export function modsForVehicle(group: MakeGroup | undefined, platform: string | null | undefined): ModEntry[] {
  if (!group || group === 'other') return [];
  return MODS.filter((m) => m.group === group && (!m.platforms || !platform || m.platforms.includes(platform)));
}

export function categoriesFor(list: ModEntry[]): { name: string; items: ModEntry[] }[] {
  const out: { name: string; items: ModEntry[] }[] = [];
  const popular = list.filter((m) => m.popular);
  if (popular.length) out.push({ name: 'Most popular', items: popular });
  const names = [...new Set(list.map((m) => m.category))].sort();
  for (const n of names) out.push({ name: n, items: list.filter((m) => m.category === n) });
  return out;
}
