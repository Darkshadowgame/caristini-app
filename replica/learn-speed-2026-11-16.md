# Learn my car speed: cost model and changes (16 Nov 2026)

The owner finds Learn my car's 10 to 20 minutes too long. One Bluetooth LE adapter, one request at a time: the time is the number of requests times what each kind costs, plus waits for modules that do not answer.

## Sources

- 2007 SEAT Leon Cupra (PQ35, older VW TP2.0 modules, ELM327 clone): adapter logs of 15 Nov 2026 (scratchpad `c4`, 9 logs) and 13 to 14 Nov 2026 (`replica/findings/cupra`, `cupra2`, `cupra3`, 23 logs). The 15 Nov logs used AT ST 32 on TP2.0 (the bug that made modules repeat and hang up); the 14 Nov logs used AT ST 19 (the working setting, current code).
- 2016 Mazda6 (GJ, UDS, OBDLink STN1151): scratchpad `mz` (2 logs) and `replica/findings/mazda`, `mazda2` (10 logs).
- Method: each `> request` paired with its `< reply`; round trip = reply time minus request time; median and 90th percentile (p90) per kind. Scripts: scratchpad `tools/costs.js`, `tools/kwp.js`, `tools/spans.js`.

## Cost per request (ms, median, p90 in brackets)

| Kind | Leon adapter | Mazda adapter |
|---|---|---|
| AT command (link round trip) | 60 (61), n = 4,438 | 31 (43), n = 2,287 |
| Protocol switch AT SP | 91 | 71 |
| No answer, adapter wait AT ST 19 (100 ms) | 180 | not seen |
| No answer, AT ST 32 (200 ms, the default) | 270 (271) | 225 (253) |
| No answer, AT ST 4B (300 ms, fault sweep) | 390 | 329 (343) |
| No answer, AT ST FF (long wait after NO DATA) | 1,110 | 1,063 |
| UDS read answered or refused, adaptive timing on | no UDS modules | 60 (75), n = 4,341 |
| UDS read, 3 values in one request | | 92 (105) |
| UDS fault read 19 02, adaptive timing off (sweep) | | 342 (346): the whole AT ST 4B wait even when answered |
| Address probe 3E00, no module | 270 (271), n = 645 | 223 (238), n = 663 |
| Mode 01 single / batch answered | 91 / 90 | 75 / 75 |
| Mode 03, 07 answered | 149 to 270 | 90 |
| TP2.0 channel open, answered (trailing response count) | 91 | |
| TP2.0 channel open, no module (2 tries) | 2 x 180 + 2 AT = 480 | |
| TP2.0 one frame exchange (AT ST 19) | 180 (181) | |
| TP2.0 KWP request to next request (request + ACK) | 360 (540); 1A 9B identification 450 (6,150) | |
| TP2.0 module visit, channel open to close | 1,259 (6,839) | |
| TP2.0 raw CAN set-up and leave (13 AT commands) | about 800 | |
| TP2.0 measuring group (broken channel, 15 Nov) | 1,890: 6 keep-alives of 270 each per group | |

Rules that follow:

1. A request nothing answers costs the adapter's whole wait (AT ST x 4 ms) plus about 70 ms (Leon) or 25 ms (Mazda). Adaptive timing (AT AT1) does not shorten it: NO DATA took the full AT ST every time.
2. An answer comes back in 60 to 90 ms when adaptive timing is on; with it off the adapter waits out AT ST even after the answer (the fault sweep's 342 ms per answered module).
3. Modules start answering about 30 to 45 ms after the link time (single-frame answers). UDS allows 50 ms (P2 server). So AT ST 32 (200 ms) is 4 to 6 times what a module needs.
4. On TP2.0 the cost is frames: every frame waits AT ST 19 (100 ms) plus the link, about 180 ms. A KWP answer with lost frames waits out the 5 s KWP limit (7 such waits, about 41 s, in each 14 Nov modules step; 26, about 140 s, on 15 Nov).
5. The Leon's engine refuses a TP2.0 channel for about 6 s after any standard OBD request (obdQuiet). The 14 Nov modules step had 54 s of such idle gaps; a health check 51 s.

## Today (code at c2ff227): estimated real-car time per step

From the request counts each step makes and the costs above; where a real Learn my car or health check log covers the step, its span is given.

| Step | Leon first run | Leon repeat run | Mazda first run | Mazda repeat run |
|---|---|---|---|---|
| 1 Modules | 2.1 to 4.3 min (logs: 127 s and 259 s; 27 channel visits, 7 slow KWP answers, up to 54 s engine quiet waits) | the same again | 1.7 min (log: 100 s; address probe 254 x 256 ms = 65 s) | 0.6 min (identities only) |
| 2 Faults (health check) | 0.6 min + older-module search 0.75 min (logs: 38 s, 45 s); 1.6 min with quiet waits (97 s log) | 0.6 to 1.6 min | 0.4 min (log: 24 s) | 0.4 min |
| 3 Sensors | none (PQ35) | none | 0.7 min (log: 40 s full search) | 0.1 min (log: 6 s) |
| 4 Values | 4.5 to 5.5 min (13 modules of value groups, engine and gearbox capped at 90 s; 15 Nov log 5.6 min) | 0 to 0.5 min | 8 min (cap; 18.5 min uncapped on 14 Nov) | 8 min every run: refused values are asked again each time |
| 5 Emissions | 0.3 min | 0.3 min | 0.1 min | 0.1 min |
| 6 MOT | from the check | from the check | from the check | from the check |
| 7 Battery and odometer | 0.1 min (odometer waits out about 5 s: UDS asked of a TP2.0-only cluster) | 0.1 min | under 0.1 min | under 0.1 min |
| 8 Save and send | 0.1 min | 0.1 min | 0.1 min | 0.1 min |
| Total | about 9 to 12 min (15 Nov, with the TP2.0 bug: about 15 min) | about 3.5 to 6.5 min | about 11 min | about 9.5 min, every run |

## Measured on the simulator (real-car request costs, simulated clock)

`__tests__/learnSpeed.test.ts` runs Learn my car on the demo cars with `SIM_TIMING` (the costs above: link, AT ST waits, raw-CAN frame waits, the Leon engine's 6 s quiet time) and a simulated clock. "Sized" cars have the real cars' module counts (Leon 11 older modules, Mazda 14). The simulator does not lose TP2.0 frames, so it has none of the 5 s KWP waits and shows less than the real Leon. Minutes:

| Car | Before: first | Before: repeat (every run) | After: first | After: repeat while values are explored | After: repeat once explored |
|---|---|---|---|---|---|
| Leon (demo, 7 modules) | 3.2 | 0.8 | 2.9 | 0.3 | 0.3 |
| Leon (11 modules) | 3.8 | 1.2 | 3.3 | 0.4 | 0.4 |
| Mazda (demo, 5 modules) | 5.6 | 2.9 | 3.8 | 2.8 | 0.2 (from run 5) |
| Mazda (14 modules) | 7.1 | 3.9 | 3.9 | 2.8 | 0.2 (from run 6) |

Per step, Mazda with 14 modules, first run: modules 78 s to 54 s (adaptive wait on the address probe), values 309 s to 150 s (2.5-minute slice); repeat run: modules 9 s to 0, sensors 6 s to 0, faults 6.4 s to 4.9 s, values 211 s on every run before, now about 158 s on 3 runs, a shorter fourth, then 0. Leon with 11 modules: modules 32 s to 21 s first and 32 s to 0 on repeat runs (raw CAN held across modules, engine last), battery 5.5 s to 0.2 s, faults 24 s to 21 s on repeat runs.

## Expected on the real cars after the changes

| | Leon first | Leon repeat | Mazda first | Mazda repeat |
|---|---|---|---|---|
| Estimate | about 5 to 6 min (modules 0.5 to 1.1 min plus any slow KWP answers, faults 1.4 min, values 2.5 min) | about 1 min; 3.5 min while value groups are still being read | about 5 min (address probe about 48 s with a 132 ms wait) | about 0.5 min; 3 min while values are explored (about 7 runs for the 18.5 min the 14 Nov run needed) |

## What was changed (16 Nov 2026)

1. Repeat runs keep what does not change (`learnMode`, `learnFullAt`): identities and codings, the sensor search and the address search run on the first run, after 30 days, with Read everything again, or for a new module (identity, coding, sensors, values) or a missing one (faults asked again, then the address search over addresses that ever answered). Silent module ids, request IDs and TP2.0 addresses are saved (`learnSilent`) and skipped until the next full read; modules the gateway lists are always asked.
2. Values: 2.5 minutes a run, no per-module cap (it left most of the slice unused once one large module was left), resume from `learnNext`/`learnRanges` and `groupsResume`, modules swept to the end marked `learnDone` and not swept again, values read twice before not re-sampled.
3. Adaptive waits (`src/obd/pace.ts`): single-frame UDS answers are timed; the wait for a silent module is 3 times the 90th percentile reply time, floor 100 ms, never above the old fixed wait. Used by the address probe, fault sweep, value sweep and sensor search. TP2.0 keeps AT ST 19, its ACK logic and its 5 s KWP limit.
4. Shared reads: the health check's readiness and engine light, OBD codes and battery voltage are reused by the emissions, MOT and battery steps. Learn reads Mode 01 only for PID 01, now once per run, so there was nothing left to batch with `livePidBatch.ts`.
5. Older VW modules: engine and gearbox last (no 6 s quiet waits), raw CAN held across modules in the module and value steps, no UDS maker-value reads of TP2.0-only modules.
6. The screen says first run, repeat run or full read, and estimates from the adapter's measured pace and the last run of the same kind (`learnTimes`, `learnPace`).

## Not known or not done

- The 5 s KWP limit for answers with lost frames on the Leon is unchanged (rule from the brief: TP2.0 timing not touched). It is the largest remaining real-car cost of the Leon's first run.
- The response-count suffix on UDS requests (as the TP2.0 channel request uses) would end each answered request at the first frame; not tried, because a "busy, wait" (78) answer and multi-frame answers have not been tested with it on these adapters.
- Freeze frames are read one value per Mode 02 request; Mode 02 batching is not supported by `livePidBatch.ts` and was left out.
- All after figures for the real cars are estimates; no real-car run has been made with this version.
