# Fuse boxes and manual links: source data for Caristini

Research note, 11 Nov 2026. Four UK right-hand-drive cars. Fuse data is copied as facts only (number, rating, function) from the owner's manual named for each car. Manual prose and images are not copied. Every table cites its URL.

## How to read this file

Suggested TypeScript shape (the tables below map 1:1 onto it):

```ts
type FuseType = 'mini' | 'cartridge' | 'unspecified';
interface Fuse {
  id: string;              // as printed: "F41", "B7", "12"
  amps: number[] | null;   // [20]; [5, 25] where the manual gives alternatives "5/25"; null = blank or not used
  fn: string;              // short function, manual wording
  label?: string;          // code printed on the box (Mazda only)
  type?: FuseType;
  variesByEquipment?: boolean;
  notUsed?: boolean;
}
interface FuseBox { id: string; name: string; location: string; access: string; fuses: Fuse[]; sourceUrl: string; }
```

Conventions in the tables:

- `amps` column: `5/25` means the manual lists two ratings for the slot (alternative equipment or engines, in the order of the functions). `-` means the manual gives no rating (slot not used, or blank in the manual).
- `var` column: `Y` = the manual marks the item as fitted only on some models or as optional equipment.
- Where the manual says layouts vary by equipment, the box header says so.
- Ford PDF links are given in code format because the path is Ford's own spelling; use them exactly as written.

---

## 1. Audi A6 C7 (4G), 2012, 2.0 TDI

### Car and VIN

| Field | Value | Source / confidence |
|---|---|---|
| VIN | WAUZZZ4GXCN000000 | Owner |
| Model | "4G" at positions 7-8 = A6 C7 | Standard VW group VIN layout; High |
| Model year | Position 10 "C" = 2012 | ISO 3779 year code; High |
| Body | Not encoded in the VIN (saloon or Avant unknown) | Check the V5C |

### Manual used

- **Audi A6 Avant onboard instruction book, "Version year 2011", English (en_GB).** Reproduced on manualesaudi.com, a third-party site that republishes Audi's onboard (MMI) manual text. **This is a mirror, not an Audi site.** The site states that all text is Audi's property.
- Index page: https://www.manualesaudi.com/AudiA6/AudiA6Avant/en_GB/onboard/o_k00504.htm
- The mirror's A6 index (https://www.manualesaudi.com/AudiA6/indiceEN.html) also lists A6 editions for 2014, 2015, 2016 and Hybrid. No saloon edition for version year 2011 or 2012 is listed. "Version year 2011" is the closest edition to this car; whether the saloon's assignments are identical is not confirmed.
- No official Audi copy of the 2012 A6 owner's manual was reachable online. A dealer or the printed handbook in the car is the official source.
- The manual gives **separate lists for left-hand-drive and right-hand-drive cars**. Only the RHD lists are below. Manual note: on RHD cars the carriers are identified by colour, not by the letters -A-, -B-, -C-.
- Manual notes (paraphrased): unassigned fuse locations are not shown; some items are only fitted on certain models or are optional extras.

### Locations and access

Source: https://www.manualesaudi.com/AudiA6/AudiA6Avant/en_GB/onboard/o_m00505.htm

| Box | Location (manual) | Access (paraphrased) |
|---|---|---|
| Dash panel, driver's side | End of the dash panel on the driver's side (right-hand end on a UK RHD car) | Remove the cover at the end of the dash panel. Remove the purple plastic frame by its narrow end (frame can be discarded). Fuse-puller clip is inside the fuse cover. |
| Dash panel, front passenger's side | End of the dash panel on the passenger's side (left-hand end on RHD) | As above |
| Luggage compartment | Behind the right-hand side trim | Remove the side trim cover |
| Engine bay | Not listed in the owner's manual | Not found |

### Box AUDI-DRV: dash panel, driver's side (RHD list)

Source: https://www.manualesaudi.com/AudiA6/AudiA6Avant/en_GB/onboard/o_m00506.htm (section "Fuse list for right-hand drive vehicles"). Layout varies by equipment.

Carrier A (black)

| id | amps | function | var |
|---|---|---|---|
| A1 | 5 | Towing bracket, ESP control unit, electro-mechanical parking brake, control unit 1 for vehicle electrical system | Y |
| A2 | 5 | Automatic anti-dazzle interior mirror | Y |
| A3 | 10 | Exhaust system (diesel engine) | Y |
| A4 | 5 | Sensor for suspension control system | Y |
| A5 | 5 | ESP control unit | |
| A6 | 5 | Air conditioner | |
| A7 | 10 | Audi adaptive cruise control | Y |
| A8 | 5 | Airbag control unit (front passenger's seat) | |
| A9 | 5 | Gateway | |
| A10 | 5 | Night vision assist control unit, HomeLink (garage door opener) | Y |
| A11 | 10 | Image processing for video camera (Audi active lane assist, Audi adaptive cruise control) | Y |
| A12 | 5 | Dynamic steering | Y |
| A13 | 15 | Terminal 15 (ignition-on feed) in luggage compartment | |
| A14 | 30 | Terminal 15 (ignition-on feed) in dash panel, front passenger's side | |
| A15 | 15 | Terminal 15 (ignition-on feed) in engine compartment | |
| A16 | 40 | Starter | |

Carrier B (brown)

| id | amps | function | var |
|---|---|---|---|
| B1 | 5 | Lumbar support (front passenger's seat) | Y |
| B2 | 10 | Air conditioner | |
| B3 | 10 | ESP control unit | |
| B4 | 30 | Front door (driver's side) | |
| B5 | 7.5 | Electric seat adjustment (driver's seat) | Y |
| B6 | 35 | Dynamic steering | Y |
| B7 | 20 | Sun roof, rear spoiler | Y |
| B8 | 5 | Lumbar support (driver's seat) | Y |
| B9 | 30 | Control unit 1 (vehicle electrical system, front seat heating) | |
| B10 | 20 | Sun roof, rear spoiler | Y |
| B11 | 5 | Anti-theft alarm, interior monitor | Y |
| B12 | 15/5 | Front door (driver's side) / tyre pressure monitoring system | |

Carrier C (red)

| id | amps | function | var |
|---|---|---|---|
| C1 | 5 | Clutch pedal | Y |
| C2 | 25 | Fuel pump | |
| C3 | 5 | Sensors for brake pedal | |
| C4 | 5/7.5 | SCR tank (diesel engine) / engine acoustics | Y |
| C5 | 30 | Rear door (front passenger's side) | |
| C6 | 7.5 | Electric seat adjustment (front passenger's seat) | Y |
| C7 | 15 | Horn | |
| C8 | 30 | Wipers | |
| C9 | 5 | Light sensor/rain sensor, heater for video camera in windscreen | Y |
| C10 | 5 | Interior lights (headliner) | |
| C11 | 15 | Front door (front passenger's side) | |
| C12 | 15 | Rear door (front passenger's side) | |

Note: the LHD list on the same page differs in many slots (for example LHD B9 = lumbar support 5 A, LHD C10 = lumbar support driver 5 A). Do not mix the two lists.

### Box AUDI-PAS: dash panel, front passenger's side (RHD list)

Source: https://www.manualesaudi.com/AudiA6/AudiA6Avant/en_GB/onboard/o_m00507.htm. Layout varies by equipment.

Carrier A (black)

| id | amps | function | var |
|---|---|---|---|
| A1 | 5 | Head-up display | Y |
| A2 | 5 | MMI display | |
| A3 | 5 | CD/DVD changer | Y |
| A4 | 7.5 | MMI centre console | |
| A5 | 5 | Chip card reader (only in some countries) | Y |
| A6 | 5 | Instrument cluster | |
| A7 | 5 | Steering column switch module | |
| A8 | 5/7.5 | Headlight range control / adaptive light | Y |
| A10 | 25 | Left headlight (headlights with adaptive light) | Y |
| A11 | 5 | Supplementary heater | Y |

Sources disagree inside the same page: A10 is 25 A in the RHD list and 7.5 A in the LHD list. Both are shown as printed; check the fuse fitted.

Carrier B (brown)

| id | amps | function | var |
|---|---|---|---|
| B1 | 10 | Air conditioner | |
| B2 | 40 | Air conditioner blower | |
| B3 | 10 | Diagnostic interface | |
| B4 | 5 | Electronic ignition lock | |
| B5 | 5 | Electric steering column adjustment | Y |
| B6 | 10 | Steering column switch module | |
| B7 | 25 | Electric steering column adjustment | Y |
| B8 | 5 | Light switch | |

(LHD list has B3 = Gateway 10 A.)

### Box AUDI-LUG: luggage compartment, right side (RHD list)

Source: https://www.manualesaudi.com/AudiA6/AudiA6Avant/en_GB/onboard/o_m00508.htm. Layout varies by equipment. Avant edition: the saloon may differ (rear wiper is Avant-only).

Carrier A (black)

| id | amps | function | var |
|---|---|---|---|
| A1 | 15 | Towing bracket | Y |
| A2 | 20 | Towing bracket | Y |
| A3 | 20 | Towing bracket | Y |
| A4 | 30 | Electro-mechanical parking brake | |
| A5 | 30 | Electro-mechanical parking brake | |
| A6 | 30 | Front door (front passenger's side) | |
| A7 | 30 | Exterior lights (rear) | |
| A8 | 20 | Rear blind, power-latching feature, boot lid lock, convenience key, START ENGINE STOP, fuel tank flap | Y |
| A9 | 15 | Electric seat adjustment | Y |
| A10 | 5 | Parking aid | Y |
| A11 | 30 | Seat heating (rear) | Y |

Carrier B (red)

| id | amps | function | var |
|---|---|---|---|
| B1 | 25 | Belt tensioner (left side) | |
| B2 | 25 | Belt tensioner (right side) | |
| B3 | 20 | Electrical socket/cigarette lighter (front) | |
| B4 | 20 | Electrical socket in rear centre console/luggage compartment | |
| B5 | 5 | Electro-mechanical parking brake | |
| B6 | 15 | Pneumatic suspension | Y |
| B7 | 35 | Rear door (front passenger's side) | |
| B8 | 30 | Exterior lights (rear) | |
| B9 | 30 | Boot lid control unit | Y |
| B10 | 15 | Rear door (front passenger's side) | |
| B11 | 30 | Sound amplifier | Y |
| B12 | 20 | Rear spoiler | Y |

Carrier C (brown)

| id | amps | function | var |
|---|---|---|---|
| C1 | 5 | Relay coil, terminal 15 | |
| C2 | 35 | Windscreen washer system | |
| C3 | 20 | Interior lights | |
| C4 | 30 | Headlight (front left) | |
| C5 | 30 | Headlight (front right) | |
| C6 | 5 | Gateway | |
| C7 | 7.5 | Radio receiver | |
| C9 | 5 | TV tuner | Y |
| C10 | 7.5/5 | MMI control console / Rear Seat Entertainment | Y |
| C11 | 5 | Automatic anti-dazzle interior mirror, start/stop system | Y |
| C12 | 5 | Parking aid | Y |

Carrier D (green)

| id | amps | function | var |
|---|---|---|---|
| D1 | 30/20 | Receiver for radio, sound amplifier / MMI (centre console, front) | Y |
| D2 | 5 | Mobile phone adapter, charging cradle for telephone/mobile phone | Y |
| D4 | 5 | Audi pre sense | Y |
| D5 | 5 | Electro-mechanical parking brake | |
| D6 | 5 | Pneumatic suspension | Y |
| D7 | 5/7.5 | Clutch travel sensor / automatic gearbox | |
| D8 | 10 | Rear wiper | Y |
| D9 | 5 | Start/stop system | Y |
| D10 | 5 | Audi side assist | Y |
| D11 | 5 | Parking aid, sport differential | Y |
| D12 | 5 | Gateway, control unit 1 for vehicle's electrical system | |

### Official links (Audi)

| What | URL | Access / price |
|---|---|---|
| Owner's manual (official) | Not found online for a 2012 A6. Printed handbook or Audi dealer. | - |
| Owner's manual (mirror, used above) | https://www.manualesaudi.com/AudiA6/AudiA6Avant/en_GB/inhalt.htm | Free; third-party reproduction |
| Workshop manual and wiring diagrams: erWin (VW Group) | https://erwin.vwgroup-datahub.com | Source: https://drivesomethinggreater.com/erwininfo (VW Group Info Services AG). Licences by hour, day, week, month or year; no prices stated on that page. Registration needs a One Business ID business account; the page says "Private customers are not in scope of the new erWin setup". New setup roll-out for Switzerland and UK: 20.8.2026. |
| Old brand erWin address | https://erwin.audi.de | Did not connect on 11 Nov 2026 (connection failure from this laptop) |

---

## 2. SEAT Leon II Cupra (1P1), 2007, 2.0 TFSI

### Car and VIN

| Field | Value | Source / confidence |
|---|---|---|
| VIN | VSSZZZ1PZ7R000000 | Owner |
| Maker | "VSS" = SEAT | WMI; High |
| Model | "1P" = Leon II | VW group layout; High |
| Model year | Position 10 "7" = 2007 | ISO 3779; High |
| Plant | Position 11 "R" = Martorell | Common VW group plant code; Medium (not checked in an official table here) |

### Manual used

- **SEAT Leon owner's manual, English, part number 1P0012003AE, edition 07.06** (printed on the back page). Official SEAT UK PDF:
  https://www.seat.co.uk/datamanual-manual/leon/my07_w45/en-uk/MI%20LEON%2007%2006_EN.pdf (fuse section, printed pages 233-239).
- Gap: this edition names the 2.0 TFSI only as "2.0 l 147 kW" (the FR). The Cupra's 177 kW (240 PS) engine is not named. Slots marked "D2L Engine (2.0 l 147 kW ... TFSI)" are the nearest match; whether the Cupra uses the same slots is not stated. No later Leon II UK edition (MY08 or MY09) was found on seat.co.uk.
- Manual note (paraphrased): the list was correct at printing and may change; if it disagrees with the sticker inside the fuse cover, the sticker is correct for the car. Some items are only fitted on certain models or are optional extras.
- Colour code of standard fuses (manual table): light brown 5 A, red 10 A, blue 15 A, yellow 20 A, natural (white) 25 A, green 30 A, orange 40 A, red 50 A, white 80 A. High-current fuses: blue 100 A, grey 150 A, violet 200 A.
- The electric windows are protected by self-resetting circuit breakers (manual).

### Locations and access

Source: SEAT PDF above, printed page 233.

| Box | Location (manual) | Access (paraphrased) |
|---|---|---|
| Dash panel | "Behind a cover at the left-hand end of the dash panel" (figure 160). The procedure heading in the same section reads "Fuse cover underneath the steering wheel". The manual does not say whether the box moves on RHD cars. | Remove the cover. Fuse-puller clip is inside the fuse cover. |
| Engine compartment, left part | Left-hand side of the engine compartment (figure 161) | Prise off the cover by pressing its tabs towards the centre; refit carefully so no water enters |
| Engine compartment, side box (high-current) | "Position in engine compartment: side box" | Not described. These are high-current fuses; the manual says relays and high-current fuses should be replaced by a qualified workshop. |

### Box SEAT-DASH: left side of dash panel

Source: SEAT PDF above, printed pages 234-236. Layout varies by equipment.

| id | amps | function | var |
|---|---|---|---|
| 1 | 10 | Diagnosis, instrument lighting control unit, headlamp range control, flow gauge, heated windscreen control unit | Y |
| 2 | 5 | Engine control unit, ABS-ESP control unit, automatic gearbox, instrument panel, trailer, light switch, brake sensor, power steering, right and left headlamp control unit | |
| 3 | 5 | Airbag | |
| 4 | 5 | Heating, reverse switch, ASR-ESP switch, telephone, fillers, electrochrome mirror | |
| 5 | 5 | Right xenon headlamp | Y |
| 6 | 5 | Left xenon headlamp | Y |
| 7 | - | Vacant | |
| 8 | 5 | Trailer pre-installation kit | Y |
| 9 | - | Vacant | |
| 10 | - | Vacant | |
| 11 | - | Vacant | |
| 12 | 10 | Central locking | |
| 13 | 10 | Diagnosis, light switch, rain sensor | |
| 14 | 5 | Automatic gearbox, heating, ESP control unit, automatic gearbox lever | |
| 15 | 7.5 | Cable control unit | |
| 16 | - | Vacant | |
| 17 | 5 | Alarm | Y |
| 18 | - | Vacant | |
| 19 | - | Fog lamp kit (no rating printed) | Y |
| 20 | - | Vacant | |
| 21 | 10 | D2L engine (2.0 l 147 kW TFSI) | Y |
| 22 | 40 | Fan switch | |
| 23 | 30 | Electric windows (front) | |
| 24 | - | Vacant | |
| 25 | 25 | Rear window heater | |
| 26 | 30 | Rear electric windows | Y |
| 27 | 15 | Engine (fuel pump relay, flowmeter) | |
| 28 | 25 | Convenience controls | |
| 29 | - | Vacant | |
| 30 | 20 | Automatic gearbox | Y |
| 31 | 20 | Vacuum pump | Y |
| 32 | - | Vacant | |
| 33 | 30 | Sunroof | Y |
| 34 | 25 | Convenience controls | |
| 35 | - | Vacant | |
| 36 | 20 | Headlight washer system | Y |
| 37 | 30 | Heated seats | Y |
| 38 | 10 | D2L engine (2.0 l 147 kW TFSI) | Y |
| 39 | - | Vacant | |
| 40 | 40 | Fan switch | |
| 41 | 15 | Rear wiper motor, wiring control unit | |
| 42 | 15 | 12 V socket, lighter | |
| 43 | 15 | Tow bar pre-installation | Y |
| 44 | 20 | Tow bar pre-installation | Y |
| 45 | 15 | Tow bar pre-installation | Y |
| 46 | - | Vacant | |
| 47 | 10 | D2L engine (2.0 l 147 kW TFSI) | Y |
| 48 | 10 | D2L engine (2.0 l 147 kW TFSI) | Y |
| 49 | - | Vacant | |

Wording notes: "servosteering" in the manual is shown as "power steering"; "Cable control unit" and "Wiring control unit" are kept as printed (meaning not stated).

### Box SEAT-ENG: engine compartment, left part

Source: SEAT PDF above, printed pages 236-238. Layout varies by engine and equipment. Where the manual gives a rating per engine, each is listed.

| id | amps | function | var |
|---|---|---|---|
| 1 | 30 | "Clean" (as printed; meaning not stated) | |
| 2 | 5 | Steering column | |
| 3 | 5 | Cable control unit | |
| 4 | 30 | ABS | |
| 5 | 15 | AQ gearbox (automatic) | Y |
| 6 | 5 | Instrument panel | |
| 7 | - | Vacant | |
| 8 | 15 | Radio | |
| 9 | 5 | Telephone | Y |
| 10 | 5/10 | Main relay, FSI/diesel injection module supply / main relay D2L (2.0 FSI 147 kW) | Y |
| 11 | - | Vacant | |
| 12 | 5 | Gateway | |
| 13 | 25/30 | Petrol injection module supply / diesel injection module supply | Y |
| 14 | 20 | Coil | |
| 15 | 5/10 | Engine T71 / 2.0 FSI ; pump relay | Y |
| 16 | 30 | ADS pump | |
| 17 | 15 | Horn | |
| 18 | - | Vacant | |
| 19 | 30 | "Clean" (as printed) | |
| 20 | - | Vacant | |
| 21 | 15 | Lambda probe | |
| 22 | 5 | Brake pedal, speed sensor | |
| 23 | 5/10/15 | Engine 1.6 main relay (relay 100) / T71 diesel EGR / 2.0 D2L high-pressure fuel pump | Y |
| 24 | 10 | ARF, change valve | |
| 25 | 40 | Right lighting | |
| 26 | 40 | Left lighting | |
| 27 | 40/50 | 1.6 SLP engine / 1.9 TDI glow plug relay | Y |
| 28 | 40 | KL15 (ignition-on feed) | |
| 29 | 50/30 | Electric windows (front and back) / electric windows (front) | Y |
| 30 | 40 | X-relief relay | |

Note on 27: in the PDF text the number 27 is not printed beside these two lines; they sit between 26 and 28, so slot 27 is inferred. For a 2.0 TFSI petrol car neither variant clearly applies.

### Box SEAT-SIDE: engine compartment side box (high-current)

Source: SEAT PDF above, printed page 238.

| id | amps | function | var |
|---|---|---|---|
| B1 | 150/200 | Alternator below 140 W / above 140 W (as printed) | Y |
| C1 | 80 | Power steering | |
| D1 | 100 | Multi-terminal voltage supply "30", internal fuse box | |
| E1 | 50/80 | Fan below 500 W / above 500 W | Y |
| F1 | 100 | PTCs (supplementary electric air heating) | Y |
| G1 | 50 | Trailer fuse voltage supply in internal fuse box | Y |
| H1 | - | Central locking control unit (4F8 with autolock); no rating printed | Y |

### Official links (SEAT)

| What | URL | Access / price |
|---|---|---|
| Owner's manual (official, used above) | https://www.seat.co.uk/datamanual-manual/leon/my07_w45/en-uk/MI%20LEON%2007%2006_EN.pdf | Free PDF, 9.3 MB |
| Workshop manual and wiring diagrams: erWin (VW Group, covers SEAT and Cupra) | https://erwin.vwgroup-datahub.com | Same terms as Audi above (business accounts only from the 2026 roll-out; prices not published on the info page) |
| Old brand erWin address | https://erwin.seat.com | Did not connect on 11 Nov 2026 |

---

## 3. Ford Focus ST-3 Mk3, about 2015

### Car and VIN

| Field | Value | Source / confidence |
|---|---|---|
| VIN | WF05XXGCC5FM00000 | Owner |
| Maker | "WF0" = Ford-Werke, Germany | `replica/focus-st-sources.md` section 0 (FS23); High |
| Year | Position 11 "F" = 2015 | Inferred from the Ford of Europe year-code sequence (`focus-st-sources.md`); Medium |
| Month | Position 12 "M" | Not decoded; Ford month table for 2015 not found |
| Engine | **The VIN does not show the engine.** | FS23 (in `focus-st-sources.md`): engine variant is on the certification label. A 2015 UK ST-3 could be the 2.0 EcoBoost petrol or the 2.0 TDCi diesel (the manual below covers both, for example the diesel particulate filter fuse). Check the V5C or the label. |

A 2015 build points to the facelifted car (Focus "CEW"); the earlier car is "CB8". If the label shows an earlier build, use the CB8 manual listed under Official links.

### Manual used

- **Ford Focus RS / Focus ST owner's manual, part number GM5J 19A321 BDB, edition 03/2016, Focus (CEW), language enGBR, market Australia/New Zealand.** Official Ford PDF:
  `https://www.fordservicecontent.com/Ford_Content/catalog/owner_information/2016_Focus_RS_ST.pdf`
  Section "Fuse Specification Chart" (printed pages 187-196; ST chart). The separate "Fuse Specification Chart - RS" from page 197 is not used.
- Gap: this is the Australia/New Zealand edition. A UK/EU edition for the CEW Focus exists (part number CG3630en, edition 09/2014 for cars built from 08-09-2014 and edition 01/2015 for cars built from 16-02-2015; CG3632en 09/2014 for cars built up to 15-02-2015) according to search-engine extracts of mirror sites (manualmachine.com, all-guidesbox.com). I could not open an official or mirror copy of those; manualmachine.com returned 403. Slot numbers may differ by market; check against the box lid.
- Rating marks: `*` = mini fuse, `**` = cartridge fuse (manual key). Passenger compartment ratings carry no mark.
- Grouping method: multi-line functions were assigned to fuse rows from the PDF's text order (first function, rating, fuse number, remaining functions), cross-checked against the table layout. Checked consistent for every row.

### Locations and access

Source: same PDF, printed pages 185-186 and 202.

| Box | Location (manual) | Access (paraphrased) |
|---|---|---|
| Engine compartment | In the engine compartment; item F on the "Under Hood Overview - 2.0L EcoBoost" picture | Not described in text |
| Passenger compartment | Shown in figures E130170/E130171 only; the text does not name the position | Pinch the retaining clips to release the cover, lower the cover and pull it towards you |
| Luggage compartment | Shown in figures for 4-door (E135336), 5-door (E135337) and estate (E135338); the text does not name the side | Not described in text |

Text gives no left/right position for the passenger and luggage boxes; a developer should not invent one. The 2012 European manual (below) shows the same figures and text.

### Box FORD-ENG: engine compartment

Source: 2016_Focus_RS_ST.pdf, printed pages 187-189. The chart starts at F7.

| id | amps | type | function |
|---|---|---|---|
| F7 | 40 | cartridge | Anti-lock brake system; electronic stability program |
| F8 | 30 | cartridge | Electronic stability program |
| F9 | 40 | cartridge | Luggage compartment fuse box |
| F10 | 40 | cartridge | Blower motor |
| F11 | 30 | cartridge | Auto-Start-Stop module |
| F12 | 30 | cartridge | Powertrain control module |
| F13 | 30 | cartridge | Starter relay |
| F14 | 40 | cartridge | Right-hand heated windshield element |
| F15 | 25 | cartridge | Transmission control module; intercooler fan |
| F16 | 40 | cartridge | Left-hand heated windshield element |
| F17 | 20 | cartridge | Auxiliary heater |
| F18 | 20 | cartridge | Windshield wipers |
| F19 | 5 | mini | Anti-lock brake system; electronic stability program |
| F20 | 15 | mini | Horn |
| F21 | 5 | mini | Brake lamps |
| F22 | 15 | mini | Battery monitor system |
| F23 | 5 | mini | Relay coils; lighting control |
| F24 | - | - | Not used |
| F25 | - | - | Not used |
| F26 | 25 | mini | Transmission control module |
| F27 | 15 | mini | Air conditioning clutch |
| F28 | 10 | mini | Rear view camera; collision warning system |
| F29 | 20 | mini | Headlamp washer |
| F30 | 5 | mini | Powertrain control module |
| F31 | - | - | Not used |
| F32 | 10 | mini | Powertrain control module relay; cooling fan module relay |
| F33 | 15 | mini | Powertrain control module; ignition coils |
| F34 | 10 | mini | Powertrain control module |
| F35 | 10 | mini | Water-in-fuel sensor; powertrain control module; ignition coils |
| F36 | 5 | mini | Active grill shutters |
| F37 | 20 | mini | Instrument panel auxiliary power point |
| F38 | 15 | mini | Powertrain control module; transmission control module |
| F39 | 5 | mini | Headlamp leveling |
| F40 | 5 | mini | Electronic power assist steering |
| F41 | 20 | mini | Body control module |
| F42 | - | - | Not used |
| F43 | 15 | mini | Headlamp leveling; adaptive front lighting unit |
| F44 | 5 | mini | Adaptive cruise control |
| F45 | 10 | mini | Heated washer nozzle |
| F46 | 25 | cartridge | Cooling fan |
| F47 | - | - | Not used |
| F48 | 15 | mini | Diesel particulate filter vaporizer |

The chart also lists relays R1-R16 (for example R16 ignition, R15 starter motor); not copied here.

### Box FORD-PAS: passenger compartment

Source: 2016_Focus_RS_ST.pdf, printed pages 191-193. Fuse type not marked.

| id | amps | function |
|---|---|---|
| F56 | 20 | Fuel pump |
| F57 | - | Not used |
| F58 | - | Not used |
| F59 | 5 | Passive anti-theft transceiver |
| F60 | 10 | Interior lighting; driver door switch pack; glove box lamp; ambient lighting; moonroof |
| F61 | 20 | Cigar lighter; rear auxiliary power points |
| F62 | 5 | Autowipers; humidity sensor; auto-dimming interior mirror |
| F63 | 10 | Adaptive cruise control |
| F64 | - | Not used |
| F65 | 10 | Liftgate release |
| F66 | 20 | Driver door lock |
| F67 | 7.5 | SYNC module; global positioning system module; information and entertainment display |
| F68 | 15 | Electric steering column lock |
| F69 | 5 | Instrument cluster |
| F70 | 20 | Central locking system |
| F71 | 7.5 | Air conditioning |
| F72 | 7.5 | Steering wheel module |
| F73 | 7.5 | Data link connector (OBD socket) |
| F74 | 15 | High beam |
| F75 | 15 | Front fog lamps |
| F76 | 10 | Reversing lamps |
| F77 | 20 | Windshield washer pump |
| F78 | 5 | Ignition switch; push button ignition switch; keyless vehicle module |
| F79 | 15 | Audio unit; navigation DVD player; hazard flasher switch; door lock switch |
| F80 | 20 | Moonroof |
| F81 | 5 | Interior motion sensor; radio frequency receiver |
| F82 | 20 | Windshield washer pump |
| F83 | 20 | Central locking system |
| F84 | 20 | Driver door unlock |
| F85 | 7.5 | Air conditioning; moonroof; heated seat switches; passenger airbag deactivation switch |
| F86 | 10 | Restraints control module; occupant classification system |
| F87 | 15 | Heated steering wheel |
| F88 | 25 | Voltage quality module |
| F89 | - | Not used |

F73 note: "Data link connector" is the manual's term; "(OBD socket)" is my plain-words gloss. Relevant to the app: if the adapter gets no power, F73 is the fuse to check.

### Box FORD-LUG: luggage compartment

Source: 2016_Focus_RS_ST.pdf, printed pages 193-196.

| id | amps | type | function |
|---|---|---|---|
| F1 | 5 | mini | Relay coils |
| F2 | - | - | Not used |
| F3 | 5 | mini | Keyless vehicle door handles |
| F4 | 25 | mini | Front left door control unit |
| F5 | 25 | mini | Front right door control unit |
| F6 | 25 | mini | Rear left door control unit |
| F7 | 25 | mini | Rear right door control unit |
| F8 | 10 | mini | Anti-theft alarm |
| F9 | 25 | mini | Driver seat |
| F10 | 25 | mini | Power windows |
| F11 | 25 | mini | Passenger seat |
| F12-F23 | - | - | Not used (each slot) |
| F24 | 30 | cartridge | Heated rear window |
| F25 | 20 | cartridge | Luggage compartment auxiliary power points |
| F26 | - | - | Not used |
| F27 | - | - | Not used |
| F28 | 40 | cartridge | Trailer tow module |
| F29 | 5 | mini | Blind spot monitor; lane keeping system; Active City Stop; rear view camera |
| F30 | 5 | mini | Parking aid module |
| F31 | - | - | Not used |
| F32 | - | - | Not used |
| F33 | 15 | mini | Rear window wiper relay |
| F34 | 15 | mini | Driver heated seat |
| F35 | 15 | mini | Passenger heated seat |
| F36-F40 | - | - | Not used (each slot) |
| F41 | 5 | mini | Retractable tow ball |
| F42 | - | - | Not used |
| F43 | - | - | Not used |
| F44 | 10 | mini | Power exterior mirrors |
| F45 | 7.5 | mini | Heated exterior mirrors |
| F46 | - | - | Not used |

Relays R1-R6 listed in the manual (R1 ignition switch, R2 heated rear window, R3 rear window wiper, R5 anti-theft alarm horn, R6 delayed accessory power); not part of the fuse list.

### Official links (Ford)

| What | URL | Access / price |
|---|---|---|
| Owner's manual, Focus RS/ST CEW, 03/2016, AUS/NZ (used above) | `https://www.fordservicecontent.com/Ford_Content/catalog/owner_information/2016_Focus_RS_ST.pdf` | Free PDF, 5.5 MB |
| Owner's manual, Focus CB8 (pre-facelift), CG3568en 06/2012, European, cars built 29-05-2012 to 31-12-2012 | `https://www.fordservicecontent.com/Ford_Content/catalog/owner_information/C346_Owners_Guide.pdf` | Free PDF, 7.5 MB; fuse chart not copied here |
| UK/EU owner's manual for CEW (CG3630en / CG3632en) | Not reached | Ask a Ford dealer, or the printed handbook |
| Workshop manual and wiring diagrams: Ford Service Info (successor to Ford Etis) | https://www.fordserviceinfo.com | Opens a country selector (UK listed). Ford UK states it is "not a direct replacement for the decommissioned Ford Etis" and offers free resources to customers with a Ford Account (per search extract of https://www.ford.co.uk/support/how-tos/owner-resources/vehicle-specifications/ford-service-info-resources; the page did not load directly). Prices for workshop manual or wiring access: not found on an official page. A third-party UK guide (https://www.maverickdiagnostics.com/guide/ford-group/, updated 27 Jul 2026) quotes £15.79 per hour for a Ford diagnostic software licence that includes repair procedures and wiring diagrams; not verified with Ford. |
| Old Etis | https://www.etis.ford.com | Did not connect on 11 Nov 2026 (decommissioned per Ford UK) |

---

## 4. Mazda6 GJ, 2016, 2.2 Skyactiv-D diesel

### Car

No VIN given. A 2016 UK Mazda6 is the facelifted GJ. Edition below chosen by year in the URL code.

### Manual used

- **Mazda6 Web Owner's Manual, edition code 8FK7-EE-16F (from the URL; "16" read as 2016 by me).** Official Mazda site:
  https://owners-manual.mazda.com/gen/en/mazda6/mazda6_8fk7ee16f/contents/07031602.html (Fuse Panel Description)
  https://owners-manual.mazda.com/gen/en/mazda6/mazda6_8fk7ee16f/contents/07031601.html (Fuse Replacement)
- The manual states that it describes a left-hand-drive model and also applies to right-hand-drive models, and that it covers all models, equipment and options (https://owners-manual.mazda.com/gen/en/mazda6/mazda6_8fk7ee16f/howto.html).
- Sources disagree: the earlier edition 8EA5-EE-14K (https://owners-manual.mazda.com/gen/en/mazda6/mazda6_8ea5ee14k/contents/07031602.html) differs in three engine-bay slots: 8 = "EVVT" (2016: "EVVT SCR1"), 33 = rear wiper only (2016 adds theft-deterrent system), 35 = "HID R" 15 A with no component (2016: "HID R ST.HEATER", heated steering wheel). Use the 2016 edition for this car.
- "(Some Models)" in the manual is shown as `var = Y`.
- Labels such as "FAN DE" / "FAN GE" are printed on the box. Mazda does not explain DE/GE on these pages; diesel engine / petrol (gasoline) engine is my inference only.

### Locations and access

Source: 07031601 page above.

| Box | Location (manual) | Access (paraphrased) |
|---|---|---|
| Cabin, left side | "Vehicle's left side" (the manual's name: "Fuse block (Left side)"); check these first if an electrical item fails | Open the fuse panel cover. The fuse puller is on the engine-compartment fuse block. |
| Engine compartment | Under the bonnet | Remove the fuse block cover. Do not replace the MAIN fuse or the multiplex slow-blow fuse yourself; the manual says to have an Authorised Mazda Repairer do it (high-current fuses). |

Manual hint (paraphrased): with no spare, borrow a fuse of the same rating from a circuit not needed for driving, such as AUDIO or OUTLET.

### Box MAZDA-ENG: fuse block, engine compartment

Source: https://owners-manual.mazda.com/gen/en/mazda6/mazda6_8fk7ee16f/contents/07031602.html

| id | label | amps | function | var |
|---|---|---|---|---|
| 1 | ADD FAN GE | 30 | Cooling fan | Y |
| 2 | IG2 | 30 | Protection of various circuits | |
| 3 | INJECTOR | 30 | Engine control system | Y |
| 4 | FAN DE | 40 | Cooling fan | Y |
| 5 | P.WINDOW1 | 30 | Power windows | Y |
| 6 | - | - | Not used | |
| 7 | ADD FAN DE | 40 | Cooling fan | Y |
| 8 | EVVT SCR1 | 20 | Engine control system | Y |
| 9 | DEFOG | 40 | Rear window defogger | |
| 10 | DCDC DE | 40 | Protection of various circuits | Y |
| 11 | FAN GE | 30 | Cooling fan | Y |
| 12 | EPB L | 20 | Electric parking brake (LH) | |
| 13 | AUDIO | 40 | Audio system | Y |
| 14 | EPB R | 20 | Electric parking brake (RH) | |
| 15 | ENG.MAIN | 40 | Engine control system | |
| 16 | ABS/DSC M | 50 | ABS, dynamic stability control system | |
| 17 | (no label) | 50 | Protection of various circuits | |
| 18 | WIPER | 20 | Front window wiper and washer | |
| 19 | HEATER | 40 | Air conditioner | |
| 20 | DCDC REG | 30 | Protection of various circuits | Y |
| 21 | ENGINE.IG1 | 7.5 | Engine control system | |
| 22 | C/U IG1 | 15 | Protection of various circuits | |
| 23 | H/L LOW L HID L | 15 | Headlight low beam (LH) | |
| 24 | H/L LOW R | 15 | Headlight low beam (RH) | |
| 25 | ENGINE3 | 15 | Engine control system | |
| 26 | ENGINE2 | 15 | Engine control system | |
| 27 | ENGINE1 | 15 | Engine control system | |
| 28 | AT | 15 | Transaxle control system (some models), ignition switch | Y |
| 29 | H/CLEAN | 20 | Headlight washer | Y |
| 30 | A/C | 7.5 | Air conditioner | |
| 31 | AT PUMP | 15 | Transaxle control system | Y |
| 32 | STOP | 10 | Brake lights, rear fog light (some models) | |
| 33 | R.WIPER | 15 | Rear window wiper (some models), theft-deterrent system (some models) | Y |
| 34 | H/L HI | 20 | Headlight high beam | |
| 35 | HID R ST.HEATER | 15 | Heated steering wheel | Y |
| 36 | FOG | 15 | Front fog lights | Y |
| 37 | (no label) | 7.5 | Engine control system | |
| 38 | AUDIO2 | 7.5 | Audio system | |
| 39 | GLOW SIG | 5 | Engine control system | Y |
| 40 | METER2 | 7.5 | Instrument cluster | Y |
| 41 | METER1 | 10 | Instrument cluster | |
| 42 | SRS1 | 7.5 | Air bag | |
| 43 | BOSE | 25 | Bose sound system-equipped model | Y |
| 44 | AUDIO1 | 15 | Audio system | |
| 45 | ABS/DSC S | 30 | ABS, dynamic stability control system | |
| 46 | FUEL PUMP | 15 | Fuel system | Y |
| 47 | FUEL WARM | 25 | Fuel warmer | Y |
| 48 | TAIL | 15 | Tail lights, number plate lights (some models) | |
| 49 | FUEL PUMP2 SCR2 | 25 | Fuel system | Y |
| 50 | HAZARD | 25 | Hazard warning flashers, direction indicator lights, tail lights, position lights, number plate lights | |
| 51 | DRL | 15 | Running lights | Y |
| 52 | R.OUTLET2 | 15 | Accessory sockets | |
| 53 | HORN | 15 | Horn | |
| 54 | ROOM | 15 | Overhead light | |

### Box MAZDA-CAB: fuse block, left side (cabin)

Source: same page.

| id | label | amps | function | var |
|---|---|---|---|---|
| 1 | P.SEAT D | 30 | Power seat | Y |
| 2 | P.WINDOW3 | 30 | Power windows | Y |
| 3 | R.OUTLET3 | 15 | (no component printed) | |
| 4 | P.WINDOW2 | 25 | Power windows | |
| 5 | SRS2/ESCL | 15 | Electronic steering lock | Y |
| 6 | D.LOCK | 25 | Power door locks | |
| 7 | SEAT WARM | 20 | Seat warmer | Y |
| 8 | SUNROOF | 10 | Sunroof | Y |
| 9 | F.OUTLET | 15 | Accessory sockets | |
| 10 | MIRROR | 7.5 | Power control mirror | |
| 11 | R.OUTLET1 | 15 | Accessory sockets | Y |
| 12-16 | - | - | Not used (each slot) | |
| 17 | M.DEF | 7.5 | Mirror defogger | Y |
| 18 | R.SEAT W | 20 | Seat warmer | Y |
| 19 | R.SHADE | 7.5 | Rear sunshade | Y |
| 20 | AT IND | 7.5 | AT shift indicator | Y |
| 21 | P.SEAT P | 30 | Power seat | Y |

### Official links (Mazda)

| What | URL | Access / price |
|---|---|---|
| Owner's manual, web edition 8FK7-EE-16F (used above) | https://owners-manual.mazda.com/gen/en/mazda6/mazda6_8fk7ee16f/index01.html | Free, no login |
| Owner's manual, earlier edition 8EA5-EE-14K | https://owners-manual.mazda.com/gen/en/mazda6/mazda6_8ea5ee14k/index01.html | Free |
| Workshop manual and wiring diagrams: Mazda Europe independent operator portal | https://portal.mazdaeur.com/io | Redirects to a Mazda Europe login (checked 11 Nov 2026). No official page with terms or prices was found. A UK forum post (search extract only) says Digital Service Record and parts data are free to garages and workshop manuals are paid, at about £1,660 a year; not verified. |

---

## What is missing or uncertain

1. **Audi:** no official Audi copy reachable; tables come from a third-party mirror of the en_GB onboard manual, Avant edition "Version year 2011". Saloon assignments not confirmed. No engine-bay fuse list in the owner's manual. Passenger-side A10 rating differs between the manual's LHD (7.5 A) and RHD (25 A) lists.
2. **SEAT:** official 07.06 edition predates the Cupra 177 kW engine; Cupra-specific slots not confirmed. Slot 27 in the engine-bay box is inferred from position. Several functions are printed in unclear translation ("Clean", "Cable control unit"). The manual itself says the sticker in the fuse cover overrides the list.
3. **Ford:** UK/EU edition (CG3630en/CG3632en) not reached; used the official AUS/NZ RS/ST edition 03/2016. Engine (EcoBoost or TDCi) cannot be read from the VIN. Passenger and luggage box positions are shown only in pictures, not in text. VIN month code not decoded.
4. **Mazda:** no VIN, so the edition was chosen by year (8FK7-EE-16F). DE/GE label meaning is my inference. Cabin fuse panel position is given only as "vehicle's left side".
5. **Workshop portals:** no official price list was found for erWin (new 2026 setup), Ford Service Info or Mazda Europe. erWin's new setup excludes private customers. The old brand erWin and Ford Etis addresses did not connect.
6. Pages that refused automated reading: manualmachine.com (403), ford.co.uk pages (connection reset to curl; WebFetch returned only a title), manualesaudi.com directory listing (403; individual pages readable).
