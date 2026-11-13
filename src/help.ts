// In-app help: one guide per screen and one note per section a driver could
// be unsure about. Shown by the ? buttons and on the User guide page.
// Describe only what the app does; keep it short and in plain words.

export type Help = { title: string; what: string; how: string[]; note?: string };

export type GuideId =
  | 'home'
  | 'connect'
  | 'garage'
  | 'vehicle'
  | 'diagnostics'
  | 'code'
  | 'lookup'
  | 'history'
  | 'report'
  | 'live'
  | 'sensors'
  | 'dashboard'
  | 'battery'
  | 'performance'
  | 'customise'
  | 'customiseGuide'
  | 'learnSetting'
  | 'service'
  | 'carIds'
  | 'serviceReset'
  | 'ai'
  | 'knowledge'
  | 'fuses'
  | 'diary'
  | 'diaryAdd'
  | 'workshop'
  | 'module'
  | 'partNumbers'
  | 'learnCar'
  | 'discover'
  | 'listen'
  | 'settings';

export const GUIDES: Record<GuideId, Help> = {
  home: {
    title: 'Car',
    what: 'The home page for the connected car: its health at a glance and every tool one tap away.',
    how: [
      'Plug the adapter into the OBD2 port under the dashboard, switch the ignition on and tap Connect adapter.',
      'The card at the top shows the last health check, the engine warning light, the emissions self-tests and the battery voltage, read every 10 seconds while this page is open.',
      'Tap Run health check to check the car for faults. Tap the battery figure for a full battery test.',
      'The 4 tiles open History, Live data, Customise and Service. More tools, For experts and Driving list everything else.',
      'Not connected? You can still open History, Code lookup and the service reset guides.',
      'The button at the top right disconnects from the car.',
    ],
  },
  connect: {
    title: 'Connect',
    what: 'Finds your OBD2 adapter over Bluetooth and connects Caristini to the car.',
    how: [
      'Plug the adapter in and switch the ignition on. On iPhone the adapter must be a Bluetooth LE type (a Carista adapter is one).',
      'Caristini looks for adapters for 10 seconds. Ones that look like OBD adapters are listed first with an OBD adapter label.',
      'Tap your adapter. The first connection can take up to 30 seconds while the adapter finds the car’s protocol.',
      'Caristini reads the VIN (the car’s identity number), works out which car it is and saves it under Your cars.',
      'Settings can connect for you when the app opens, and run a health check straight after connecting.',
    ],
    note: 'Only one app can use the adapter at a time. Close Carista or other OBD apps first.',
  },
  garage: {
    title: 'Your cars',
    what: 'Every car you have connected to, saved on this phone by its VIN. Listed at the bottom of the Car tab.',
    how: [
      'A car is added the first time you connect to it.',
      'Each car keeps its details, its last health check and its coding backup, readable with no adapter.',
      'Tap a car to see its last health check, its records and its details.',
    ],
  },
  carIds: {
    title: 'Parts and IDs',
    what: 'Everything needed to buy parts for one car, readable without the adapter: the VIN, the codes from the data label, every module’s part number, software and coding, and a list of service part numbers.',
    how: [
      'Module details are saved each time you read part numbers here, open a module in Workshop, or run Learn my car.',
      'Type the engine, gearbox, paint and option codes from the car’s data label once; they stay on this phone.',
      'For a car Caristini has been researched for (the 2007 to 2009 SEAT Leon Cupra, engine BWJ), Built-in for this car shows part numbers and a Car reference with known faults, fluids and the service schedule, all offline.',
      'Find service part numbers asks the AI to search the web for the maker part numbers for this car, each with the page it came from.',
      'Parts diagrams by VIN opens a parts catalogue with exploded diagrams for this exact car.',
      'Share all IDs sends everything as text, for a parts counter or a garage.',
    ],
    note: 'AI part numbers are a starting point: check each against a catalogue by VIN before ordering.',
  },
  vehicle: {
    title: 'Vehicle details',
    what: 'One of your cars: its last health check, its records and the details Caristini uses for it.',
    how: [
      'The last health check, History, Research notes and Diary work without the adapter.',
      'Detected from the VIN shows what Caristini read from the car’s identity number.',
      'Under Your details you can add a nickname and correct the make, model, year and fuel.',
      'Maker group decides which service guides and settings Caristini offers, so set it right if the VIN was not recognised.',
      'Tap Save to keep your changes. Remove this car deletes the car’s details from this phone; diary entries stay.',
    ],
  },
  diagnostics: {
    title: 'Health check',
    what: 'Checks the control modules in the car for stored faults and shows what each one means. A control module is a small computer that runs one part of the car, such as the engine, the airbags or the doors.',
    how: [
      'It starts by itself. Each dot around the car is a module: green has no faults, red has faults, orange could not be read, dim is not fitted or asleep.',
      'The first 2 checks ask every address and, on VW group cars, look once for older modules. After that a check asks only the modules your car has, which is about 3 times quicker on an Audi A6.',
      'Every address is asked again by itself after 30 days, or when you tap Check every address.',
      'The odometer is read too, so service reminders know the distance.',
      'Tap Stop and keep results to end after the module being read. The time left shows after a few modules.',
      'Tap any fault for what it means, the likely causes and how to fix it.',
      'Clear one module or Clear all faults. Faults that come straight back mean the cause is still there.',
      'Under the result: Clear all faults, Ask the AI about these faults, Make a PDF health report.',
      'Each check is saved to History. From the Car tab, See faults opens the last check with no new one. With no adapter, this page shows the last check saved on this phone.',
    ],
    note: 'Clear faults with the engine off and the ignition on: Caristini refuses while the engine runs. Clearing also resets the emissions self-tests, so an MOT can fail until you have driven enough for them to complete.',
  },
  code: {
    title: 'Fault code',
    what: 'What one fault code means, how serious it is, the likely causes and how to fix it.',
    how: [
      'Most likely causes and How to fix it are listed cheapest and most likely first.',
      'Where it was found shows the module and the fault status, for example stored or pending.',
      'Reading the code splits it into system, type and area.',
      'Explain this fault asks Caristini AI for a plain-words explanation for your car, including whether it is safe to drive. It needs a Claude API key.',
      'Search the web for this code opens a web search. On VW group cars you can also search the Ross-Tech wiki.',
    ],
    note: 'The explanation is a guide, not a diagnosis.',
  },
  lookup: {
    title: 'Lookup',
    what: 'Look up any fault code or keyword in the built-in library, with no adapter and no internet.',
    how: [
      'Type a code like P0171 or a word like DPF.',
      'On your car now lists the codes from your last health check.',
      'Tap a code for its meaning, causes and fixes.',
      'Fuses and manuals opens the fuse box layouts.',
    ],
  },
  history: {
    title: 'History',
    what: 'Everything Caristini has done with this car, by day: health checks, faults cleared, settings changed, services, sensor searches and learning.',
    how: [
      'Use the chips at the top to show one kind of entry.',
      'A health check shows its faults, which are new and which have gone since the check before.',
      'Tap an entry to open it. Tap a fault for what it means.',
      'Setting changes show the coding before and after.',
      'History is kept on this phone and works without the adapter.',
    ],
  },
  report: {
    title: 'Health report',
    what: 'Makes a one-page PDF about this car, for an MOT, a sale or a garage visit.',
    how: [
      'Run a health check first so the report lists every module’s faults.',
      'Tap Make PDF. Caristini reads the engine codes, the battery voltage and the odometer where the car reports it.',
      'The report holds the car, engine light, emissions codes, the faults from the last health check and the emissions self-tests.',
      'Share the PDF or save it to Files.',
    ],
    note: 'It is read by the owner from the diagnostic port. It is not an MOT test or a garage inspection.',
  },
  live: {
    title: 'Live data',
    what: 'Live readings from the car as you drive or idle: the standard readings every car reports, plus the maker’s own sensors once your car has been searched.',
    how: [
      'At the top: your pinned sensors, or suggested ones when nothing is pinned, and every sensor on this car by system.',
      'Standard readings: tap Choose values to pick which to watch. Fewer values update faster.',
      'Each tile shows the value, a short trend line and the lowest and highest since you opened the page. Reset starts them again.',
      'Record saves every reading with its time. Tap Stop, then Share CSV to open it in Numbers or Excel.',
      'Coolant above 110 °C shows a warning.',
      'Maker data and Older VW modules read values that only some cars have.',
    ],
  },
  sensors: {
    title: 'Sensors',
    what: 'Every maker sensor your car answers, by system, with live values. The list of possible sensors comes from the open OBDb project.',
    how: [
      'Tap Quick search once. Caristini asks first what other cars of your make answered, then the rest, and keeps the ones your car answers. You can stop and keep what was found.',
      'Full search asks everything again, to confirm or correct. Modules to search lets you leave some out, for example the engine.',
      'Open a system, or search in your own words, for example oil, boost or gearbox temp.',
      'Values refresh while the page is open.',
      'Tap the star to pin a value. Pinned values show at the top of Live data.',
      'A value marked check looks wrong for that sensor, so it may not apply to your car.',
      'Search again after a module has been added or replaced.',
    ],
    note: 'Keep the ignition on while it searches; the engine can run.',
  },
  dashboard: {
    title: 'Dashboard',
    what: '4 large gauges to watch while driving, with alerts for an overheating engine or a low battery.',
    how: [
      'Tap a gauge to choose which value it shows.',
      'Head-up mirrors the screen so you can lay the phone under the windscreen at night.',
      'Alerts show for coolant too hot and for low voltage, with the engine running or off.',
      'Voltage is read every 10 seconds.',
    ],
    note: 'Keep your eyes on the road.',
  },
  battery: {
    title: 'Battery test',
    what: 'Checks the battery and the charging system in 3 steps, using the voltage the adapter measures at the OBD port.',
    how: [
      'Step 1: engine off, ignition on, lights and fan off. Tap Read rest voltage.',
      'Step 2: engine off. Tap Start, then start the engine within 10 seconds. Caristini records the lowest voltage while cranking.',
      'Step 3: engine idling. Read at idle, then switch on the headlights, heated rear screen and fan and read again.',
      'Results gives a verdict for each reading.',
    ],
    note: 'The port reads slightly lower than the battery itself. The figures are general lead-acid guides.',
  },
  performance: {
    title: 'Performance',
    what: 'Times 0 to 60 mph, 30 to 70 mph, 0 to 100 km/h and the quarter mile from the speed the car reports.',
    how: [
      'Pick a test and tap Get ready.',
      'Stop the car (or slow below the start speed). The timer starts when you pass the start speed and stops at the target.',
      'Results stay on this page for this session.',
      'Accuracy depends on how fast the adapter answers, usually 5 to 10 readings a second, so treat results as a guide.',
    ],
    note: 'Only use the timers on a closed road or track, never on public roads.',
  },
  customise: {
    title: 'Customise',
    what: 'Switch hidden settings on your car on and off, such as the needle sweep or the lights. Each setting is a change to a module’s coding, the list of options stored in that module.',
    how: [
      'The list opens on the coding read last time. Each switch unlocks once its module has answered again, so nothing is written from old data.',
      'Tap a setting’s name for what it does, where it lives (byte and bit) and its source.',
      'Before each change Caristini checks the battery and the engine, saves the module’s current coding as the original, writes the change and reads it back.',
      'If the module does not keep the change, Caristini puts the original coding back.',
      'Switch the ignition off and on to see a change. Every change is saved to History and your diary.',
      'Backups lets you put a module’s original coding back at any time.',
    ],
    note: 'Ignition on and engine off is best. A battery below 10.5 V at the port stops any change.',
  },
  customiseGuide: {
    title: 'Customisation guide',
    what: 'How one customisation is done on your kind of car, where it lives and where the information comes from.',
    how: [
      'The label says who can make the change: you with the car’s own controls, a documented setting Caristini does not write yet, or the dealer’s tool only.',
      'Where it lives names the module and the setting.',
      'Tap a source to read it.',
    ],
  },
  learnSetting: {
    title: 'Learn from Carista',
    what: 'Teaches Caristini settings it does not know yet, by comparing your car’s coding before and after you change them in Carista.',
    how: [
      'Step 1: tap Save settings now, once. Caristini reads the modules your car has.',
      'Optional: pick one module for a wider compare, to catch settings kept outside the coding. The first save takes about 5 minutes more; later compares take seconds.',
      'Step 2: tap Disconnect Caristini now, change one setting in each module you like in Carista, close Carista and connect Caristini again.',
      'Step 3: tap Read again and compare. What changed lists each module and its bytes.',
      'Name each change and tap Keep. They appear in Customise under Learned from your car, and the next round starts from the new values.',
    ],
    note: 'One setting per module per round, so Caristini knows which bytes belong to which setting.',
  },
  service: {
    title: 'Service',
    what: 'Step-by-step guides to reset the service or oil reminder after a service, a reset with the adapter for cars that need a tool, and a reminder of when the next service is due.',
    how: [
      'The methods use the car’s own buttons and menus, or the adapter for cars that need a tool. Each shows whether it comes from the maker or a third party.',
      'Tap I did this reset to save it to your diary.',
      'Under Reminder pick a service plan. Caristini counts time, and distance too once it knows the odometer.',
      'Mark service done today saves it to your diary and starts the count again from today.',
    ],
    note: 'For cars that need a tool, use Reset with the adapter at the bottom of the page.',
  },  serviceReset: {
    title: 'Reset with the adapter',
    what: 'Resets the service or oil reminder through the adapter, for cars where the instrument menu cannot do it.',
    how: [
      'Resets for this car lists what Caristini can send: learned on this car (green) or from a public source (Try, orange).',
      'Learn it by compare: save the cluster values, reset the service with another tool, then compare.',
      'Learn it by recording: record another tool with Listen mode and a Y-splitter.',
      'Every step is shown before anything is sent, old values are kept, and they are put back if a step is refused.',
    ],
    note: 'Nothing is guessed: only steps learned on this car or published for it are sent.',
  },

  ai: {
    title: 'Caristini AI',
    what: 'A chat assistant that can read your car: sensors, faults, modules and settings. It explains them for your car and can change a setting when you ask.',
    how: [
      'Type a question or tap a suggestion.',
      'With the adapter connected it reads the car as it answers. Without it, it answers from the last health check and History.',
      'Any change to the car waits for you to tap Allow, and uses the same safe write as Customise: backup, read-back and automatic restore.',
      'Tap the stop button to end an answer early.',
      'Each car has its own conversation while the app is open.',
    ],
    note: 'It needs your own Claude API key, pasted once in Settings.',
  },
  knowledge: {
    title: 'Research notes',
    what: 'What Caristini AI has researched and saved for your kind of car, such as fuse layouts, common faults and published settings. It is shared with every Caristini install.',
    how: [
      'Tap a research button to ask the AI to look something up and save it.',
      'Search the saved entries, and tap one to see its sources.',
      'New knowledge arrives by itself when the app opens, or tap Check for new knowledge.',
    ],
  },
  fuses: {
    title: 'Fuses and manuals',
    what: 'Fuse box layouts for your car from the owner’s manual, with links to the maker’s manuals and wiring portals.',
    how: [
      'Caristini picks the fuse set for the connected car. Pick another car under Other cars.',
      'Search by what stopped working, for example radio.',
      'Each box says where it is and how to open it.',
    ],
  },
  diary: {
    title: 'Diary',
    what: 'A log of services, repairs and notes for your cars.',
    how: [
      'Tap + to add an entry.',
      'Cleared faults, service resets and setting changes are added for you.',
      'With more than one car, tap a car to show only its entries.',
      'Tap Delete under an entry to remove it.',
    ],
  },
  diaryAdd: {
    title: 'Add to diary',
    what: 'Adds a service, repair or note to your diary.',
    how: ['Pick what was done.', 'Add the date (for example 2026-11-12), mileage and any notes.', 'Tap Save entry. It shows in the Diary tab.'],
  },
  workshop: {
    title: 'Workshop',
    what: 'Every control module in the car by its address, one page per module, the way workshop tools lay it out. A control module is a small computer that runs one part of the car.',
    how: [
      'Search by the address, by the name or by the CAN request ID. Addresses are the VW group workshop numbers, for example 01 engine, 17 instrument cluster, 09 central electronics. The CAN ID looks like 7E0 or 714.',
      'Modules that answered your last health check come first under On this car, with their fault count.',
      'Show more lists the modules that did not answer: not fitted, asleep, or on the older VW protocol. You can still open one to try it.',
      'Tap a module to read its faults, values and coding.',
      'Listen mode records what another tool, such as VCDS, sends to the car.',
    ],
    note: 'Module access is set up for VW group, Ford and Mazda cars on CAN.',
  },
  module: {
    title: 'Control module',
    what: 'One control module: what it is, its faults, its live values and its coding, in plain words.',
    how: [
      'The top shows the address, part number and software. Older system means it uses the older VW protocol.',
      'Faults: the fault memory of this module. Tap a fault for its meaning, Read again, or Clear these faults.',
      'Values: named values with Read all or Live. Older modules show numbered groups of 4 values. Expert reads any value by its 4-character number.',
      'Coding: named switches and every byte of the coding. Nothing changes in the car until you tap Save to the car.',
      'Saving checks the battery first, keeps the original coding, reads the new one back and puts the original back if the module does not keep it.',
      'Restore original coding puts back what the module had before Caristini first changed it.',
    ],
    note: 'Only change bits you know from a trusted source. Clear faults with the engine off and the ignition on.',
  },
  partNumbers: {
    title: 'Read part numbers',
    what: 'Reads every module’s part number, software, hardware and coding, to save or share.',
    how: [
      'Tap Read part numbers. Modules that answer are listed as they arrive.',
      'Technical details shows the protocol and the CAN IDs.',
      'Copy all or Share sends the list, for example to a parts supplier or a forum.',
      'The coding of each module is kept on this phone as a backup.',
    ],
    note: 'Read-only: nothing is changed in the car. CAN cars only.',
  },
  learnCar: {
    title: 'Learn my car',
    what: 'One button that finds every module and sensor on your car and, with a Claude key, has the AI work out what they are.',
    how: [
      'Run a health check first: Learn my car then asks the modules that check found, which is quicker. Without one it asks every diagnostic address (about 2 minutes more).',
      'Step 1 reads each module’s part number, software and coding. If the car is not answering, or fewer than half its known modules answer, it stops and keeps your earlier results.',
      'Step 2 asks the sensors other cars of your make answered first; the full list is on Sensors.',
      'Step 3 sweeps each module for values no list knows yet and reads them twice to see which ones move.',
      'Step 4 has the AI look up each part, name the unknown values and find settings owners have published. These show in Customise and Sensors.',
      'Step 5 saves what was learned and, if automatic sending is set up, sends it back to be built in.',
      'It takes 10 to 30 minutes. Stop any time and keep what was learned.',
    ],
    note: 'Read-only: nothing is changed in the car. Keep the ignition on; running the engine keeps the battery up.',
  },
  discover: {
    title: 'Unknown values',
    what: 'For experts. Asks a module for value numbers no list names yet and keeps whatever answers. Each module numbers its own values, so every module is asked separately.',
    how: [
      'Quick explore asks only the blocks around values already known for that module, plus the live-value block. Full explore asks every number in the usual ranges and takes much longer.',
      'Both skip numbers already asked on this car. Open one module to explore it alone.',
      'Pause any time and carry on later from where it stopped.',
      'Open a module to see what it found. Sample again shows which values move: rev the engine, switch something on or drive, then sample again.',
      'Tap a value to name it, or ask the AI what it is.',
      'Send findings to build them into Caristini for every car of this kind.',
    ],
    note: 'Read-only: nothing is written to the car.',
  },
  listen: {
    title: 'Listen mode',
    what: 'Records what another diagnostic tool, such as Carista on this phone or VCDS on a laptop, sends to the car, so its functions can be added to Caristini.',
    how: [
      'Plug an OBD Y-splitter into the car: Caristini’s adapter in one socket, the other tool’s adapter or cable in the other. Carista needs its own adapter, so Caristini uses a second one.',
      'Choose what to record, then tap Start recording and use the other tool. Caristini keeps recording in the background while you are in Carista (needs app version 1.0.32 or later installed, not only an update).',
      'Type a marker after each step, for example 17 coding, needle sweep on, so each step can be matched to its commands.',
      'Tap Stop recording, then Share recording.',
    ],
    note: 'The adapter only listens: it sends nothing to the car while recording.',
  },
  settings: {
    title: 'Settings',
    what: 'Speed and distance, temperature, connecting, the adapter check, app updates, Caristini AI, sending findings, the adapter log and help.',
    how: [
      'Speed and distance: miles or kilometres. Temperature: Celsius or Fahrenheit.',
      'Connecting: connect when the app opens, and run a health check straight after.',
      'Adapter: check what the adapter is and how fast it answers.',
      'AI: paste your Claude API key. It stays in this phone’s keychain.',
      'Troubleshooting: keep an adapter log and share it when something does not work.',
    ],
  },
};

// The User guide page: screen guides grouped by what you want to do.
export const GUIDE_GROUPS: { title: string; ids: GuideId[] }[] = [
  { title: 'Start here', ids: ['home', 'connect', 'garage', 'vehicle', 'carIds'] },
  { title: 'Find faults', ids: ['diagnostics', 'code', 'lookup', 'history', 'report'] },
  { title: 'Read the car', ids: ['live', 'sensors', 'dashboard', 'battery', 'performance'] },
  { title: 'Change settings', ids: ['customise', 'learnSetting', 'customiseGuide', 'service', 'serviceReset'] },
  { title: 'Tools', ids: ['ai', 'knowledge', 'fuses', 'diary', 'diaryAdd'] },
  { title: 'Expert', ids: ['workshop', 'module', 'partNumbers', 'learnCar', 'discover', 'listen'] },
  { title: 'App', ids: ['settings'] },
];

export const GUIDE_ORDER: GuideId[] = GUIDE_GROUPS.flatMap((g) => g.ids);

export const SECTIONS: Record<string, Help> = {
  // Workshop list
  workshopModules: {
    title: 'Control modules',
    what: 'The control modules Caristini knows for your kind of car, by address.',
    how: [
      'On this car lists the modules that answered your last health check, with their fault count.',
      'The line under each name is its CAN request ID, or Older VW protocol.',
      'Type in the search box to filter by address (17), name (cluster) or CAN ID (714).',
    ],
  },
  workshopNotFound: {
    title: 'Not found in the last health check',
    what: 'Modules on the list for your kind of car that did not answer the last health check.',
    how: ['They may not be fitted, may be asleep, or may use the older VW protocol.', 'Open one to try it again.'],
  },
  workshopListen: {
    title: 'Record another tool',
    what: 'Listen mode records what another tool sends to the car through a Y-splitter.',
    how: ['Caristini sends nothing while it listens.', 'The recording shows the exact commands for codings, adaptations and resets.'],
  },
  // Control module page
  moduleFaults: {
    title: 'Fault memory',
    what: 'The faults this module has stored.',
    how: [
      'Tap a fault for what it means and the likely causes; with AI, whether it is safe to drive.',
      'Read again asks the module once more.',
      'Clear these faults wipes this module’s fault memory, then reads it again. Faults still present come back.',
      'Clearing is saved to History and your diary.',
    ],
    note: 'Clear with the engine off and the ignition on: Caristini refuses while the engine runs.',
  },
  moduleNamedValues: {
    title: 'Named values',
    what: 'Live values this module holds, with names from the sensor lists.',
    how: [
      'Read all reads every value once. Live keeps reading the first 30 until you tap Stop.',
      'The 4-character code under each name is the value number.',
      'Once a sensor search has run (Sensors), only the values your car answered are listed.',
    ],
  },
  moduleGroups: {
    title: 'Live values by group',
    what: 'Older VW modules give live values in numbered groups of 4.',
    how: [
      'Use − and + to pick a group (1 to 255), then Read group.',
      'Field names come from public sources for your car. Unnamed ones show as Field 1 to 4.',
      'An empty group has no values on this module.',
    ],
  },
  moduleExpert: {
    title: 'Expert',
    what: 'Reads any value from this module by its 4-character number, as VCDS or ODIS show it.',
    how: ['Type the number, for example F187 (the part number), and tap Read.', 'The answer shows as bytes in hex, with the readable text below.'],
    note: 'Read-only: nothing is written to the car.',
  },
  moduleSettings: {
    title: 'Settings in this coding',
    what: 'Named switches inside this module’s coding.',
    how: [
      'Flip a switch to change the draft. Changed shows which ones differ from the car.',
      'Nothing changes in the car until you tap Save to the car.',
      'Not tested on this car means it comes from a single source or the AI.',
    ],
  },
  moduleBytes: {
    title: 'All bytes',
    what: 'Every byte of the coding. Each byte holds 8 on-off bits, numbered 0 to 7.',
    how: [
      'Tap a byte to see its 8 bits. Named bits say what they do; others show Bit 0 to 7.',
      'Bytes with a named bit have an amber outline. Bytes you have changed are highlighted.',
      'Save to the car keeps the original coding first, writes the new one, reads it back and puts the original back if the module does not keep it.',
      'Undo my changes resets the draft. Restore original coding puts back what the module had before Caristini first changed it.',
    ],
    note: 'Only change bits you know from a trusted source.',
  },
  // Diagnose
  diagModules: {
    title: 'Control modules',
    what: 'Each control module in the car and what it reported.',
    how: [
      'No faults: the module answered with an empty fault list.',
      'Could not read: the module answered but would not send its fault list.',
      'Modules that did not answer at all are folded away under not found.',
    ],
  },
  diagFaults: {
    title: 'Faults in a module',
    what: 'The faults one module has stored, with their meaning.',
    how: [
      'The code chip is the code people look up, for example P0011. The line below gives the status and fault type.',
      'Tap a fault for causes and fixes.',
      'Clear removes this module’s faults only.',
    ],
    note: 'Ignition on, engine off when clearing.',
  },
  diagCouldNotRead: {
    title: 'Could not read',
    what: 'These modules answered but would not send their fault list.',
    how: ['Switch the engine off, leave the ignition on, then tap Try these again.'],
  },
  diagNotFound: {
    title: 'Not found',
    what: 'Modules on the list for your kind of car that gave no answer.',
    how: ['Most are not fitted to your car.', 'Some are not reachable from this port.'],
  },
  diagOlder: {
    title: 'Older modules',
    what: 'Some VW group modules, such as central electronics, comfort and doors, speak an older protocol and are found by a separate look.',
    how: [
      'Caristini looks for them once, at the end of the first health check on a car, and saves what it finds.',
      'After that they are read with every health check, and Customise and Workshop include them.',
      'Tap a module to open it in Workshop; tap a fault for its meaning. Fault numbers are VW 5-digit codes.',
    ],
    note: 'Looking changes nothing in the car.',
  },
  diagEmissions: {
    title: 'Engine emissions (OBD2)',
    what: 'The standard emissions fault codes every car reports, and the engine warning light.',
    how: [
      'Stored: confirmed faults. Pending: seen once, not yet confirmed.',
      'Permanent: clear themselves once the car sees the fault fixed during normal driving.',
    ],
  },
  diagFreeze: {
    title: 'Freeze frame',
    what: 'What the engine was doing at the moment the fault was stored, such as speed, load and temperature.',
    how: ['Use it to see whether the fault happened cold, hot, idling or under load.'],
  },
  diagMonitors: {
    title: 'Emissions self-tests',
    what: 'Tests the car runs on its own while you drive, to check the emissions parts.',
    how: [
      'All must be complete for an MOT emissions test.',
      'Clearing faults resets them. Normal driving completes them again.',
    ],
  },
  lastScan: {
    title: 'Last health check',
    what: 'The faults found in the last health check of this car, saved on this phone.',
    how: ['Readable with no adapter.', 'Tap a fault for what it means and what to do.', 'Stopped early means the check did not finish.'],
  },
  // Customise
  customiseSettings: {
    title: 'Settings',
    what: 'Settings documented by public sources for your car’s platform, plus ones the AI found.',
    how: [
      'Tap a name for details, the byte and bit, and the source.',
      'Reported by owners means one community source. Check the result in the car.',
      'A switch stays grey until its module has answered.',
      'Flip a switch and confirm. Switch the ignition off and on to see the change.',
    ],
    note: 'Caristini saves the original coding first and puts it back if the module does not keep the change.',
  },
  customiseTry: {
    title: 'Try these',
    what: 'Settings with one vague source each, not yet confirmed on cars like yours.',
    how: [
      'Caristini writes the change and checks the module kept it.',
      'It then asks whether you saw the change. No, put it back writes the old value again and marks it No effect seen.',
      'The result shows as a label: Works on your car, Did not take or No effect seen.',
    ],
  },
  customiseLearned: {
    title: 'Learned from your car',
    what: 'Switches you made with Learn a setting, from the exact bytes Carista changed on this car.',
    how: [
      'Flip a switch to write the learned bytes, with the same backup and read-back.',
      'Forget removes the switch from Caristini. The car keeps whatever is set now.',
      'A switch waits if its module does not answer with the coding it had when learned.',
    ],
  },
  customiseMore: {
    title: 'More settings',
    what: 'Add a setting Caristini does not know yet by learning it from Carista.',
    how: ['Caristini saves your coding, you change one setting in Carista, and Caristini compares.'],
  },
  customiseBackups: {
    title: 'Backups',
    what: 'The coding each module had before Caristini first changed it.',
    how: ['Tap Restore to put a module’s original coding back.', 'It shows once a module’s coding differs from its original.'],
  },
  customiseUnreachable: {
    title: 'Not reachable on this car yet',
    what: 'Settings in modules that did not answer, or whose coding is not the length the sources describe.',
    how: ['They are not offered, so nothing is written to a module that may be different.'],
  },
  customiseGuides: {
    title: 'Guides',
    what: 'Customisations for your car with how-to guides and sources.',
    how: [
      'Owner procedure: you change it yourself with the car’s own controls.',
      'Documented, write not verified: sources say where it lives, but Caristini does not write it yet.',
      'Dealer tool only: public sources only report it changed with the maker’s tool.',
    ],
  },
  // Learn a setting
  learnSave: {
    title: 'Save the current settings',
    what: 'Reads and saves the coding of the modules your car answered on before, as the starting point.',
    how: ['Ignition on. Run a health check first so Caristini knows your modules.', 'Each compare moves the starting point on, so you save only once per session.'],
  },
  learnDeep: {
    title: 'Wider compare',
    what: 'Also saves every value 0000 to 0FFF of one module, to catch settings kept outside the coding, such as adaptations.',
    how: ['Tap a module to pick it; tap again to unpick it.', 'The first save takes about 5 minutes more; each compare re-reads only the values that answered, in seconds.'],
  },
  learnChange: {
    title: 'Change settings in Carista',
    what: 'Make the changes in Carista while Caristini is disconnected.',
    how: ['Only one app can use the adapter at a time.', 'Change one setting in each module you like (cluster, doors, central electronics...). Two in the same module cannot be told apart.', 'Note what you changed, then close Carista and connect Caristini again.'],
  },
  learnCompare: {
    title: 'Compare',
    what: 'Reads the modules again and lists what changed in each one.',
    how: ['Name each change after the setting you changed in that module; leave one empty to skip it.', 'Keep makes them switches and starts the next round straight away.', 'Add a login code only if a module needs one to accept changes.', 'Every compare and every learned setting is sent to the private findings repo.'],
  },
  // All sensors
  sensorsPinned: {
    title: 'Pinned',
    what: 'Values you starred. They refresh live here and show at the top of Live data.',
    how: ['Tap the star again to unpin.'],
  },
  sensorsBySystem: {
    title: 'By system',
    what: 'The sensors your car answered, grouped by system.',
    how: ['Open a system to see its values live, most useful first.'],
  },
  sensorsScan: {
    title: 'Find sensors',
    what: 'Two ways to look for the sensors your car answers, on the modules you choose.',
    how: [
      'Quick search: first the sensors your other cars and other owners of the same make found, then only what this car has not been asked yet. Values asked before are skipped.',
      'Full search: every sensor on the chosen modules again, slower. Use it to confirm earlier results; a value that answered before and does not now is taken off.',
      'Modules to search: switch off any module you do not want asked, for example the engine, which holds most values.',
      'What is found is sent back, so the next car of the same make is quicker.',
    ],
  },
  sensorsResults: {
    title: 'Sensor values',
    what: 'Sensors in this system or matching your search, with live values.',
    how: [
      'The line under each name is the module and the value number.',
      'Named by AI: Learn my car named it. A list name: it comes from a close relative of your car.',
      'Check: may not apply means the reading looks wrong for that sensor.',
      'Tap the star to pin a value to Live data.',
    ],
  },
  // Live data
  liveHub: {
    title: 'Sensors on this car',
    what: 'The maker sensors your car answered in the sensor search.',
    how: ['Open a system for its live values.', 'Tap the star on a value to pin it to the top of this page.', 'Search all sensors finds a value by name.'],
  },
  liveStandard: {
    title: 'Standard readings (every car)',
    what: 'The standard values cars report over OBD2, such as speed, engine speed and coolant temperature.',
    how: [
      'Choose values picks which values to watch. Fewer values update faster.',
      'Pause stops reading. Reset clears the lowest and highest.',
      'Record keeps every reading. Stop, then Share CSV.',
    ],
  },
  liveRecording: {
    title: 'Recording',
    what: 'The lowest, highest and average of each value in your recording.',
    how: ['Share CSV sends one row per reading time, in your units.'],
  },
  liveMaker: {
    title: 'Maker data',
    what: 'Values only the maker’s modules hold, such as odometer per module, DPF soot and ash, and airbag crash counters.',
    how: [
      'Tap Read maker data. Only values your car answers are shown.',
      'The odometer reading is saved for the service reminder.',
      'Watch for DPF regeneration checks every 20 seconds while this page is open. DPF: the diesel particulate filter, which burns off soot now and then.',
    ],
    note: 'These come from community sources, not the maker, and vary by engine. Compare them with another tool before relying on them.',
  },
  liveOlder: {
    title: 'Older VW modules',
    what: 'Live values from modules on the older VW protocol, in numbered groups.',
    how: [
      'Tap Find older modules, then pick one.',
      'Use − and + or a preset to pick a group. Live keeps reading it.',
      'Find values in every group reads groups 1 to 255 and lists the ones with values.',
      'Values with an unknown formula are shown raw.',
    ],
  },
  // Discover
  discoverModules: {
    title: 'Modules',
    what: 'Each module and how far the exploring has got with it.',
    how: ['Tap a module to open what it found.', 'Findings stay on this phone until you send them.'],
  },
  discoverFound: {
    title: 'Values found',
    what: 'Every value number this module answered, with its latest bytes.',
    how: [
      'Named values are already in Caristini’s lists.',
      'Moves means it changed between samples, so it is most likely a sensor.',
      'Tap a value to see its samples and possible readings, name it, or ask the AI.',
    ],
  },
  // Learn my car
  learnCarSteps: {
    title: 'What happens',
    what: 'The 5 steps of Learn my car, in order.',
    how: ['The step running now is marked Now; finished steps turn green.', 'The AI step needs a Claude API key; the other steps run without it.'],
  },
  learnCarKnows: {
    title: 'What Caristini knows',
    what: 'The modules found on this car, with plain names and part numbers.',
    how: ['Tap one to open it in the Workshop.'],
  },
  // Listen mode
  listenSetup: {
    title: 'Set up',
    what: 'How to wire the adapter so it can listen to another tool.',
    how: ['You need an OBD Y-splitter: one plug for this adapter, one for the other tool.', 'Start recording here first, then use the other tool.'],
  },
  listenWhat: {
    title: 'What to record',
    what: 'How much traffic to record.',
    how: [
      'All traffic suits VW group cars, where the gateway keeps most car traffic off the port.',
      'Diagnostic IDs only (700 to 7FF) suits Ford and Mazda, or use it if the adapter stops with a full memory.',
    ],
  },
  listenMark: {
    title: 'Markers',
    what: 'A note saved into the recording with the time.',
    how: ['Type what you did in the other tool and tap Mark.'],
  },
  // Battery test
  batteryRest: {
    title: 'Rest voltage',
    what: 'The battery’s charge with the engine off.',
    how: ['Best after the car has stood for a few hours.', 'About 12.6 V is full, 12.2 V about half, below 12.0 V flat.'],
  },
  batteryCrank: {
    title: 'Cranking',
    what: 'The lowest voltage while the starter turns the engine.',
    how: ['Above 9.6 V is generally fine. Lower suggests a weak battery or a poor connection.', 'A short dip can fall between readings.'],
  },
  batteryCharge: {
    title: 'Charging',
    what: 'Whether the alternator charges the battery with the engine running.',
    how: ['Typically 13.7 to 14.7 V.', 'Smart charging on newer cars can run lower, down to about 12.5 V, so a low reading is not always a fault.'],
  },
  // Performance
  perfTest: {
    title: 'Test',
    what: 'Which run to time.',
    how: ['Standing starts begin when the car moves. 30 to 70 begins as you pass 30 mph.', 'You cannot change the test while the timer is ready.'],
  },
  perfSession: {
    title: 'This session',
    what: 'Your runs since you opened this page, newest first.',
    how: ['Each shows the time, readings a second and, for the quarter mile, the speed at the line.', 'Runs are not saved when you leave the page.'],
  },
  // Settings
  settingsConnecting: {
    title: 'Connecting',
    what: 'What happens when the app opens and after it connects.',
    how: ['Connect when the app opens uses the last adapter you connected to.', 'Health check after connecting runs a health check straight away.'],
  },
  settingsAdapter: {
    title: 'Adapter check',
    what: 'Reads what the adapter is and how fast it answers.',
    how: [
      'Reply speed matters for older VW modules, which expect an answer within about 100 ms.',
      'Older VW modules and Ford and Mazda extra modules say whether the adapter can reach those modules.',
    ],
    note: 'Changes nothing in the car.',
  },
  settingsUpdates: {
    title: 'App updates',
    what: 'New versions of Caristini arrive over the air.',
    how: ['They download by themselves when the app opens and apply the next time it starts.', 'Check for updates looks now; Restart to update applies one straight away.'],
  },
  settingsAi: {
    title: 'AI',
    what: 'Caristini AI uses your own Claude API key from console.anthropic.com.',
    how: [
      'Paste the key once. It stays in this phone’s keychain and is sent only to Anthropic.',
      'It explains faults, guesses unknown values and answers questions about your car.',
      'Anthropic charges for each question, pay as you go.',
    ],
  },
  settingsSending: {
    title: 'Sending findings',
    what: 'What your car teaches Caristini (sensors, modules, settings, logs) goes to your private findings store, to be built into the next version.',
    how: ['Automatic sending uses a GitHub token pasted here once and kept in the phone keychain. Nothing is built into the app.', 'Without a token, findings wait on the phone, or go by email with the file attached.'],
  },
  settingsTroubleshooting: {
    title: 'Troubleshooting',
    what: 'A log of the last 4,000 adapter commands and replies, kept on this phone only.',
    how: ['Switch on Keep an adapter log, repeat what went wrong, then Share adapter log.', 'Clear log empties it.'],
  },
  // Other screens
  partNumbersModule: {
    title: 'Module details',
    what: 'What one module told Caristini about itself.',
    how: [
      'Part number, software and hardware identify the exact part.',
      'Coding is the list of options stored in the module.',
      'Technical details shows the protocol and the CAN IDs.',
    ],
  },
  fusesBox: {
    title: 'Fuse box',
    what: 'The fuses in one box with what each protects and its rating in amps.',
    how: ['The note below says where the box is and how to open it.', '(some cars) means that fuse differs between cars.', 'Not used means the slot is empty.'],
  },
  fusesManuals: {
    title: 'Manuals and wiring',
    what: 'Links to the maker’s official portals for workshop manuals and wiring diagrams.',
    how: ['Workshop manuals and wiring diagrams are sold by the maker.', 'Links marked Unofficial copy are third-party copies, not the maker’s own.'],
  },
  reportIncluded: {
    title: 'Included in the report',
    what: 'What goes into the PDF.',
    how: ['Run a health check first so the report lists every module’s faults.', 'Emissions self-tests show which of the car’s own checks have run.'],
  },
  serviceReminder: {
    title: 'Reminder',
    what: 'When the next service is due, by time and distance.',
    how: [
      'Pick a plan. Mark service done today when the car has been serviced.',
      'Distance counts once Caristini knows the odometer: read maker data in Live data or make a health report.',
    ],
  },
  serviceObd: {
    title: 'Reset with the adapter',
    what: 'A service reset sent through the adapter, for cars whose reminder only resets with a diagnostic tool.',
    how: [
      'The commands are not publicly documented for most cars, so Caristini learns them on your car: by comparing the instrument cluster before and after another tool resets it, or by recording that tool with Listen mode.',
      'Methods from public sources are offered as Try until they have worked on your car.',
    ],
  },
  serviceResets: {
    title: 'Resets for this car',
    what: 'The service resets Caristini can send to this car.',
    how: [
      'Green ones were learned on this car, by recording or by compare. Orange Try ones come from a public source and are not yet confirmed on this car.',
      'Tap one to see every step before anything is sent. Nothing is sent until you confirm.',
      'Before each write Caristini reads and keeps the old value. If the module refuses a step, the values already written are put back.',
      'A Try that works on this car is kept as confirmed.',
    ],
    note: 'A routine the module has already run cannot be undone; the steps list shows any routine before you confirm.',
  },
  serviceLearnCompare: {
    title: 'Learn it by compare',
    what: 'Finds what a service reset changes in the instrument cluster, so Caristini can make the same change next time.',
    how: [
      'Save the cluster values. Caristini reads every value in the service ranges, about 5 minutes.',
      'Disconnect Caristini, reset the service with Carista or another tool, then connect Caristini again.',
      'Read again and compare. Values that move on their own, or hold the date or odometer, are held back and never written.',
      'Keep the result as this car’s service reset.',
    ],
    note: 'Some resets are a command that leaves no stored value. If nothing changes, record the reset with Listen mode.',
  },
  idsVin: {
    title: 'From the VIN',
    what: 'What the VIN itself says about the car.',
    how: ['The make, and on VW group cars the model and platform, come from fixed positions in the VIN.', 'The model year is character 10; some European Ford and Mazda VINs do not use it, so it is marked check.'],
  },
  idsCodes: {
    title: 'Codes from the data label',
    what: 'Codes parts counters ask for that the car does not send over the OBD port.',
    how: [
      'Type each code as printed on the car’s data label. They are kept on this phone.',
      'Codes marked Found by AI came from a web search, with the page shown under them. Check them against the label.',
      'Your own entry always replaces one found by AI.',
    ],
  },
  idsModules: {
    title: 'Control modules',
    what: 'Every module that answered, with its part number, hardware, software, system name and coding.',
    how: [
      'Filled in when you read part numbers, open a module in Workshop or run Learn my car, and kept when you are not connected.',
      'Tap a module to see everything; press and hold a line to copy it.',
      'The part number is what to quote when buying a replacement module.',
    ],
    note: 'A replacement module usually needs coding to match: keep the coding shown here.',
  },
  idsParts: {
    title: 'Service parts',
    what: 'Maker part numbers for the usual service parts for this car, found by AI on the web.',
    how: [
      'Needs the internet and a Claude API key, not the car.',
      'The search uses the VIN, the engine and gearbox codes and the engine computer’s part number, so fill those in first for the best match.',
      'Each number shows the page it came from. Tap a number to copy it.',
    ],
    note: 'Check each number against a catalogue by VIN before ordering: fitment can change during a model year.',
  },
  idsPack: {
    title: 'Built-in for this car',
    what: 'Part numbers and a reference researched for this exact model and engine, built into the app, so they show with no internet and no adapter.',
    how: [
      'Shows when the VIN and the engine code match a car Caristini has been researched for.',
      'Each part number links to the page it came from. Tap a number to copy it.',
      'One source means only one public page gave that number; the rest were agreed by two or more.',
      'Car reference has the known faults, fluids, service schedule, specs and recalls.',
    ],
    note: 'Check each number against a catalogue by VIN before ordering: fitment can change during a model year.',
  },
  refFaults: {
    title: 'Known faults',
    what: 'Problems reported most often on this engine and model, from public owner and garage pages.',
    how: [
      'Tap a fault for its signs, the fault codes it usually sets, the cause and the usual fix.',
      'Owners report means the fault is known from owner forums and garage pages, not from a maker bulletin.',
      'If a Health check shows one of these codes, start here.',
    ],
  },
  refFacts: {
    title: 'Researched values',
    what: 'Fluids, capacities, intervals and torque settings for this car, each with the page it came from.',
    how: ['One source means only one public page gave the value.', 'The handbook and the label on the car win over anything here.'],
  },
  refRecalls: {
    title: 'Recalls',
    what: 'Safety recalls for this model found in public records.',
    how: ['A recall applies only to the VINs the maker lists: check your own VIN with SEAT or on the GOV.UK recall checker.'],
  },
  idsCatalogues: {
    title: 'Parts diagrams by VIN',
    what: 'Online parts catalogues with exploded diagrams for this exact car.',
    how: ['Caristini copies the VIN, then opens the catalogue. PartSouq opens straight on your car; on 7zap, paste the VIN.', 'Opening a catalogue sends the VIN to that site.'],
  },
  serviceWhere: {
    title: 'Where to look',
    what: 'Which module keeps the service data that the reset changes.',
    how: [
      'Instrument cluster: the service display and its counters.',
      'Engine computer: oil life on Ford, and on the Mazda Skyactiv-D diesel the oil data reset (oil change count, fuel dilution estimate and oil pressure reference) that Mazda says is needed after every oil change.',
      'Pick one before saving values. To learn both, do the compare once for each.',
    ],
  },
  serviceChanges: {
    title: 'What the reset changed',
    what: 'Each cluster value that differs after the other tool’s reset, before and after.',
    how: ['Written: Caristini writes this exact value when it resets the service.', 'Held back: the value holds the date, the odometer or a live reading, so writing it later would be wrong.'],
  },
  serviceLearnRecord: {
    title: 'Learn it by recording',
    what: 'Records the exact commands another tool sends when it resets the service.',
    how: [
      'Plug an OBD Y-splitter into the car, with this adapter and the other tool on it.',
      'Open Listen mode, start recording, reset the service with the other tool, then stop.',
      'Tap Use as service reset. Caristini keeps only the steps the cluster said yes to, and works out the login code if one was used.',
    ],
    note: 'Recordings with flashing, output tests or a module restart are refused.',
  },
  knowledgeEntries: {
    title: 'Saved knowledge',
    what: 'Entries researched by the AI or added by owners, for your make, model or platform.',
    how: ['Tap an entry for the full text, who added it and its sources.'],
  },
  codeWhere: {
    title: 'Where it was found',
    what: 'The module that reported this fault and its status.',
    how: ['Stored: confirmed. Pending: seen, not yet confirmed.', 'Failure type adds detail, for example short to ground or signal too high.'],
  },
  codeDetails: {
    title: 'Extra data for a workshop',
    what: 'Extra data the module stored with this fault.',
    how: ['Tap Read details.', 'The layout is the maker’s own and not public, so it is shown raw.'],
  },
  codeAi: {
    title: 'Explained by AI',
    what: 'A plain-words explanation for your car: meaning, causes, whether it is safe to drive and a rough cost.',
    how: ['It needs a Claude API key in Settings.'],
    note: 'A guide, not a diagnosis.',
  },
  codeReading: {
    title: 'Reading the code',
    what: 'What each part of the code means.',
    how: ['The letter is the system: P engine and gearbox, C chassis, B body, U network.', 'A 0 or 2 after the letter is a generic code; a 1 means the maker defines it.'],
  },
};
