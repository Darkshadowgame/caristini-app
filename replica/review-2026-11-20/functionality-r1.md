# Pin16 functionality review, round 1

Date: 20 Nov 2026. Reviewer: product tester (functionality only).

How it was checked: the web preview at http://localhost:8090 in the in-app browser at 375 x 812, on the demo cars SEAT Leon Cupra (Learn my car to the end, health check, clear all, MOT check, Customise write and restore, change timeline, History, Diary, Live data, data logger, knock monitor, Parts and IDs, vehicle details), Mazda6 (health check, DPF monitor, Learn my car left part-way) and Audi A6 (battery test, Workshop list and one module). The code was read for every finding. `npx tsc --noEmit` passes. Jest: 413 of 414 pass, 1 fails (finding 27).

Each finding says "Repeated in the browser" or "Code only".

## 1. Score

**Functionality: 6 out of 10.**

Why: 1 high, 11 medium and 17 low findings. The rubric gives 7 for "several medium issues or one high". This build has both the high and 11 medium issues, so it sits below 7. It is above 5 because the core reads work well: Learn my car ran all 8 steps with progress and time left, the health check read, cleared and compared faults correctly, and the coding write, read-back, backup and restore all worked on the demo Leon.

## 2. Features

| Feature | Verdict | One line |
|---|---|---|
| Connect and car detection | works (demo only) | Demo connect, car naming and Your cars work. Bluetooth not checked. |
| Car tab | partly | Good when connected. With no adapter it gives no way to the MOT check, saved logs or the battery reading (finding 4). |
| Learn my car | works | 8 steps, progress, time left, results linked. Leaving the page stops it without asking (finding 5). |
| Health check, read | works | Modules, engine codes, freeze frame, self-tests, compare with the last check. |
| Health check, clear | works | Clear all and per module worked, older VW module included. No clear from the saved view (finding 13). |
| Fault code page and Lookup | works | Meaning and links shown. "On your car now" list not checked. |
| History | works | Entries by day with filters. A coding write can be missing (finding 1). Entries cannot be deleted. |
| Diary | works | Automatic entries arrive. Same gap as History for finding 1. |
| Live data | works | Standard values, older VW groups, record to CSV in memory. |
| Dashboard | partly (code only) | Standard values only: no maker sensors or older VW groups (finding 12). Not driven in the browser. |
| Data logger | works (preview) | Record, marker, save, charts and delete worked. Route, screen-off and auto-start not checked. |
| Drive monitors | partly | DPF works on the Mazda6. Knock has no data on the demo Leon. Trip not driven. Nothing but trips is saved. |
| MOT check | partly | Read and walk-round work. Shows an old car read after a newer health check (finding 2). Not reachable with no adapter. |
| Customise | partly | Write, read-back, backup and restore worked on the Leon. A write can go unrecorded (finding 1). VW group only (finding 7). |
| Change timeline and Backups | partly | Correct for recorded changes. Misses the unrecorded write of finding 1. |
| Battery test | partly | Readings work. Results are not kept (finding 9). Crank step not checked. |
| Service guides and reminder | partly | Guides fine. Reminder cannot be set from a past service or a typed odometer (finding 6). |
| Reset with the adapter | partly (code only) | Nothing built in: a reset must first be learned from another tool (finding 11). |
| Health report PDF | not checked | Code read only. Needs the adapter (finding 25). |
| Parts and IDs, Vehicle details | partly | Lists and codes work. Save on Vehicle details can wipe them (finding 3). |
| Workshop | partly checked | List and module page open. Coding write from Workshop read in code only. |
| Find my car's sensors, Unknown values, Listen mode, Learn from Carista | not checked | Code skimmed for stop and leave handling only. |
| Performance timer | not checked | |
| Settings, User guide | not checked | Help text read against the code (finding 19). |

## 3. Findings, most severe first

### High

**1. A coding write leaves no record, and the screen shows the old setting, if you leave while it is writing.** Feature: Customise, Workshop coding, Change timeline, History, Diary.
- Steps (repeated in the browser, Leon demo): Customise > flip "Leaving home lights" > go back within 1 second (the write takes about 8 seconds and shows only a small spinner). Result: the car has the setting on (shown after Read settings again), History and Diary have no entry, the Change timeline lists 2 changes where 3 were made, and Customise shows the setting as off until Read settings again.
- Code: `src/app/customise/index.tsx:269` returns when the screen has gone, before `client.sessionValues.set` (272), `setCodings`, the cache update (275), `addDiary` (292) and `addHistory` (296). Same pattern in `src/app/workshop/[id].tsx:195` (write) and `:159` (fault clear). Related, code only: a Workshop write never updates `client.sessionValues`, and Customise reuses those values on re-entry (`index.tsx:121`), so Customise can show old switch states after a Workshop write. The compare inside `writeCoding` (`src/obd/elm.ts:2191`, `2278`) stops a write from old data, so no wrong bytes are written.
- Help broken: "Every change is saved to History and your diary" (`src/help.ts:240`), "Every setting Pin16 changed on this car" (`src/help.ts:443`).
- Fix: after the write returns, always update `client.sessionValues`, the coding cache, Diary and History; guard only the `setState` calls with `alive.current`. Do the same in Workshop (write and clear), and set `client.sessionValues` there too. Add a "Writing, keep this page open" line beside the spinner.

### Medium

**2. The MOT check keeps showing an old car read after a newer health check.** Feature: MOT check.
- Steps (repeated in the browser): Learn my car (4 faults, engine light on) > clear all faults > health check now shows 0 faults, light off > tap "MOT check, Can use this health check". Result: "2 likely fails, Engine warning light On", footer "From Learn my car, 20 Nov 16:02". The same would hide a new fault after an earlier clean read.
- Code: `src/app/mot.tsx:94` uses a recent health check only when `draft.read` is empty; the "Use the health check from" row (`:283`) shows only when there is no read. The health check row promises otherwise (`src/app/diagnostics.tsx:465`).
- Fix: when a complete health check is newer than `draft.read.at`, apply it (or show "Newer health check from 16:03: use it" as the first row) and show the read's age in the hero.

**3. Save on Vehicle details overwrites anything saved since the page opened.** Feature: Your cars, Parts and IDs.
- Steps (repeated in the browser): Your cars > the Leon > Parts and IDs > type engine code BWJ (the researched parts appear) > back > Save. Result: `ids.codes` is empty again in storage; the engine code is gone.
- Code: `src/app/vehicle.tsx:20` copies the whole vehicle into `draft` once; `:98` writes `{ ...draft, year, edited: true }` back over the car. Module IDs read from Parts and IDs on that visit are lost the same way.
- Fix: save only the edited fields (nickname, brand, model, year, group, platform, fuel, edited).

**4. With no adapter there is no way to the MOT walk-round, saved logs, saved emissions read, last battery reading, trips or runs.** Feature: Car tab, MOT check, Data logger.
- Steps (repeated in the browser): disconnect. The Car tab offers History, Code lookup, Service reset guides, User guide and Your cars only. The car's page (`src/app/vehicle.tsx`, Records) adds Parts and IDs, Research notes and Diary.
- Code: the only links to `/mot`, `/logger`, `/battery`, `/report` and `/emissions-tests` are in the connected Car tab (`src/app/(tabs)/(car)/index.tsx:179-246`) and connected screens. The offline branches exist but cannot be reached: `src/app/mot.tsx:46-50`, `src/app/logger.tsx:27-35` and `372` (OtherCarsLogs), `src/app/battery.tsx:92-99`, `src/app/emissions-tests.tsx:72-98`.
- Help broken: "the walk-round can be done over a few days" (`src/help.ts:461`); "The log appears under Saved logs; open it to see the charts" (`src/help.ts:425`) only holds while connected.
- Fix: add MOT check, Saved logs, Battery (last reading) and Emissions self-tests rows to the Records group on the car's page and to the "No adapter needed" group for the last car.

**5. Leaving a long run stops it without asking.** Feature: Learn my car, health check, Find my car's sensors, Unknown values, MOT read.
- Steps (repeated in the browser, Mazda6 demo): Learn my car > Start > after 8 seconds tap back. The run ended in step 1 with no question and no message.
- Code: `src/app/learn-car.tsx:77-81` sets `stop.current = true` on unmount; same in `src/app/diagnostics.tsx:77-83`, `src/app/sensors.tsx:69-75`, `src/app/discover.tsx:63-69`, `src/app/mot.tsx:65-71`. No screen blocks the back gesture or asks. The help says switching apps and locking are safe, and says nothing about leaving the page.
- Fix: while a run is active, ask "Stop the run and keep what was found?" on back (expo-router `usePreventRemove`), or keep the run in a provider above the screen so it carries on and the Car tab shows its progress.

**6. The service reminder cannot be set up for a car serviced before today, and cannot count distance on the Leon.** Feature: Service.
- Code: `lastDate` and `lastKm` are written only by "I did this reset" and "Mark service done today" (`src/app/service.tsx:63`, `src/app/service-reset.tsx:176`), always as today. With an interval picked and no service marked, the row reads "Set the last service to start" (`src/service/reminder.ts:58`) and there is no control to set it. The odometer comes only from the car (`src/app/service.tsx:36-49`); older VW modules are skipped (`src/obd/elm.ts:1529-1532`), and Learn my car on the Leon demo said "the car did not give its odometer". The whole reminder is hidden when not connected (`src/app/service.tsx:130`), and nothing notifies the owner when a service is due.
- Fix: add "Last service: date and mileage" and "Odometer now" fields (typed, in the unit from Settings); show the reminder for the last car when not connected; show "Service due" on the not-connected Car tab.

**7. Customise has switches only on VW group cars with a known platform.** Feature: Customise.
- Code: `src/coding/items.ts:234` returns no settings unless `group === 'vag'` and a platform is set. Repeated in the browser: the Mazda6 demo shows "Customise, 1 guide". The Focus ST gets guides only too (4 Ford and Mazda guide entries in `src/mods/catalogue.ts`, 0 in `src/coding/catalogue.ts`).
- Effect: 2 of the owner's 3 cars have no coding switches. The Customise help (`src/help.ts:232-243`) does not say so. PRODUCT.md still lists coding writes as "Not built".
- Fix: say on the Customise page and in the help which cars have switches, and offer Learn from Carista as the first row on cars with none. Longer term: sourced Ford and Mazda settings.

**8. The "ask whether it worked, put it back if not" step is promised but never runs.** Feature: Customise, From your other cars, Try these.
- Code: `setAsk` is only ever called with `null` (`src/app/customise/index.tsx:193`, `660`), so the "Did you see it?" sheet (`:651-666`) never opens and `undoTry` (`:191`) is never reached. The footer of "From your other cars" promises it (`:484`), as does the unused confirm text (`:693`). A setting borrowed from another car can therefore never be confirmed into this car's own list (`:662-666`).
- Fix: either call `setAsk({ id, title, done, login })` after a successful write of a low-confidence or borrowed setting, or remove the promise and the dead code and add "Works / No effect" buttons under the switch.

**9. Battery test results are not kept.** Feature: Battery test.
- Code: rest, crank, idle and load readings live in screen state only (`src/app/battery.tsx:54-58`); nothing is written to the car record, History or Diary, and there is no Share. Leaving the page loses the test. Only the single voltage from Learn my car or the health check is saved.
- Fix: on each completed step save the result on the car (`battery.test`), show the last test with its date when the page opens, and add a History entry (new kind "battery") with the 4 verdicts.

**10. A dropped adapter link is never picked up again.** Feature: connection, Data logger, Trip computer, Dashboard. Code only; not checked on a phone.
- Code: `src/state.tsx:116-121` sets an error and drops the client; auto-connect runs once per app start (`:211-216`). The logger saves and ends (`src/logger/recorder.ts:336-341`, `src/app/logger.tsx:86-95`), the trip ends. The owner must open Connect, wait for the search and tap the adapter while driving.
- Fix: on a lost link, try the last adapter again for about 60 seconds (3 or 4 attempts) while the screen shows "Reconnecting"; let the logger and trip resume into the same log when the same VIN comes back.

**11. "Reset with the adapter" cannot reset any car until another tool has done it once.** Feature: Service reset. Code only.
- Code: the list of public resets is empty (`src/service/obdReset.ts:327`). On the Leon the cluster speaks the older protocol, so learning by compare is switched off (`src/app/service-reset.tsx:249-253`) and only Listen mode with a Y-splitter and a second adapter is left. The help describes resets "from a public source (Try, orange)" (`src/help.ts:280`) that do not exist.
- Fix: say plainly on the page "No reset is built in for this car yet", list what is needed (another tool once, or a Y-splitter), and remove the "Try, orange" line from the help until a public reset ships.

**12. Dashboard gauges can show standard values only.** Feature: Dashboard. Code only.
- Code: `src/app/dashboard.tsx:105` builds the pick list from `client.livePidsForCar()`; the read loop uses `readLiveMany` only (`:143`, `:174`). Maker sensors found by Find my car's sensors and older VW value groups (boost in group 115, knock in 020) cannot be put on a gauge, so the Leon has no boost or oil temperature gauge. The data logger already offers all 3 kinds (`src/logger/recorder.ts:52-97`).
- Fix: reuse `channelOptions` from the logger for the gauge picker and its 3 read paths.

### Low

**13. The saved health check has no next step but a new check.** `src/app/diagnostics.tsx:322-338`. Repeated in the browser: Learn my car > Faults shows the 4 faults and only "Check again"; no Clear, PDF or MOT row. Fix: add Clear all faults (which runs a check first), Make a PDF and MOT check under the saved list.

**14. The Car tab says "First read done" after a run that stopped in step 1.** `src/app/(tabs)/(car)/index.tsx:125`. Repeated in the browser (Mazda6: "First read done 20 Nov: 5 modules"). Fix: say "First read stopped early" unless `learnFullAt` is set.

**15. "Checking again to see what comes back" stays on screen after the check has finished.** `src/app/diagnostics.tsx:291`. Repeated in the browser. Fix: replace it with "Faults cleared. Nothing came back." or the count that returned once the re-check ends.

**16. MOT Save and Share work while the car is still being read.** `src/app/mot.tsx:330-331`. Repeated in the browser: the History entry saved "3 likely fails" from the old read while the new read was at module 5 of 6. Fix: disable both while `step` is set.

**17. The rest reading accepts a charging voltage.** `src/obd/battery.ts:12-13`, `src/app/battery.tsx:105-126`. Repeated in the browser (A6 demo): 14.16 V judged "Rest, engine off: Good, close to full charge". When engine speed is not reported the engine check is skipped. Fix: above 13.0 V say "This looks like a running engine or surface charge; switch off, wait and read again". Also add a `catch` to the 3 step functions so a failed read shows a message.

**18. The knock monitor reports a reading rate for a group that does not answer, and blames the engine for any error.** `src/app/knock.tsx:87-101`, `:110`. Repeated in the browser (demo Leon has no group 020): "2.6 readings a second of group 020" beside "The engine did not answer value group 020". Peaks and the verdict are not saved. Fix: count only non-empty answers; show the real error text; keep the last session's peaks on the car.

**19. Help text that does not match the app.** `src/help.ts:59` names groups "More tools, For experts" (the page says "This car", "Expert"); `:345` "Saving checks the battery first" (the check never stops a save, `src/coding/preflight.ts:2-5`); `:234` gives the needle sweep as a switch example (guide only on the Leon); `src/app/dpf.tsx:133` says "every few seconds" (it is 15). Fix: correct the 4 lines.

**20. The restore result shows where the user is not looking.** `src/app/customise/index.tsx:341` (a message without an id renders at the top). Repeated in the browser: after Restore under Backups at the bottom, the Backups group vanished and the notice was off screen. Fix: show the result in place, or scroll to the top.

**21. The "Faults cleared" entry lists one fault twice, and re-read modules are not saved.** `src/app/diagnostics.tsx:259-288` (repeated in the browser: "Cleared P0420, P0171, P0300, 00532, 16684", where P0300 and 16684 are one fault); "Try these again" (`:172-190`) updates the screen only. Fix: de-duplicate with `faultKey`; update the History entry after a retry.

**22. The Diary groups cars by name.** `src/app/(tabs)/(diary)/diary.tsx:34-35`. Renaming a car splits its entries; 2 cars with one name merge. Automatic entries carry no mileage though the odometer is known. Fix: filter by VIN; pass `odometerKm` in the unit from Settings.

**23. Live data's Record is lost on leaving the page.** `src/screens/LiveScreen.tsx:206-220`. Readings sit in memory until Share CSV. Fix: point Record at the data logger, or warn on leaving with unsaved readings.

**24. A logger read error ends the recording with no reason given.** `src/logger/recorder.ts:336-341`. Any error other than a lost link saves the log and shows only "Saved". Fix: add "Recording stopped: <error>".

**25. The health report needs the adapter and is not kept.** `src/app/report.tsx:35-41`. Most of its content is saved on the phone. Fix: allow a report from saved data when not connected, marked with the dates; add a History entry when a PDF is made.

**26. The DPF monitor shows internal file names as sources and forgets regenerations.** `src/app/dpf.tsx:170` ("mazda6-sources Z5 capture", repeated in the browser); regenerations seen live in state only (`:31`). Fix: owner-readable source labels; save regenerations on the car.

**27. One Jest test fails.** `__tests__/uxFixes.test.ts:55` expects "Steps known, not yet tested by Pin16"; `src/mods/catalogue.ts:26` says "Guide only, no switch yet". Fix: update the test or the label.

**28. History entries cannot be removed.** `removeHistory` (`src/history.ts:111`) has no caller. A test entry, or the MOT entry saved in finding 16, stays for good. Fix: a Delete link on an opened entry, with a confirmation.

**29. A switch writes at once, with no question, low-confidence settings included.** `src/app/customise/index.tsx:441-450`. This is the owner's choice of 20 Nov 2026 (`src/coding/preflight.ts:2`) and the help says so, but PRODUCT.md principle 4 says "asks first". Listed so the 2 documents agree. Fix: update PRODUCT.md, or ask once for "Try these" settings only.

## 4. What must be fixed

**To reach 8** (no high, and only a few low or medium issues that do not get in the way):
- Finding 1 (the high).
- Findings 2, 3, 4, 5, 6, 8, 9 and 10.
- Findings 7, 11 and 12 may stay as known limits for this round if the page and the help state them plainly (finding 7: which cars have switches; finding 11: no built-in reset; finding 12: standard values only).
- Finding 27, so the test run is green.

**To reach 9** (trivial nits only):
- Everything above, plus findings 7, 11 and 12 fixed in function, not only in wording.
- Findings 13 to 26 and 28.
- Finding 29 settled either way.

## 5. What I could not check

- Bluetooth, a real adapter and real cars. Everything ran on the simulated demo cars in the web preview.
- Losing the adapter mid-run (the preview has no way to drop the link; findings on it are from the code).
- Background running, the screen-off logger, GPS route and GPX share, sounds and buzzes, share sheets, the PDF.
- Sending findings to the findings store: "Send what this run finds" was switched off for both Learn runs, so nothing was sent.
- Ford Focus ST and VW Golf demo cars.
- Knock values (the demo Leon answers group 115 only), the crank step of the battery test, the trip computer under way, the performance timer, the dashboard's pages and alerts, logger auto-start.
- Find my car's sensors, Unknown values, Listen mode, Learn from Carista, Reset with the adapter (running a reset), Workshop coding write, Settings.
- The "On your car now" list in Lookup.

Notes for the next round:
- The in-app browser's local storage for localhost:8090 now holds 3 demo cars with history, diary entries and 1 MOT entry from this review.
- Loading a deep link such as /dpf directly returns 404 from the static server; the preview must be entered from /.
