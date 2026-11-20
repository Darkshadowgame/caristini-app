# Functionality fixes A, round 1

Date: 20 Nov 2026. Source: `functionality-r1.md`, findings 1, 6, 7, 8, 9, 11, 17, 19 and 20, plus bug review item L4 (`bugs-r1.md`), added by the coordinator.

## Findings

- 1 (high): fixed. After a coding write returns, Customise and Workshop always update `client.sessionValues`, the saved coding, the diary and History, whether or not the page is still open; only the page state calls are guarded. Workshop does the same for the fault clear and now sets `client.sessionValues`. A line "Writing. Keep this page open." shows beside the spinner. Also recorded now: a change where one module took it and a later one refused or the write broke off (title ends "(part done)" or "(not kept)").
- 6: fixed in part. Service > Reminder has typed fields for the last service date, its mileage and the odometer now, in the unit from Settings, with Save. The reminder shows for the last car when no adapter is connected. New garage fields `odometerTypedKm` and `odometerTypedAt`; the reminder counts from the newer of the typed figure and the reading from the car. Not done: "Service due" on the Car tab with no adapter (the Car tab belongs to another owner), and no notification when a service falls due.
- 7: fixed as a stated limit. On a car with no built-in switches Customise says at the top which cars have them (VW group cars whose model Caristini knows), and the Get more settings group, with Learn from Carista as its first row, moves to the top. The help says the same. Not done: sourced Ford and Mazda switches. PRODUCT.md is outside `src` and was left alone.
- 8: fixed as decided. The unused question sheet, `undoTry` and the text that promised a question are gone. Switches still write at once with no confirm. A setting from another of the owner's cars that is switched on and kept by the module is added to this car's own learned list.
- 9: fixed. Each completed battery step is saved on the car (`batteryTest`), the page opens on the last test with its date (with or without the adapter), and each test keeps 1 History entry (new kind `battery`) with the verdicts. A test left part-way carries on within 30 minutes.
- 11: fixed as a stated limit. The reset page says no reset is built in for any car, and what learning one needs (another tool once; a Y-splitter for recording). The help lines about public "Try" resets are removed. Not done: a built-in reset.
- 17: fixed. A step 1 reading above 13.0 V is shown with a plain message and is not judged or saved. All 3 step functions catch a failed read and show a message.
- 19: fixed in part. Needle sweep is no longer the switch example in the Customise help. The "More tools, For experts" and "Saving checks the battery first" lines had already been corrected by another editor. `src/app/dpf.tsx:133` ("every few seconds") is not one of my files and was left.
- 20: fixed. The result of a put back tapped under Backups shows beside Backups and stays when the list empties. A put back opened from the change timeline shows at the top, where the page opens.
- Bug review L4 (coordinator): fixed. The end of the settings read builds the coding cache from `garage.latest(v.vin)`, so a switch flipped during the read is not overwritten with old bytes.

## Choices to check

- The row is titled "Learn from Carista" (the name of the page it opens and the name used in the help), not "Learn a setting from Carista".
- `src/history.ts` and `src/app/history.tsx` are outside my list. I added the `battery` kind there (type, label, icon, colour, filter chip) because a History entry of an existing kind would carry the wrong label. The edits only add.
- `restVerdict` is unchanged, so the Car tab, the health check and the MOT notes read as before. The 13.0 V rule is in `restTooHigh`, used by the Battery test.

## Files changed

- `src/app/customise/index.tsx`
- `src/app/workshop/[id].tsx`
- `src/app/service.tsx`
- `src/app/service-reset.tsx`
- `src/app/battery.tsx`
- `src/obd/battery.ts`
- `src/service/reminder.ts`
- `src/coding/shared.ts`, `src/coding/items.ts` (comments only)
- `src/help.ts` (entries: customise, customiseLearned, customiseMore, service, serviceReset, serviceReminder, serviceObd, serviceResets, battery, batteryRest)
- `src/vehicle/garage.tsx` (3 optional fields added: `odometerTypedKm`, `odometerTypedAt`, `batteryTest`)
- `src/history.ts`, `src/app/history.tsx` (kind `battery` added)
- `__tests__/reminder.test.ts` (5 tests added), `__tests__/batteryTest.test.ts` (new, 5 tests)

## Checks

- `npx tsc --noEmit`: passes, no errors (run after the last source edit).
- `npx jest --testPathIgnorePatterns "[\\/]\.claude[\\/]"`: 475 of 484 tests pass, 9 fail in 3 suites, none in the files above.
  - `__tests__/uxFixes.test.ts`, 1 test: finding 27 (the "Guide only, no switch yet" label in `src/mods/catalogue.ts`). Another owner's area.
  - `__tests__/learnRepeat.test.ts`, 6 tests, and `__tests__/uxRecheck.test.ts`, 2 tests: all 8 stop on the test time limit (120 s and 60 s) inside Learn my car runs on the simulated cars. The 2 in `uxRecheck` time out again when run on their own. These runs go through `src/learn/runLearn.ts`, `src/obd/elm.ts` and `src/obd/tp20.ts`, which changed at 18:09 to 18:18 in another owner's work. Whether the cause is those changes or the load on the laptop (about 45 node processes while the tests ran) is not known.
- The new and changed tests pass: `__tests__/reminder.test.ts` 8 of 8, `__tests__/batteryTest.test.ts` 5 of 5.

Not checked in the app: the web preview on port 8090 serves a build made at 15:58, before these changes, and rebuilding it is outside `src` and `__tests__`.