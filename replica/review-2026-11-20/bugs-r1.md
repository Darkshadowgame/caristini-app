# Pin16 review round 1: Bugs

Date: 20 Nov 2026. Commit reviewed: 99c3910. Review only: no source file was changed.

Checks run: `npx tsc --noEmit` passes. `npx jest` gives 41 of 42 suites passing, 413 of 414 tests (see L10: the suite is red at this commit).

## 1. Score

**Bugs: 6 out of 10.**

Why: 1 high, 9 medium, 15 low. The rubric gives 7 for "several medium bugs or one high". This code has both, and 4 of the medium findings sit on write paths, so it scores under that band. Nothing found writes wrong data in normal use; the high finding needs a lost frame in the middle of a coding write.

Counts: high 1, medium 9, low 15.

Confidence words: **confirmed** = traced end to end in the code (2 were also run). **plausible** = the code path is confirmed, the car-side or phone-side effect could not be proved here.

## 2. Findings

### High

**H1. TP2.0 resend restarts a multi-frame request in the middle of the message the module is building (wrong coding can be written)**
- Where: `src/obd/tp20.ts:277-283` (the ACK from the module names another frame, so `txSeq` is set to it), `:361-365` (returns `'again'`), `:231-244` (the next try cuts the request from byte 0 again), `:196-204` (retry loop). Used by every coding write: `tp20WriteCoding` `:561`, `:572`.
- Trigger: a request of 2 or more frames (any `2E 06 00` or `3B 9A` coding write) where the module took frame 0 and lost a later frame, so its ACK after the last frame names frame 1 or 2. TP2.0 expects the sender to carry on from the named frame.
- What goes wrong: the code sends the whole request again starting at the named number. The module joins the new first chunk (length bytes and `2E 06 00`) onto the frame 0 it already holds. Run on a scratch copy of the real `tp20.ts` with a 10-byte coding C0..C9: frames sent were `20 000D2E0600C0C1`, `21 C2..C8`, `12 C9`, then after ACK `B1`: `21 000D2E0600C0C1`, `22 C2..C8`, `13 C9`. The 13 bytes the module was told to expect become `2E 06 00 C0 C1 00 0D 2E 06 00 C0 C1 C2`: a coding of the right length with wrong content, so a length check in the module does not catch it. The read-back in `writeTp20Coding` would then see a mismatch and write the original back, which is the only net.
- Fix: remember the sequence number of the first frame of the request. If the module names that number, resend all (the behaviour today). If it names a later frame, resend from that chunk with the original numbers. If the number does not map to a chunk, close the channel, reopen and start again; for a write, read the coding first.
- Confidence: confirmed in code and reproduced; whether a given module accepts the joined message is plausible.

### Medium

**M1. Standard OBD requests skip the module lock, so they can land inside another conversation**
- Where: `src/obd/elm.ts:737-740` (`command`), `:771-781` (`request`). Callers with no lock and no `addressed` check: `readStatus` `:831`, `readFreezeFrame` `:854`, `readVin` `:879`, `readCodes` `:921`, `clearFaultCodes` `:956`, `supportedPids` `:969`, `carAwake` `:1839`, `src/diag/freeze.ts:80`, `src/diag/service06.ts:260`, `src/diag/service09.ts:132`. Only `readLive` and `readLiveMany` check `addressed`.
- Trigger: 2 activities at once. Concrete case: Learn my car is running; the rows under "What Pin16 knows about this car" stay tappable (`src/app/learn-car.tsx:310`) and open Workshop, where a coding write can start. The reads Learn makes itself (`runLearn.ts:617-618` self-tests and services 06 and 09, the fault and freeze-frame reads at the start of its health check) then go out while the write holds the adapter.
- What goes wrong: with the adapter pointed at a module (ATSH 7xx), `03` or `0101` goes to that module: "NO DATA" is read as no engine codes, or a clear is reported as refused. With a TP2.0 channel open (`inTp20`), `command` sends the text as a raw CAN frame on the channel ID: `0101` is a TP2.0 data frame, number 1, 1 byte. If the module expects that number it becomes part of the message being built (a coding write included).
- Fix: route every standard request through one helper that takes the module lock (or waits for `whenIdle()`), and refuse non-AT text in `command()` while `inTp20` or `addressed` is held by another owner. Disable the rows on the Learn screen while a run is in progress.
- Confidence: confirmed (mechanism and the screen path); frame acceptance by the module is plausible.

**M2. One adapter timeout switches TP2.0 off for the whole connection, and a lost link reads as "no module"**
- Where: `src/obd/elm.ts:428-437` (any error from `enter()` sets `tp20Usable = false`), `:439` (`s.open(address).catch(() => false)`), `:1304` (only `'error'` results count towards the link check).
- Trigger: a Bluetooth stall of 1.5 s on one of the 6 set-up commands (`AdapterTimeout`), or the link dropping during set-up or channel open.
- What goes wrong: `routesFor` drops every TP2.0 route until reconnect, with no message. On the PQ35 Leon every module then shows "no answer", Customise says the module did not give its coding, and value-group scans return nothing. After a real link loss, modules with no UDS address come back as `no-answer` (not `error`), so `scanAllFaults` may never reach 4 errors in a row, and `runHealthCheck` saves a partial check as complete (`healthCheck.ts:236-241` overwrites `lastCodes`).
- Fix: set `tp20Usable = false` only when the adapter answers `?` (the `ObdError` from `Tp20Session.cmd`). Rethrow `LinkLost` from `enter` and `open`. Count `LinkLost` and `AdapterTimeout` as errors in the sweep.
- Confidence: confirmed (first 2 effects); the partial save is plausible (depends on module order).

**M3. The older-module search remembers addresses as silent after a lost link or a stall**
- Where: `src/obd/elm.ts:2500-2509` (bare `catch` then `onSilent`), `src/diag/healthCheck.ts:275`, `src/learn/runLearn.ts:407` and `:674` (saved in `learnSilent.tp20`), `healthCheck.ts:270` (the search runs only while `deepFound` is unset).
- Trigger: the adapter drops, or stalls for 0.8 s on a set-up frame, or a module answers "busy" 5 times, during the first older-module search in Learn my car.
- What goes wrong: every address not yet probed is reported silent, saved for 30 days, and `deepFound` is set (even to an empty list), so the automatic search does not run again. Older modules at those addresses stay unknown until the owner taps "Look for older modules" or the next full read.
- Fix: rethrow `LinkLost`; call `onSilent` only when both set-up attempts got a clean NO DATA.
- Confidence: confirmed.

**M4. Long UDS answers are cut at 16 frames (a module with 28 or more faults shows 27)**
- Where: `src/obd/elm.ts:109-122` (`parseMessages`: a `0:` line starts a new message whenever the current one has data).
- Trigger: any ISO-TP answer over 111 bytes. The frame index the adapter prints is one hex digit and wraps from `F:` to `0:`.
- What goes wrong: the answer splits in 2 and the caller takes the first part. Run with a 30-fault `59 02` answer: 2 messages of 111 and 14 bytes, 27 faults kept, 3 dropped with no warning. The same applies to long gateway tables (`2A2A`, `2A2C`) and long values in sweeps.
- Fix: when a length line was seen, keep adding frames until `declared` bytes are in; start a new message on `0:` only when the current one is complete or has no declared length.
- Confidence: confirmed (reproduced with the logic of the function).

**M5. After clearing the faults of an older module the re-read never happens**
- Where: `src/obd/elm.ts:2489-2490` (addresses that are the route of a module are filtered out), `:2551` (`linkTp20` makes the address the route), `src/app/diagnostics.tsx:238-242`.
- Trigger: Health check finds an older module with faults, owner taps Clear on it.
- What goes wrong: `deepScan([address])` returns an empty list, so `after` is undefined: the row keeps its old faults, the "came straight back" check cannot fire, and the message says cleared. "Look for older modules again" (`diagnostics.tsx:201-202`) shows only modules never seen before, so the list empties. The test `__tests__/tp20.test.ts:34-40` passes only because no search ran before the clear.
- Fix: after `clearTp20`, read the module with `readModuleFaults(moduleById(moduleId))`, or give `deepScanInner` a flag to probe listed addresses.
- Confidence: confirmed.

**M6. UDS write: an unclear failure is reported as "Nothing was changed", and the write can go out up to 4 times**
- Where: `src/obd/elm.ts:2284-2301` (`writeDid`), `:1128-1159` (`uds` retries on NO DATA and on "busy, wait").
- Trigger: the module answers `7F 2E 78` and the final answer comes after the adapter stopped listening, or a Bluetooth timeout on the write.
- What goes wrong: `uds` sends the same `2E` again (the rule in the code at `:2314` says a write must go once). Any error other than a login request is wrapped as "The module did not accept the change ... Nothing was changed" with no read-back, while the module may have stored it. The TP2.0 path (`:2198-2209`) handles the same case correctly.
- Fix: send `2E` with `sendOnce`; on `'unconfirmed'` or a non-refusal error, read the value back and return ok, restored or unknown from what the module holds.
- Confidence: confirmed.

**M7. Leaving the screen during a write drops the record of a change that reached the car**
- Where: `src/app/customise/index.tsx:268-276` (`if (!alive.current) return` before `sessionValues`, `codingCache`, Diary and History), `src/app/workshop/[id].tsx:194-201` (same, and Workshop never updates `client.sessionValues`).
- Trigger: flip a switch and go back before the result shows (a write takes 2 to 10 s); or write in Workshop, then open Customise.
- What goes wrong: the car holds the new coding; History and the Diary have no entry; `sessionValues` keeps the old bytes, so Customise shows the switch in its old position, hides the Backups row (it compares the stale bytes with the original), and the next change fails with "The value changed since it was read" until "Read settings again".
- Fix: guard only the `setState` calls with `alive`; always update `sessionValues`, the cache, Diary and History. Update `sessionValues` in Workshop too.
- Confidence: confirmed.

**M8. Old-style KWP coding write: a channel the module closes after the write is reported as a failure**
- Where: `src/obd/elm.ts:2193` (`settle` calls `s.idle(3000)`), `:2210-2216`; `src/obd/tp20.ts:167-178` and `:188-191` (`idle` throws on A8).
- Trigger: a module that restarts or sends A8 after `3B 9A`.
- What goes wrong: `settle()` throws after a successful write (the error reaches the screen, no read-back), or the read-back returns null on the dead channel, `put(before)` fails, and the result is `ok: false, restored: false` with a "could not confirm" message, while the module holds the new coding. Nothing reopens the channel.
- Fix: catch a closed channel in `settle`, open a new channel (`s.open(address)` after a pause) and read back there before deciding.
- Confidence: confirmed in code; the module behaviour is plausible (no real capture of this write exists, per `replica/kwp-write-sources.md`).

**M9. Old-style long coding is accepted for writing without the checks the research note asks for**
- Where: `src/obd/tp20.ts:529-541`, `:569-572`.
- Trigger: a module whose `1A 9A` record differs from the assumed layout (no trailing FF, or a length byte that does not match).
- What goes wrong: the last byte is dropped unchecked, the workshop code and software bytes come from `1A 9B` and are never compared with those in `1A 9A`, and the write always appends FF. `replica/kwp-write-sources.md` step 3 says: "Check the WSC and SW match step 2 and the reply ends in `FF`." A layout mismatch would write a shifted or shortened coding, and the read-back uses the same parse, so it would agree.
- Fix: return null (no write offered) unless `body.length === 12 + len`, the last byte is FF and bytes 0 to 9 equal the `1A 9B` workshop code and software.
- Confidence: plausible.

### Low

**L1. KWP login key can be sent up to 3 times.** `src/obd/tp20.ts:196-204`, `:596`. `request()` resends on a lost or stray frame; for `27 04` a second send after an accepted key can be refused, giving "The login code was not accepted" on an unlocked module, or use up a login attempt. Fix: a no-retry flag for `27 04` (and for writes after M6). Confirmed in code; effect plausible.

**L2. GPS can stay on after a quick stop.** `src/logger/phoneGps.ts:84-94`, `:99-108`, `:72-76`; `src/background.ts:28-45`. `stop()` during `start()` (first permission prompt, or a Learn run that ends at once) finds nothing started; `start()` then starts the updates with `users === 0` and nothing stops them until the app restarts. Fix: after `startUpdates()` resolves, stop the updates if `!started && users === 0`. Confirmed.

**L3. Value-group scan counts unanswered groups as empty.** `src/obd/elm.ts:679-697`. A timed-out request falls through to the empty-group count, and after a reopen the same 3 groups are counted again, so a body module can be marked complete after fewer than 8 empty groups. Fix: `continue` after a failed request; reset `empty` on reopen. Confirmed.

**L4. Customise read overwrites a newer saved coding.** `src/app/customise/index.tsx:135-138`. `read` keeps the `v` of the render that created it; a switch flipped while other modules are still being read saves the new coding, then the end of `read` writes `{...v.codingCache}` back with the old bytes. Fix: build from `garage.latest(v.vin)?.codingCache`. Confirmed.

**L5. Try mode cannot start, but the screen says it asks.** `src/app/customise/index.tsx:100`, `:193`, `:484`, `:651-670`; `src/coding/items.ts:24`. `setAsk` is only ever called with null, so the "Did you see it?" sheet and `mark(..., 'works')` are dead; a setting borrowed from another car can never become one of the settings of this car. The footer at `:484` still says Pin16 asks. Fix: remove the dead code and reword, or restore the question for borrowed settings. Confirmed.

**L6. A link lost during connect is missed.** `src/state.tsx:86-121`. `transport.onLost` is set after `initialise()`, `readVinFromModules()` and the garage saves; `BleTransport.lost()` fires once (`bleTransport.ts:200-207`), so a drop in that window leaves status "connected" on a dead link. Fix: set `onLost` before `initialise()` and check it after. Confirmed.

**L7. The wait for a TP2.0 answer has no overall limit.** `src/obd/tp20.ts:260-261`, `:313`, `:325`, `:332`, `:347`. Every "busy, wait", filler or follow-on message moves the deadline on; a module that keeps sending them holds the adapter lock with no way to cancel. The inner `while (queue.length)` loop also ignores the deadline. Fix: a hard cap (for example 30 s) checked in both loops. Confirmed in code.

**L8. A TP2.0 answer is matched by service only.** `src/obd/tp20.ts:373-375`. A late `7F 2E 31` for the date write (`:552`) is taken as the refusal of the coding write (`:561`), and `elm.ts:2200` then says "Nothing was changed" while the write went through. A late `62 F1 xx` is taken as the answer to the next `22` read (`tp20Identity` `:611-615`). Fix: for `22`, `2E` and `1A`, also match the identifier bytes. Confirmed in code; timing plausible.

**L9. UDS login treats an all-zero seed as locked.** `src/obd/elm.ts:2247-2248`. The comment says all-zero or empty means unlocked; only empty is checked, so a key is sent to an unlocked module and its refusal reads as a wrong code. Fix: `if (!seed.length || seed.every((b) => b === 0)) return`. Confirmed.

**L10. The test suite fails at this commit.** `__tests__/uxFixes.test.ts:55` expects "Steps known, not yet tested by Pin16"; `src/mods/catalogue.ts:26` now says "Guide only, no switch yet". Fix: update the test. Confirmed (run).

**L11. Tests cannot catch the new protocol faults.** `src/obd/simTransport.ts:683-692` accepts request frames with any sequence number, so the 2 coding-write tests pass whatever `txSeq` does. No test covers: a refusal in the middle of a multi-frame request (H1), a lost link during `enter`, `open` or the deep scan (M2, M3), a clear after a search (M5), or more than 16 frames (M4). Fix: check sequence numbers in the simulator and add one scripted test per case. Confirmed.

**L12. Module frames heard at the wrong moment are dropped without an ACK.** `src/obd/tp20.ts:170-175` (`idle` keeps only A3 and A8) and `:241` (replies to non-last request frames are thrown away, a channel test among them). The module repeats and may close the channel. Fix: push these frames to `carry`. Confirmed in code.

**L13. History updates can overwrite each other.** `src/history.ts:83-109`. `addHistory`, `updateHistory` and `removeHistory` each load, change and save the whole list with no queue; 2 at once (a check finishing while a clear is logged) lose 1 entry. Fix: one promise chain, as `sendBack.ts:95-100` does. Confirmed in code.

**L14. Bluetooth writes are not split to the packet size of the link.** `src/obd/bleTransport.ts:250-262`. A long UDS command (a 30-byte coding is 67 characters) goes in one write without response; on a 20-byte link iOS may drop or cut it. TP2.0 frames (18 characters) fit. Fix: write with response when the text is over 20 bytes, or split it. Plausible.

**L15. A damaged garage file shows an empty garage, and the next save replaces it.** `src/vehicle/garage.tsx:178-196`. A `JSON.parse` failure is treated like no data. Fix: keep the raw text under a backup key before the first save. Plausible.

## 3. What must be fixed

**To reach 8** (no high, only a few low or medium with narrow triggers): H1, M1, M2, M3, M4, M5, M6, M7, M8, M9 and L10 (the suite must be green). L11 should go with them, since those tests are what prove H1 to M5 stay fixed.

**To reach 9** (only trivial or cosmetic left): all of the above plus L1, L2, L3, L4, L6, L7, L8, L9, L12, L13, L14 and L15. L5 may remain only as a wording fix.

## 4. Areas not covered

- Data tables: `src/data/*` (sensors, fault libraries, fuses, car data), `src/coding/catalogue.ts`, `enriched.ts`, `src/mot/rules.ts`. Bit positions and formulas in them were not checked against sources.
- `src/service/obdReset.ts` and `src/app/service-reset.tsx` (the client side, `runServiceReset`, was read).
- `src/obd/sensors.ts` decoding, `sensorSearch.ts`, `vagGateway.ts`, `modules.ts`, `pace.ts`, `extras.ts`, `battery.ts`.
- `src/diag/service06.ts`, `service09.ts`, `freeze.ts`, `timeline.ts`, `scanDiff.ts`, `emissionsStore.ts` beyond their adapter calls.
- Screens read only in part: `mot.tsx`, `performance.tsx`, `battery.tsx`, `trip.tsx`, `dpf.tsx`, `boost.tsx`, `fuel-trims.tsx`, `sensors.tsx`, `discover.tsx`, `modules.tsx`, `car-ids.tsx`, `history.tsx`, `log-view.tsx`, `customise/timeline.tsx`, `customise/[id].tsx`, `src/ui.tsx`, `src/logger/Charts.tsx`, `src/kb.ts`.
- `simTransport.ts` apart from its TP2.0 part.
- Nothing was run on a phone or a car: background running through expo-location, sounds through expo-audio (and the `app.json` entries they need) and Bluetooth timing were read, not tested.
- The choices the owner made on 20 Nov 2026 (no confirm, no preflight block, no coding-length gate, clearing with the engine running) were treated as intended and not scored. They make H1, M1, M6 and M9 matter more, because the read-back is now the only net.
- Security (the upload token built into the app) belongs to another category and was not scored here.
