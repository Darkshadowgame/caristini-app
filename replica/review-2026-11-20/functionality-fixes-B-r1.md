# Functionality fixes B, round 1

Date: 20 Nov 2026. Source: `functionality-r1.md`. Scope: findings 2, 3, 4, 5, 10, 12, 13, 14, 15, 16, 18, 21, 22, 23, 24 and later low findings outside Customise, Workshop, Service and Battery. Plus 2 items from `bugs-r1.md` passed on by the coordinator (L6 and the screen part of M1).

Not checked in the web preview: it serves the `dist-web` export made at 15:58, which does not hold these changes, and rebuilding it writes outside `src`. Not checked on a phone.

## Findings

| No. | Result | What changed |
|---|---|---|
| 2 | Fixed | The MOT check uses a complete health check by itself when it is newer than the car read (any age), says so in a notice, and shows the read's age under the result ("From the health check 4 minutes ago"). With no read yet, the 1-hour rule is unchanged. |
| 3 | Fixed | Save on Vehicle details writes nickname, make, model, year, maker group, platform, fuel and the edited mark only. |
| 4 | Fixed | New rows for MOT check, Saved logs, Battery (last reading) and Emissions self-tests in Records on the car's page and in "No adapter needed" on the Car tab (last car). The MOT check opens for the car whose page it was opened from. Limit: Saved logs, Battery and Emissions rows show only where their page has something to show for that car, because those 3 pages take no car and show the connected car or the last car. |
| 5 | Fixed | Going back during Learn my car, a health check, Find my car's sensors, Unknown values or the MOT read asks "Stop the run and keep what was found?" (shared ConfirmSheet, `usePreventRemove` from `expo-router`). "Stop and go back" stops the run, waits up to 8 seconds for it to save, then goes back. Leaving the app or locking the phone asks nothing and stops nothing. Help updated on the 5 pages. |
| 10 | Fixed | A dropped Bluetooth link is tried again 4 times (waits of 2, 8, 12 and 15 seconds, about 60 seconds with the time each try takes). The Car tab shows "Reconnecting ... try 2 of 4" with "Stop trying". Opening Connect, connecting by hand or disconnecting stops it. Only `src/state.tsx` and the new `src/reconnect.ts` changed; the Bluetooth transport is untouched. A logger or trip that ended stays ended. |
| 12 | Fixed in wording, as decided | The gauge picker and the Dashboard help say gauges take standard values and that maker values and older VW value groups are in Live data and the Data logger. No maker or older-VW gauges built. |
| 13 | Fixed | The saved health check has Clear all faults (checks the car first, then the usual clear question), Make health report and MOT check. |
| 14 | Fixed | The Car tab says "First read stopped early" until a full read has ended (`learnFullAt`), and "Run it again to finish". |
| 15 | Fixed | After the check that follows a clear, the message says "Nothing came back", the count that came back, or that the check did not finish. |
| 16 | Fixed | MOT Share and Save are disabled while the car is being read, with a line saying when they are ready. |
| 18 | Fixed | The reading rate counts only answers that hold values; a real error shows as "Reading stopped: <error>"; the peaks and verdict of the last session with readings are kept on the phone per car and shown on the page. |
| 19 | Part | `help.ts:59` (Car tab group names) was already corrected by the wording pass. `dpf.tsx` "every few seconds" now gives the real 15 seconds. The 2 Customise and Workshop lines belong to the other owner. |
| 21 | Fixed | The cleared list names each fault once (P0300 and 16684 are one). After "Try these again" the saved check is updated: its History entry (faults, modules, title, detail) and the car's saved fault list. |
| 22 | Fixed | The Diary groups and filters by VIN and shows the car's name as it is now; 2 cars with one name get the last 4 VIN characters. The "Faults cleared" entry from the Health check carries the odometer in the unit from Settings. Limit: the automatic entries written by Customise, Workshop and Service are in the other owner's files and still carry no mileage. |
| 23 | Fixed without a question | A Live data recording is kept while Caristini is open, so leaving the page and coming back still offers Share CSV; the page and help point to the Data logger for recordings saved with charts. No warning on leaving was added (only finding 5 may add a question). |
| 24 | Fixed | A logger read error ends the recording with "Recording stopped: <error>" (1 line in `src/logger/recorder.ts`). |
| 25 | Skipped | A health report from saved data needs the report builder in `src/app/report.tsx` reworked and a new History kind in `src/history.ts`; neither file is in this scope. |
| 26 | Fixed | DPF values show owner-readable sources ("Mazda6 research notes"); regenerations seen are saved per car on the phone and listed on later visits. |
| 27 | Not mine | Customise guide label against its test. |
| 28 | Skipped | Deleting a History entry needs a confirmation, and the only new question allowed this round is the one in finding 5. Needs the owner's decision. |
| 29 | Not mine | Customise. |

## From bugs-r1.md

| Item | Result | What changed |
|---|---|---|
| L6 | Fixed | `transport.onLost` is set before `initialise()`. A link lost while the car is identified fails the connect with "Connection lost" in place of a "connected" state on a dead link. |
| M1, screen part | Fixed | On Learn my car the rows under "What Caristini knows about this car" and the Unknown values row are disabled while a run is in progress. |

## Files changed

Edited:
- `src/state.tsx`
- `src/app/mot.tsx`, `src/mot/read.ts`
- `src/app/vehicle.tsx`
- `src/app/(tabs)/(car)/index.tsx`
- `src/app/(tabs)/(diary)/diary.tsx`
- `src/app/learn-car.tsx`, `src/app/diagnostics.tsx`, `src/app/sensors.tsx`, `src/app/discover.tsx`
- `src/app/dashboard.tsx`, `src/app/knock.tsx`, `src/app/dpf.tsx`
- `src/screens/LiveScreen.tsx`
- `src/logger/recorder.ts` (1 line, finding 24)
- `src/help.ts` (19 lines added or replaced in the entries for these pages)

New:
- `src/leaveRun.tsx` (the back-while-running question)
- `src/reconnect.ts` (reconnect schedule and wording)
- `src/diag/recheck.ts` (message after a clear, cleared list, retry merge)
- `src/vehicle/records.ts` (record rows, Vehicle details save)
- `src/components/CarRecords.tsx` (the record rows)
- `src/learn/runLabel.ts` (Car tab Learn label)
- `src/diaryCars.ts` (Diary cars by VIN, diary mileage)
- `src/monitors/knockStore.ts`, `src/monitors/dpfStore.ts` (last knock session, DPF regenerations and source labels)
- `__tests__/functionalityB.test.ts`

## Tests

- `npx tsc --noEmit`: passes (run at 18:36 after the last source edit here, and again at 18:58).
- `__tests__/functionalityB.test.ts` (new): 36 of 36 pass.
- `npx jest --testPathIgnorePatterns "[\\\\/]\.claude[\\\\/]"`, full run ending 18:48: 45 suites, 42 pass, 3 fail; 484 tests, 475 pass, 9 fail. None of the 9 is in a file changed here:
  - `uxFixes.test.ts`, 1 test: the Customise guide label (finding 27, other owner).
  - `uxRecheck.test.ts`, 2 tests, and `learnRepeat.test.ts`, 6 tests: each runs Learn my car on a demo car and times out (60 s and 120 s limits). Both suites fail the same way run by themselves (run ending 19:01: 8 of their 38 tests fail). Probable cause, not confirmed: the wait added today in `src/obd/elm.ts` `request()` (lines 792 to 795), where a standard request waits up to 20 seconds while `addressed` is set. That file, `src/obd/tp20.ts` and `src/learn/runLearn.ts` were changed by others between 18:09 and 18:18. Other test runs were going on at the same time, so machine load is not ruled out.
