# Pin16: looks, formatting and branding review, round 1

Date: 20 Nov 2026. Reviewer: design review agent. Build: static web build at http://localhost:8090, viewport 390 x 844, dark mode first, light mode spot-checked. Demo cars used: SEAT Leon Cupra (main pass) and Audi A6 C7 diesel (sensors, DPF). Screenshots: `replica/review-2026-11-20/shots/looks-*.png` (file names below omit the folder).

## 1. Score

**Looks, formatting and branding: 6.5 out of 10**

| Sub-score | Score | Basis |
|---|---|---|
| Looks | 6.5 | 1 high (H1) and 8 medium (M1, M2, M3, M6, M7, M8, M10, M15) |
| Formatting | 7 | 0 high, 5 medium (M4, M5, M9, M11, M13) |
| Branding | 7.5 | 0 high, 2 medium (M12, M14); M12 is from source and was not seen on the web build |

How the score follows from the rubric: 7 is "several medium issues or one high". This build has 1 high and 15 medium, so it sits under the 7 line. 6 needs more than 1 high, which it does not have. Hence 6.5.

Counts: 1 high, 15 medium, 24 low. 40 findings.

Measured, not judged: contrast ratios were computed in the browser from the rendered colours; touch sizes are the rendered box sizes, checked against `hitSlop` in the source.

Ignored as web-only: the expo-router "!" badge, the drawn top tab bar and its focus ring, the web header (left arrow, left-aligned title), the page sheet opening under the header, the teal switch thumb (React Native Web default), the Segoe UI font and the scrollbar.

## 2. Findings, most severe first

### High

**H1. Secondary screens use 5 chip styles, 4 input styles, 3 numbered-step styles and 2 section-label patterns, so the app stops reading as one product once you leave the main lists.**
- Screens: Add to diary, Vehicle details, MOT walk-round, Dashboard edit, Live data, Customise, History, Lookup, Service, Code detail, help sheets, Customise guide.
- What is wrong:
  - Chips: filled capsule (Diary filter, Customise, History: `looks-63-diary-connected-dark.png`, `looks-43-customise-switch-toggled-dark.png`); bordered rounded rectangle with amber outline (Add to diary, Vehicle details: `looks-64-diary-add-dark.png`, `looks-68-edit-details-dark-a.png`); outlined 4-way segments (MOT: `looks-39-mot-walkround-states-dark.png`); 12px-radius code chips (Lookup: `looks-03-lookup-tab-dark.png`); 30px neutral pills (Live data groups: `looks-18-live-data-dark-b.png`).
  - Inputs: black well with border (`looks-19-live-tile-sheet-dark.png`, `looks-64-diary-add-dark.png`); sunken well, no border (`looks-36-performance-dark.png`); inline borderless with mono placeholder (`looks-65-parts-ids-dark-a.png`); inline in a row (`looks-20-live-choose-sheet-dark.png`). DESIGN.md defines 1 field: the sunken well.
  - Numbered steps: amber-soft circle with amber number (help sheet, `looks-02-help-sheet-car-dark.png`); sunken circle with white number (code detail, `looks-12-code-detail-p0420-dark-a.png`); solid amber circle (Service, `looks-50-service-dark-a.png`). DESIGN.md says numbered-step circles are `sunken`.
  - Section labels: outside the container on most screens; inside the card on Add to diary, Vehicle details and the Customise guide (`looks-41-customise-guide-dark.png`), where the first row also draws a stray hairline under the label.
- Source: `src/app/vehicle.tsx:203-205`, `src/app/diary-add.tsx:34,110`, `src/app/mot.tsx:477`, `src/live/LiveTiles.tsx:297-299`, `src/app/performance.tsx:394`, `src/ui.tsx:304` (help step number), `src/app/service.tsx:109`, `src/app/code/[code].tsx:228`, `src/ui.tsx:859` (`row` style always draws a top border).
- Fix: add 4 shared components to `src/ui.tsx` and use them everywhere: `Chip` (capsule, 36 tall with hitSlop to 44, selected = amber fill), `Segmented` (1 style for MOT, log view, Workshop, Dashboard tile style), `Field` (sunken well, 10 radius, label above in `small` muted), `StepNumber` (sunken circle, white number). Move in-card labels out to `Group` headers. Give `Row` a `first` prop so the top hairline can be dropped.

### Medium

**M1. The One Square Rule is broken for 4 tools: the same tool shows 2 colours.**
- History: blue row when not connected (`looks-01-car-tab-empty-dark.png`), red tile when connected (`looks-08-car-tab-connected-dark-a.png`). Health checks inside History are blue although DESIGN.md gives Diagnose red (`looks-52-history-dark.png`).
- Fuses: teal on the Car tab (`looks-08-car-tab-connected-dark-b.png`), orange on Lookup (`looks-03-lookup-tab-dark.png`).
- Learn my car: indigo on the Car tab, teal in Customise (`looks-40-customise-dark-c.png`) and Research notes.
- Module chip icon: indigo in Learn my car (`looks-17-learn-car-result-dark-b.png`), teal in Research notes (`looks-67-research-notes-dark-a.png`).
- Source: `src/app/(tabs)/(car)/index.tsx:58,203,221,234`; `src/app/(tabs)/(lookup)/lookup.tsx:70`; `src/app/history.tsx:23`; `src/app/customise/index.tsx:570`; `src/app/knowledge.tsx:97,103`; `src/app/learn-car.tsx:310`.
- Fix: one `TOOLS` map in `src/theme.ts` or `src/ui.tsx` (`history`, `fuses`, `learn`, `module`, `diagnose` and so on, each with icon and colour) and read every row and tile from it. Update the DESIGN.md table to list every tool.

**M2. Section headers sit at 2 different left insets on the same screen.**
- Lookup: "COMMON CODES" and "ON YOUR CAR NOW" at 16, "READING A CODE" at 32, the caption under the search field at 20 (`looks-03-lookup-tab-dark.png`, `looks-59-lookup-connected-dark.png`). Live data: "STANDARD READINGS", "MAKER DATA", "FOR EXPERTS" at 16, "VIEWS" at 32 (`looks-18-live-data-dark-a.png`).
- Related: "FOR EXPERTS" sits directly on top of "OLDER VW MODULES" with nothing between (`looks-18-live-data-dark-b.png`); Workshop shows a help "?" with no header beside it (`looks-70-workshop-dark.png`).
- Source: `src/ui.tsx:273-283` (`Label` has no left margin) against `src/ui.tsx:845-846` (`groupHeader` 16 margin); `src/screens/LiveScreen.tsx:636`; `src/app/workshop/index.tsx:76`.
- Fix: give `Label` the same 16 left margin as `groupHeader` when it heads a card or chip row; merge "For experts" into the next header ("Older VW modules, for experts"); give the Workshop group a header ("Not found").

**M3. Car tab, connected: the identity row under the title is cramped and wraps.**
- Make badge, "Demo car" pill, "2007 · SEAT / Cupra · Petrol" and "Disconnect" share 1 row; the summary breaks after the separator and leaves "Petrol" alone on line 2 (`looks-08-car-tab-connected-dark-a.png`, `looks-14-car-tab-after-check-dark-a.png`).
- Source: `src/app/(tabs)/(car)/index.tsx:138-148`.
- Fix: put the summary on its own line under the pill row, or drop the make from the summary (the badge already says it): "2007 · Petrol · PQ35", as the Your cars row does.

**M4. Text is cut with "..." in 3 places a user reads first.**
- Primary button on Unknown values: "Read value groups in every mod..." (`looks-55-unknown-values-dark.png`).
- Live data tile on the Car tab after Learn my car: "4 values in 1 value gr..." (`looks-81-car-tab-light-a.png`).
- Customise switch descriptions: "...triggered by the light sensor, not ..." (`looks-40-customise-dark-a.png`).
- Source: `src/app/discover.tsx:297`; `src/ui.tsx` Button label `numberOfLines={1}`; `src/app/(tabs)/(car)/index.tsx:201,299`; `src/app/customise/index.tsx` (2-line clamp on the description).
- Fix: shorten the labels ("Read every value group", "4 values, 1 group"); let Customise descriptions run to 3 lines or drop the clamp.

**M5. Performance: the selected test shows 2 ticks.**
- "0 to 60 mph" has 2 amber checkmarks side by side, also when the list is disabled (`looks-36-performance-dark.png`, `looks-37-performance-armed-2-dark.png`).
- Source: `src/app/performance.tsx:431-433` passes `selected` and also a `right` check icon.
- Fix: delete the `right={<Icon name="check" .../>}` prop.

**M6. Touch targets under 44 pt with no hitSlop.**
- Live data group chips 30 tall; Dashboard tile-style chips 32; log view segments 32; Customise and History category chips 34; Lookup code chips, MOT Pass / Advisory / Fail / To do (41 items x 4 buttons), Diary filter, Add to diary and Vehicle details chips 36; logger step buttons 36 x 32 (`looks-18-live-data-dark-b.png`, `looks-22-dashboard-edit-dark.png`, `looks-39-mot-walkround-states-dark.png`, `looks-03-lookup-tab-dark.png`).
- Source: `src/live/LiveTiles.tsx:299`, `src/app/log-view.tsx:265`, `src/app/mot.tsx:477`, `src/app/(tabs)/(lookup)/lookup.tsx:141`, `src/app/(tabs)/(diary)/diary.tsx:67`, `src/app/logger.tsx:409`, `src/app/vehicle.tsx:205`.
- Fix: 44 minimum height on MOT segments (the screen is used standing by the car); `hitSlop` to 44 on every chip through the shared `Chip` from H1. PRODUCT.md commits to "generous touch targets".
- Not a finding: the "?" help buttons are 28 to 32 px but carry hitSlop to 44 (`src/ui.tsx:354-360`).

**M7. Dark mode: readable text set in `faint` fails WCAG AA.**
- 3.25:1 on black and 3.40:1 on surface (needs 4.5:1). Seen: "MOT manual 8.2.1.2(h)..." (`looks-39-mot-walkround-states-dark.png`), "Sensor definitions: OBDb project, CC BY-SA 4.0." (`looks-54-sensors-start-dark.png`), "Saved on this phone only." (`looks-68-edit-details-dark-a.png`).
- Source, 12 places: `src/app/mot.tsx:421,424`; `src/app/sensors.tsx:383`; `src/app/vehicle.tsx:102`; `src/app/car-ids.tsx:129,180`; `src/app/car-reference.tsx:32`; `src/app/customise/index.tsx:421`; `src/app/knowledge.tsx:157`; `src/app/workshop/[id].tsx:349,478`; `src/screens/LiveScreen.tsx:531`.
- Fix: use `t.muted` for all of these. DESIGN.md already says `faint` is for chevrons and empty-state glyphs only.

**M8. Light mode: 3 token pairs fall under 4.5:1.**
- `accentText` #A65F00 on `accentSoft` over the page ground: 3.98:1 (Choose, Pause, Reset, Record on Live data, `looks-83-live-data-light-a.png`); on a white card 4.38:1 ("Check again", "Read maker data", "Seen before").
- `muted` on the page ground #F2F2F7: 4.47:1 (every group header and footer, `looks-85-car-tab-empty-light.png`).
- Neutral pill text on `sunken`: 4.19:1 ("Older system", byte index numbers, `looks-80-workshop-coding-light-b.png`).
- Source: `src/theme.ts:19,23,24`.
- Fix: `accentText` light to about #8F5200; `muted` light to `rgba(60,60,67,0.78)`; then measure again.

**M9. Dates and times appear in 5 formats.**
- "20/11/2026" and "20/11/2026, 16:05:42" (Learn my car, `looks-17-learn-car-result-dark-a.png`, `looks-17-learn-car-result-dark-b.png`); "11 Nov 2026" (Diary, `looks-04-diary-tab-empty-dark.png`); "20 Nov, 16:07" (Data logger, `looks-28-logger-saved-dark.png`); "20 Nov 16:04" with no comma (Health report, `looks-66-health-report-dark.png`); "today 16:02" (Car tab, `looks-14-car-tab-after-check-dark-a.png`).
- Source: bare `toLocaleString('en-GB')` or `toLocaleDateString('en-GB')` at `src/app/learn-car.tsx:105,308`, `src/app/customise/learn.tsx:206`, `src/app/discover.tsx:317`, `src/app/knowledge.tsx:157`, `src/app/service.tsx:152`, `src/app/service-reset.tsx:177,262`, `src/app/settings.tsx:200`, `src/app/modules.tsx:73` (no locale at all). `src/timeText.ts` already exports `dateText` and `clockText`.
- Fix: route every date through `src/timeText.ts`: "20 Nov 2026" for dates, "20 Nov, 16:05" for date and time, never seconds.

**M10. Colour meaning rules from DESIGN.md are not held.**
- Amber for status and decoration: "Not yet run" pill (`looks-10-health-result-dark-c.png`), "Seen before" pill (`looks-82-health-result-light.png`), module address badge "09" (`looks-71-workshop-module-dark.png`), solid amber step circles (`looks-50-service-dark-a.png`), amber glow on idle hero cards before anything is being read (`looks-26-logger-start-dark.png`, `looks-32-knock-dark.png`).
- Green for things that are not "healthy": "Maker source" pill (`looks-50-service-dark-a.png`); a green tick on step "8. Save and send" whose text says "Not sent" (`looks-17-learn-car-result-dark-b.png`); a green success notice that contains "Not sent: no GitHub token is set" (`looks-94-sensors-audi-result-dark.png`).
- Red and green as decoration: P, C, B, U rows on Lookup (`looks-03-lookup-tab-dark.png`); the 12 sensor categories use all 8 squares (`looks-94-sensors-audi-result-dark.png`).
- Source: `src/app/diagnostics.tsx:720`, `src/app/emissions-tests.tsx:151`, `src/app/service.tsx:103,109`, `src/app/learn-car.tsx:297`, `src/app/sensors.tsx:170`, `src/app/(tabs)/(lookup)/lookup.tsx:61-64`.
- Fix: "Not yet run" and "Seen before" neutral; "Maker source" info blue; step 8 neutral when not sent, and split the notice in 2 (green "88 sensors found", neutral "Not sent"); grey squares for P, C, B, U. Either hold the rules or rewrite them in DESIGN.md to allow a "pending" amber and category colours.

**M11. MOT "From the car" rows are a wall of same-weight grey text.**
- Each row stacks code, module, verdict, reason and fix in 15px muted over 5 to 6 lines, with an amber "More" squeezing the column (`looks-38-mot-dark-a.png`). The verdict ("Likely fail (Major)") is what matters and does not stand out.
- Source: `src/app/mot.tsx` (From the car list).
- Fix: verdict as a pill (danger "Likely fail", neutral "Advisory") on the title line; 1 line of reason; move "Fix: ..." behind the existing More.

**M12. On iPhone the app mixes 2 icon families (from source; not visible on the web build).**
- `Icon` draws an SF Symbol only for the 77 names in the `SF` map and falls back to Material Community Icons for the rest. About 35 icons in use have no mapping, for example `radar`, `telescope`, `school-outline`, `chart-line`, `lightning-bolt`, `book-open-variant`, `clipboard-list-outline`, `ear-hearing`, `flag-checkered`. On the Car tab that puts Material glyphs (MOT check, Research notes, Data logger, Find my car's sensors, Unknown values, Listen mode, Learn my car) beside SF Symbols in the same list.
- Source: `src/ui.tsx:33-111` (map), `src/ui.tsx:113-129` (fallback).
- Fix: map the remaining names (for example `dot.radiowaves.left.and.right`, `binoculars`, `graduationcap`, `chart.xyaxis.line`, `bolt.fill`, `book`, `checklist`, `ear`, `flag.checkered`), then check on the phone.

**M13. Long values squeeze row titles into 2 or 3 lines.**
- "Unknown values" wraps because the value "Explore a module" takes up to 55% (`looks-08-car-tab-connected-dark-b.png`); the Battery result title runs to 3 lines beside "14.20 V" and a pill (`looks-48-battery-dark.png`); "BCM PQ35 H ·" ends a line on a separator (`looks-10-health-result-dark-a.png`); Health report values wrap right-aligned ("4 (from 20 Nov 16:04 check)", `looks-66-health-report-dark.png`); sensor titles break into 3 lines beside 9-digit values (`looks-95-sensors-engine-list-dark-a.png`); the code detail "Area" value wraps tight to the row edges (`looks-12-code-detail-p0420-dark-b.png`).
- Source: `src/ui.tsx:565-569` (value `maxWidth: '55%'`), `src/app/(tabs)/(car)/index.tsx:252`, `src/app/battery.tsx`, `src/app/report.tsx`.
- Fix: keep trailing values to 1 or 2 words ("Explore", "PDF"); move anything longer to the subtitle; use a non-breaking space before a part number.

**M14. App icon and splash use a navy ground that the app does not use.**
- `assets/icon.png`: amber mascot on a navy gradient (about #22305A to #0B1020) with a brown halo behind the car. The dark splash ground is #0B1020; the app opens on true black #000000, so launch steps from navy to black. The light splash is #F2F2F7 and matches.
- Source: `app.json:16,62-65`; `assets/icon.png`.
- Fix: dark splash `#000000`; icon ground near-black (#0B0B0D to #1C1C1E) with a clean amber glow. Or state navy as a brand colour in DESIGN.md and use it in the app.

**M15. Wrapping labels push headline figures out of line.**
- Car tab hero stats: "Emissions self-tests" wraps, so "1 pending" sits about 15 px lower than "On" and "14.3 V" (`looks-08-car-tab-connected-dark-a.png`). Dashboard: "Intake pressure (MAP)" wraps, so "69" sits lower than "90" beside it (`looks-21-dashboard-dark.png`). Dial style: the figure is left-aligned under a centred dial and runs into the lower left end of the arc (`looks-23-dashboard-dial-dark.png`).
- Source: `src/app/(tabs)/(car)/index.tsx:261-275`; `src/app/dashboard.tsx:435-439`; `src/live/LiveTiles.tsx:33`.
- Fix: reserve 2 label lines (fixed `minHeight`) or shorten ("Self-tests", "Intake (MAP)"); centre the figure inside the dial.

### Low

- **L1.** Fault titles are Title Case in Lookup results and sentence case in the Health check ("Random/Multiple Cylinder Misfire Detected" against "Random/multiple cylinder misfire detected"). `looks-60-lookup-results-dark-a.png`, `looks-10-health-result-dark-b.png`. Fix: one casing helper used by both.
- **L2.** Codes, VINs and part numbers are Menlo in some places and plain in others: demo VINs on Connect (`looks-06-connect-sheet-dark.png`), "Code P0420" on code detail, Lookup result titles, the coding hex in a Diary entry (`looks-04-diary-tab-empty-dark.png`), part numbers under modules. DESIGN.md: "every code or VIN in Menlo". Fix: pass `mono` or use the code chip.
- **L3.** Lookup "On your car now" shows all 4 codes in red; the Health check shows the same codes with only the serious 2 in red. `looks-59-lookup-connected-dark.png`. Source: `src/app/(tabs)/(lookup)/lookup.tsx:45` (`strong` on every chip). Fix: pass severity.
- **L4.** Number formatting: "1183 not asked yet" beside "1,456 to ask" (`looks-94-sensors-audi-result-dark.png`, `src/app/sensors.tsx:170`); "3%" in progress against "55 %" in values; "0.00 l" for litres reads like a digit (`looks-34-trip-running-dark.png`, `src/app/trip.tsx:126,143,170`); hyphen for minus ("-3.9"). Fix: `toLocaleString('en-GB')`, one percent style, "L", U+2212.
- **L5.** Copy: "On on your car: the headlights stay on..." (`looks-44-customise-after-toggle-dark.png`, `src/coding/items.ts:265`). Fix: "On now: ...".
- **L6.** Live data tiles: "max 1588 · peak 1588" repeats one number, some tiles show peak and some do not, and the line orphans a single value ("7.0") on line 2 (`looks-18-live-data-dark-a.png`, `src/screens/LiveScreen.tsx:274`). The top of the page is 4 amber-soft buttons with no primary. Fix: drop peak from the tile (it is in the sheet); make Record the one primary or move Choose and Reset into a menu.
- **L7.** Type sizes outside the scale: 10 (chart labels), 12 (`caption`, in `src/theme.ts:113` but not in DESIGN.md), 14, 24, 44, 48 (Logger, Trip, Knock figures), 72. Fix: add `caption` and one mid figure size to DESIGN.md, or fold 48 into 56 or 34.
- **L8.** Customise guide page: the title block sits flush on the ground with tight spacing, cards are 16 apart, and the source is a bold underlined 13px web-style link 34 px tall (`looks-41-customise-guide-dark.png`). The same underlined link beside "I did this reset" on Service wraps to 3 lines (`looks-50-service-dark-a.png`). Fix: source links as a ListRow with an external-link glyph.
- **L9.** Diary: a red 13px "Delete" text link under every entry (`looks-63-diary-connected-dark.png`). Fix: swipe to delete on iPhone, or a trailing menu.
- **L10.** Log view: chart panels use #121212 (not a token), square bottom corners against 16-radius cards, 10px axis labels; "7.5/s" repeats on all 5 rows; Delete has the same weight as Share CSV (`looks-29-log-view-dark-a.png`, `looks-30-log-view-together-dark.png`).
- **L11.** Health check: the "Hide" row carries a chevron although it collapses the list; 26 rows repeat "Not listed by the gateway / No answer" (`looks-13-modules-not-found-dark-b.png`, `src/app/diagnostics.tsx:578`).
- **L12.** Scan heroes differ: mascot in the module ring (Health check), graduation-cap icon in a circle (Learn my car), car glyph (sensor search), icon in a rounded square (Find my car's sensors, Unknown values). DESIGN.md puts the mascot inside ScanPulse during a scan. `looks-09-health-running-1-dark.png`, `looks-16-learn-car-running-1-dark.png`, `looks-93-sensors-audi-running-dark.png`.
- **L13.** Data logger recording uses the fault glow, a red "RECORDING" label and a danger button for Stop; the marker button is a 16-radius slab, not a capsule (`looks-27-logger-recording-dark.png`). Red for recording is a common convention: add it to the Meaning Rule or use amber.
- **L14.** Choose values sheet: the unit column shifts left on ticked rows ("rpm" plus tick against "%" at the edge), and "SAVED SETS" sits 12 px under the caption (`looks-20-live-choose-sheet-dark.png`). Fix: fixed-width tick slot.
- **L15.** Service: 3 loose text blocks (intro, notice, paragraph) before the first card; the Reminder group mixes a row with no icon and a row with one, so titles start at 32 and 74 (`looks-50-service-dark-a.png`, `looks-50-service-dark-b.png`).
- **L16.** Template tells: diagonal glow washes on 4 tiles plus most hero cards, and long explanatory footers under most groups (Settings has 9, `looks-05-settings-tab-noconn-dark-a.png`; the Learn my car hero is a 6-line centred paragraph, `looks-17-learn-car-result-dark-a.png`). The copy is good; there is too much of it on screen. Fix: 1 line per footer, the rest behind the existing "?".
- **L17.** MOT items that do not apply are dimmed to 50%, which takes their explanation ("Not checked on this car. Inspected on cars first used from 1 September 2009 only.") to 3.0:1 (`looks-38-mot-dark-b.png`). Fix: dim the title only.
- **L18.** DESIGN.md drift: tabs listed as "Car, Lookup, Diary, Garage" (the app says Settings); `muted` 0.64 and `faint` 0.32 in the doc against 0.72 and 0.4 in `src/theme.ts:57-58`; `caption` missing.
- **L19.** Dashboard: 4 tiles fill the top half and leave about 180 px of empty black above the footer text; the same in Windscreen view, where bigger figures would help most (`looks-21-dashboard-dark.png`, `looks-24-dashboard-windscreen-dark.png`).
- **L20.** Research notes: the search field sits two-thirds down the page, after 2 long groups (`looks-67-research-notes-dark-a.png`).
- **L21.** "Disconnect" is a 20 px text target; with `hitSlop={10}` it reaches 40 pt, 4 short (`src/app/(tabs)/(car)/index.tsx:146`).
- **L22.** Health check shows "No faults" 2 ways on one screen: filled green tick plus pill, and outline tick plus plain grey text with a chevron (`looks-10-health-result-dark-a.png`).
- **L23.** The same faults are drawn 2 ways: code chips in the scan result (`looks-10-health-result-dark-a.png`) and plain "00532 · Airbags" subtitles when opened from "See 4 faults" (`looks-82-health-result-light.png`).
- **L24.** Sensor list: a raw identifier as a title ("SEG_AD_MMV_ER_L, 2"), and the tappable star is `faint` grey when off, so it does not read as tappable under the One Tint Rule (`looks-95-sensors-engine-list-dark-a.png`, `src/app/sensors.tsx:291`).

## 3. What must be fixed

**To reach 8** (no high, only a few medium or low left):
- H1.
- M1, M2, M3, M4, M5, M6, M7, M8, M9, M10, M13, M15.
- M12: map the icons, then confirm on the phone.
- Quick lows that show on main screens: L1, L3, L4, L5, L22.
- May stay open at 8: M11, M14 and the other lows.

**To reach 9** (trivial nits only):
- Everything above, plus M11 and M14.
- L2, L6, L7, L8, L9, L10, L11, L12, L13, L14, L15, L16, L17, L23, L24.
- May stay open at 9: L18 (doc only), L19, L20, L21.

## 4. What is already good

- The main path is strong: Car tab hero, Health check with the module ring, the 56px fault count and code chips, and the code detail page read at a glance and look like one hand made them.
- The mascot is distinctive and its faces (asleep, scanning, smiling, worried) carry state well. With the amber tint on true black it gives Pin16 its own look.
- Not a Carista copy as far as the assets show: own mascot, colour and wording. No Carista screenshots are in the project, so this was not compared side by side. Carista is named in 4 pieces of UI copy as a tool ("your Carista adapter", "Learn from Carista").
- Waiting states are well handled: progress, step count, time left, partial results and a "Stop and keep" action on every long read.
- Tone of voice is plain, direct British English, and sources are labelled ("Owner forum guide (Audizine), not a SEAT figure").
- Numbers use tabular figures and units are consistent (rpm, mph, kPa, °C, V).
- Confirm sheet, info and success notices, the "No matches" and "Connect to see live data" empty states are clean.
- Fuse table and byte grid are well formatted.
- Light mode is a complete alternative; only the 3 contrast pairs in M8 need work.

## Notes for the next round

- Preview data changed by this review (web local storage only): 2 "Setting changed" Diary entries and 2 timeline entries for the SEAT demo car (Coming home lights switched on, then back off), 1 saved 14 s log, 2 health checks, 1 Learn my car run, 1 sensor search on the Audi demo car. Dashboard tile style was put back to Number and the MOT items back to To do.
- Not reached: Diary with no entries at all, the "Try it" question sheet, the Pin16 AI card (did not appear), Emissions self-tests as its own page, Car reference, Fuel trims and Turbo boost detail views, and the native iOS chrome (tab bar, large titles, action sheets).
- The `shots` folder already held copies of the app assets (`icon.png`, `splash-icon.png` and so on, with `.old` copies) before this review started; they were left in place.
