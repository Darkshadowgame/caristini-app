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
  | 'settings'
  | 'logger'
  | 'diagTests'
  | 'diagChanges'
  | 'mot'
  | 'monitors'
  | 'knock'
  | 'dpf'
  | 'trip'
  | 'fuelTrims'
  | 'boost'
  | 'carReference';

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
    what: 'Everything needed to buy parts for one car, readable without the adapter: the VIN, the codes from the data label, every module’s part number, software and coding, and links to parts catalogues.',
    how: [
      'Module details are saved each time you read part numbers here, open a module in Workshop, or run Learn my car.',
      'Type the engine, gearbox, paint and option codes from the car’s data label once; they stay on this phone.',
      'For a car Caristini has been researched for (the 2007 to 2009 SEAT Leon Cupra, engine BWJ), Built-in for this car shows part numbers and a Car reference with known faults, fluids and the service schedule, all offline.',
      'Parts diagrams by VIN opens a parts catalogue with exploded diagrams for this exact car.',
      'Share all IDs sends everything as text, for a parts counter or a garage.',
    ],
    note: 'Check part numbers against a catalogue by VIN before ordering.',
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
      'Your details come first. Platform shows which models it covers; leave it on Not sure if you do not know it.',
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
      'Tap any fault for what it means and, where Caristini knows them, the likely causes and how to fix it.',
      'Clear one module or Clear all faults. Faults that come straight back mean the cause is still there.',
      'Under the result: Clear all faults, Make a PDF health report.',
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
    what: 'Everything Caristini has done with this car, by day: health checks, faults cleared, settings changed, services, Find my car’s sensors and Learn my car.',
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
      'Standard readings: tap Choose to pick which values to watch, search for a value, or save and load named sets. Fewer values update faster. With Developer options on, the readings and updates a second are shown too.',
      'Each tile shows the value, a short trend line and the lowest and highest since you opened the page. Reset starts them again.',
      'Tap a tile to set alert limits. Past a limit the tile turns red and the phone buzzes.',
      'Record saves every reading with its time. Tap Stop, then Share CSV to open it in Numbers or Excel.',
      'Coolant above 110 °C shows a warning.',
      'Views: Fuel trims on petrol cars, and Turbo boost where the car reports it.',
      'Maker data and Older VW modules read values that only some cars have.',
    ],
  },
  sensors: {
    title: 'Find my car’s sensors',
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
    what: 'Large gauges to watch while driving, on as many pages as you like, with alerts for an overheating engine or a low battery.',
    how: [
      'Tap a gauge to choose which value it shows. Press and hold it for alert limits and its lowest and highest.',
      'Swipe or tap a page name to switch pages. Edit page sets the name, the tile style (number, dial, bar or graph) and the number of tiles.',
      'Shift light sets the engine speed at which the whole screen flashes red.',
      'Windscreen view mirrors the screen so you can lay the phone under the windscreen at night and read it in the glass.',
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
      'The figure at the top is read when the page opens and every 10 seconds between steps, the same reading as on the Car tab.',
    ],
    note: 'The port reads slightly lower than the battery itself. The figures are general lead-acid guides.',
  },
  performance: {
    title: 'Performance',
    what: 'Times 0 to 60 mph, 30 to 70 mph, 0 to 100 km/h, the quarter mile and your own speed ranges from the speed the car reports.',
    how: [
      'Pick a test and tap Get ready.',
      'Stop the car (or slow below the start speed). The timer starts when you pass the start speed and stops at the target.',
      'Runs are saved for each car, with plus or minus how far each time could be off.',
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
      'Under Common service intervals tap the one that matches your service book; a tick shows the one chosen. Caristini counts time, and distance too once it knows the odometer: Read the odometer under Reminder reads it straight away.',
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

  knowledge: {
    title: 'Research notes',
    what: 'Notes saved for your kind of car, such as fuse layouts, common faults and published settings. They are read from your private findings store when the app opens.',
    how: [
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
    how: [
      'Pick what was done.',
      'Add the date as day/month/year (for example 12/11/2026), or tap Today or Yesterday. Add the mileage, in the unit set in Settings, and any notes.',
      'Tap Save entry. It shows in the Diary tab. Cancel is at the top left.',
      'Setting changed entries are added for you when Customise or Workshop changes a setting.',
    ],
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
    what: 'One button that reads everything on your car once and saves each result where its own screen shows it: Health check, Customise, Live data, Emissions self-tests, MOT check, Battery test and Service.',
    how: [
      'Run it with the engine running. The first run reads everything and takes longest; later runs refresh only what changes (the faults of every module, emissions, the MOT read, battery and odometer) and usually take a few minutes. The screen shows the time for your car, from your adapter’s measured pace and your last run, and the time left while it runs.',
      'Module identities and codings, the search for your car’s sensors and the search of every address run again for a new or missing module, every 30 days, or when you switch on Read everything again. Addresses that never answered are not asked again until then.',
      'Step 1 reads each module’s part number, software and coding, and keeps the coding as a backup. If the car is not answering, or fewer than half its known modules answer, it stops and keeps your earlier results.',
      'Step 2 is a full health check of every module, older VW modules too, with the engine’s codes and freeze frames. It is saved like any health check, so the Car tab, See faults, Lookup, the PDF report and the MOT check use it.',
      'Step 3 asks the sensors other cars of your make answered first; the full list is on Find my car’s sensors.',
      'Step 4 looks near the values already known for each module for ones no list knows yet. On older VW modules it reads the value groups, named groups first. It gets 2.5 minutes each run and carries on where the last run stopped, until every module is explored.',
      'Step 5 reads the emissions self-tests, test results and calibration IDs. Step 6 reads the MOT items from the car, so only the walk-round is left. Step 7 reads the battery voltage and the odometer.',
      'Step 8 saves what was learned and sends it to your private findings store, filed under the VIN. Switch off Send what this run finds to keep a run, and its adapter log, on this phone.',
      'A step that fails is marked and the run carries on. Stop any time: what was found is kept and saved.',
      'On VW PQ35 cars it uses the gateway’s list of modules and skips the newer-protocol address search and sensor list.',
    ],
    note: 'Read-only: no faults are cleared, no coding is written and nothing is run in the car. Driving tools (logger, performance, trip, knock and boost) are not part of it.',
  },
  discover: {
    title: 'Unknown values',
    what: 'Asks a module for value numbers no list names yet and keeps whatever answers. For experts: each module numbers its own values, so every module is asked separately.',
    how: [
      'Quick explore asks only the blocks around values already known for that module, plus the live-value block. Full explore asks every number in the usual ranges and takes much longer.',
      'Both skip numbers already asked on this car. Open one module to explore it alone.',
      'Pause any time and carry on later from where it stopped.',
      'Open a module to see what it found. Sample again shows which values move: rev the engine, switch something on or drive, then sample again.',
      'Tap a value to name it.',
      'Send findings sends them to your private findings store, filed under the VIN, to be built into Caristini.',
      'The module list shows the modules that answered your last health check. Run one first if the list is long.',
      'Full explore shows the total time for all the modules listed before it starts.',
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
    what: 'Speed and distance, temperature, connecting, the adapter check, app updates, sending findings, the adapter log and help.',
    how: [
      'Speed and distance: miles or kilometres. Temperature: Celsius or Fahrenheit.',
      'Connecting: connect when the app opens, and run a health check straight after.',
      'Adapter: check what the adapter is and how fast it answers.',
      'Troubleshooting: keep an adapter log and share it when something does not work.',
      'Developer options: the GitHub token, the email address, the app version and the findings waiting to send.',
    ],
  },
  logger: {
    title: 'Data logger',
    what: 'Records the values you choose while you drive, saves each log on the phone for this car, and shows it as charts you can read back.',
    how: [
      'Tap Choose values and pick what to record: standard values, maker values found by Find my car’s sensors, and older VW groups found by Learn my car.',
      'Tap Record, or turn on Auto-start to begin when engine speed, the accelerator or the throttle goes above a set value.',
      'While recording, tap Marker to number a moment you want to find later.',
      'Tap Stop. The log appears under Saved logs; open it to see the charts, drag across a chart to read every value at that moment, and share it as a CSV.',
    ],
    note: 'Fewer values record faster. The rate shown is what the adapter achieved. Set up the log before you drive and keep your eyes on the road.',
  },
  diagTests: {
    title: 'Emissions self-tests',
    what: 'Which of the self-tests the engine runs on itself have run, their results where the engine keeps them, its calibration IDs and how often each self-test gets the chance to run.',
    how: [
      'Open it from Health check. It reads the engine as soon as it opens; tap Read again to repeat.',
      'Each test shows its value and the car’s own limits. Pass: inside the limits. Fail: outside them.',
      'Tests the standard does not name are the maker’s own and are shown as maker tests. Values with a unit Caristini does not know are shown raw.',
      'Calibration ID and CVN identify the engine software. Compare them with a garage’s records after a software update.',
    ],
    note: 'Read-only: nothing is written to the car.',
  },
  diagChanges: {
    title: 'Change timeline',
    what: 'Every setting Caristini changed on this car, newest first, with the module, the old and new value and the backup it came from.',
    how: [
      'Open it from Customise or History.',
      'Share as text for a readable list, or as CSV for a spreadsheet.',
      'Backup is the coding the module had before Caristini first changed it. Customise > Backups puts it back.',
      'Changes made before this list was added show Backup: Not recorded.',
      'Put back opens Customise and asks before it writes. It puts back the coding the module had before Caristini first changed it, so every change to that module is undone.',
    ],
  },
  mot: {
    title: 'MOT check',
    what: 'Checks your car against the UK MOT rules before the test: what the car reports, and a walk-round of what a tester looks at.',
    how: [
      'From the car reads the engine light, the engine codes and the faults in the modules whose warning lamps the MOT checks: ABS and stability control, airbags, power steering, tyre pressure and electronic parking brake where fitted, plus lamp, horn and wiper faults. It only reads; nothing is cleared.',
      'If a full health check ran in the last hour, you can use it instead of reading the modules again.',
      'Walk-round: work down the list and mark each item Pass, Advisory, Fail or Not checked. Each item says what fails, from the MOT manual, with its section number.',
      'Result lists likely fails and advisories with what to fix. Share sends it as text; Save keeps it in History.',
      'Check MOT history opens the GOV.UK service, where you type the registration yourself.',
      'Your answers are kept on this phone until you start again, so the walk-round can be done over a few days.',
    ],
    note: 'A guide only, from the DVSA MOT inspection manual for cars (read 15 Nov 2026). The tester decides on the day.',
  },
  monitors: {
    title: 'Drive monitors',
    what: 'Tools that watch the car while you drive. Only the ones that work on this car are listed: knock and timing on petrol cars, the diesel particulate filter (DPF) on diesels, and a trip computer on every car.',
    how: [
      'Each tool shows only values with a known source for your car.',
      'Where a value is not known for your car, the tool says so.',
      'Everything here only reads from the car.',
      'The performance timer is on the Car tab, under Driving.',
    ],
  },
  knock: {
    title: 'Knock and timing',
    what: 'How much the engine computer pulls ignition timing on each cylinder when it hears knock.',
    how: [
      'SEAT Leon Cupra and other older VW petrol engines: Caristini reads value group 020 (knock retard, cylinders 1 to 4) over and over, with group 003 (rpm and timing) and 115 (boost).',
      'Watch the readings under load, for example in 3rd gear at full throttle on a closed road.',
      'A warning shows when a cylinder pulls more than 3° or pulls 3° more than every other cylinder.',
      'Other cars: knock values are not known, so only the standard timing advance is shown where the car reports it.',
    ],
    note: 'The 3° figure is an owner forum guide, not a SEAT figure. Other VW engines are reported to allow 0 to 12°. A cylinder that keeps pulling more than the others can point to a plug, coil or injector on that cylinder, or poor fuel.',
  },
  dpf: {
    title: 'DPF monitor',
    what: 'Watches the diesel particulate filter: whether it is cleaning itself (regenerating), distance since the last clean, soot load and pressure difference across it.',
    how: [
      'Mazda6 2.2 diesel: regeneration, distance, count, soot load and pressure come from the engine computer.',
      'Any diesel that reports the standard pressure value (7A or 7B) shows it.',
      'Audi A6 2.0 TDI: regeneration status and distance are not known. Find my car’s sensors can look for this car’s own DPF values, such as soot mass and distance since the last regeneration.',
      'Caristini reads every 15 seconds while this page is open and buzzes when a regeneration starts.',
    ],
    note: 'If a regeneration is running, keep driving at a steady speed until it ends. A flashing DPF light needs a garage (Mazda owner manual).',
  },
  trip: {
    title: 'Trip computer',
    what: 'Distance, time, average speed and fuel used for one trip, from the speed and fuel values the car reports.',
    how: [
      'Tap Start trip when you set off and Finish trip when you arrive. Keep this page open: the phone stays awake. Leaving the page ends the trip and keeps what was driven.',
      'Distance adds up the reported speed over time.',
      'Trips are saved for this car on this phone.',
      'Gaps in the readings of more than 5 seconds are skipped, not guessed.',
    ],
  },
  fuelTrims: {
    title: 'Fuel trims',
    what: 'How much the engine computer is correcting the fuel, per bank, with the lambda and oxygen sensors. Plus means it adds fuel because it sees a lean mixture; minus means it takes fuel away (rich).',
    how: [
      'Short term moves all the time. Long term is what the engine has learned. Total is both added together.',
      'Green: within 10 %. Amber: 10 to 20 %, worth watching. Red: beyond 20 %, where many engines set a lean or rich fault code.',
      'Judge at a steady speed with the engine warm. A vacuum leak shows as high plus trims at idle that fall with revs.',
      'Bank 2 shows only on V engines. Lambda 1.00 is the ideal mixture; below 1 is rich, above 1 is lean.',
    ],
    note: 'The bands are a common rule of thumb, not a maker limit.',
  },
  boost: {
    title: 'Turbo boost',
    what: 'The boost the engine asks for and the boost it gets, with the gap between them.',
    how: [
      'Tap Start, then accelerate. The dashed line is requested, the solid line actual. The lower chart is the gap, with the green band within 15 kPa.',
      'Pressures are absolute, in kPa as on Live data: about 100 kPa is no boost at sea level.',
      'A gap that stays below the band under full load can point to a boost leak, a sticking wastegate or a worn diverter valve.',
      'Leon Cupra: read from engine group 115 on the older VW protocol. Other cars: from standard PID 70 where the engine reports it.',
    ],
    note: 'Only drive hard where it is legal and safe. A passenger should watch the screen.',
  },
  carReference: {
    title: 'Car reference',
    what: 'Known faults, fluids, the service schedule, specs and recalls for a car Caristini has been researched for, built into the app.',
    how: [
      'Open it from Parts and IDs, under Built-in for this car. It works with no adapter and no internet.',
      'Tap a known fault for its signs, the fault codes it usually sets, the cause and the usual fix.',
      'Every line links to the public page it came from. One source means only one page gave it.',
      'Check recalls for your own VIN on GOV.UK.',
    ],
    note: 'The handbook and the labels on the car win over anything here.',
  },
};

// The User guide page: screen guides grouped by what you want to do.
export const GUIDE_GROUPS: { title: string; ids: GuideId[] }[] = [
  { title: 'Start here', ids: ['home', 'connect', 'garage', 'vehicle', 'carIds', 'carReference'] },
  { title: 'Find faults', ids: ['diagnostics', 'code', 'lookup', 'history', 'report', 'diagTests', 'mot'] },
  { title: 'Read the car', ids: ['live', 'sensors', 'dashboard', 'battery', 'performance', 'logger', 'fuelTrims', 'boost'] },
  { title: 'Drive monitors', ids: ['monitors', 'knock', 'dpf', 'trip'] },
  { title: 'Change settings', ids: ['customise', 'learnSetting', 'customiseGuide', 'service', 'serviceReset', 'diagChanges'] },
  { title: 'Tools', ids: ['knowledge', 'fuses', 'diary', 'diaryAdd'] },
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
      'Tap a fault for what it means and the likely causes.',
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
      'Once Find my car’s sensors has run, only the values your car answered are listed.',
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
      'Not tested on this car means it comes from a single source.',
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
      'Some emissions tests check that these are complete. The UK MOT manual does not say whether the tester reads them.',
      'Clearing faults resets them. Normal driving completes them again.',
    ],
  },
  lastScan: {
    title: 'Last health check',
    what: 'The faults found in the last health check of this car, saved on this phone.',
    how: ['Readable with no adapter.', 'Tap a fault for what it means and, where Caristini knows them, the likely causes and fixes.', 'Stopped early means the check did not finish.', 'No control module answered means only the engine’s standard codes were read, so it is not a clean result.'],
  },
  // Customise
  customiseSettings: {
    title: 'Settings',
    what: 'Settings documented by public sources for your car’s platform.',
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
      'Steps known, not yet tested by Caristini: sources say where it lives, but Caristini does not write it yet.',
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
      'Quick search: only the sensors your other cars and other owners of the same make already found, not yet asked on this car. It shows only when there are some.',
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
      'Check: may not apply means the reading looks wrong for that sensor.',
      'Tap the star to pin a value to Live data.',
    ],
  },
  // Live data
  liveHub: {
    title: 'Sensors on this car',
    what: 'The maker sensors your car answered in Find my car’s sensors.',
    how: ['Open a system for its live values.', 'Tap the star on a value to pin it to the top of this page.', 'Search all sensors finds a value by name.'],
  },
  liveStandard: {
    title: 'Standard readings (every car)',
    what: 'The standard values cars report over OBD2, such as speed, engine speed and coolant temperature.',
    how: [
      'Choose picks which values to watch. Fewer values update faster.',
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
      'Read every group of this module reads groups 1 to 255 and lists the ones with values. Learn my car reads them too and keeps the list.',
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
      'Tap a value to see its samples and possible readings, or name it.',
    ],
  },
  // Learn my car
  learnCarSteps: {
    title: 'What happens',
    what: 'The 8 steps of Learn my car, in order.',
    how: [
      'The step running now is marked Now. A step gets a green tick only when it finished.',
      'Failed: the step hit an error; the run carried on. Stopped or Not run: you tapped Stop. Carries on next time: the value step reached its time limit.',
      'What it finds is sent to your private findings store, unless Send what this run finds is off.',
    ],
  },
  learnCarResults: {
    title: 'Results',
    what: 'Where each result of this run is shown. Tap one to open it.',
    how: [
      'Faults opens the health check this run saved. MOT check has the car part done; the walk-round is left.',
      'Emissions self-tests shows this run’s read, with Read again to ask the car now.',
      'Customise and Live data use the modules, coding and sensors this run found.',
    ],
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
    what: 'Your runs on this car, newest first, saved on this phone.',
    how: [
      'Each shows the time, plus or minus how far it could be off, readings a second and, for the quarter mile, the speed at the line.',
      'Plus or minus: half the gap between speed readings at the start and at the finish, plus the effect of the car reporting whole km/h.',
    ],
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
  settingsSending: {
    title: 'Sending findings',
    what: 'What your car teaches Caristini (sensors, modules, settings, logs) goes to your private findings store on GitHub, filed under the car’s VIN, to be built into the next version.',
    how: [
      'Automatic sending uses the GitHub token built into this app, or one pasted under Developer options and kept in the phone keychain.',
      'Findings not sent yet wait on this phone and go by themselves the next time the app opens.',
      'Learn my car has a switch to keep one run on this phone.',
    ],
  },
  settingsTroubleshooting: {
    title: 'Troubleshooting',
    what: 'A log of the last 4,000 adapter commands and replies. It stays on this phone unless Send the log automatically is on.',
    how: [
      'Switch on Keep an adapter log, repeat what went wrong, then Share adapter log.',
      'With Send the log automatically on, new lines go to your private findings store after each health check, Find my car’s sensors, Learn my car or failed connect.',
      'Clear log empties it.',
    ],
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
      'Common service intervals are generic, not your maker’s plan: pick the one that matches your service book or handbook. A tick shows the one chosen.',
      'Mark service done today when the car has been serviced.',
      'Distance counts once Caristini knows the odometer: tap Read the odometer here, run a health check or make a health report.',
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
      'Codes marked Found by AI were saved by an earlier version from a web search, with the page shown under them. Check them against the label.',
      'Your own entry always replaces a saved one.',
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
    what: 'Entries saved for your make, model or platform, by earlier versions or by owners.',
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
  codeReading: {
    title: 'Reading the code',
    what: 'What each part of the code means.',
    how: ['The letter is the system: P engine and gearbox, C chassis, B body, U network.', 'A 0 or 2 after the letter is a generic code; a 1 means the maker defines it.'],
  },
  // Drive monitors (knock, DPF, trip, timer upgrade, second CAN bus): the
  // screen guides are in GUIDES, so the header ? and the section ? match.
  monHub: GUIDES.monitors,
  monKnock: GUIDES.knock,
  monKnockCylinders: {
    title: 'Per cylinder',
    what: 'Knock retard now and the peak since you started, for each cylinder.',
    how: ['0° means no timing pulled.', 'Peaks reset when you tap Start again.', 'The rate shows how many readings a second the engine gives.'],
  },
  monDpf: GUIDES.dpf,
  monDpfValues: {
    title: 'DPF values',
    what: 'The values your car answered, with their source.',
    how: ['Maker values come from owner sources and can differ from a dealer tool by a few per cent.', 'A value missing from the list was not answered by your car.'],
  },
  monTrip: GUIDES.trip,
  monTripFuel: {
    title: 'How fuel is worked out',
    what: 'Which method this car gets.',
    how: [
      'Petrol: from the air flow sensor, at 14.7 kg of air to 1 kg of petrol, corrected by the commanded mixture when the car gives it, and 0.755 kg per litre.',
      'Diesel: only from the fuel rate value (5E) if the car reports it. Diesels run with extra air, so the air flow method does not work.',
      'If neither is reported, fuel used shows as not available.',
    ],
    note: 'Under full load petrol engines run rich, so the air flow estimate reads a little low. On E10 petrol it also reads a little low.',
  },
  monPerfRanges: {
    title: 'Your speed ranges',
    what: 'Add your own timer, for example 50 to 70 mph.',
    how: ['Type a start and a target speed and tap Add. It joins the test list.', 'A start of 0 is a standing start.', 'Tap the bin to remove a range.'],
  },
  monSecondBus: {
    title: 'Second CAN bus',
    what: 'Some Ford and Mazda modules sit on a second, slower CAN bus on OBD pins 3 and 11.',
    how: [
      'Focus ST: instrument cluster, heating, audio and GPS. Mazda6: rear body module.',
      'A standard ELM327 adapter only uses pins 6 and 14, so it cannot reach them.',
      'With an OBDLink MX+ (or another OBDLink with the STN chip), the health check and part numbers include these modules.',
      'The vLinker FS is sold with automatic switching, but Caristini has not tested it.',
    ],
  },
  logValues: {
    title: 'Values to record',
    what: 'The values saved in each log for this car. Your choice is kept for next time.',
    how: [
      'Standard values come from the engine computer and are the quickest to read.',
      'Maker values and older VW groups need the adapter to talk to each module, so they are read less often.',
      'Caristini shares the adapter fairly between them, so a slow group does not hold the quick values back.',
    ],
  },
  logAuto: {
    title: 'Auto-start',
    what: 'Starts a log when the chosen value goes above the set level, and stops it once the value has stayed below for the set time.',
    how: [
      'Pick engine speed, accelerator pedal or throttle, then set the level and the stop delay.',
      'While waiting, only the trigger value is read, so it reacts quickly.',
      'Each start makes a new log. Tap Stop to end one early; turn Auto-start off to stop waiting.',
    ],
  },
  logMarkers: {
    title: 'Markers',
    what: 'A numbered line on the charts at the moment you tapped.',
    how: ['Tap Marker while recording. Markers are numbered 1, 2, 3 in order.', 'In the viewer, tap a marker in the list to put the cursor on it. The CSV has a Marker column.'],
  },
  logRate: {
    title: 'Reads a second',
    what: 'How many times a second the adapter answered, for all values together and for each kind of value.',
    how: ['Standard values read in one request where the car allows it.', 'Each maker module or older VW group adds its own wait, so it reads fewer times a second.'],
  },
  logSaved: {
    title: 'Saved logs',
    what: 'Logs kept on this phone for this car, newest first.',
    how: ['Tap a log to open its charts.', 'Logs stay on the phone until you delete them in the viewer.'],
  },
  logViewer: {
    title: 'Reading a log',
    what: 'Charts of each value over the log, or all values on one chart.',
    how: [
      'Drag across a chart to move the cursor. The values at that moment show above the charts and on each chart.',
      'All together scales each value to its own range, so the shapes line up; read the numbers from the list.',
      'Lowest, highest and average are worked out from every reading in the log.',
      'Share CSV gives one row per reading in your units, for Numbers or Excel.',
    ],
    note: 'Phone position (GPS) is not recorded in this version.',
  },
  diagScanChanges: {
    title: 'Since the last check',
    what: 'This health check compared with the last one of the same car that ran to the end, module by module.',
    how: [
      'New: not there last time. Seen before: also in the last check, so it has not gone away. Cleared: there last time, gone now.',
      'Checks that stopped early, or that no module answered, are not used for the comparison.',
      'Not read: the module did not answer this time, so its faults are not counted as cleared.',
    ],
  },
  diagTestResults: {
    title: 'Test results',
    what: 'The engine’s own emissions tests (OBD2 service 06), with the value measured and the limits the car allows.',
    how: [
      'Pass: inside the limits. Fail: outside them.',
      'Maker test: the meaning is the maker’s own and not public.',
      'Raw: the unit code is not in the standard table, so the bytes are shown as sent.',
    ],
    note: 'Test and unit names come from the python-OBD project’s tables of the SAE J1979 standard.',
  },
  diagCalibration: {
    title: 'Calibration',
    what: 'The engine software’s calibration IDs and calibration verification numbers (CVN), from OBD2 service 09.',
    how: ['The calibration ID names the software version. The CVN is a check number for it.', 'Several units can answer: each is listed.'],
  },
  diagInUse: {
    title: 'How often each self-test runs',
    what: 'Counters the engine keeps (OBD2 service 09): for each self-test, how many times it finished and how many drives gave it the chance.',
    how: ['The number on the right is finished divided by chances. A low number means the test rarely gets to finish on your drives.'],
  },
  diagTimeline: {
    title: 'Change timeline',
    what: 'Every setting change on this car, one line per module.',
    how: [
      'Old and new value: the setting in words, when known.',
      'Technical shows the bytes: the module’s coding or value before and after, and the backup, the coding the module had before Caristini first changed it.',
      'Put back appears while the module’s coding differs from its backup. Connect first; Customise asks before anything is written.',
    ],
  },
  // Live data and dashboard additions
  liveAlerts: {
    title: 'Alerts and lowest and highest',
    what: 'Your own limits for a value, and its lowest, highest and peak since you opened the page.',
    how: [
      'Tap a tile. Type a limit to warn above, below or both, in your units.',
      'Add an engine speed if the alert should only count above it, for example boost above 3000 rpm.',
      'Past a limit the tile turns red and the phone buzzes once. It buzzes again only after the value has been back inside for 5 seconds.',
      'The peak holds the highest reading for 3 seconds. Reset lowest and highest starts that value again.',
    ],
    note: 'Limits are kept for this car. Each alert reads only values already on the page, plus engine speed when an alert needs it.',
  },
  liveSets: {
    title: 'Saved sets',
    what: 'Named lists of values for this car, so you can switch between jobs, for example trims or a cold start.',
    how: [
      'Tick the values, type a name and tap Save set. The same name replaces the old set.',
      'Tap a set to load it, then Done. The bin deletes it.',
      'Search finds values by name, group or unit, for example trim, temp or kPa.',
    ],
  },
  liveViews: {
    title: 'Views',
    what: 'Pages that put related values side by side.',
    how: [
      'Fuel trims: shows on petrol cars that report fuel trims, with the lambda and oxygen sensors.',
      'Turbo boost: shows when the engine reports requested and actual boost. On the 2007 Leon Cupra this comes from engine group 115 on the older VW protocol.',
    ],
  },
  liveRate: {
    title: 'Readings a second',
    what: 'How many values arrive each second, and how often the whole page updates.',
    how: [
      'Each added value slows the page. Fewer values update faster.',
      'On CAN cars that allow it, Caristini asks for up to 6 values in one request. If the car answers only one, it goes back to one value per request by itself.',
    ],
  },
  liveTrims: GUIDES.fuelTrims,
  liveBoost: GUIDES.boost,
  liveDashPages: {
    title: 'Dashboard pages',
    what: 'Several dashboard pages for this car, each with its own values and tile style.',
    how: [
      'Swipe or tap a page name to switch. Only the page on screen is read, so it updates faster.',
      'Edit page sets its name, its tile style (number, dial, bar or graph) and how many tiles it has, 1 to 8.',
      'Tap a tile to change its value. Press and hold a tile for alerts and its lowest and highest.',
    ],
  },
  liveShift: {
    title: 'Shift light',
    what: 'The whole screen flashes red at the engine speed you set.',
    how: [
      'Tap Shift light above the gauges and type the engine speed. It is the same on every page of this car. Leave it empty to turn it off.',
      'With Reduce Motion on in iPhone settings, the screen turns red without flashing.',
    ],
    note: 'Keep your eyes on the road.',
  },
  motCar: {
    title: 'From the car',
    what: 'What the car reports that matters at an MOT.',
    how: [
      'Engine light on fails on petrol cars first used from 1 July 2003 and diesels from 1 July 2008 (manual 8.2.1.2 and 8.2.2.2).',
      'The tester checks the warning lamps, not the codes. To be safe, a fault that is there now is shown as a likely fail, since it may keep its lamp on; a pending or intermittent one is an advisory.',
      'Mark Dashboard warning lamps as Pass in the walk-round when every lamp goes out, and those faults become advisories.',
      'Lamp, horn and wiper faults are sorted by their fault text. Interior lamps and other faults are not MOT items as far as the manual shows.',
      'Battery voltage and the emissions self-tests are shown for information only.',
      'A complete health check from the last hour is used by itself, so the modules are not read twice. Read the car again for a fresh reading.',
    ],
  },
  motWalk: {
    title: 'Walk-round',
    what: 'The items a tester looks at, in groups, with what fails for each.',
    how: [
      'Tap Pass, Advisory, Fail or To do for each item. Tap the item to add a note.',
      'Fail if is taken from the MOT manual. Tap the item for how to check it and the manual section.',
      'An item whose worst defect is Minor still passes, so a Fail there counts as an advisory.',
      'Items that do not apply to your car by its year are greyed out.',
    ],
  },
  motResult: {
    title: 'Result',
    what: 'Likely fails first, then advisories, each with what to fix. Tap one for the manual section.',
    how: [
      'Dangerous and Major defects fail; Minor defects and advisories pass.',
      'Share sends the result as text. Save to History keeps it with the car.',
      'Start again clears the answers on this phone.',
    ],
    note: 'The registration is never sent anywhere. Check MOT history asks for it on GOV.UK.',
  },
};

// What leaves the phone, in one sentence, shown in Settings, Learn my car and
// Research notes. Matches src/share/sendBack.ts: files go to the findings repo
// at findings/<VIN>/..., or wait in the outbox on the phone.
export const WHAT_IS_SENT =
  'What Caristini learns about your car and the adapter log, including the VIN, make and model, part numbers, coding and values read, go to your private findings store on GitHub, filed under the VIN, and nowhere else unless you share them yourself.';
