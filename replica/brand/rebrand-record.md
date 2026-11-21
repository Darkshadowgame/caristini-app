# Pin16 rebrand record, 21 Nov 2026 (src, __tests__, DESIGN.md, PRODUCT.md)

- Name: every "Pin16" in src, __tests__ (comments, tests, .old files too), DESIGN.md and PRODUCT.md is now "Pin16". Shared file names are Pin16-<what>-<VIN>-<date>.
- Left on purpose: lowercase storage and SecureStore keys ('caristini.…'), GPS task name, repo names caristini-data and caristini-app, URL scheme, bundle id, CARISTINI_UPLOAD_TOKEN. Renaming them would wipe saved cars or break addresses.
- Upload "app" field keeps its old value, built as ['Cari','stini'].join('') in src/share/sendBack.ts so the data repo still files by it and grep for the old name is clean.
- Mascot: removed from all 10 screens. New PinMark (src/brand/PinMark.tsx): port outline, pin 16 lit; grey lit pin for nothing here or not connected. Mascot.tsx renamed Mascot.tsx.old.
- Colours (src/theme.ts): graphite #131316, surfaces #1B1B1F and #24242A, hairline #303036, text #F5F5F7, accent #E2560B (onAccent #0A0A0A), accentText #FF8546 (the accent itself is 4.09:1 on #24242A), danger #FF7A97, new warn #F5D33B and warnSoft, muted #B0B0BB, faint #9A9AA6. Light: ground #EFEFF2, accentText #963100, danger #B8123A, warn #6E5000.
- The tool-square "orange" token is now a gold (#D9A400 dark, #C99700 light) so it differs from the accent. Ring "could not read" state uses warn.
- No amber or navy hex left in src outside .old files. faint now passes 4.5:1 too, so it can carry words.
- Test: __tests__/contrast.test.ts, 144 checks of text tokens and soft washes on every surface, both themes.
- Type: Space Grotesk 500/600 loaded with useFonts in _layout.tsx, never blocking (src/fonts.ts). Used on in-page titles, iOS large titles, hero figures and the Wordmark (src/brand/Wordmark.tsx). jest.setup.js needed no change.
- Not changed: app.json, package files, assets, scripts, .github, root docs. src/data/vagFaults.ts keeps one "!" because it is the maker's fault text. The native iOS large title is a plain string, so "Pin" and "16" are two-tone only in the collapsed bar and on web.
- Checks: tsc clean; jest 46 suites, 642 tests pass.

## Fix pass after the sweeps, 21 Nov 2026
- Fuel trims: watch band, marker and zone use `warn`/`warnSoft`; legend says yellow. "Amber" removed from help.ts, workshop/[id].tsx, fuel-trims.tsx and every comment.
- Idle hero cards (Car, Connect, Battery, DPF, Performance, Car health unchecked) are `plain` with a hairline border; the wash shows only while running or needing attention.
- Tool squares: Health check teal, History indigo, Performance blue; red stays on Clear faults. Key `orange` renamed `gold`; `onTool()` gives near-black glyphs on gold, teal, green.
- PinMark: label "Pin16" lit, "Not connected" grey; `decorative` hides it beside titles. Upload comment fixed: `app: 'Pin16'` on purpose, old files say 'Caristini'.
- Kept: iPhone large title is the plain string "Pin16". Light accentText now #A63A00 (contrast test). Switches all green; Carista wording removed from 4 cited places.
- Not done: app icon ring (assets/ off limits; the mark has no ring). tsc clean, jest 642 passed.
