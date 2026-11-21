# Pin16 consistency review, round 1

Date: 20 Nov 2026. Reviewer role: critical editor and UX reviewer. Scope: consistency only.

Method: read `DESIGN.md`, `PRODUCT.md`, `src/ui.tsx`, `src/theme.ts`, `src/help.ts`, `src/timeText.ts`, `src/vehicle/counts.ts`, `src/settings.tsx` in full; read the Car tab and Health check screens in full; extracted every user-visible string, component choice and number format from all other files in `src/app`, `src/screens`, `src/components`, `src/live`, `src/diag`, `src/learn`, `src/monitors`, `src/service`, `src/share`, `src/logger`. One screenshot checked against the code (`replica/ux-review-2026-11-16/03-car-connected-leon-light.png`). No browser used. No source file changed.

Not checked: the data libraries (`src/data`, `src/coding/catalogue.ts`, `src/mot/rules.ts` item text) beyond spot checks, and how the iOS share sheet treats plain text (finding C16 needs a check on the phone).

## 1. Score

**Consistency: 5 out of 10.**

Why: 2 high findings (the rubric caps the score at 6 for more than one high) and 20 medium findings. Feature names in screen titles, the shared components and the count helper are sound; the drift is in help text, messages, dates, time left, stop and delete behaviour, and colour and icon choices.

Counts: 2 high, 20 medium, 15 low. 37 findings.

## 2. Findings

Each finding lists every place, quotes each wording and gives 1 form to use.

### High

**C1. Clearing faults: help still says engine off; the screen says engine running.**
- `src/help.ts:651` (the ? beside the first faulty module in Health check): "Ignition on, engine off when clearing."
- `src/app/diagnostics.tsx:724`, `:726`, `:728` (confirm sheet): "Works with the engine running; a few modules only clear with it off."
- `src/help.ts:123`: "Faults can be cleared with the engine running. A few modules only clear with the engine off and the ignition on; the result names any that refused."
- `src/help.ts:587`: "Clearing works with the engine running."
- `src/app/diagnostics.tsx:299` (error): "Clearing stopped: ... Engine off, ignition on, then try again."
- `src/app/workshop/[id].tsx:516` (confirm sheet): "Clears this module’s fault memory. Faults still present come back." (no engine line at all)
- Use: "Works with the engine running. A few modules only clear with the engine off and the ignition on." in `help.ts:651`, in the Workshop confirm sheet, and as the hint in `diagnostics.tsx:299` ("If a module refuses, switch the engine off, leave the ignition on and try again.").

**C2. AI is mentioned in 5 user-visible places (rule: no mention of AI).**
- `src/app/car-ids.tsx:164` pill: "Found by AI, check"
- `src/app/knowledge.tsx:146` pill: "Found by AI" (against "Added by owner")
- `src/app/sensors.tsx:280` row text: "· named by AI"
- `src/help.ts:1044`: "Codes marked Found by AI were saved by an earlier version from a web search..."
- `src/vehicle/ids.ts:122` (text sent by Share all IDs): "(found by AI, check the data label)"
- Also in the design file, not user-visible: `DESIGN.md:426-427` "Pin16 AI card".
- Use: "From a web search, check" for the pill and the shared text, "From a web search" in Research notes, "· name from a web search" on sensors, and the same words in `help.ts:1044`. Delete the DESIGN.md section.

### Medium

**C3. Time left is written 4 ways.**
- `src/ui.tsx:719-723` (ProgressBar): "under a minute left", "about 6 min left", "about 2 h 10 min left"
- `src/app/diagnostics.tsx:408`: "about 45 s left" (no minutes form, so a long check shows "about 240 s left")
- `src/app/learn-car.tsx:197`: "about 45 s left" or "about 4 min left" (via `shortDuration`)
- `src/discover.ts:220`: "about 4 minutes" (full words)
- `src/app/battery.tsx:222`: "Start the engine now: 8 s left"
- Use: the ProgressBar form everywhere ("under a minute left", "about 4 min left"). Move `timeLeft` from `ui.tsx` into `src/timeText.ts` and call it from Health check and Learn my car.

**C4. Dates and times use 8 formats.**
- `src/app/(tabs)/(car)/index.tsx:307-315`: "today 21:40", "yesterday 08:15", "9 Nov, 17:02" (the comment on line 306 says "Today, 21:40")
- `src/components/LastScan.tsx:31` (used by Health check, MOT check, Battery test, Emissions self-tests, Health report): "9 Nov 17:02". Result: the same check reads "Last health check, today 21:40" on the Car tab (`index.tsx:157`) and "Last health check, 20 Nov 21:40" on the Health check page (`LastScan.tsx:38`).
- `src/logger/format.ts:285`, `src/app/performance.tsx:495`, `src/app/trip.tsx:175`: "9 Nov, 17:02"
- `src/app/history.tsx:66`, `src/app/customise/timeline.tsx:91`: "Mon 9 Nov 2026"
- `src/app/sensors.tsx:347`, `src/app/car-ids.tsx:218`, `src/app/(tabs)/(diary)/diary.tsx:125`: "9 Nov 2026"
- Numeric: `src/app/learn-car.tsx:105`, `src/app/service.tsx:152`, `src/app/knowledge.tsx:157`, `src/app/service-reset.tsx:177`, `src/service/obdReset.ts:184` and `:306`: "09/11/2026"
- Numeric with seconds: `src/app/customise/learn.tsx:206`, `src/app/discover.tsx:316`, `src/app/learn-car.tsx:308`, `src/app/service-reset.tsx:262`, `src/app/settings.tsx:200`, `src/app/report.tsx:56` and `:66` (in the PDF): "09/11/2026, 17:02:33"
- Phone locale, not en-GB: `src/app/modules.tsx:73` `new Date().toLocaleString()`
- Use: 1 helper in `src/timeText.ts`. Date: "9 Nov 2026". Date and time: "9 Nov 2026, 17:02". "today" and "yesterday" either in that helper for every screen or nowhere. Files (CSV, logs) keep ISO dates.

**C5. "Saved to ..." after a change or clear: 5 wordings, and "Diary" 3 ways.** Every one of these actions writes both History and the diary.
- `src/app/diagnostics.tsx:242`, `:255`: "faults cleared. Saved to your Diary."; `:291`: "Faults cleared and saved to your Diary."
- `src/app/customise/index.tsx:306`: "Switch the ignition off and on to see it. Saved to your Diary."
- `src/app/workshop/[id].tsx:206`: "Saved to History."; `:163`: "Fault memory cleared. Saved to History and your Diary."
- `src/app/service-reset.tsx:178`: "Saved to History and your Diary."
- `src/app/service.tsx:97`: "Saved to your Diary: ..."; `:174`: "Saves it to the diary and starts the reminder again"
- `src/help.ts:240`, `:585`: "saved to History and your diary"; `:271`, `:273`: "your diary"
- Use: "Saved to History and your diary." (lower-case diary; capital only for the Diary tab by name).

**C6. Stop buttons: 9 labels, 3 button styles, and help does not match.**
- Reads that keep part results: `diagnostics.tsx:413` "Stop and keep results" (secondary); `sensors.tsx:313` and `learn-car.tsx:210` "Stop and keep what was found" (secondary); `discover.tsx:279` "Pause" (secondary); `mot.tsx:239` "Stop" (a text link); `service-reset.tsx:216` "Stop" (secondary)
- Recordings: `logger.tsx:152` "Stop and save" (danger); `LiveScreen.tsx:204` "Stop (12)" (danger); `listen.tsx:138` "Stop recording" (danger); `trip.tsx:155` "Finish trip" (primary)
- Live watches: `knock.tsx:149`, `:260` "Stop" (secondary); `boost.tsx:126` "Stop" (primary); `workshop/[id].tsx:338` "Stop" (primary, icon stop) against `LiveScreen.tsx:679` "Stop live" (primary, chart icon); `dpf.tsx:141` "Stop watching" against `LiveScreen.tsx:504` "Stop watching for regeneration"
- Timer: `performance.tsx:441` "Cancel" with the stop icon
- Stopping state: `diagnostics.tsx:413` "Stopping after this module…" against `learn-car.tsx:210` "Stopping…"
- Help: `help.ts:425` "Tap Stop." (button is "Stop and save"); `help.ts:176` "Tap Stop, then Share CSV" (button is "Stop (12)")
- Use: reads "Stop and keep results" (secondary, a Button, MOT check included); recordings "Stop recording" (danger); live watches "Stop" (secondary); Performance "Stop". Help to quote those labels.

**C7. Car tab help describes groups and a button that are not there.**
- `src/help.ts:59`: "More tools, For experts and Driving list everything else." Screen: `index.tsx:231` "This car", `:242` "Driving", `:249` "Expert".
- `src/help.ts:61`: "The button at the top right disconnects from the car." Screen: `index.tsx:146-148` a "Disconnect" text link in the line under the title; the top right control is the ?.
- `src/app/_layout.tsx:44`: the tab stack is titled "Home" (shows in the back menu); the tab and guide say "Car".
- Use: "This car, Driving and Expert list everything else."; "Tap Disconnect, under the car's name, to disconnect."; title "Car".

**C8. Help names controls with words the screens do not use.**
- `src/help.ts:722`: "Switches you made with Learn a setting". Screen name: "Learn from Carista" (`_layout.tsx:69`, `customise/index.tsx:568`). Use "Learn from Carista".
- `src/help.ts:808`: "Search all sensors finds a value by name." Row: `LiveScreen.tsx:432` "Find my car’s sensors". Use the row name.
- `src/help.ts:458`: "mark each item Pass, Advisory, Fail or Not checked". Screen: `mot.tsx:399` "To do"; `help.ts:1344` already says "To do". Use "To do".
- `src/help.ts:143`: "Fuses and manuals opens the fuse box layouts." Row: `lookup.tsx:71` "Fuses for this car" or "Fuse boxes" under the header "Fuses and manuals". Use "Fuses and manuals" for the row.
- `src/help.ts:730` title "More settings" against `customise/index.tsx:563` "Get more settings".
- `src/help.ts:925` title "This session" against `performance.tsx:487` "Runs on this car" (the usual case).
- `src/help.ts:879` title "What Pin16 knows" against `learn-car.tsx:308` "What Pin16 knows about this car".
- `src/help.ts:664` title "Older modules": see C12.
- Use: in each pair, the screen wording.

**C9. Help and design files are out of date on writes to the car, and the 3 write paths behave differently.**
- `src/help.ts:345` (Control module): "Saving checks the battery first, keeps the original coding..." `src/coding/preflight.ts:2-3` and `:18`: nothing stops or delays a write. `src/help.ts:243` (Customise): "Nothing stops a change: not the engine running, a low battery..."
- The low-battery line (`preflight.ts:17`) is shown by Customise (`customise/index.tsx:242`, `:283`) and never by Workshop (`workshop/[id].tsx:181-186` reads only `block` and `warn`, both always null) or Reset with the adapter (`service-reset.tsx:155-160`).
- Customise writes at once (`customise/index.tsx:448`, `:512`, `:552`); Workshop and Reset with the adapter ask first (`workshop/[id].tsx:510-521`, `service-reset.tsx:313-323`). Each help text says so, but `DESIGN.md:444` ("put every write to the car behind the Confirm Sheet"), `DESIGN.md:432-433` (Pending changes bar) and `PRODUCT.md:31` ("Not built: coding writes") and `PRODUCT.md:50` do not.
- Dead confirm text left in the code: `customise/index.tsx:676-699` ("Switch on: ...?", "Ignition on and engine off is best."), `:705` ("Change anyway", "Change setting"); `workshop/[id].tsx:521` ("Save anyway").
- Use: `help.ts:345` "Saving keeps the original coding, reads the new one back and puts the original back if the module does not keep it." Show the low-battery line on all 3 paths. Update DESIGN.md and PRODUCT.md. Delete the dead branches.

**C10. Restore, Put back and Undo name the same action.**
- `customise/index.tsx:592` row "Restore {module} coding"; `:284` "tap Restore under Backups below" (no row has that label); `:292` diary note "Undo it in Customise > Backups."; `:705` confirm "Restore"
- `workshop/[id].tsx:494` button "Restore original coding"; `:208` "Use Restore original."
- `customise/timeline.tsx:157` "Put back"; `:82` "tap Put back again"; `help.ts:449` "Put back opens Customise"
- `help.ts:737` "Tap Restore to put a module’s original coding back."
- Use: button "Restore original coding" in Customise, Workshop and Change timeline; in sentences "puts the original coding back".

**C11. Research notes is called knowledge inside its own screen.**
- Title: `_layout.tsx:65` "Research notes"; rows `index.tsx:238`, `vehicle.tsx:117`
- `knowledge.tsx:107` "Search saved knowledge"; `:65` "Checking for new knowledge…"; `:167` "New knowledge also arrives by itself..."; `:168` "Check for new knowledge"
- `help.ts:293` "New knowledge arrives by itself..., or tap Check for new knowledge."; `help.ts:1118` title "Saved knowledge"
- `customise/index.tsx:575` "Notes from the knowledge base"; `kb.ts:152` "From the shared knowledge base."; `share/github.ts:20` "The knowledge base needs the GitHub token"
- Use: "notes" throughout: "Search research notes", "Check for new notes", "Saved notes", "From Research notes".

**C12. Older VW modules has 6 names.**
- `LiveScreen.tsx:637` and `settings.tsx:105`: "Older VW modules" (the set name)
- `diagnostics.tsx:571` header "Older modules"; `:628` "Look for older modules"; `:151` "The older-module search stopped"
- `LiveScreen.tsx:645` "Find older modules"; `help.ts:838` "Tap Find older modules"
- `customise/index.tsx:460` "Older modules on this car"; `knowledge.tsx:92` "Older modules found"
- `workshop/[id].tsx:250` pill "Older system"; `help.ts:341` "Older system means..."; `workshop/index.tsx:88` "Older VW protocol"
- `help.ts:664` title "Older modules"
- Use: "Older VW modules" for the thing, "Look for older VW modules" for the action on both screens, pill "Older VW module".

**C13. Engine light and Engine warning light are both used, 3 times on the same screen or page.**
- "Engine light": `index.tsx:171`, `diagnostics.tsx:433`, `mot.tsx:128`, `:284`, `:294`, `report.tsx:74` (PDF heading), `learn-car.tsx:24`, `help.ts:163`, `:456`
- "Engine warning light": `diagnostics.tsx:652`, `mot.tsx:248`, `report.tsx:75` and `:118`, `report.tsx:107`, `help.ts:57`, `:675`
- Use: "Engine light" everywhere; say "the engine warning light on the dashboard" once in the Health check guide.

**C14. Emissions self-tests: 3 words for each state, and "pending" clashes with the fault status.**
- Car tab: `index.tsx:172` "1 pending", "All done", "Not reported"
- Pill: `diag/readiness.ts:36` "Not yet run" (and "Complete"), used at `diagnostics.tsx:706`, `emissions-tests.tsx:151`
- Summary: `diag/readiness.ts:52-53` "3 of 8 complete. Not yet run: ..." and "All 8 complete."; `report.tsx:84` and `:119` "Complete", "Not yet run", "3 of 8 complete"
- Fault status also "Pending": `obd/uds.ts:196`
- Use: Car tab "1 not yet run" and "All complete".

**C15. Deleting things: some ask, some do not, and 4 verbs.**
- Ask first: `log-view.tsx:237-241` "Delete this log?"; `(diary)/diary.tsx:104-108` "Delete this entry?"; `trip.tsx:187-191` "Remove this trip?"; `performance.tsx:505-509` "Clear runs?"; `vehicle.tsx:122-129` "Remove this car?"; `mot.tsx:342-346` "Start again?"; Customise "Forget" (`customise/index.tsx:537`)
- Do not ask: `service-reset.tsx:201` and `:308` a learned service reset is removed on 1 tap; `dashboard.tsx:357-359` and `:522` "Delete this page"; `LiveScreen.tsx:878` saved set bin; `settings.tsx:153-158` "Clear log"; `performance.tsx:365` speed range bin
- Use: ConfirmSheet for anything that takes work to make again (learned reset, dashboard page, saved set). Verbs: "Delete" for something the owner made or recorded (log, trip, entry, page, set, range, learned reset), "Clear" for emptying a list, "Remove" for a car only.

**C16. "Share CSV" does 2 different things, and shared files are named 4 ways.**
- `LiveScreen.tsx:226-231`: "Share CSV" sends the CSV as message text (`Share.share`), no file. `LiveScreen.tsx:748` and `help.ts:176` say it opens in Numbers or Excel. To check on the phone.
- `log-view.tsx:98-105` and `customise/timeline.tsx:52-59`: a real .csv file.
- File names: `customise/timeline.tsx:52` "caristini-changes-{VIN}.csv"; `log-view.tsx:105` with `logger/store.ts:17` and `:110` "Pin16_log_{id}.csv" and "Pin16_route_{id}.gpx"; `report.tsx:91` the PDF gets the system's random name; `share/sendBack.ts:161` "{kind}-{last 8 of VIN}-{stamp}.json"
- Share titles: "Pin16 live data" (`LiveScreen.tsx:231`), "Pin16 adapter log" (`settings.tsx:145`), "Pin16 recording" (`listen.tsx:170`), "MOT check" (`mot.tsx:163`), "Change timeline" (`timeline.tsx:59`), "Health report" (`report.tsx:92`)
- Use: every "Share CSV" writes a file through `shareCsv`. Names "Pin16-{what}-{VIN}-{yyyymmdd}.{ext}", for example "Pin16-health-report-{VIN}-20261120.pdf".

**C17. The same fault tags have different colours and words in Health check and History.**
- `components/ScanChanges.tsx:39`: New red, Seen before amber, Cleared green
- `history.tsx:163` "2 new" amber; `:188` New amber, Seen before grey; `:165` cleared green
- Words: `history.tsx:164` and `diag/scanDiff.ts:110` "2 also in the last check" against the tag "Seen before" (`ScanChanges.tsx:34`, `history.tsx:133`)
- Use: New red, Seen before grey, Cleared green in both; "2 seen before".

**C18. A fault row is drawn 3 ways, and Workshop shows the raw status word.**
- `diagnostics.tsx:785-843`: code chip, title, "Active now · ..." from `STATE_LABEL` (`obd/uds.ts:193-198`)
- `workshop/[id].tsx:285-288`: ListRow with a red icon square, subtitle "P0300 · active" or "· stored" (the raw value, lower case)
- `components/LastScan.tsx:57-58` and `ScanChanges.tsx:50-51`: ListRow, title, "P0300 · Engine"
- Also `diagnostics.tsx:657` OBD rows "Stored, permanent" against "Active now" for module faults.
- Use: move `CodeRow` into `src/ui.tsx` and use it in all 4 places with `STATE_LABEL`.

**C19. Keeping the phone awake differs between screens that do the same kind of job.**
- Stay awake: `dashboard.tsx:61`, `boost.tsx:24`, `knock.tsx:52`, `dpf.tsx:211`, `trip.tsx:218`, `performance.tsx:222`, `logger.tsx:107`, `sensors.tsx:132`, `discover.tsx:102`, `learn-car.tsx:121`, `service-reset.tsx:87`
- Do not: Live data (`screens/LiveScreen.tsx`), Fuel trims (`fuel-trims.tsx`, the sibling of Turbo boost under Views), Workshop "Live" (`workshop/[id].tsx:338`), Health check (`diagnostics.tsx`), Read part numbers (`modules.tsx`), Learn from Carista (`customise/learn.tsx`, the wider compare is "about 5 minutes"), the MOT read (`mot.tsx`), Listen mode (`listen.tsx`)
- Two mechanisms: `useKeepAwake()` in 4 files, `stayAwake(tag)` (`src/keepAwake.ts:6`) in 7.
- Help mentions it once: `help.ts:501` "the phone stays awake".
- Use: `stayAwake` on every live view and every read longer than a few seconds.

**C20. "reads a second" and "readings a second".**
- "reads": `logger.tsx:45`, `:136`, `:177`; `log-view.tsx:89`; `help.ts:1213`
- "readings": `LiveScreen.tsx:188`, `dashboard.tsx:291`, `performance.tsx:418`, `:493`, `battery.tsx:248`, `knock.tsx:137`, `help.ts:228`, `:1301`
- "/s": `log-view.tsx:224` "4.2/s"
- Use: "readings a second".

**C21. Units and number formats.**
- Miles: "mi" (`history.tsx:68`, `customise/timeline.tsx:87`, `service.tsx:152`, `service/reminder.ts:48`, `trip.tsx:124`) against "miles" (`report.tsx:17`, `(diary)/diary.tsx:91`). Use "mi" after a figure.
- Units ignore Settings in the shared Change timeline: `diag/timeline.ts:83` column "Odometer km" and `:106` "{n} km" (no thousands separator), while the screen shows mi (`customise/timeline.tsx:87`). Use the owner's unit.
- Voltage: 2 decimals in Battery test (`battery.tsx:95`, `:201`, `:217`, `:223`), 1 decimal everywhere else (`index.tsx:176`, `diagnostics.tsx:439`, `dashboard.tsx:41`, `report.tsx:72`, `settings.tsx:107`, `coding/preflight.ts:17`). `help.ts:217` calls it "the same reading as on the Car tab". Use 1 decimal on summaries and say in Battery test help that it shows 2.
- Per cent: "10 %" (`fuel-trims.tsx:93`, `:133`, `:152`, `help.ts:512`) against "42%" (`ui.tsx:741`, `diagnostics.tsx:402`, `:616`, `service/procedures.ts:110`). Use "10%".
- Seconds in sentences: "10 s" (`dashboard.tsx:296`, `battery.tsx:251`, `obd/battery.ts:21`, `performance.tsx:167`, `:168`) against "10 seconds" (`LiveScreen.tsx:502`, `dpf.tsx:128`, `live/LiveTiles.tsx:189`, `help.ts:214`). Use words in sentences, "s" in figures and tables.
- Thousands separators missing: `settings.tsx:141` "{n} lines" (the footer on `:122` says "4,000"), `LiveScreen.tsx:748` "{n} readings", `listen.tsx:141` "{n} frames". Use `toLocaleString('en-GB')` as `vehicle/counts.ts:41` does.
- Lowest and highest: "min · max · peak" (`LiveScreen.tsx:274`, `dashboard.tsx:446`), "avg" (`LiveScreen.tsx:756`) against "Lowest", "Highest", "average" (`live/LiveTiles.tsx:190-192`, `log-view.tsx:217`, `:223`, help). Use "min" and "max" only on tiles, "average" in rows.

**C22. Icons and colour squares for the same feature differ, and 37 of 102 icons have no SF Symbol.**
- No SF Symbol in `ui.tsx:32-111`, so iPhone shows a Material glyph beside SF Symbols: `school-outline` (Learn my car, `index.tsx:222`), `radar` (Find my car’s sensors, `index.tsx:251`), `telescope` (Unknown values, `index.tsx:252`), `clipboard-list-outline` (MOT check, `index.tsx:236`), `chart-line` (Data logger, `index.tsx:246`), `book-open-variant` (Research notes, `index.tsx:238`), `ear-hearing` (Listen mode, `index.tsx:253`), `format-list-bulleted` (`index.tsx:183`), `bluetooth-off` (`diagnostics.tsx:310`), `timeline-text-outline`, `piston`, `turbine`, `gas-station`, `filter-outline`, `lightning-bolt` and 22 more.
- Health check icon: `heart-pulse` (`index.tsx:184`, `learn-car.tsx:20`, `guide.tsx:12`) against `stethoscope` (`history.tsx:14`)
- History: red (`index.tsx:203`) against blue (`index.tsx:58`, `vehicle.tsx:116`)
- Learn my car: indigo (`index.tsx:221`) against teal (`customise/index.tsx:570`, `knowledge.tsx:103`)
- Fuses and manuals: teal (`index.tsx:234`) against orange (`lookup.tsx:70`)
- Unknown values: indigo (`index.tsx:252`) against purple (`knowledge.tsx:91`)
- History kinds (`history.tsx:22`): health check blue, cleared orange, sensors teal; elsewhere clearing is red (`diagnostics.tsx:463`, `(diary)/diary.tsx:15`) and sensors blue (`index.tsx:251`)
- Settings in the User guide uses the Customise icon (`guide.tsx:38` `tune-variant`); Car reference uses the Research notes icon (`car-ids.tsx:200`) and another in the guide (`guide.tsx:49`)
- Use: 1 table of feature, icon and colour (in `ui.tsx` or `theme.ts`) read by every row, tile and the guide, and an SF Symbol for every icon in it.

### Low

**C23. Colour meaning drifts from DESIGN.md (amber for tap targets, red and green for fault and healthy only).**
- Amber or orange as a state: `index.tsx:172` and `diagnostics.tsx:706` (not yet run), `learn-car.tsx:300` "Now", `sensors.tsx:288` "check: may not apply", `customise/index.tsx:493` "Try it" amber against `service-reset.tsx:241` "Try" grey
- "Could not read": grey pill (`diagnostics.tsx:768`) against orange square (`diagnostics.tsx:523-524`, `workshop/[id].tsx:296`) and orange ring dot (`ui.tsx:910`)
- Green for things that are not a health result: `discover.tsx:398` "Moves", `service-reset.tsx:275` "Written", `service.tsx:103` "Maker source", `connect.tsx:136` "OBD adapter", `sensors.tsx:351` "Live"
- Red card for a state that is not a fault: `logger.tsx:144` (recording), `dpf.tsx:119` (regeneration)
- Use: either follow DESIGN.md (these become grey) or add "amber: needs attention, not a fault" to DESIGN.md and apply it the same way everywhere.

**C24. Not-connected states: 3 patterns.**
- `NeedsConnection what`: "Connect to see faults" (`diagnostics.tsx:316`), "live data" (`LiveScreen.tsx:177`), "your car's sensors" (`sensors.tsx:112`), "boost", "fuel trims", "test results", "part numbers", "this module"
- `NeedsConnection title`: "Connect your car to change settings" (`customise/index.tsx:164`) and 11 more; "Connect your car for the dashboard" (`dashboard.tsx:205`); "Connect your car to discover its values" (`discover.tsx:80`, old feature name)
- Own notice: `mot.tsx:106-107`, `monitors.tsx:29` "Not connected. Connect the adapter to use these tools.", `diagnostics.tsx:310`, `settings.tsx:112` "Connect to the adapter first." against `service.tsx:165` "Connect the adapter first"
- Use: "Connect your car to {verb} ..." in every case, for example "Connect your car to see live data", "Connect your car to explore unknown values".

**C25. Errors after a read stops: 5 patterns.**
- `diagnostics.tsx:153` "The check stopped: {reason}. Check the ignition is on, then tap Check again."
- `emissions-tests.tsx:64` "Reading stopped: {reason}. Check the ignition is on, then tap Read again."
- `mot.tsx:139` "Reading stopped: {reason}. Ignition on, then try again."
- `diagnostics.tsx:212` says "tap Check again" after the older-module search, where the button is "Look for older modules again".
- Bare reason only: `workshop/[id].tsx:75`, `sensors.tsx:180`, `discover.tsx:176`, `customise/learn.tsx:119`, `modules.tsx:64`, `report.tsx:96`
- Use: "{What} stopped: {reason}. Check the ignition is on, then tap {button}."

**C26. Old words left in visible text.**
- `diagnostics.tsx:462` "Available when the scan finishes." Use "check".
- `discover.tsx:166` History detail "Discover sweep finished". Use "Unknown values: explore finished".
- `history.ts:64` and `history.tsx:30` kind and chip "Learning" for Unknown values and Learn my car entries; `help.ts:148` lists "Learn my car". Use "Learn my car" for the chip.
- `discover.tsx:272` progress label "Saying hello". Use "Starting" as `sensors.tsx:310` does.

**C27. Leftovers that a user cannot see.**
- Storage keys with the old app name: `diary.ts:22` 'gauge.diary.v1', `vehicle/garage.tsx:131` 'gauge.garage.v1' against `settings.tsx:54` 'caristini.settings.v1', `history.ts:68` 'caristini.history.v1'. Renaming needs a migration.
- `DESIGN.md:385` tabs "Car, Lookup, Diary, Garage" (the 4th tab is Settings, `(tabs)/_layout.tsx:27`); `DESIGN.md:361` "Scan for adapters" (button is "Search for adapter", `connect.tsx:119`).
- `.old` files in `src/app` and `src/screens` (for example `src/app/ask.tsx.old`, `src/app/(tabs)/(ai)/ai.tsx.old`).

**C28. Dashboard: gauge and tile for the same thing.**
- "gauge": `dashboard.tsx:296` "Tap a gauge", `:610` "This gauge", `help.ts:200`
- "tile": `dashboard.tsx:510` "Tile style", `:512` "Tiles", `help.ts:201`, `:1316` "Tap a tile to change its value. Press and hold a tile..."
- Use: "gauge" on Dashboard ("Gauge style", "Gauges"); "tile" stays for Live data.

**C29. Smaller naming pairs.**
- "Lookup" (`(tabs)/_layout.tsx:19`, `lookup.tsx:32`, guide title) against "Code lookup" (`index.tsx:60`, `help.ts:60`). Use "Lookup".
- "Vehicle details" (`_layout.tsx:71`, `help.ts:98`) and "Unknown vehicle" (`vehicle/garage.tsx:168`) in an app that says "car" everywhere else (`index.tsx:239` "Edit details"). Use "Car details".
- "Workshop", "the Workshop" (`help.ts:881`), "the workshop" (`workshop/index.tsx:39`). Use "Workshop".
- "Health report" (`_layout.tsx:60`), "Make a PDF health report" (`diagnostics.tsx:464`), "Make PDF" (`report.tsx:122`), "the PDF report" (`help.ts:368`). Use "Health report" and "Make health report".
- "customisations" (`vehicle.tsx:60`, `customise/[id].tsx:15`, `help.ts:246`) against "settings". Use "settings".
- "OBD2 port" (`index.tsx:46`), "OBD port" (`battery.tsx:227`), "diagnostic port" (`report.tsx:72`, `:86`, `help.ts:166`). Use "OBD port".
- "private findings store" (most), "findings store" (`learn-car.tsx:236`, `listen.tsx:171`), "private findings repo" (`help.ts:772`). Use "private findings store".
- "measuring values" (`workshop/index.tsx:59`) against "values". Use "values".
- "Check every address" (`diagnostics.tsx:476`) against "Read all {n} addresses" (`modules.tsx:122`). Use "every address" in both.

**C30. Clearing faults: label, sheet and History title do not line up.**
- Health check: row "Clear {module} faults" (`diagnostics.tsx:510`), sheet title "Clear {module}?" (`:721`), button "Clear {module}" (`:733`) or "Clear faults" for older modules
- Workshop: row "Clear these faults" (`workshop/[id].tsx:300`), sheet "Clear {module} faults?" (`:512`), button "Clear faults" (`:521`)
- History title: "Faults cleared" (`diagnostics.tsx:220`) against "{module} faults cleared" (`workshop/[id].tsx:162`); message "Fault memory cleared" (`workshop/[id].tsx:163`) against "faults cleared" (`diagnostics.tsx:242`)
- Use: row "Clear {module} faults", sheet "Clear {module} faults?", button "Clear faults", History "{module} faults cleared".

**C31. Empty and no-value placeholders.**
- No value: "–" (`workshop/[id].tsx:351`, `battery.tsx:217`, `logger.tsx:189`, `trip.tsx:125`), "No reading" (`LiveScreen.tsx:244`, `log-view.tsx:149`, `fuel-trims.tsx:112`), "No data" (`dashboard.tsx:413`, `diag/freeze.ts:66`), "…" (`index.tsx:176`, `logger.tsx:179`), "None yet" (`live/LiveTiles.tsx:190`, `boost.tsx:134`), "No answer" (`dpf.tsx:166`), "?" (`customise/timeline.tsx:133`)
- Empty lists: "Nothing here yet" (`history.tsx:119`), "Nothing logged yet" (`(diary)/diary.tsx:52`), "Nothing saved yet" (`knowledge.tsx:114`), "Nothing read yet" (`car-ids.tsx:220`) against "No changes yet" (`customise/timeline.tsx:115`), "No runs yet" (`performance.tsx:499`), "No trips yet" (`trip.tsx:183`), "No readings yet" (`battery.tsx:282`)
- Use: "…" while a first read is running, "No reading" when the car gave none; "No {things} yet" for empty lists.

**C32. Progress and sheets are built by hand in several files.**
- Progress for a read: ModuleRing and a percentage (`diagnostics.tsx:387-402`), ScanPulse and ProgressBar (`sensors.tsx:304-310`, `discover.tsx:260-270`, `learn-car.tsx:189-207`), ScanPulse and a line of text (`modules.tsx:102-105`), spinner and text (`diagnostics.tsx:613-617` with its own percentage, `customise/index.tsx:345`, `mot.tsx:234`, `workshop/index.tsx:66`). Only ProgressBar shows counts and time left.
- Sheet bars copied per file: `LiveScreen.tsx:848-852`, `dashboard.tsx:491-495`, `:556-560`, `:603-605`, `logger.tsx:339-343`, `live/LiveTiles.tsx:178-184`; confirm word "Done" in 4 and "Save" in `LiveTiles.tsx:184`.
- Text-link rows built with Pressable (`diagnostics.tsx:501-511`, `:529-539`, `:596-606`, `:619-629`), chips (`customise/index.tsx:357-375`, `(diary)/diary.tsx:69`, `log-view.tsx:137`), tone colours redefined (`mot.tsx:408`) where `toneColours` exists (`ui.tsx:471`), labels written as raw Text (`service-reset.tsx:284`, `customise/learn.tsx:265`) where `Label` exists.
- Use: add `Sheet` (bar with Cancel, title, Done), `ActionRow` and `Chip` to `ui.tsx`; use ProgressBar with counts for every read of more than 1 module.

**C33. Apostrophes: straight and curly both appear in visible text.**
- Straight: `index.tsx:187` "this car's", `diagnostics.tsx:118` and `:456` "engine's", `settings.tsx:62-68` "phone's region", `sensors.tsx:112`, `components/LastScan.tsx:48`, `service-reset.tsx:294`
- Curly: all 64 in `help.ts`, `_layout.tsx:61`, `settings.tsx:94`, `learn-car.tsx:102`
- Use: curly in all visible text.

**C34. An em dash character is used as a legend mark.** `boost.tsx:103` (the Actual legend) and `boost.tsx:102` "- - Requested". Use 2 small drawn line swatches (solid and dashed), as the chart draws them.

**C35. "Technical" and "Technical details".** `customise/index.tsx:416` and `customise/timeline.tsx:151` "Technical" and "Hide technical"; `modules.tsx:195` "Technical details" and "Hide technical details"; `help.ts:355`. Use "Technical" and "Hide technical".

**C36. Help states a fixed unit where the screen follows Settings.** `help.ts:177` "Coolant above 110 °C shows a warning." The screens convert (`LiveScreen.tsx:134`, `dashboard.tsx:212`). Also 2 wordings of that warning: `LiveScreen.tsx:134` "Stop when safe and let the engine cool." against `dashboard.tsx:37` "Slow down, stop when it is safe and let the engine cool." Use "110 °C (230 °F)" in help and the Dashboard sentence in both.

**C37. Small copy slips.**
- `discover.tsx:265` "1 values found" (no singular).
- `discover.tsx:299` "Full explore (carries on)" against `:356` "Carry on: full explore".
- `guide.tsx:64` "how to use it" against `index.tsx:62` and `settings.tsx:189` "how it works".
- `performance.tsx:378` "Choose a test" against `help.ts:225` "Pick a test"; `workshop/index.tsx:59` "Pick a control module" against `:72` "Select control module".
- `components/LastScan.tsx:57` "Meaning not in the library yet" against `report.tsx:82` "Meaning not in the library".
- Menu paths: ">" (`obd/bleTransport.ts:78`, `customise/index.tsx:292`, `help.ts:447`) against commas (`background.ts:50`, `logger/gps.ts:43`).
- `LiveScreen.tsx:502` "while this screen is open" against "this page" in 12 other places.
- Step notes in Learn my car end with and without a full stop (`learn/runLearn.ts:337`, `:457`, `:609` against `:408`, `:640`, `:654`).

## 3. What must be fixed

**To reach 8** (no high, only a few low or medium left): C1 and C2, and every medium, C3 to C22. Of the low ones, C24, C26 and C29, because they are naming and the rules list "one name per feature".

**To reach 9** (trivial nits only): all of the above plus C23, C25, C28, C30, C31, C32, C33, C34, C35, C36. C27 and C37 can stay as nits, but they take minutes.

Quickest gains, text only: C1, C2, C5, C7, C8, C10, C11, C12, C13, C14, C20, C26, C29. Need a shared helper: C3, C4, C16, C21. Need behaviour changes: C6, C9, C15, C19. Need component work: C17, C18, C22, C32.

## 4. What is already consistent

- Feature names in screen titles and on the Car tab match the list: Health check, Learn my car, Find my car’s sensors, Unknown values, Live data, Dashboard, Data logger, Drive monitors, MOT check, Customise, Battery test, Read part numbers, Research notes.
- British English throughout the screens and help (tyre, colour, customise); digits for numbers; no em dashes in sentences.
- "Tap" for a tap and "press and hold" for a long press, everywhere. Most buttons are verb first, and all are in sentence case. Group headers are sentence case.
- Counts of sensors, values and modules come from `vehicle/counts.ts` and read the same on the Car tab, Live data, Learn my car and Research notes. Durations before a run come from `timeText.ts` ("About 3 minutes").
- Speed, distance and temperature follow Settings on screens and in CSV files through `toUserUnits` (the 1 gap is in C21).
- Switches use 1 green track colour; confirm sheets use the shared `ConfirmSheet`; help sheets and the ? buttons are 1 component on every screen; "Read-only: nothing is written to the car." is worded the same in help.
- "Stopped early", "No control module answered", "Could not read", "No faults" and "{n} modules not found" are the same on the Car tab, Health check, History, MOT check and Read part numbers.
- No TODO text, no placeholder text, and no visible use of the old app name.
