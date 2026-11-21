# Pin16 review round 2: Bugs and Functionality

Date: 20 Nov 2026. Review only: no source file was changed. Each round 1 HIGH and MEDIUM finding was checked in the current code at the file and line it names; the fix records were not trusted.

Checks run: `npx tsc --noEmit` passes. `npx jest` (without `.claude`): 45 of 45 suites, 484 of 484 tests pass (the red test of round 1, L10 and finding 27, is green).

## 1. Scores

| Category | Round 1 | Round 2 | High | Medium | Low |
|---|---|---|---|---|---|
| Bugs | 6 | **8** | 0 | 1 | 7 |
| Functionality | 6 | **7** | 0 | 2 | 4 |

Bugs: no high finding is left. Every round 1 high and medium is fixed or reduced to a narrow low. One new medium, plus 7 low.

Functionality: the high and all medium findings the owner chose to fix are fixed. The 2 mediums are both in the service reminder added this round. Some features stay as stated limits (round 1 findings 7, 11 and 12: no Ford or Mazda switches, no built-in reset, gauges take standard values only), which holds this category at 7.

## 2. Round 1 findings re-checked

### Bugs

| Finding | Result | Where it was checked |
|---|---|---|
| H1 TP2.0 resend scrambles a multi-frame request | Fixed | `src/obd/tp20.ts:248-262` (frame i always goes out as `firstSeq + i`), `:299-320` (an ACK naming the first frame sends all again; a later frame sends from that chunk; anything else closes the channel and throws). The old restart from byte 0 is gone. |
| M1 standard requests land inside another conversation | Fixed for TP2.0, left for UDS (see B-L1) | `src/obd/elm.ts:798-801` waits while `rawSessions > 0`; `src/app/learn-car.tsx` rows are disabled during a run. |
| M2 one timeout turns TP2.0 off | Fixed | `elm.ts:440-447` turns it off only on an adapter `?`; `LinkLost` is rethrown at `:441` and `:450-453`. |
| M3 older-module search remembers silent addresses | Mostly fixed (see B-L2) | `elm.ts:2561-2574` (`clean` flag, `openBusy`, `LinkLost` rethrown). |
| M4 answers cut at 16 frames | Fixed | `elm.ts:109-126` (a `0:` line carries on the same message while the declared length is not yet in). |
| M5 re-read after clearing an older module | Fixed | `elm.ts:2546-2551` (`known` option), called with `known: true` at `src/app/diagnostics.tsx:300`. |
| M6 UDS write sent up to 4 times, "Nothing was changed" on an unclear failure | Fixed | `elm.ts:2341-2359` writes through `sendOnce`; only a refusal says nothing was changed; the read-back settles the rest. |
| M7 leaving during a write drops the record | Fixed | `src/app/customise/index.tsx:252-262` and `:281-301`, `src/app/workshop/[id].tsx:213-230`: `sessionValues`, cache, Diary and History are written whether or not the page is open; only `setState` is guarded. |
| M8 KWP write: channel closed after the write | Fixed for old-style long and short coding, open for the `did` style (see B-M1) | `elm.ts:2233-2247`. |
| M9 long coding accepted without checks | Fixed | `tp20.ts:569-574` (`parseLongCodingRecord`: type 10, length `12 + len`, trailing FF) and `:596`. The record's own workshop code and software are written back. The research note's cross-check with `1A 9B` is not done; low, not listed. |
| L1, L3, L4, L6, L7, L9, L10, L12, L13 | Fixed | `tp20.ts:210` (`once` for the login key), `elm.ts:2302`, `customise/index.tsx:145`, `state.tsx:157-169`, `tp20.ts:266` (30 s cap), `tp20.ts:256` (frames kept), `history.ts:83-91`. |
| L8 answer matched by service only | Partly fixed (see B-L3) | `tp20.ts:409-419`. |

### Functionality

| Finding | Result | Where it was checked |
|---|---|---|
| 1 (high) no record when leaving mid-write | Fixed | As M7 above, plus the fault clear at `workshop/[id].tsx:172-176`. |
| 2 MOT keeps an old read | Fixed | `src/app/mot.tsx:101-108`, `src/mot/read.ts:37-41` (a complete health check newer than the read replaces it, once per entry). |
| 3 Vehicle save overwrites | Not re-read (outside the files named for this round) | |
| 4 no way to MOT, logs, battery with no adapter | Fixed | `src/app/(tabs)/(car)/index.tsx:89` and the offline "Service due" row at `:76-84`. |
| 5 leaving a long run stops it unasked | Fixed | `src/leaveRun.tsx:24-28`, used in `learn-car.tsx:188`, `diagnostics.tsx:469`, `sensors.tsx:307`, `discover.tsx:259`, `mot.tsx:214`. |
| 6 service reminder set-up | Fixed in part (see F-M1, F-M2) | `src/app/service.tsx:41-71`, `src/service/reminder.ts:53-104`. |
| 8 "ask if it worked" step | Fixed as decided | Dead sheet removed; `customise/index.tsx:306-316` adds a kept borrowed setting to the car's own list. |
| 9 battery results not kept | Fixed | `src/app/battery.tsx:99-113`, `:84-95`. |
| 10 dropped link never retried | Fixed | `src/state.tsx:97-124`, `src/reconnect.ts`. |
| 17 charging voltage accepted as rest | Fixed for step 1 | `battery.tsx:171-175`. |

## 3. New findings

### Medium

**B-M1. Old-module coding write of the `did` style: a channel that closes after the write is reported as "could not confirm", and nothing reopens it**
- Where: `src/obd/elm.ts:2233-2236` (`settle` returns at once when `now.style === 'did'`, so the reopen at `:2238-2246` never runs for it), `:2256`, `:2261-2270`; the new deliberate close at `src/obd/tp20.ts:315-316` ends in the same state.
- Trigger: a PQ body module that restarts or sends A8 after `2E 06 00` (the style proven on the Polo log), or the new "lost step" branch closing the channel during the request.
- Effect: `tp20ReadCoding` fails on the closed channel (`tp20.ts:212`, `:577`) and returns null; `put(before)` also fails; the result is `ok: false, restored: false`. The screen tells the owner the original could not be confirmed and to tap Put back, while the module holds either value. Round 1 M8 was fixed for the long and short styles only.
- Fix: run the closed-channel check in `settle` for every style (`if (now.style === 'did' && !s.closed) return;`), then reopen and read back before deciding.
- Severity: medium (the owner is sent to a second write on a wrong picture). Confidence: confirmed in code; the module behaviour is plausible.

**F-M1. The Service tile on the connected Car tab ignores the odometer the owner typed**
- Where: `src/app/(tabs)/(car)/index.tsx:242` uses `v.odometerKm`; the Service page (`src/app/service.tsx:34`), the offline row (`index.tsx:44`) and the reminder use `odometerNow`.
- Trigger: a car that gives no odometer (the owner's Leon), a typed odometer, a service due by distance.
- Effect: the Service page says "Overdue by 200 mi" while the tile shows the date leg only ("Due in 3 months"). The reminder gives 2 answers on 2 screens.
- Fix: use `odometerNow(v)?.km` in the tile.
- Severity: medium (the reminder's one job). Confidence: confirmed.

**F-M2. A typed odometer never ages, so the distance leg of the reminder is frozen**
- Where: `src/service/reminder.ts:56-62` (`odometerNow` returns the typed figure for ever when the car gives no reading), `:33-34`; `src/app/service.tsx:61-64`; `:106` also stores that stale figure as the mileage of a service marked done today.
- Trigger: a car with no odometer reading; the owner types the odometer once and drives.
- Effect: "Due in 3,000 mi" never falls and never turns overdue by distance; the page does not say the figure is from the typing date. The mileage stored for a service marked done today is the old typed figure.
- Fix: show "odometer typed on [date]" beside the figure and mark the distance leg "not updated since [date]" after 30 days; on Mark done, ask for or skip the mileage when the odometer is a typed figure older than a day.
- Severity: medium. Confidence: confirmed in code.

### Low

**B-L1. Standard requests still go to a module while a UDS write or read holds the adapter.** `src/obd/elm.ts:798-802`: only `rawSessions` is waited for, not `addressed`. `readCodes`, `clearFaultCodes`, `readStatus` and `readVin` (`:831`, `:921`, `:956`) take no lock, so a health check started while a Customise write is running sends `03` or `04` with the header pointing at the module (NO DATA reads as no faults; a clear reads as refused). Also, the 20 s wait gives up and sends into a raw channel that is still open (a TP2.0 write with a read-back can pass 20 s). Fix: wait on `addressed` too, and fail the request after the limit, not send it. Confirmed.

**B-L2. A stall on a channel set-up frame is still counted as silence.** `src/obd/tp20.ts:113-119` (`frames` returns `[]` on any non-`LinkLost` error) and `:147-148`; `elm.ts:2573` then calls `onSilent` because `clean` stays true. A 0.8 s stall on the open frame saves the address as silent for 30 days. Fix: have `open` report a timeout separately from a clean NO DATA. Confirmed in code.

**B-L3. A late refusal is matched by service only.** `src/obd/tp20.ts:410`: `7F 2E 31` for the date write, arriving after that request timed out, is taken as the refusal of the coding write (`elm.ts:2254` then says "Nothing was changed"). The positive answers now check the identifier (`:416-417`). Fix: for `7F`, also compare the identifier when the refusal carries one, or drain stray frames before a write. Confirmed in code; timing plausible.

**B-L4. Asking "Stop and go back" after the run has ended waits 8 seconds for nothing.** `src/leaveRun.tsx:40-45` runs only when `active` changes, and `:61-65` sets `leaving` after `active` is already false, so only the 8 s timer ends it (the sheet also stays open when the run ends underneath it, `:18`). Fix: close the sheet when `active` turns false, and call `leave()` at once in `onConfirm` when `active` is false. Confirmed in code.

**B-L5. A link lost during a write leaves no record.** `src/app/customise/index.tsx:246-251` and `:276-279`: when `writeCoding` throws `LinkLost` after the write frame went out, `done` is empty, so no History or Diary entry is made and `sessionValues` keeps the old bytes (the next change fails with "The value changed since it was read" until Read settings again). The message does say to read again. Fix: on a thrown error after a write was sent, record "unconfirmed" in History. Confirmed in code.

**B-L6. A failed storage read replaces all of History.** `src/history.ts:73-80` returns `[]` on any read error and `:97-102` saves `[entry]` over the stored list. Round 1 L15 had the same shape for the garage file. Fix: let `addHistory` stop when the read threw. Confirmed in code; needs a transient storage error.

**B-L7. Service due date arithmetic drifts at month ends.** `src/service/reminder.ts:37-38`: 31 Aug plus 6 months becomes 3 Mar, and an ISO date is parsed as UTC then moved in local months. Off by a few days. Fix: clamp to the last day of the target month. Confirmed.

**F-L1. Idle and loads-on charging reads are not checked when the car gives no engine speed.** `src/app/battery.tsx:240-252`: with `rpm()` null the engine check is skipped, so an engine-off 12.4 V is saved as an idle result (and goes to History). Round 1 finding 17 was fixed for step 1 only. Fix: reject below about 13.0 V with "this looks like engine off" when no engine speed is given.

**F-L2. The service reminder never alerts.** `package.json` has no notification module; the reminder shows only on the Car tab (`index.tsx:76-84`, `:242`) and the Service page. A car that is due while the app is closed gives no sign.

**F-L3. History entries still cannot be removed.** `removeHistory` (`src/history.ts:126`) has no caller (round 1 finding 28; the owner has not decided).

**F-L4. The health report still needs the adapter.** `src/app/report.tsx:37-42` (round 1 finding 25, skipped in round 1).

## 4. What would reach the next score

- Bugs 9: B-M1, then B-L1 to B-L6.
- Functionality 8: F-M1 and F-M2 (one line and one label), then F-L1. Round 1 findings 7, 11 and 12 stay as stated limits and still hold the category below 9.

## 5. Not covered

- Nothing was run on a phone, a car or the web preview. Bluetooth timing, the reconnect timers and the back-swipe guard were read, not driven.
- `src/app/vehicle.tsx` (round 1 finding 3) and the other files outside the list given for this round were not re-read.
- The owner choices (switches write at once, faults clear with the engine running) were treated as intended.
