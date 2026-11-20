# Looks fixes, round 1 (20 Nov 2026)

- M7, M8: tokens in src/theme.ts raised to 4.5:1 or better on bg, surface and sunken, dark and light (measured: muted 4.88 to 9.01, accentText on its soft wash 4.82 to 8.85). Amber accent and true black kept. DESIGN.md colour values updated to match.
- M6: chips, segments, steppers and MOT buttons are 44 pt through the shared Chip, Segmented and Stepper (size or hitSlop).
- M4: button labels shortened or wrapped (2 lines); Customise descriptions show in full.
- M5: double tick removed on Performance (selected state only).
- M3: Car tab connected header split into a badge and pill row plus a summary line.
- H1: shared Chip, Chips, Segmented, Field and StepNumber in src/ui.tsx; screens moved onto them.
- Skipped as asked: M12, M14. Other files not touched: assets, app.json, package.json, src/obd, src/learn, src/state.tsx.
- Checks: tsc clean; jest 45 suites, 484 tests pass. Not checked on screen (no screenshots taken).
