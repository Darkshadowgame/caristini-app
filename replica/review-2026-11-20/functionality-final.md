# Pin16 final functionality review

Date: 20 Nov 2026. Review only: nothing but this report was written. No git, no browser, no test run (the code was read, and the tests named below were read against it).

## 1. Score

**Functionality: 8.** No high. 2 medium, 2 low. Both r3 mediums are fixed. The two new mediums are in the same Service page: one is a side effect of the fix, one is older.

## 2. The two r3 fixes

**R3-M2, Mark done from `service-reset.tsx` with a stale typed odometer: fixed.**
- `src/app/service-reset.tsx:182` stores `lastKm: markDoneKm(v)`. `markDoneKm` (`src/service/reminder.ts:175-182`) returns no mileage for a typed figure older than 1 day or with no date, and returns the car's reading otherwise.
- `:184` adds `DISTANCE_RESTARTS_NOTICE` when `markDoneSkipsKm(v)` is true (`reminder.ts:198-200`). The date part of the reminder restarts either way.
- Tests: `__tests__/reminder.test.ts:127-133` (`markDoneKm`) and the Mark done skip test after `:157`.

**R3-M1, `service.tsx` retyped odometer: fixed for what it set out to do.**
- `shouldStoreTypedOdometer` (`reminder.ts:189-193`): nothing typed is not stored; no current figure is stored; a figure typed over a typed one is always stored (refreshes its date); over a reading from the car it is stored only when it differs in the owner's unit, so the car's date stays.
- `service.tsx:60` and `:63` use it. Tests at `reminder.test.ts:147-158` match the code.
- The "always stored over a typed one" rule has a side effect, see F-M1.

## 3. Findings

### Medium

**F-M1. Saving any other field on the Reminder refreshes a stale typed odometer without the owner retyping it**
- Where: `src/app/service.tsx:47` (the Odometer field is prefilled from the saved figure), `:60` (`shouldStoreTypedOdometer(odoKm, odoNow, miles)`), `:63` (stores `odometerTypedKm` with `Date.now()`), `src/service/reminder.ts:192` (`current.typed ||` makes the store unconditional).
- Trigger: the owner typed 50,000 on 5 Nov. On 20 Nov they correct only the last service date and tap Save. The prefilled 50,000 is read as "typed again".
- Effect: the typed figure now has today's date, so `vehicleServiceDue` (`reminder.ts:156-169`) counts distance from it for another 30 days and shows "Due in N mi" for a car that has been driven since. The stale-odometer protection from r3 F-M2 is bypassed by an unrelated Save.
- Fix: keep a flag that is set in the Odometer field's `onChange` (`service.tsx:218-221`) and cleared when the saved figure reloads (`:44-48`). Pass "edited" to the store test: store when edited, or when the figure differs. The `current.typed` refresh then needs the flag, not the prefilled value.

**F-M2. Tapping Read the odometer wipes the date and mileage typed above it and not yet saved**
- Where: `src/app/service.tsx:44-48`. The effect resets all 3 text fields from the saved plan and has `odo` in its dependencies. `readOdometer` (`:74-88`) changes `odo` through `garage.update` at `:82`. The Read row sits below the fields and the Save button (`:231-238`).
- Trigger: choose an interval, type the last service date and mileage, then tap Read the odometer to fill the third field. The odometer changes, the effect runs, and the date and mileage return to their saved values (empty on a first set-up).
- Effect: typed input lost with no message. The owner must type it again.
- Fix: split the effect. Reset the date and mileage fields only on `v?.vin`, `plan?.lastDate`, `plan?.lastKm` and `miles`; reset the odometer field alone on `odo`.

### Low

**F-L1. Service diary entries never carry a mileage**
- `src/app/service.tsx:101` and `src/app/service-reset.tsx:179` write `mileage: null` although `markDoneKm` (or the car's odometer) is known. History gets it (`service.tsx:105`, `service-reset.tsx:180`); the diary does not. The fault clear uses `diaryMileage` (`src/app/diagnostics.tsx:280`, `src/diaryCars.ts:41`). Fix: pass `...diaryMileage(km, miles)`.

**F-L2. The service-reset History entry ignores a typed odometer**
- `src/app/service-reset.tsx:180` stores `odometerKm: v.odometerKm` (the car's reading only), while the reminder at `:182` uses the newest figure. A car whose odometer was typed shows no mileage on that History entry. Fix: use `markDoneKm(v) ?? v.odometerKm`.

## 4. End to end, no finding

Traced in code and found sound:
- **Connect and reconnect:** `src/state.tsx:140-230` (one attempt at a time, early link loss caught at `:157-202`, a cancelled attempt closes its link at `:215`), `:97-124` and `src/reconnect.ts` (4 tries, waits 2, 8, 12, 15 s, as `help.ts:61` says). Opening Connect stops the tries (`state.tsx:128-130`).
- **Learn my car:** `src/app/learn-car.tsx:111-167`. Stop keeps results, the leave guard asks first, the log is sent or skipped in `finally`. "Read-only" is true of the steps.
- **Health check and clear:** `src/app/diagnostics.tsx:255-344`. Clear all checks first (`:190-201`), logs only codes the car accepted, names refusing modules, and checks again. The saved-result path (`:407-420`) does not run the scan twice.
- **Customise switch:** writes at once as `help.ts:251` says (r3 checked, unchanged). The `did`-style KWP write now settles on a closed channel (`src/obd/elm.ts:2252-2268`), so the r2 B-M1 medium is fixed.
- **MOT:** `src/app/mot.tsx:78-145`. The draft saves on every answer, a newer health check replaces an older read once, the read is stoppable and keeps its partial result.
- **Data logger with route:** `src/logger/recorder.ts:287-345`. Link loss, a full log and leaving the screen all save the log; a 45 s checkpoint bounds a crash loss (`:409-423`). The GPS is released on stop (`:234`), and the route note says when GPS is denied or off. Leaving the screen ends the recording, as `help.ts:1232` says. Back does not ask first on the logger (the guard is not used there); the log is still saved, so this is a note, not a finding.
- **Battery test:** `src/app/battery.tsx:84-300`. Each step saves at once and resumes within 30 minutes. "Within 10 seconds" matches `CRANK_WINDOW_S` (`:17`, `:323`).
- **Help promises checked against code:** reconnect (4 tries), 30 days (`FULL_READ_DAYS`, `src/learn/runLearn.ts:36`), 10 s battery, 15 s DPF page (`src/app/dpf.tsx:20`) and 20 s Live-data DPF watch (`src/screens/LiveScreen.tsx:491`), trip gap 5 s (`src/monitors/trip.ts:19`), alert quiet 5 s and peak 3 s (`src/live/alerts.ts:37`, `:69`). All match.

## 5. Older-module coding read (`src/obd/tp20.ts`) against `__tests__/tp20.test.ts`

No finding. Checked line by line:
- **Multi-message identification:** the first message's top length bit sets `more` (`:337-338`); a one-byte filler is an extra, not the answer (`:383-384`); the answer is held while later messages are read and ACKed (`:385-390`), then returned (`:391-392`). The test at `tp20.test.ts:435-458` expects extras `[5A]` and `[5A 9B 41 42]`, and ACKs `B1 B2 B3` before the next request. The code gives exactly that, as `seq` 0, 1, 2 each ACKs with `seq + 1`. `drain` (`:226-243`) ACKs frames heard between requests.
- **A3 channel test:** `isTest` (`:131-133`) needs a one-byte `A3` on the module's id. It is answered in `exchange` (`:296-299`), `idle` (`:182-186`) and `drain` (`:233-236`), each bounded (3 tries, `hardStop`). The test at `:419-433` expects `B1` first and the `A10F8AFF32FF` answer after it, as the code does.
- **Resend from the named frame:** an ACK (`9x` or `Bx`) with a number other than `txSeq` is read as `missing = (seq - firstSeq) & 15` (`:305-306`). Zero resends the whole request (`:307-311`), a value below the chunk count resends from that frame with the original numbers (`:312-317`, `sendFrom` numbers frame `i` as `firstSeq + i`, `:260`), anything else closes and throws (`:318-321`). Tests at `tp20.test.ts:487-510` match all 3 outcomes.
- Not covered by a test, and not shown to fail: a late ACK from the previous request arriving as the next one starts would read as "out of step" (`:318-321`) and close the channel. The `drain` call at the start of `exchange` makes this unlikely; no log shows it.

## 6. Not covered

No device run, so timing (ACK within 100 ms, the module's 7 s channel timeout) rests on the logs quoted in the code comments and the tests. `src/old` and the `.old` files were not read.
