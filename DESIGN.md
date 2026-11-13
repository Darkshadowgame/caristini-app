---
name: Caristini
description: A personal iPhone car scanner built to the craft of Apple's own apps, in one amber tint on a true black ground.
"colors":
  bg: "#000000"
  surface: "#1C1C1E"
  raised: "#2C2C2E"
  sunken: "#2C2C2E"
  text: "#FFFFFF"
  muted: "rgba(235,235,245,0.64)"
  faint: "rgba(235,235,245,0.32)"
  border: "rgba(84,84,88,0.6)"
  accent: "#FFB340"
  accentSoft: "rgba(255,179,64,0.18)"
  accentText: "#FFB340"
  onAccent: "#1A1205"
  danger: "#FF6961"
  dangerSoft: "rgba(255,69,58,0.2)"
  ok: "#30D158"
  okSoft: "rgba(48,209,88,0.18)"
  info: "#64B5FF"
  infoSoft: "rgba(10,132,255,0.2)"
  red: "#FF453A"
  blue: "#0A84FF"
  green: "#30D158"
  indigo: "#5E5CE6"
  purple: "#BF5AF2"
  teal: "#40C8E0"
  orange: "#FF9F0A"
  grey: "#8E8E93"
  bg-light: "#F2F2F7"
  surface-light: "#FFFFFF"
  raised-light: "#FFFFFF"
  sunken-light: "#E5E5EA"
  text-light: "#000000"
  muted-light: "rgba(60,60,67,0.72)"
  faint-light: "rgba(60,60,67,0.36)"
  border-light: "rgba(60,60,67,0.22)"
  accent-light: "#FF9F0A"
  accentSoft-light: "rgba(255,159,10,0.16)"
  accentText-light: "#A65F00"
  danger-light: "#D70015"
  dangerSoft-light: "rgba(255,59,48,0.12)"
  ok-light: "#1F7A35"
  okSoft-light: "rgba(52,199,89,0.14)"
  info-light: "#0062CC"
  infoSoft-light: "rgba(0,122,255,0.12)"
  red-light: "#FF3B30"
  blue-light: "#007AFF"
  green-light: "#34C759"
  indigo-light: "#5856D6"
  purple-light: "#AF52DE"
  teal-light: "#30B0C7"
  orange-light: "#FF9500"
typography:
  display:
    fontFamily: "SF Pro Display, -apple-system, system-ui, sans-serif"
    fontSize: "34px"
    fontWeight: 700
    lineHeight: "41px"
    letterSpacing: "0.37px"
  title:
    fontFamily: "SF Pro Display, -apple-system, system-ui, sans-serif"
    fontSize: "22px"
    fontWeight: 700
    lineHeight: "28px"
    letterSpacing: "0.35px"
  title3:
    fontFamily: "SF Pro Display, -apple-system, system-ui, sans-serif"
    fontSize: "20px"
    fontWeight: 600
    lineHeight: "25px"
    letterSpacing: "0.38px"
  heading:
    fontFamily: "SF Pro Text, -apple-system, system-ui, sans-serif"
    fontSize: "17px"
    fontWeight: 600
    lineHeight: "22px"
    letterSpacing: "-0.41px"
  body:
    fontFamily: "SF Pro Text, -apple-system, system-ui, sans-serif"
    fontSize: "17px"
    fontWeight: 400
    lineHeight: "22px"
    letterSpacing: "-0.41px"
  callout:
    fontFamily: "SF Pro Text, -apple-system, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: "21px"
    letterSpacing: "-0.32px"
  sub:
    fontFamily: "SF Pro Text, -apple-system, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: "20px"
    letterSpacing: "-0.24px"
  small:
    fontFamily: "SF Pro Text, -apple-system, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: "18px"
    letterSpacing: "-0.08px"
  label:
    fontFamily: "SF Pro Text, -apple-system, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: "18px"
    letterSpacing: "-0.08px"
  figure:
    fontFamily: "SF Pro Display, -apple-system, system-ui, sans-serif"
    fontSize: "56px"
    fontWeight: 700
    lineHeight: "62px"
    letterSpacing: "-1px"
    fontFeature: "tnum"
  figure-progress:
    fontFamily: "SF Pro Display, -apple-system, system-ui, sans-serif"
    fontSize: "34px"
    fontWeight: 700
    lineHeight: "41px"
    fontFeature: "tnum"
  figure-tile:
    fontFamily: "SF Pro Display, -apple-system, system-ui, sans-serif"
    fontSize: "26px"
    fontWeight: 700
    letterSpacing: "-0.5px"
    fontFeature: "tnum"
  mono:
    fontFamily: "Menlo, ui-monospace, Consolas, monospace"
    fontSize: "13px"
    fontWeight: 700
    fontFeature: "tnum"
  button:
    fontFamily: "SF Pro Text, -apple-system, system-ui, sans-serif"
    fontSize: "17px"
    fontWeight: 600
    letterSpacing: "-0.41px"
  button-compact:
    fontFamily: "SF Pro Text, -apple-system, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 600
    letterSpacing: "-0.24px"
  pill:
    fontFamily: "SF Pro Text, -apple-system, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 600
    letterSpacing: "-0.08px"
rounded:
  code: "6px"
  icon: "7px"
  sm: "8px"
  field: "10px"
  md: "12px"
  sheet: "14px"
  lg: "16px"
  capsule: "25px"
  full: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  xxl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.onAccent}"
    typography: "{typography.button}"
    rounded: "{rounded.capsule}"
    padding: "0 24px"
    height: "50px"
  button-secondary:
    backgroundColor: "{colors.accentSoft}"
    textColor: "{colors.accentText}"
    typography: "{typography.button}"
    rounded: "{rounded.capsule}"
    padding: "0 24px"
    height: "50px"
  button-danger:
    backgroundColor: "{colors.dangerSoft}"
    textColor: "{colors.danger}"
    typography: "{typography.button}"
    rounded: "{rounded.capsule}"
    padding: "0 24px"
    height: "50px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.accentText}"
    typography: "{typography.button}"
    rounded: "{rounded.capsule}"
    padding: "0 12px"
    height: "44px"
  button-compact:
    backgroundColor: "{colors.accentSoft}"
    textColor: "{colors.accentText}"
    typography: "{typography.button-compact}"
    rounded: "{rounded.capsule}"
    padding: "0 12px"
    height: "44px"
  card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.lg}"
    padding: "16px"
  group:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.lg}"
  list-row:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    typography: "{typography.body}"
    padding: "0 16px"
    height: "50px"
  list-row-pressed:
    backgroundColor: "{colors.raised}"
  tool-icon:
    textColor: "#FFFFFF"
    rounded: "{rounded.icon}"
    size: "30px"
  pill-ok:
    backgroundColor: "{colors.okSoft}"
    textColor: "{colors.ok}"
    typography: "{typography.pill}"
    rounded: "{rounded.full}"
    padding: "3px 9px"
  pill-danger:
    backgroundColor: "{colors.dangerSoft}"
    textColor: "{colors.danger}"
    typography: "{typography.pill}"
    rounded: "{rounded.full}"
    padding: "3px 9px"
  pill-neutral:
    backgroundColor: "{colors.sunken}"
    textColor: "{colors.muted}"
    typography: "{typography.pill}"
    rounded: "{rounded.full}"
    padding: "3px 9px"
  notice:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    typography: "{typography.sub}"
    rounded: "{rounded.md}"
    padding: "12px"
  search-field:
    backgroundColor: "{colors.sunken}"
    textColor: "{colors.text}"
    typography: "{typography.body}"
    rounded: "{rounded.field}"
    padding: "0 8px"
    height: "36px"
  code-chip:
    backgroundColor: "{colors.sunken}"
    textColor: "{colors.text}"
    typography: "{typography.mono}"
    rounded: "{rounded.code}"
    padding: "4px 7px"
---

# Design System: Caristini

## Overview

**Creative North Star: "The Driver's Seat at Night"**

Caristini is a first-party iOS app, used in a dark car with the ignition on and the phone in one hand. The world is iOS itself, executed at the craft level of Apple's own apps: a true black ground, grouped secondary surfaces, hairline separators, San Francisco at Dynamic Type sizes, SF Symbols, a native glass tab bar and large titles that collapse into the system bar material. Dark appearance is the default scene; light appearance is a full alternative built from the same token names.

Colour is spent on meaning. One amber tint marks everything you can tap. System red and green say fault and healthy. Each tool owns one coloured rounded square, as in iOS Settings. Everything else is neutral grey on black, so a result reads at a glance to someone who is not technical.

Motion is reserved for the car talking back: rings ripple out from the car symbol while a scan runs, and each module's result slides up as it answers. Both stop under Reduce Motion.

**Key Characteristics:**
- True black ground (`bg`), grouped secondary surfaces (`surface`), hairline `border` separators.
- One amber tint (`accent` and `accentText`) for interactive elements.
- State colours carry meaning: `danger` for faults, `ok` for healthy, neutral grey for everything non-urgent.
- One fixed colour square per tool, white SF Symbol glyph.
- Inset grouped sections with uppercase headers outside the container.
- Tabular figures for every number; Menlo for codes.
- Native chrome: glass tab bar, large-title stacks, blur header, system action sheets.

## Colors

A neutral iOS system palette with one warm amber tint and the system state and tool colours. Every key below has a light variant with the `-light` suffix.

### Primary
- **Caristini Amber** (`accent`): fills the primary capsule button, the selected tab, the text cursor and the ScanPulse rings. `accentText` is its text and glyph form for bar buttons, Cancel, Done, ghost buttons and checkmarks; in light appearance it darkens to a legible amber brown. `accentSoft` is the 18% wash behind secondary buttons. `onAccent` is the near-black label on a filled amber button.

### Secondary
- **Fault Red** (`danger`, `dangerSoft`): fault counts, fault pills, destructive actions, low-battery warnings and serious-code chips.
- **Healthy Green** (`ok`, `okSoft`): a zero-fault result, the "No faults" and "Connected" pills, success notices.
- **Info Blue** (`info`, `infoSoft`): maker-specific notes and context notices.

### Tertiary
- **Tool Squares** (`red`, `blue`, `green`, `indigo`, `purple`, `teal`, `orange`, `grey`): the iOS system colours behind white glyphs in 30px rounded squares. Diagnose `red`, Live data `blue`, Service `green`, ECU info `indigo`, Customise `purple`, Code lookup `teal`. `grey` is the square for car facts and anything without its own tool. `red` doubles as the tab badge colour.

### Neutral
- **True Black** (`bg`): the page ground in dark appearance; iOS grouped grey in light.
- **Grouped Charcoal** (`surface`): cards, grouped sections, notices.
- **Pressed Charcoal** (`raised`): the pressed state of rows and sheet buttons.
- **Well Charcoal** (`sunken`): search field, neutral pills, code chips, progress track, numbered-step circles.
- **Label White** (`text`), **Secondary Label** (`muted`), **Tertiary Label** (`faint`): the iOS label hierarchy. `faint` is for chevrons and empty-state glyphs only.
- **Separator** (`border`): hairline rules between rows.

### Named Rules
**The One Tint Rule.** Amber marks what you can tap: buttons, bar buttons, the selected tab, checkmarks, the cursor. The one sanctioned non-interactive use is progress of an action the user started (ScanPulse rings and ProgressBar fill). Nothing else is amber.

**The Meaning Rule.** Red means a fault or a destructive action. Green means healthy. Anything non-urgent (could not read, minor, not found) is neutral grey on `sunken`. Red and green are never decoration.

**The One Square Rule.** Each tool owns one colour square, everywhere it appears. A row may switch its square to `red` or `green` to report state (a faulty module, a low battery); it never borrows another tool's colour.

## Typography

**Display Font:** San Francisco (SF Pro Display, with the system font as fallback)
**Body Font:** San Francisco (SF Pro Text)
**Label/Mono Font:** Menlo (with ui-monospace and Consolas)

**Character:** The system face at iOS Dynamic Type default sizes, scaling with the user's text-size setting. No custom fonts are loaded. Menlo is kept for fault codes, VINs and coding values.

### Hierarchy
- **Display** (700, 34px, 41px): the large tab title, drawn by the native header on iPhone.
- **Title** (700, 22px, 28px): card headings, code titles, the empty-state prompt to connect.
- **Title3** (600, 20px, 25px): the word beside a big figure, connect prompts, NeedsConnection.
- **Heading** (600, 17px, 22px): sheet titles and in-card headings.
- **Body** (400, 17px, 22px): row titles, row values, paragraphs.
- **Callout** (400, 16px, 21px): fault titles in code rows.
- **Sub** (400, 15px, 20px): subtitles, summaries, notices.
- **Small** (400, 13px, 18px): group footers, captions under buttons, code row details.
- **Label** (400, 13px, uppercase): grouped section headers, in `muted`.
- **Figure** (700, 56px, 62px, tabular): the fault count in the Health and Diagnose cards, in `danger` or `ok`.
- **Figure Progress** (700, 34px, tabular): the live scan percentage.
- **Figure Tile** (700, 26px, tabular): live data tile values, with the unit at 14px in `muted`.
- **Mono** (Menlo 700, 13px, tabular): fault code chips.

### Named Rules
**The Tabular Rule.** Every number uses tabular figures (`type.number`, which sets `tabular-nums`), so counts, percentages, voltages and live values hold their width while they change.

**The Dynamic Type Rule.** Text sizes come from `type` in `src/theme.ts`. Off-scale sizes are drift.

## Layout

A single scrolling column, maximum 640px, centred, with 16px (`space.lg`) side gutters and 120px of bottom padding to clear the tab bar. Spacing runs on the 4/8 grid in `space` (4, 8, 12, 16, 24, 32). Cards and notices sit 16px apart; grouped sections sit 24px apart. Rows are at least 50px tall (44px minimum for any tap target), with a 16px leading inset and the separator starting after the icon square.

On iPhone each tab is its own large-title stack; the title lives in the native header and collapses on scroll. The web preview has no native header, so `Screen` draws the 34px title in the page below a 56px tab bar at the top. The live data grid wraps 2 tiles per row (45% basis, 12px gap).

## Elevation & Depth

Flat. There are no shadows anywhere: header shadows are switched off on every stack. Depth comes from tonal layering: `bg` under `surface`, `raised` for a pressed row, `sunken` for wells and fields. The only translucency is native: the system chrome material behind the transparent header and the glass tab bar, both supplied by iOS. Modal scrims use 45% black.

### Named Rules
**The Tonal Depth Rule.** Lift is a step in the grey ladder, never a shadow.

## Shapes

Continuous iOS rounding throughout. Cards, grouped sections and live tiles use 16px (`rounded.lg`); notices and inline callouts 12px (`rounded.md`); the search field 10px; action sheets 14px; tool squares 7px on a 30px square; code chips 6px. Buttons are full capsules (25px on a 50px height). Pills, the header circle button and numbered-step dots are full circles. Rules between rows are hairlines; containers carry no borders.

## Components

### Buttons
Capsules with a firm press: opacity 0.75 and scale 0.97 while held, 0.4 opacity when disabled, a selection haptic on tap.
- **Shape:** full capsule (25px radius), 50px tall, 24px horizontal padding, 8px icon gap, 18px leading icon.
- **Primary:** `accent` fill with `onAccent` label (17px, 600). One per screen, for the main action (Run health check, Connect adapter, Scan for adapters).
- **Secondary:** `accentSoft` fill with `accentText` label. For repeat and supporting actions (Scan again, Read maker data).
- **Danger:** `dangerSoft` fill with `danger` label. For writes to the car (Clear all faults), always behind a confirmation.
- **Ghost:** no fill, `accentText` label, 44px tall, 12px padding.
- **Compact:** 44px tall, 12px padding, 15px label, for a row of several (Values, Pause, Reset on Live data).

### Chips
- **Pill:** full-round, 3px by 9px padding, 13px semibold, optional 11px leading glyph. Tones: `ok`, `danger`, neutral (`sunken` with `muted`), `info`, `accent`.
- **Code chip:** Menlo 13px bold on `sunken` (or `dangerSoft` with `danger` for a serious code), 6px radius.

### Cards / Containers
- **Corner Style:** 16px.
- **Background:** `surface`.
- **Shadow Strategy:** none; see Elevation & Depth.
- **Border:** none.
- **Internal Padding:** 16px; hero cards (Health, Diagnose, code detail) use 24px.
- **Glow card:** hero cards on Home, Connect and Diagnose carry a soft diagonal wash from a tinted corner into `surface`: amber (`glowBrand`) while connecting or scanning, green (`glowOk`) with no faults, red (`glowFault`) with faults. The wash names the state; the card holds the Mascot and the headline figure.
- **Group:** an inset grouped section. Uppercase `label` header in `muted` outside and above the container (16px inset, 6px gap), optional `small` footer below. Rows inside are separated by hairlines.

### Inputs / Fields
- **Search field:** `sunken` well, 10px radius, 36px tall, 16px magnifier glyph in `muted`, `body` text, amber cursor, no outline.
- **Focus:** native cursor only; no ring.

### Navigation
- **Tab bar:** the native tab bar (Liquid Glass on iOS 26) with SF Symbols, filled when selected, tinted `accent`. Tabs: Car, Lookup, Diary, Garage. The Car tab shows a red badge when the engine light is on.
- **Stacks:** large titles, transparent header over the system chrome material, `accentText` back chevron with no back label, 600 weight inline title.
- **Modals:** Connect and Add to diary present as sheets with Cancel in `accentText` at leading. The value picker is a page sheet with Cancel and a semibold Done.
- **Header button:** a plain 22px tint glyph in the native bar; on the web preview a 36px circle beside the in-page title.

### List Row
The iOS Settings cell: optional 30px colour square with a 17px white glyph, `body` title, optional `sub` subtitle in `muted`, a trailing tabular value in `muted`, then a 13px chevron in `faint`. Pressed rows fill with `raised`. Choice rows replace the chevron with an `accentText` checkmark. Disabled rows drop to 0.45 opacity and lose the chevron.

### Confirm Sheet
Writes to the car ask first. On iPhone this is the system action sheet (`ActionSheetIOS`): title, the consequence in the message, the destructive action in red and Cancel apart, tinted `accentText`. Elsewhere a bottom sheet copies that layout: message and the red action in one 14px group, Cancel in its own group below. The action fires once per opening.

### Mascot (signature)
A small amber car in a navy mechanic's cap, drawn in SVG (`src/brand/Mascot.tsx`). Its face shows what the app is doing: asleep before a car is connected and on empty lists, wide-eyed with eyes to one side while it scans, smiling with no faults, worried when faults are found. It sits inside ScanPulse during a scan and at the trailing side of the result card. It never replaces a status word or number.

### Make badge
The connected car's maker mark, white on the maker's own colour in a rounded square, shown on Home, Garage rows and Last connected. Marks are Simple Icons v16.37.0 paths (CC0) for Audi, Volkswagen, SEAT, Skoda, Ford and Mazda; other makes show no badge.

### Byte grid (Workshop coding)
Long coding shown as 44px tiles, one per byte: byte index in `small` `muted` above the value in Menlo. Changed bytes take `raised` and `accentText`; the open byte takes `accentSoft`. The open byte lists its 8 bits as rows with a green switch. Writing always goes through the Confirm Sheet.

### Try mode question
After a change to a setting not yet confirmed on the car, a neutral Confirm Sheet asks "Did you see ...?" with "Yes, it works" and "No, put it back". The answer shows as a pill on the setting: `ok` tone for "Works on your car", neutral for "Did not take" and "No effect seen".

### Fuse row
A Menlo chip with the fuse number on `sunken`, the function in `sub`, the rating in tabular `muted` at the end. Unused slots drop to half opacity. A search field filters by function.

### ScanPulse (signature)
The car symbol in an `accentSoft` disc at 56% of the component size, with 3 amber 2px rings that grow to the full size and fade (opacity 0 to 0.55 to 0) over 1800ms with an ease-out cubic curve, staggered 600ms, looping while the car is being read. Used on Connect and as the hero of a Diagnose or ECU info scan, over a tabular percentage. Under Reduce Motion the rings hold still.

### Arrive
Content that comes back from the car (a module's result, the scan summary) slides up 12px and fades in once over 420ms with an ease-out expo curve. Under Reduce Motion it appears at once. Results keep their order while a scan runs and re-sort (faults first) only when it ends.

### ProgressBar
A 4px `sunken` track with an `accent` fill that glides to each new value over 400ms (ease-out expo), with a `sub` label and a semibold tabular percentage above.

### Module ring (signature)
One dot per control module around the mascot on the health check. Dots fill in as modules answer: green clear, red faults, orange could not read, dim not fitted; the module being asked pulses amber (still under Reduce Motion). `ModuleRing` in src/ui.tsx.

### Tool tile (Home)
Four main tools as 2-by-2 tiles: a solid tool-colour icon square, title, one-line status, a diagonal glow of the tool colour from the top left (`LinearGradient`, colour at 20% to 0%). Press scales to 0.97.

### Caristini AI card
Purple-to-amber glow with a purple hairline border, a pill-shaped "ask" field with an amber send button, and up to three suggestion chips. Without a key it becomes a set-up row that says what is needed.

### Category chips
Horizontal scrolling pills above long lists (Customise, History): amber fill when selected, surface fill otherwise, count in tabular figures.

### Pending changes bar
Amber-soft bar under a coding settings list while switches differ from the car: how many bytes changed and a compact Save to the car button. Nothing is written until it is tapped.

## Do's and Don'ts

### Do:
- **Do** use `accent` and `accentText` for every tappable element and nothing else, except ScanPulse and ProgressBar progress.
- **Do** colour a result by meaning: `danger` for faults, `ok` for healthy, neutral `sunken` with `muted` for non-urgent states.
- **Do** keep each tool on its own square: Diagnose `red`, Live data `blue`, Service `green`, ECU info `indigo`, Customise `purple`, Code lookup `teal`.
- **Do** build screens from inset grouped sections with the uppercase header outside the container.
- **Do** set every number with tabular figures and every code or VIN in Menlo.
- **Do** honour Reduce Motion in any new motion, as ScanPulse and Arrive do.
- **Do** put every write to the car behind the Confirm Sheet (the system action sheet on iPhone), stating ignition state and consequence.
- **Do** keep demo cars behind `Platform.OS === 'web'`; the phone app connects to real adapters only.

### Don't:
- **Don't** use amber for decoration, headings, illustrations or status. The exceptions are the Mascot's body and the `glowBrand` wash on a hero card while the car is being read.
- **Don't** use red or green for a state that is not a fault or a healthy result; minor and unknown stay grey.
- **Don't** give a non-tool row a tool's colour square.
- **Don't** add shadows; depth is tonal.
- **Don't** set text sizes outside the `type` scale.
- **Don't** replace native chrome (tab bar, headers, action sheets) with drawn imitations on iPhone.
