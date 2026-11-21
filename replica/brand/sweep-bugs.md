# Rebrand sweep: bugs and functionality

Date: 21 Nov 2026. Scope: uncommitted rebrand (`git diff HEAD`, 122 files). Review only; no source edited.

Scores: BUGS 8/10. FUNCTIONALITY 9/10.

## Results by check

1. Saved data safety: PASS. No change to any AsyncStorage or SecureStore key, file path, URL scheme, bundle id, location task name or env var name. Verified unchanged:
   - Keys: `caristini.settings.v1`, `.history.v1`, `.kb.v1`, `.kb.shas.v1`, `.outbox.v1`, `.lastAdapter.v1`, `.mot.v1`, `.emissions.v1`, `.dpfRegens.v1`, `.knock.v1`, `.perfRuns.v1`, `.perfRanges.v1`, `.trips.v1`, `.discover.<vin>`, `.logger.v1.<vin>`, SecureStore `caristini.<name>`.
   - `GPS_TASK = 'caristini-logger-gps'` (src/logger/phoneGps.ts:18), `EXPO_PUBLIC_UPLOAD_REPO` and the `Darkshadowgame/caristini-data` default, `releaseUrl` (src/version.ts:17).
   - app.json: `slug` "caristini", `android.package` "com.philmuspratt.caristini" and all other keys unchanged. The diff touches only `name`, three colours, `imageWidth` 220 to 200, permission strings, and the `modes` array layout.
   - The only string-literal change in a persisted or sent path is the upload `app` field (see item 5).
2. Leftovers: PASS. `grep "Caristini"` over src, __tests__, app.json, .github, scripts, *.md, docs finds nothing outside `.old` files. No old colours (#FFB340, #FF9F0A, #E8902A, #0B1020, #16213A) in src. No import of Mascot (`Mascot.tsx.old` only). Stale wording found, see findings F1 and F2.
3. Fonts: PASS. src/app/_layout.tsx:16 calls `useFonts` and renders at once (no early return, no splash hold). `setDisplayFontReady` flips on load. `useDisplay` returns `{}` until ready or on failure, so the system font shows. Names match: `DISPLAY_FONT` in src/theme.ts uses `SpaceGrotesk_500Medium` and `SpaceGrotesk_600SemiBold`, the same names loaded in _layout.tsx:4 and exported by the installed `@expo-google-fonts/space-grotesk` (package present in node_modules and package.json; `expo-font` ~58.0.11 present). src/tabStack.tsx applies the font to the large title only when ready.
4. PinMark and Wordmark: PASS with one low finding (F3). No hooks after early returns (no early returns). `Svg` with `viewBox="13 31 104 68"` and height `size * 68/104` keeps the aspect ratio. Keys are unique. Sizes in use (56, 72) are sensible. `Wordmark` letterSpacing is `-0.02 * size` (correct, points not em).
5. Rename breakage: PASS. `shareFileName` now returns `Pin16-...` and tests were updated to match (src/timeText.ts:124; the test diff is a pure rename of expected strings, no assertions removed or loosened). PDF footer reads "with Pin16" (src/app/report.tsx). GPX creator, adapter log header and mail subject updated. `sendBack` keeps a named constant `UPLOAD_APP = 'Pin16'` (src/share/sendBack.ts:68) and sends `app: 'Pin16'`. History and Diary entries use no brand string in stored data. See F4 for the upload field.
6. app.json: PASS. Valid JSON (parsed with node). name "Pin16". Splash dark and light both `#131316` (intended, graphite ground).
7. Checks run:
   - `npx tsc --noEmit`: 0 errors.
   - `npx jest --testPathIgnorePatterns "[\\\\/]\.claude[\\\\/]"`: 46 suites passed of 46, 642 tests passed of 642, 0 failed.

## Findings (verified)

Counts: high 0, medium 0, low 4.

| ID | Severity | Where | Finding | Fix |
|---|---|---|---|---|
| F1 | Low | src/app/workshop/[id].tsx:442, src/help.ts:654, src/help.ts:539, src/app/fuel-trims.tsx:96 | User-visible text still says "amber" ("amber outline", "Amber: 10 to 20%", "amber to 10%"). The accent is now burnt orange; the byte outline uses `t.accent` (line 457) and the fuel trim watch band uses `t.accentSoft` and `t.accentText` (fuel-trims.tsx:119, 158). | Change the words to "orange" in those four strings. |
| F2 | Low | src/app/(tabs)/_layout.tsx:6, src/ui.tsx:291, 707, 792, 937, 1250, src/app/code/[code].tsx:14, src/app/learn-car.tsx:197, src/app/logger.tsx:146, src/app/sensors.tsx:298, src/app/(tabs)/(car)/index.tsx:313 | Code comments still say "amber". The "Meaning Rule: amber is not a status colour" comment in index.tsx:313 now also sits beside a new `warn` yellow used for status (ui.tsx ModuleRing). | Reword comments to "orange"; state in theme.ts that fuel trim "watch" uses the accent while `warn` is the status yellow, or move the watch band to `t.warn`/`t.warnSoft`. |
| F3 | Low | src/brand/PinMark.tsx:16, src/ui.tsx NeedsConnection | `PinMark` always carries `accessibilityLabel="Pin16"` and role image, and sets no `accessible` prop. Where it sits beside a title (Diary empty state, Report, NeedsConnection) VoiceOver may read "Pin16, image" with no state, and the not-connected (grey) variant says nothing about being disconnected. On iOS a plain View label is not focusable without `accessible`. | Add an optional `label` prop; pass `accessible`; mark purely decorative uses `accessibilityElementsHidden` and `importantForAccessibility="no"`; use label "Not connected" for `lit={false}`. |
| F4 | Low | src/share/sendBack.ts:68, 164 | Uploaded findings JSON now has `app: 'Pin16'` where older files in the data repo have `app: 'Caristini'`. The comment says the data repo "already files by" this value, which is not true of the old files, and any reader filtering on `app === 'Caristini'` will miss new uploads. No reader exists in this repo (grep finds none). | Confirm no consumer in caristini-data filters on `app`; correct the comment to say old files carry 'Caristini'. |

## Not findings (checked)

- No hook ordering or early return problems in PinMark, Wordmark, `Screen`, `TabStack`, `RootLayout`.
- `Screen` swaps in the `Wordmark` header only when `title === 'Pin16'` (the Home screen, src/app/(tabs)/(car)/index.tsx:47). Other screens are unaffected.
- Font load failure: `useFonts` reports an error value and does not throw, so a failed load leaves `fontsLoaded` false and the system font in use.
- Owner choices (Customise switches write at once; faults clear with the engine running) not touched by this diff.
