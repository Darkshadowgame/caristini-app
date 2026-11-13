// Service and oil-life reset guides. Every method links to its public source.
// The steps are paraphrased; the owner's manual for the exact car wins.
// No reliable public source documents the diagnostic commands for a wired
// reset on these makes, so the app guides the dashboard method.

export type Make = 'vag' | 'ford' | 'mazda';

export interface Method {
  title: string;
  applies: string;
  steps: string[];
  note?: string;
  // Platforms this method is for; leave out when it applies to the whole make.
  platforms?: string[];
  source: { label: string; url: string; official: boolean };
}

// Methods for a car: those tied to other platforms are hidden once the platform is known.
export function methodsFor(make: Make, platform: string | null | undefined): Method[] {
  return PROCEDURES[make].methods.filter((m) => !m.platforms || !platform || m.platforms.includes(platform));
}

export const MAKES: { id: Make; label: string }[] = [
  { id: 'vag', label: 'VW group' },
  { id: 'ford', label: 'Ford' },
  { id: 'mazda', label: 'Mazda' },
];

export const PROCEDURES: Record<Make, { intro: string; methods: Method[] }> = {
  vag: {
    intro: 'VW, Audi, Skoda and Seat. The methods shown match your car’s dashboard; reset only after the service has been done.',
    methods: [
      {
        title: 'MMI menu (Audi MLB: A4 B8, A5, A6 and A7 C7, Q5)',
        applies: 'Audi models with the MMI screen and CAR button',
        platforms: ['MLB', 'MLB evo'],
        steps: [
          'Switch the ignition on.',
          'Press CAR on the MMI controls.',
          'Choose Car systems, then Servicing & checks.',
          'Choose Service Interval displays.',
          'Choose Reset oil change interval and confirm.',
        ],
        note: 'This resets the oil change reminder only. Audi says the inspection reminder is reset by the dealer, and not to reset the display between oil changes.',
        source: { label: 'Audi of America, 2012 A6 owner information (NHTSA copy)', url: 'https://static.nhtsa.gov/odi/tsbs/2015/MC-10120898-9999.pdf', official: true },
      },
      {
        title: 'Cluster button',
        applies: 'Cars with a 0.0 or trip reset button on the instrument cluster',
        platforms: ['PQ35', 'PQ25', 'PQ26', 'PQ46', 'MQB', 'MQB evo', 'MQB A0'],
        steps: [
          'Switch the ignition off.',
          'Press and hold the 0.0 (trip reset) button on the cluster.',
          'Keep holding it and switch the ignition on.',
          'Release the button when the display asks whether to reset the inspection or service interval.',
          'Press the 0.0 button again to confirm.',
        ],
        note: 'VW advises not to reset the reminder between services, only after one has been done.',
        source: { label: 'VW service document (NHTSA archive)', url: 'https://static.nhtsa.gov/odi/tsbs/2020/MC-10171385-0002.pdf', official: true },
      },
      {
        title: 'Display or infotainment menu',
        applies: 'Newer cars (MQB platform onwards) with a menu-driven cluster or touchscreen',
        platforms: ['MQB', 'MQB evo', 'MQB A0'],
        steps: [
          'Switch the ignition on.',
          'Open the vehicle or car settings menu on the touchscreen or cluster.',
          'Go to the Service section.',
          'Choose the reset option for the oil change or inspection and confirm.',
        ],
        note: 'Menu names differ by model and year. This route is from a third-party guide, not a VW document.',
        source: { label: 'Third-party guide (Arteon)', url: 'https://www.wheelsjoint.com/vw-arteon-oil-change-interval-reset-procedure/', official: false },
      },
    ],
  },
  ford: {
    intro: 'Ford uses three methods depending on the car. Try the menu first on cars with a screen between the dials, then the pedal method.',
    methods: [
      {
        title: 'Pedal method (Focus Mk3, including the ST)',
        applies: 'Ford Focus 2011 to 2018',
        steps: [
          'Switch the ignition on, engine off.',
          'Press the accelerator and brake pedals fully at the same time, and keep them pressed.',
          'After about 3 seconds the display shows that the oil reset is in progress.',
          'After about 25 seconds it shows that the oil reset is complete. Release both pedals.',
          'Switch the ignition off.',
        ],
        note: 'From the US 2013 Focus owner manual. The UK ST manual shows the oil change message but does not describe the reset, so check the display confirms it.',
        source: { label: 'Ford 2013 Focus owner manual, page 250 (copy on manualslib)', url: 'https://www.manualslib.com/manual/624810/Ford-Focus.html?page=250', official: false },
      },
      {
        title: 'Pedal method',
        applies: 'Many cars without a cluster menu (for example the 2011 Fiesta)',
        steps: [
          'Put the car in accessory mode (ignition on, engine off).',
          'Press the accelerator and brake pedals fully at the same time.',
          'Hold both for 20 seconds until the oil life message resets.',
          'Switch the ignition off.',
        ],
        note: 'Some models need 25 seconds (third-party sources, not checked against a Ford manual).',
        source: { label: 'Ford 2011 Fiesta owner manual', url: 'https://www.manualsdir.com/manuals/602148/ford-2011-fiesta-v1.html?page=23', official: true },
      },
      {
        title: 'SETUP and RESET buttons',
        applies: 'Cars with SETUP and RESET buttons on the message centre (for example the 2010 Expedition)',
        steps: [
          'Switch the ignition on.',
          'Press SETUP to bring up the oil life reset.',
          'Hold RESET for about 2 seconds to set oil life back to 100%.',
        ],
        source: { label: 'Ford 2010 Expedition owner manual', url: 'https://www.manualsdir.com/manuals/602183/ford-2010-expedition-v2.html?page=32', official: true },
      },
      {
        title: 'Cluster menu',
        applies: 'Cars with a screen between the dials and steering wheel arrow buttons',
        steps: [
          'Switch the ignition on.',
          'Use the steering wheel arrows to open Settings, then Vehicle, then Oil Life.',
          'Hold OK until the display confirms the reset.',
        ],
        note: 'From a third-party guide. Ford support only links video guides for this.',
        source: { label: 'Third-party guide (2013 Edge)', url: 'https://getjerry.com/car-repair/2013-ford-edge-oil-reset', official: false },
      },
    ],
  },
  mazda: {
    intro: 'Mazda resets oil life from the display menu. Some engines also need a separate engine control reset.',
    methods: [
      {
        title: 'Tripmeter switch (Mazda6 SKYACTIV-D 2.2)',
        applies: 'Mazda6 2.2 diesel, when the oil warning light is not on',
        steps: [
          'Switch the ignition off.',
          'Press and hold the tripmeter switch.',
          'Keep holding it and switch the ignition on, engine off.',
          'Hold for more than 5 seconds. The master warning light flashes when the reset is done.',
        ],
        note: 'This resets the engine control unit oil data, including the oil dilution figure the diesel keeps. Reset the oil life in the display menu as well.',
        source: { label: 'Mazda SKYACTIV-D 2.2 workshop page (public mirror)', url: 'https://mazda6.neocities.org/esicont/srvc/html/id0140z7444700', official: false },
      },
      {
        title: 'Vehicle Status Monitor menu',
        applies: 'Cars with Mazda Connect (for example the CX-5)',
        steps: [
          'Switch the ignition on.',
          'Open the Vehicle Status Monitor on the Mazda Connect screen.',
          'Go to Maintenance, then Oil Change.',
          'Choose the reset option to set remaining oil life to 100%.',
        ],
        note: 'For SKYACTIV-G 2.5T and SKYACTIV-D 2.2 engines, Mazda says the engine control unit also needs resetting (method 2).',
        source: { label: 'Mazda CX-5 owner manual', url: 'https://owners-manual.mazda.com/gen/en/cx-5/cx-5_8hd5ee18k/contents/07020402.html', official: true },
      },
      {
        title: 'Engine control unit oil data reset',
        applies: 'Petrol engines where the manual asks for it (for example the 2018 Mazda6)',
        steps: [
          'Switch the ignition off.',
          'Press and hold the dashboard illumination (brightness) knob.',
          'Keep holding it and switch the ignition on.',
          'Hold for about 5 seconds until the warning light flashes, then release.',
        ],
        note: 'This source covers petrol engines. The diesel steps were not checked: use the owner manual for a SKYACTIV-D.',
        source: { label: 'Mazda6 2018 owner manual', url: 'https://www.mazdausa.com/static/manuals/2018/mazda6/contents/07030404.html', official: true },
      },
    ],
  },
};
