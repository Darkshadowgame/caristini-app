# Caristini consistency review, round 2

Date: 20 Nov 2026. Scope: grep and reads over `src` (app, screens, components, help.ts, timeText.ts, and other folders where a visible string was found). Review only. No source file edited, no git, no browser, tests not run.

Not checked: `DESIGN.md` and `PRODUCT.md` (outside `src`), the data libraries (`src/data`), and the iPhone share sheet.

## 1. Score

**Consistency: 7 out of 10** (round 1: 5).

Why: no high findings remain. Two medium findings are verified in this pass (R2-1, R2-2). Two more medium findings from round 1 are still open per the fixes log (C22 icons, C32 hand-built progress and sheets) and were not re-checked here. Under the rubric, several medium findings means 7.

Counts: 0 high, 2 medium verified (plus 2 open from round 1, not re-verified), 11 low verified.

## 2. The six checks from round 1

| # | Check | Result | Evidence |
|---|---|---|---|
| 1 | No user-visible "AI" or "gauge" as the app name | Pass | No "AI" in visible text. "gauge" appears only as the Dashboard feature ("Gauge style", "Gauges": `dashboard.tsx:507-509`, `help.ts:210-212`). AI appears only in comments (`learn-car.tsx:50`, `runLearn.ts:12`). |
| 2 | help.ts: faults clear with the engine running; Customise switches write at once | Pass | `help.ts:130`, `:614`, `:678` say "Works with the engine running. A few modules only clear with the engine off and the ignition on." Clear sheets use `CLEAR_ENGINE_LINE` (`diagnostics.tsx:40`, used at `:820-826`) and `workshop/[id].tsx:509`. No "engine off when clearing", "asks whether" or "checks the battery first" in `src`. Customise has a confirm sheet only for Forget and Put back (`customise/index.tsx:680-691`); switches write without one, as `help.ts:259` says. |
| 3 | Time left and dates through timeText.ts | Pass, 2 exceptions | `leftText`/`timeLeft` in `timeText.ts:55-61`, used by `ui.tsx:1067`, `diagnostics.tsx:501`, `learn-car.tsx`. Dates through `dateText`, `dateTimeText`, `clockText` across about 25 files. No bare `toLocaleString()` (all use `'en-GB'`). No "today" or "yesterday". Exceptions: R2-10, R2-11. |
| 4 | Stop labels | Pass, 2 residuals | "Stop and keep results": `diagnostics.tsx:506`, `discover.tsx:283`, `sensors.tsx:322`, `learn-car.tsx:220`, `mot.tsx:263`. "Stop recording": `logger.tsx:153`, `LiveScreen.tsx:232`, `listen.tsx:141`. "Stop": `knock.tsx:185,304`, `LiveScreen.tsx:546,711`, `dpf.tsx:158`, `boost.tsx:136`, `workshop/[id].tsx:341`, `performance.tsx:443`. Residuals: R2-6; `service-reset.tsx:222` "Stop" kept on purpose (a stopped read keeps nothing). |
| 5 | Restore, Put back, Undo | Pass | "Restore" is gone from visible text. "Put back" in `customise/index.tsx:621,689`, `workshop/[id].tsx:488,514`, `customise/timeline.tsx:160`, `help.ts:366,472`. "Undo my changes" (`workshop/[id].tsx:487`, `help.ts:656`) resets the draft and is a different action. Residual: R2-9. |
| 6 | Same feature name everywhere | Partly | Older VW modules: consistent (`diagnostics.tsx:667,724`, `LiveScreen.tsx:678,686`, `customise/index.tsx:495`, `knowledge.tsx:93`, `help.ts:691,863`); one miss, R2-8. Research notes: consistent (`_layout.tsx:65`, `knowledge.tsx:78`). Engine light: R2-1. "a second": R2-2. |

## 3. Findings

### Medium (verified)

**R2-1. MOT check says "Engine warning light"; the rest of the app says "Engine light" (round 1 C13, partly fixed).**
- `src/mot/rules.ts:339` and `:332`: title "Engine warning light on"
- `src/mot/rules.ts:215`: "A likely cause of the engine warning light."
- Elsewhere: `src/app/mot.tsx:272` row title "Engine light"; `mot.tsx:317` "Engine light, engine codes and the modules whose warning lamps the MOT checks."; `rules.ts:217` "engine light is off".
- Use: "Engine light on" and "A likely cause of the engine light." Keep `help.ts:127`, which is the one place that explains the name.

**R2-2. "a second" and "readings a second" (round 1 C20, partly fixed).**
- `src/app/log-view.tsx:90` and `:221`: "4.2 a second"
- `src/app/logger.tsx:136`: "readings, 4.2 a second"
- Against: `src/app/logger.tsx:45`, `src/app/dashboard.tsx:292`, `src/app/battery.tsx:316`: "4.2 readings a second".
- Use: "4.2 readings a second" everywhere. For `logger.tsx:136`: "1,234 readings, 4.2 readings a second".

### Low (verified)

**R2-3. Placeholders for "no value" and "empty list".**
- `src/app/boost.tsx:144-146` value "None yet" (Peak actual, Largest shortfall, Largest overshoot); `src/live/LiveTiles.tsx:190-192` "None yet" (Lowest, Highest, Peak (held)). Against "No reading" in `src/screens/LiveScreen.tsx:284` and `src/app/log-view.tsx:146`.
- `src/app/dashboard.tsx:414` "No data" for a gauge with no reading. If it means "not supported on this car", say that.
- `src/app/sensors.tsx:388` empty list "Nothing here yet". Against "No readings yet" (`battery.tsx:353`) and "No trips yet" (`trip.tsx:184`).
- `src/app/service-reset.tsx:241` footer "None yet. Learn one below...".
- Use: "No reading" for a value; "No {things} yet" for an empty list (for example "No sensors yet").

**R2-4. Not-connected notices without "your car".**
- `src/app/diagnostics.tsx:374`: "Connect to check again." Against "Connect your car to check for faults" (`diagnostics.tsx:380`).
- `src/app/customise/timeline.tsx:85`: "Connect to this car with the ignition on, then tap Put back again."
- Use: "Connect your car to check again." and "Connect your car with the ignition on, then tap Put back again."

**R2-5. Error sentences after a stop do not follow one pattern (round 1 C25, partly fixed).**
- `src/app/diagnostics.tsx:223`: "The check stopped: {reason}. Engine off, ignition on, then tap Try these again." Against `diagnostics.tsx:173`: "The check stopped: {reason}. Check the ignition is on, then tap Check again."
- `src/app/mot.tsx:152`: "Reading stopped: {reason}. Check the ignition is on, then try again." (no button named).
- `src/logger/recorder.ts:340`: "Recording stopped: {reason}" (no next step).
- Use: "{What} stopped: {reason}. Check the ignition is on, then tap {button}." For `diagnostics.tsx:223`, where the engine must be off: "Switch the engine off, leave the ignition on, then tap Try these again." (the wording of `help.ts:683`).

**R2-6. Help says "Stop" where the button says "Stop and keep results".**
- `src/help.ts:893`: "Stopped or Not run: you tapped Stop."
- Button: `src/app/learn-car.tsx:220` "Stop and keep results".
- Use: "you tapped Stop and keep results".

**R2-7. Names in the Customise guide text.**
- `src/mods/catalogue.ts:33`: "Learn a setting (under More settings) can make one from your own car."
- Against "Get more settings" (`src/app/customise/index.tsx:348`, `help.ts:758`) and "Learn from Carista" (`customise/index.tsx:353`, `help.ts:271`).
- Use: "Learn from Carista (under Get more settings) can make one from your own car." Not confirmed on the screen that this text is shown; check the guide row on the phone.

**R2-8. "older module" in a learn run note (round 1 C12).**
- `src/learn/runLearn.ts:447`: "1 older module added to the backup" (`plural(..., 'older module')`).
- Use: "older VW module", as in the rest of the app.

**R2-9. Put back wording differs in two places.**
- `src/app/customise/index.tsx:269`: "tap Put back under Backups below." Against `src/coding/apply.ts:36`: "Tap Put back under Backups in Customise."
- Use the `apply.ts` form in both.
- `src/app/customise/index.tsx:685`: "Put back the original {module} coding?" Against `src/app/workshop/[id].tsx:506`: "Put back the original coding?".
- Use one form; "Put back the original coding?" with the module named on the line.

**R2-10. Two hand-built date and time formatters.**
- `src/mot/rules.ts:1053-1056` `stamp()` builds "9 Nov 2026, 17:02" by hand. Used in the MOT check text at `rules.ts:1067` and `:1072`.
- `src/diag/timeline.ts:70-72` `stamp()` builds the date and time by hand. Used for the time at `src/app/customise/timeline.tsx:129`.
- Output matches `dateTimeText` and `clockText` today. Use those helpers so a format change happens once.

**R2-11. Battery countdown uses seconds in a different form (round 1 C3, documented exception).**
- `src/app/battery.tsx:290`: "Start the engine now: {n} s left". Against "about 4 min left" (`timeText.ts:59`).
- The fixes log says this is kept on purpose. Keep it, and say in the Battery test help that the seconds form is used for the 10 second start window.

**R2-12. Leftovers the owner can see in the repo, not on screen.**
- Twelve `.old` files under `src`, for example `src/app/ask.tsx.old`, `src/app/(tabs)/(ai)/ai.tsx.old`, `src/ai/agent.ts.old`, `src/screens/CarScreen.tsx.old`, `src/old/garage-tab.old/garage.tsx.old` (round 1 C27).
- Storage keys with the old name: `src/diary.ts:22` `'gauge.diary.v1'`, `src/vehicle/garage.tsx:139` `'gauge.garage.v1'`. Changing them needs a migration.
- Use: move the `.old` files out of `src` (owner's call). Leave the keys until a migration is written.

**R2-13. Menu paths use ">" in some places (round 1 C37, partly fixed).**
- `src/app/customise/index.tsx:287`, `src/coding/apply.ts:39`: "Put it back in Customise > Backups."; `src/help.ts:470`: "Customise > Backups puts it back."
- Use: "Customise, then Backups" everywhere.

### Open from round 1, not re-verified here (not counted above)

- **C22 icons and colours (medium).** The fixes log says the icons and colours were partly aligned, with no single feature table and no SF Symbol changes. Not re-checked.
- **C32 hand-built progress and sheets (medium).** Skipped in the fixes log. Shared `Sheet`, `ActionRow` and `Chip` not added. Not re-checked.
- **C23 colour meaning (low).** Skipped; needs a design decision (amber as "needs attention" or grey).
- **C33 apostrophes (low).** Partly done. A sample of `src/app` found straight apostrophes only in comments. Not a full sweep.
- **C16 share as text (low).** Listen recording, MOT check and adapter log are still shared as plain text (fixes log). Not re-checked on the phone.
- **C9 documents (medium, outside `src`).** `DESIGN.md:426-427` ("Caristini AI card"), `DESIGN.md:432-444` and `PRODUCT.md:31,50` not re-checked.
- **C7 tab stack title (low).** Round 1 quoted `_layout.tsx:44` "Home"; not re-checked.

## 4. Verified as fixed

C1 (clearing wording, sheets, help, error text), C2 (AI wording removed from visible text), C4 (dates on screens), C5 (Saved to History and your diary), C6 (stop labels), C8 (help names match screens), C10 (Put back), C11 (Research notes), C12 (Older VW modules, except R2-8), C14 (not yet run, complete), C15 (ConfirmSheet and verbs), C17 (New red, Seen before grey, Cleared green), C18 (CodeRow used in Health check, Workshop, the last check and its changes), C19 (stayAwake; no `useKeepAwake` left), C24 (except R2-4), C26, C28 (gauge on Dashboard), C29, C30 (clear labels and History titles), C34 (no em dash left in visible code outside `src/data`), C35 (Technical), C36 (110 °C (230 °F); Dashboard sentence in Live data).
