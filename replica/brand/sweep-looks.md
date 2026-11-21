# Pin16 sweep: looks and consistency

Review only, 21 Nov 2026. Web build at localhost:8090, 390 x 844. Nothing edited except this report and the screenshots.

## Scores

- LOOKS: 7 / 10
- CONSISTENCY: 7 / 10

Counts: 1 high, 4 medium, 8 low.

## What holds up

- Palette: every screen seen uses graphite, burnt orange, pink-red danger and green. No navy, no amber fill and no mascot on any screenshot. `src/brand/Mascot.tsx.old` and the old AI files are `.old`.
- The port mark and the wordmark read as one family. Sizes are steady: 72 wide on empty states, 64 on result cards, 56 on tool heroes. The Pin16 wordmark is 34 px with the orange 16 on the Car tab. The app icon and splash show the lit pin on graphite.
- Display type (Space Grotesk) shows on the large titles (Leon II, Settings), the fault count and the wordmark. It loaded on the web build.
- Contrast from tokens: dark accentText on bg 7.68, on accentSoft over surface 5.64; onAccent on accent 5.25; danger on dangerSoft 5.73; warn 8.36; faint on surface 6.17. Light accentText 6.60 to 6.69; danger 5.54; ok 5.89; warn 6.52; faint 5.28 to 5.56. All text pairs I computed pass 4.5.
- Touch targets: the small controls (Disconnect 73 x 20, help 32 x 32) carry hitSlop of 10 to 12 (`ui.tsx:269`, `car/index.tsx:185`), so they reach 44.
- No exclamation marks in copy (the only `!` is the tab badge, `(tabs)/_layout.tsx:15`). No "Caristini" and no mention of AI in anything the user sees. Empty states (Car not connected, Data logger "No logs yet for this car") are calm.

## Findings

### High

1. **Fuel trims: orange used as a status colour.** Screen: Fuel trims (not in the 14 shots; read from source). `src/app/fuel-trims.tsx:119` colours the "watch" band with `t.accentText`, and `:158` draws the watch zone with `t.accentSoft`. The legend at `:96` calls it "amber". Orange now means "watch" here and "tap me" everywhere else, which breaks the One Tint Rule and sits next to the red danger band. Fix: use `t.warn` for the watch band text, marker and zone (add a `warnSoft` zone at `:158`), and change the copy to "yellow".

### Medium

2. **Leftover "amber" wording in user-facing text.** `src/help.ts:539` ("Amber: 10 to 20%"), `src/help.ts:654` and `src/app/workshop/[id].tsx:442` ("an amber outline"; the byte border is `t.accent` at `:457`, so it is orange), `src/app/fuel-trims.tsx:96`. Fix: "orange outline" in the two byte-grid strings; "yellow" for trims once finding 1 is fixed. Comments with "amber" (`car/index.tsx:313`, `_layout.tsx:6`, `code/[code].tsx:14`, `learn-car.tsx:197`, `logger.tsx:146`, `sensors.tsx:298`, `ui.tsx:290`) are low and can go in the same pass.
3. **Brand wash on idle hero cards.** Screens: Car tab not connected, Connect (shots 01, 02). `GlowCard tone="brand"` is hard-coded at `car/index.tsx:60`, `connect.tsx:103`, `battery.tsx:286`, `discover.tsx:263`, `sensors.tsx:314`. The brown-orange wash plus an orange button plus an orange mark puts three oranges on one card, and DESIGN.md allows the wash only while the car is being read. Fix: `tone="plain"` for the idle state and `'brand'` only while scanning, as `learn-car.tsx:198` and `logger.tsx:147` already do.
4. **iPhone large title is plain text, not the wordmark.** `src/ui.tsx:240` swaps in `<Wordmark>` only through `headerTitle`, which iOS shows for the collapsed title. The large title (`tabStack.tsx:35`) renders the string "Pin16" in the text colour with no orange 16. The web build shows the wordmark, so the web shots hide this. Not checked on a device. Fix: set `headerLargeTitle: false` on the Car root and let `headerTitle` carry the wordmark, or accept plain text and say so in DESIGN.md.
5. **Pink-red tool square is the danger colour.** Screens: Car tab, Health check (shots 03, 04). `theme.ts` `red` (#FF5C7A) is within a few shades of `danger` (#FF7A97). History, Check again, Clear all faults, Health check and Performance wear it, so "Check again" in the Health check list looks like a fault marker beside the red "4 faults" figure. Fix: move History, Check again and Performance to `indigo` or `purple`, and keep `red` for Clear all faults only.

### Low

6. **Light-mode accentText is brown.** Screen: Settings light (shot 11). The help circle and the checkmarks (#963100) read brown beside the orange fills. Fix: lift to about #B13E00 (still above 4.5 on white; check on `bg` #EFEFF2).
7. **Wordmark orange 16 is 3.3 to 3.8:1 in light mode** (accent on #EFEFF2 3.29, on white 3.77). Fine at 34 px (large text). At 17 px in the collapsed header (`Wordmark.tsx`, `ui.tsx:240`) it is below 4.5. Logotypes are exempt, so low. Fix, if wanted: use `accentText` for the 16 below 24 px in light mode.
8. **Tool colour key "orange" is gold (#D9A400), not the brand orange.** `ui.tsx:162-163` (Workshop, Diary); `theme.ts:49`. The name invites a wrong reuse, and the gold sits close to `warn` yellow. White glyphs on gold are 2.27:1, on teal 1.99 to 2.57, on green 2.02 to 2.22 (iOS Settings has the same trait). Fix: rename the key to `gold`; use dark glyphs on gold, teal and green squares.
9. **Third-party name in feature copy.** "Carry on learning from Carista" (`car/index.tsx:262`), "Learn from Carista" (`customise/index.tsx:353`), `connect.tsx:111` and `:159`. It sits beside "Learn my car", so the product has two learning names and names another brand. Fix: "Learn a setting" (the `TOOLS.learnSetting` key) and "your adapter" in the connect copy.
10. **Display type not carried to the big live figures.** Screens: Live data, Dashboard (shots 06, 07). Only titles, the fault count and the wordmark use Space Grotesk; the 48 px speed and rpm figures and the tile values use the system font. DESIGN.md says display type is for "hero figures". Fix: either apply `useDisplay()` to the Dashboard figures or state in DESIGN.md that tiles stay system.
11. **Mark detail differs between app and icon.** `assets/icon.png` and `splash-icon.png` show a faint ring round the lit pin; `PinMark.tsx:23` draws none. Fix: drop the ring from the icon, or add it to the mark at 64 px and above.
12. **Switch colour has no rule.** `theme.ts:10` says orange fills "the switches that are on". Customise uses `t.green` (`customise/index.tsx:479`); Learn my car and Settings use the platform default (teal on web, system green on iPhone). Fix: pick green (as DESIGN.md says for bits), delete the "switches" line from the theme comment and pass `trackColor` to every `<Switch>`.
13. **DESIGN.md is stale in places.** Line 276 "True black ground" (bg is #131316 graphite); line 384 "the card holds the Mascot"; the Glow card text omits the idle case from finding 3. Fix: edit those lines.

Also seen: the Learn my car hero (shot 05) has a 7-line centred paragraph under the title; split it into a one-line summary and a footer note (`learn-car.tsx`, hero block). Low, not counted.

## Not scored or not checked

- Web-only: the top tab bar (dark in light mode), the scrollbar, and the tab labels set in display type.
- Not screenshotted: Data logger and light-mode Health check. The 14-shot budget went on the others after two retakes (a failed click and a scrolled light Car shot). Data logger text was read from the DOM: titles and empty state follow the same pattern, no leftover palette words. Light Car tab connected (shot 12) was captured scrolled, so the hero is cropped; the tiles and rows below it use the new palette.
- Internal names that still say caristini: `app.json` slug (`:3`), scheme (`:72`), bundle ids, storage keys (for example `src/settings.tsx:54`, `src/history.ts:69`). Not visible to a user; renaming storage keys would drop saved data without a migration.

## Screenshots

`replica/brand/shots/`: sweep-01 Car not connected, 02 Connect, 03 Car connected, 04 Health check, 05 Learn my car, 06 Live data, 07 Dashboard, 08 Customise, 09 MOT check, 10 Settings (all dark); sweep-11 Settings light, sweep-12 Car light (scrolled).
