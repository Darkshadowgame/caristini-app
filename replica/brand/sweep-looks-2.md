# Pin16 re-check: looks and consistency

Review only, 21 Nov 2026. Web build at localhost:8090, 390 x 844. Nothing edited except this report and the screenshots.

## Scores

- LOOKS: 8 / 10
- CONSISTENCY: 8 / 10

Counts: 0 high, 1 medium, 3 low.

## Status of the first sweep (1 high, 4 medium)

| # | Finding | Status | Evidence |
|---|---|---|---|
| 1 | Fuel trims watch band in orange (high) | Fixed in colour, see new finding A for the zone tint | `fuel-trims.tsx:96` says "yellow", `:119` uses `t.warn`, marker is yellow in recheck-04 |
| 2 | "Amber" wording (medium) | Fixed | No "amber" in `src` outside `.old` files |
| 3 | Brand wash on idle hero cards (medium) | Fixed | Car not connected is plain with a hairline (recheck-01). `GlowCard tone="brand"` remains only in running-only blocks (`discover.tsx:263`, `sensors.tsx:314`) and as `busy`, `scanning` or `running` ternaries. Data logger idle hero is plain (recheck-05) |
| 4 | iPhone large title plain text (medium) | Kept on purpose, not scored | `tabStack.tsx:20` still `headerLargeTitle: true` |
| 5 | Pink-red tool squares (medium) | Fixed | Health check list: only Clear all faults is pink-red; History indigo, Check again and Emissions teal, MOT green (recheck-03) |

Also confirmed: no "Caristini" and no AI, Claude or mascot wording in anything a user sees (hits are `.old` files, one comment at `learn-car.tsx:50`, lowercase storage keys such as `state.tsx:45`). No amber or navy hex in `src`.

## What holds up

- Port mark and wordmark: grey port with "Pin16" label when not connected, lit orange pin while reading, grey port beside the fault count. The Pin16 wordmark with the orange 16 reads cleanly on the Car tab in both themes. Sizes steady (72, 64).
- Glyphs: near-black on gold, teal and green squares, readable in dark and light (light Car tab list, recheck-06: Workshop gold, Drive monitors teal). White on the other squares is 3.52 to 5.65:1, enough for non-text.
- Contrast, computed from `src/theme.ts`: dark accentText on bg 7.68, on raised 6.39; warn on raised 10.48; danger on raised 6.23; ok 7.63; muted 7.18; faint 5.55. Light accentText #A63A00 on bg 5.67, on white 6.51; warn 6.51; danger 5.74; ok 5.75. onAccent on accent 5.25. All at least 4.5:1. `__tests__/contrast.test.ts` covers the soft washes (not re-run).
- Switches: every `<Switch>` carries `trackColor` green (`settings.tsx:55`, `logger.tsx:208`, `customise/index.tsx:479`). Light Settings screen is calm and consistent (recheck-08).
- Light Car tab connected (recheck-07): fault hero, tiles and tool squares use the new palette; no orange status.

## Findings

### Medium

A. **Fuel trims: watch zone reads brown-orange.** Screen: Fuel trims (recheck-04). `src/app/fuel-trims.tsx:157-159`. The track is `dangerSoft` (translucent pink-red) and the watch zone is `warnSoft` (14% yellow) drawn over it, which blends to brown-orange; the green zone over that looks olive. The text and marker are yellow as required, but the bands beside them read orange. Fix: give the track a neutral base (`t.sunken`) and draw `dangerSoft` only on the outer segments, or use an opaque yellow tint for the watch zone.

### Low

B. **Third-party name still in feature copy and help.** `customise/index.tsx:341,343,344,353` ("Change a setting in Carista; Pin16 learns what changed"), `customise/learn.tsx:193-240`, `service-reset.tsx:234,288,318`, `help.ts:69,76,256,272,276,299,420,421,749`. The four places cited in sweep 1 are cleared, but the title "Learn a setting" now sits above a subtitle that names Carista. Fix: "another app" in subtitles and help, or keep the name only where steps depend on it and say so in DESIGN.md.
C. **Two adjacent teal squares in the Health check list.** Check again and Emissions self-tests are both teal (`ui.tsx:138,156`, recheck-03). Fix: move Emissions to blue or keep and accept.
D. **Web switch thumb is teal.** Data logger and light Settings show a teal thumb on the green track (recheck-05, recheck-08). Web default for `Switch`; on iPhone the thumb is white. Add `thumbColor` (or `activeThumbColor` on web) if the web build matters.

## Not scored or not checked

- Not scored per brief: SF Symbol coverage, web-only artefacts (top tab bar, scrollbar), plain iPhone large title.
- Screenshot budget: 8 used. Light-mode Health check result was not captured; light tokens were checked by computation and the light Car and Settings screens. The first Car connected capture (recheck-02) was taken after a failed path resolution and retaken. One accidental navigation to a bad URL reset the demo connection; I reconnected and carried on from the root without further reloads.
- recheck-03 Health check was captured after the scan finished (4 faults, Clear all faults first).

## Screenshots

`replica/brand/shots/`: recheck-01 Car not connected (dark), 02 Car connected (dark), 03 Health check result (dark), 04 Fuel trims (dark), 05 Data logger (dark), 06 Car connected light, scrolled to the tool lists, 07 Car connected light, top, 08 Settings (light).
