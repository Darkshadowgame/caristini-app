# Pin16: looks, formatting and branding review, round 2

Date: 20 Nov 2026. Build: web build at http://localhost:8090, 390 x 844, SEAT Leon Cupra demo car. Screenshots: `replica/review-2026-11-20/shots/looks2-01` to `looks2-09` (Car, Health check, Live data, Customise, Data logger, Settings, MOT check in dark; Car and Settings in light). 10 shots taken (1 retaken); the limit was 12. Most of the review is from code.

## 1. Score

**8 out of 10** (round 1: 6.5).

Rubric: 8 is "solid, no high, only a few low or medium". This build has 0 high, 2 medium, 8 low.

Counts: 0 high, 2 medium, 8 low. 10 verified findings.

Contrast was computed from the tokens in `src/theme.ts` (WCAG relative luminance, soft washes composited over the real ground):

| Pair | Dark | Light |
|---|---|---|
| muted on bg, surface, sunken, glow washes | 4.9 to 9.0 | 4.88 to 5.63 |
| accentText on bg, surface, sunken, glows | 5.9 to 11.8 | 5.28 to 6.62 |
| accentText on its own soft wash (over bg / surface) | 8.85 / 6.44 | 5.35 / 5.89 |
| danger, ok, info on bg, surface, sunken, glows | 5.7 to 9.6 | 5.2 to 6.9 |
| danger, ok, info on their own soft wash | 5.68 to 8.05 | 5.23 to 5.89 |
| onAccent on accent (filled button) | 10.40 | 9.02 |
| faint on bg / surface | 3.25 / 3.40 | 1.92 / 1.96 |

Every text colour is at least 4.5:1. `faint` is used only for chevrons and empty-state glyphs (grep of `faint` in `src`: 16 uses, all icons; `ui.tsx:1262` is a module-ring dot).

## 2. Round 1 high and medium findings

| Round 1 | Status | Evidence |
|---|---|---|
| H1 shared Chip, Segmented, Field, StepNumber | Fixed | 23 files use them; only 2 `TextInput` remain, both in `src/ui.tsx` (`Field`, `SearchField`); Customise chips in `looks2-04`; the 3 step styles are now 1 (`ui.tsx:348`) |
| M1 colour per tool | Partly fixed | `TOOLS` map (`ui.tsx:134`) used by 47 rows; 98 literal `iconColour` values remain (new finding M1 below) |
| M2 header insets | Fixed | `Label` has the 16 inset (`ui.tsx:1181`); Live data headers in `looks2-03` line up |
| M3 Car identity row | Fixed | `looks2-01`: badge and pill, then "2007 · Petrol · PQ35" on its own line |
| M4 cut-off labels | Fixed for buttons and Customise (`looks2-04`); 1 subtitle still clipped (L2) |
| M5 double tick | Fixed | `performance.tsx` passes `selected` only; `ui.tsx:654` keeps a fixed tick slot |
| M6 44 pt targets | Mostly fixed | Chip is 36 + 4 + 4 hitSlop (`ui.tsx:822`); MOT segments are 40 pt (M2 below) |
| M7 faint text | Fixed | See table |
| M8 light contrast | Fixed | See table |
| M9 dates | Fixed | No bare `toLocaleDateString` or date `toLocaleString` left in `src`; all dates go through `src/timeText.ts` (`looks2-01`: "20 Nov 2026, 16:04") |
| M10 colour meaning | Fixed in the places checked | "Maker source" is info (`service.tsx:131`); Lookup P, C, B, U are grey (`lookup.tsx:65-68`); "Seen before" is a neutral tag in `history.tsx`. Pills tone `accent` remain on "Try it" and "Now" (acceptable: pending and in progress) |
| M11 MOT rows | Fixed | `looks2-07`: verdict pill on the title line, 1 line of reason, "Fix and details" link |
| M13, M15 | Fixed in `looks2-01` | Stat tiles line up; trailing values capped at 50% (`ui.tsx:649`) |
| No double tick, dates | Done | As above |

## 3. Findings, most severe first

### Medium

**M1. The One Square Rule is still broken by action rows and by screens that set their own colours.**
- Screens: Health check (`looks2-02`), Data logger (`looks2-05`), MOT check, Service reset, Settings.
- Seen: Health check "Check again" and "4 seen before" are blue (Live data's colour; Diagnose is red). Data logger squares are teal (Record route), blue (Choose values) and green (Auto-start) although `TOOLS.logger` is indigo, `live` is blue and `service` is green.
- Source: `src/app/diagnostics.tsx:559` (`refresh`, blue) and `:569` (`radar`, grey, where `TOOLS.sensors` is `radar` in blue); `src/app/logger.tsx:199,221,237`; `src/app/mot.tsx:298,324,354,355,356,357`; `src/app/service-reset.tsx:284,286,315,321`; `src/app/settings.tsx:130,142,251,313,318,369,377`. 98 literals against 47 `tool()` uses.
- Fix: action rows that are not a tool (Check again, Read again, Share, Save, Start again, Settings rows) take `grey` or the owning tool's colour from `TOOLS`; add `TOOLS` entries for the rest; update the DESIGN.md table (L4).

**M2. Segmented segments are 40 pt tall, not 44.**
- Screen: MOT walk-round, 41 items x 4 segments, used standing by the car. Measured in the DOM on `/mot`: 77 x 40 for every Pass / Advisory / Fail / To do button.
- Source: `src/ui.tsx:1191-1192` (`segmented` minHeight 44 with padding 2; the segment is a flex child with no minHeight or hitSlop). The 2 pt track edge does not register a tap.
- Fix: `segment` `minHeight: 44` and `segmented` `minHeight: 48`, or `hitSlop={{ top: 2, bottom: 2 }}` on each segment.

### Low

- **L1. Live data tile trend bars render as wide blocks when there are few samples.** `looks2-03`: 3 points become 3 big grey and amber rectangles, 10 to 25 px wide, and amber outside the One Tint exceptions. `src/screens/LiveScreen.tsx:809-823` (`flex: 1` per bar). Fix: fixed 3 pt bar width with 1 pt gap, align left, `t.muted` for the latest bar.
- **L2. A subtitle is cut mid-sentence.** MOT "From the car": "The engine light showing a malfunction ..." (`looks2-07`). `src/app/mot.tsx:420` (`numberOfLines={open ? undefined : 1}`). Fix: 2 lines.
- **L3. The Car hero caption orphans "16:04".** "Last health check, 20 Nov 2026," wraps and leaves the time alone on line 2 (`looks2-01`). `src/app/(tabs)/(car)/index.tsx:189`. Fix: shorten to "Checked 20 Nov, 16:04" or put the date on its own line.
- **L4. DESIGN.md drift.** `type.caption` (12) and `type.figureMid` (48) are not in the document; the tool-colour table lists 6 tools while `TOOLS` has 29 entries on 8 colours (the rule now means one colour per family); tabs are listed as "Car, Lookup, Diary, Garage" (the app shows Settings); `Segmented` and the 36 pt `Chip` are not documented (DESIGN.md describes a 3px by 9px pill and category chips only). Fix: update the document.
- **L5. Off-scale type still hard-coded.** 48 px figures in `src/app/knock.tsx:318`, `logger.tsx:385`, `sensors.tsx:401`, `trip.tsx:224` where `type.figureMid` exists; 14, 12, 15 and 72 in `src/screens/LiveScreen.tsx:992,995,1017-1021`, `src/live/LiveTiles.tsx:262`, `src/app/modules.tsx:221`. Fix: use the `type.*` tokens.
- **L6. White glyphs on green, teal and orange squares are under 3:1.** Computed: green 2.02 dark and 2.22 light, teal 1.99 and 2.57, orange 2.06 and 2.20 (red, blue, purple, grey are 3.3 to 4.1; indigo is 5.1 to 5.7). Same as iOS Settings and every square has a text title, so low. Fix: darken those 3 squares by about 15 percent, or use `onAccent` glyphs on them.
- **L7. "Check again" on the Car hero is amber-soft over the red glow** and reads as a muddy brown (`looks2-01`). `src/ui.tsx:543` (`buttonColours`, secondary). Fix: on a `GlowCard` of tone fault, use a `t.surface` fill with `accentText`.
- **L8. MOT hero repeats itself.** "2 likely fails", then "Likely to fail: 2 items to fix", then "3 advisories", then a source line: 4 text lines in the card (`looks2-07`). `src/app/mot.tsx` hero. Fix: drop the repeated line.
- **L9. Search fields are 36 pt tall with no hitSlop.** `src/ui.tsx:1230`. DESIGN.md specifies 36 pt, which conflicts with its own 44 pt target rule. Fix: `minHeight: 44`, or a note in DESIGN.md.
- **L10. Dead styles.** `circleButton` (`src/app/(tabs)/(car)/index.tsx:358`) and `add` (`src/app/(tabs)/(diary)/diary.tsx:137`) are 36 pt and unused. Fix: delete.

## 4. Known and accepted, not scored

SF Symbol coverage (round 1 M12) and the icon and splash ground colour (round 1 M14).

## 5. What is good now

- Settings, Data logger and Customise read as one product in dark and light (`looks2-04`, `-05`, `-06`, `-09`); the Live data page has 1 primary button and aligned headers.
- All text tokens pass 4.5:1 in both appearances, on every ground and wash.
- 1 shared Chip, Segmented, Field and StepNumber; dates in 1 format; the MOT verdict is a pill.

## 6. Not reached

Native iOS chrome, Add to diary, Vehicle details, Service reset, Lookup results, Learn my car and the Pin16 AI card. These were not opened this round; findings there are from code only.
