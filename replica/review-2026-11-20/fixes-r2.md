# Fixes, round 2 (20 Nov 2026)
- F-M1, F-M2: one helper `vehicleServiceDue` (src/service/reminder.ts) for the Car tile, offline row and Service page. A typed odometer older than 30 days drops "due in" distance (overdue stays); the page says how old it is. `markDoneKm` stores no mileage from a typed figure older than a day (also in service-reset). Month-end date clamp (B-L7). 9 new Jest tests.
- F-L1: idle and loads-on charging under 13.0 V with no engine speed is shown, not saved (`chargeTooLow`).
- B-M1: `settle` reopens a closed channel for the did style. B-L1: fault reads, clear, status and VIN wait for the adapter (20 s) and fail, never send into a busy channel. B-L2: a stalled open frame is not saved as silent.
- B-L4: the leave sheet closes when the run ends and Stop and go back leaves at once.
- Consistency R2-1 to R2-10, R2-13 and the clear-failed text (no "engine off"): worded as the report says; MOT and Customise stamps use timeText.
- Looks: Segmented segments 44 pt, MOT reason 2 lines, trend bars 3 pt, search field 44 pt. Colours: 55 rows moved to `TOOLS` (Check again, Data logger, MOT, Service reset, Health check, car records); about 40 literals remain (Settings, Sensors, small status rows).
- DESIGN.md synced (tabs, caption, figureMid, Segmented, Chip, tool table; AI card section removed).
- Skipped: B-L3, B-L5, B-L6, F-L2 to F-L4, R2-11 (help note added only), R2-12, Looks L3, L5 to L10, C22 beyond the above.
- Checks: tsc clean; Jest 45 of 45 suites, 493 of 493 tests.
