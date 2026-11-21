# Pin16 consistency fixes, round 1

Date: 20 Nov 2026. Source: `consistency-r1.md` in this folder. Scope: text and presentation in `src` and `__tests__` only. Nothing committed or published. Other agents were changing the same screens at the same time, so every change here is a small targeted edit.

## One line per finding

| Finding | Result | Note |
|---|---|---|
| C1 | Fixed | One line on every clear-faults sheet and in help: "Works with the engine running. A few modules only clear with the engine off and the ignition on." The clearing error now ends "If a module refuses, switch the engine off, leave the ignition on and try again." |
| C2 | Fixed in `src` | All 5 visible mentions reworded ("From a web search, check", "From a web search", "name from a web search"). `DESIGN.md` section left: outside `src`. |
| C3 | Fixed, 2 places left | `leftText` and `timeLeft` are in `src/timeText.ts`; ProgressBar, Health check and Learn my car call them. Left: the Battery test countdown ("8 s left" is a 10 second countdown, so the seconds are the point) and `src/discover.ts:220`, which is a time before a run and already uses the shared duration wording, so the finding is wrong for that line. |
| C4 | Fixed | `dateText` ("9 Nov 2026"), `dateTimeText` ("9 Nov 2026, 17:02") and `clockText` in `src/timeText.ts`; every screen, the PDF and the service reset titles call them. "today" and "yesterday" are used nowhere. Files keep ISO dates. |
| C5 | Fixed | "Saved to History and your diary." everywhere both are written. Service keeps "Saved to your diary: ..." for "I did this reset", because History is only written when a car is connected. |
| C6 | Fixed, 2 kept | Reads: "Stop and keep results" (secondary Button, MOT check included). Recordings: "Stop recording" (danger). Live watches: "Stop" (secondary). Performance: "Stop". Stopping state: "Stopping…". Help quotes these. Kept: Reset with the adapter "Stop" (a stopped read keeps nothing, so "keep results" would be untrue) and Trip computer "Finish trip" (the pair of "Start trip"; now in the recording style). |
| C7 | Fixed | Car tab help names "This car, Driving and Expert" and the Disconnect link; the tab stack title is "Car". |
| C8 | Fixed | Help uses the screen wording in all 8 pairs. Lookup row is now "Fuses and manuals". |
| C9 | Fixed in `src` | Dead confirm text removed from Customise and Workshop ("Change anyway", "Change setting", "Save anyway", the unused switch confirm lines). Help says "Saving keeps the original coding, reads the new one back and puts the original back if the module does not keep it." The low-battery line now shows on a failed write in Workshop and Reset with the adapter too. No confirm, warning or block added to Customise switches or fault clearing. `DESIGN.md` and `PRODUCT.md` left: outside `src`. |
| C10 | Fixed | "Put back" for the action in Customise, Workshop, Change timeline, help and the diary note; "Backups" stays the section name. |
| C11 | Fixed | "notes" throughout Research notes: "Search research notes", "Check for new notes", "Saved notes", "From Research notes". |
| C12 | Fixed | "Older VW modules" for the thing, "Look for older VW modules" for the action on both screens, pill "Older VW module". |
| C13 | Fixed | "Engine light" everywhere; the Health check guide says once that it is the engine warning light on the dashboard. |
| C14 | Fixed | Car tab says "1 not yet run" and "All complete". |
| C15 | Fixed | ConfirmSheet added for: a learned service reset, a dashboard page, a saved Live data set, a speed range and Clear log. Verbs: Delete (trip, set, page, range, learned reset), Clear (log, runs), Remove (car). Customise switches and fault clearing unchanged. |
| C16 | Fixed, parts left | Live data "Share CSV" shares a .csv file through `shareCsv`. One name pattern from `shareFileName`: `Pin16-{what}-{VIN}-{yyyymmdd}` for the live data CSV, change timeline, log CSV, route GPX and health report PDF (logs use their own start stamp so 2 logs from 1 day keep their names). Left: findings sent to the private store keep their names (the store's own paths, read by other tooling); the adapter log, Listen recording and MOT check are shared as text, so they have no file name. To check on the phone: the PDF copy to the named file, and the Live data CSV in the share sheet. |
| C17 | Fixed | New red, Seen before grey, Cleared green in Health check and History; "2 seen before" in both. |
| C18 | Fixed | One `CodeRow` and `FaultRow` in `src/components/CodeRow.tsx`, used by Health check, Workshop, the last health check and its changes; Workshop shows the `STATE_LABEL` words. Placed in `src/components`, as `src/ui.tsx` would have had to import the connection state and fault library. |
| C19 | Fixed | `stayAwake` / `allowSleep` (and a small `useStayAwake` hook) on Health check, Live data, Fuel trims, Workshop Live, Read part numbers, Learn from Carista, the MOT read and Listen mode; the 4 `useKeepAwake()` screens moved to the same helper. |
| C20 | Fixed | "readings a second" in the data logger, log viewer and help. |
| C21 | Fixed | "mi" after a figure; the shared Change timeline uses the owner's unit with a thousands separator; "10%"; seconds as words in sentences; thousands separators on lines, readings and frames; "average" in rows. Battery test keeps 2 decimals and its help says so. |
| C22 | Part fixed | One icon and colour per feature in place: Health check heart-pulse, History red, Learn my car indigo, Fuses and manuals teal, Unknown values indigo, clearing red, sensors blue, Settings and Listen mode icons in the User guide, Car reference icon. Not done by instruction: no SF Symbol names added or changed in `src/ui.tsx`. Not done: a single feature table read by every row. |
| C23 | Skipped | Needs a design decision (follow DESIGN.md or add an amber rule). |
| C24 | Fixed | "Connect your car to {verb} ..." on every not-connected state; the smaller notices say "Connect your car". The MOT check notice for a phone that has never met a car is kept. |
| C25 | Part fixed | Health check and MOT check messages follow the pattern, and the older-module search names its own button. The bare-reason screens are left. |
| C26 | Fixed | "check" for "scan", "Unknown values: explore finished", chip "Learn my car", "Starting". |
| C27 | Skipped | Storage keys need a migration; DESIGN.md and `.old` files are outside this job. |
| C28 | Fixed | Dashboard says "Gauge style" and "Gauges"; help matches. |
| C29 | Fixed | Lookup, Car details, Unknown car, Workshop, Health report and "Make health report", settings, OBD port, private findings store, values, "every address". |
| C30 | Fixed | Row "Clear {module} faults", sheet "Clear {module} faults?", button "Clear faults", History "{module} faults cleared". |
| C31 | Part fixed | Empty lists now "No entries yet", "No notes yet", "No modules read yet". No-value placeholders left. |
| C32 | Skipped | Component work across files other agents are changing. |
| C33 | Part fixed | Curly apostrophes in about 30 visible strings. Not swept: data libraries and `src/obd`. |
| C34 | Fixed | The Turbo boost legend uses 2 drawn line swatches. |
| C35 | Fixed | "Technical" and "Hide technical" on Read part numbers and in help. |
| C36 | Fixed | Help says "110 °C (230 °F)"; Live data uses the Dashboard sentence. |
| C37 | Part fixed | "1 value found", "Carry on: full explore", "how it works", "Choose a test", "Choose a control module", "Meaning not in the library yet", "this page". Left: menu path marks and the full stops on Learn my car step notes. |

## Tests

- New: `__tests__/timeText.test.ts` (time left, dates, shared file names).
- Updated to the new wording: `__tests__/diag.test.ts` ("1 seen before", plus a test for the odometer unit), `__tests__/ids.test.ts` ("from a web search").
- Updated to wording already committed by other work: `__tests__/uxFixes.test.ts` expected "Steps known, not yet tested by Pin16"; `src/mods/catalogue.ts` has said "Guide only, no switch yet" since commit 99c3910. This test failed before any change here.

## Results, 20 Nov 2026

- `npx tsc --noEmit`: passes.
- `npx jest --testPathIgnorePatterns "[\\/]\.claude[\\/]"`: 43 of 45 suites pass. 8 tests in `__tests__/learnRepeat.test.ts` and `__tests__/uxRecheck.test.ts` stop on their time limit (60 or 120 seconds each).
- Cause of the 8: uncommitted changes another agent is making in `src/obd/elm.ts` and `src/obd/tp20.ts` (files this job may only change strings in). Check made: a throwaway copy of the project with every change from this job, and those 2 files as they were at 16:15, passes `uxRecheck` (26 of 26 in 19 seconds) and `learnRepeat`. The only edit from this job in those files is 1 message string in `elm.ts`.
- Not checked on a phone: nothing here was run in the app.

## Files changed

Shared: `src/timeText.ts`, `src/keepAwake.ts`, `src/ui.tsx`, `src/help.ts`, `src/history.ts`, `src/kb.ts`, `src/version.ts`, `src/components/CodeRow.tsx` (new), `src/components/LastScan.tsx`, `src/components/ScanChanges.tsx`, `src/diag/scanDiff.ts`, `src/diag/timeline.ts`, `src/coding/apply.ts`, `src/logger/format.ts`, `src/service/obdReset.ts`, `src/share/github.ts`, `src/vehicle/ids.ts`, `src/vehicle/garage.tsx`.

Visible strings only: `src/diag/healthCheck.ts`, `src/learn/runLearn.ts`, `src/obd/elm.ts`, `src/obd/battery.ts`.

Screens: `src/screens/LiveScreen.tsx`, `src/app/_layout.tsx`, `src/app/(tabs)/(car)/index.tsx`, `src/app/(tabs)/(diary)/diary.tsx`, `src/app/(tabs)/(lookup)/lookup.tsx`, `src/app/battery.tsx`, `src/app/boost.tsx`, `src/app/car-ids.tsx`, `src/app/code/[code].tsx`, `src/app/connect.tsx`, `src/app/customise/index.tsx`, `src/app/customise/[id].tsx`, `src/app/customise/learn.tsx`, `src/app/customise/timeline.tsx`, `src/app/dashboard.tsx`, `src/app/diagnostics.tsx`, `src/app/discover.tsx`, `src/app/dpf.tsx`, `src/app/emissions-tests.tsx`, `src/app/fuel-trims.tsx`, `src/app/guide.tsx`, `src/app/history.tsx`, `src/app/knock.tsx`, `src/app/knowledge.tsx`, `src/app/learn-car.tsx`, `src/app/listen.tsx`, `src/app/log-view.tsx`, `src/app/logger.tsx`, `src/app/modules.tsx`, `src/app/monitors.tsx`, `src/app/mot.tsx`, `src/app/performance.tsx`, `src/app/report.tsx`, `src/app/sensors.tsx`, `src/app/service-reset.tsx`, `src/app/service.tsx`, `src/app/settings.tsx`, `src/app/trip.tsx`, `src/app/vehicle.tsx`, `src/app/workshop/[id].tsx`, `src/app/workshop/index.tsx`.

Tests: `__tests__/timeText.test.ts` (new), `__tests__/diag.test.ts`, `__tests__/ids.test.ts`, `__tests__/uxFixes.test.ts`.
