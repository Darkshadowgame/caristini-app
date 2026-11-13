# A6 C7 module enrichment: names, coding meanings and the car's current coding

Research note, 12 Nov 2026. Car: 2012 Audi A6 C7 (4G) 2.0 TDI, UK, MLB, VIN WAUZZZ4GXCN000000. Input: `findings/a6/saved-2026-11-12.json` (coding backup of 9 modules, gateway identification, 17 modules seen). Builds on `vag-tweaks.md` (A6C7-001 to 062), `carista-a6-map.md` and `vag-sources.md`; nothing from those is repeated except where a new source changes it. Machine-readable output: `a6-enrich.json`.

Conventions: byte counted from 0 and bit 0 = least significant, as the VCDS Long Coding Helper counts. Confidence: high = two independent sources agree; medium = one credible source; low = hint only (kept out of the JSON settings list). Label pages on vagcode.info all show the Ross-Tech label text, so several label pages count as one source. "My decode" marks bit arithmetic I did on published coding strings.

## Outcome

- 5 new settings at high or medium: 2 for 17 (cluster), 1 for 10 (parking aid), 1 each for 42 and 52 (door ambient lighting). None is in `src/coding/catalogue.ts` or `src/coding/items.ts`.
- 08 climate, 19 gateway, 09 and 46: no new high or medium coding bit found. Module explanations are written for all 8.
- The cluster coding decodes cleanly against 2 labelled C7 clusters (20 bits named). 10 decodes 1 bit. 08 has only low-confidence hints. 19 has no public bit meaning.
- Main disagreement: cluster byte 1 bit 5 is "Cruise Control System installed" on both C7 labels but "Shift Suggestion" on MLB sibling labels and on vag-coding.net's C7 page. Not offered.

## Sources

| Id | Title | URL | What it gives |
|---|---|---|---|
| L17A | vagcode.info, cluster 4G8 920 931 R, 2012 A7 Sportback | https://vagcode.info/en/components/31efa0ba8917e512d6ff0c1465c23711.html | 11-byte coding 138601021F130008080100 with C7 labels (already VCI17 in earlier notes) |
| L17B | vagcode.info, cluster 4G8 920 984 K, 2015 A6 | https://vagcode.info/en/components/79e2492b9e5083b6f9b4b18e4e3a06fc.html | 11-byte coding 0BE609040B41D705020000; same labels as L17A for every bit checked |
| L17K | vagcode.info, cluster 8K0 920 931 J, 2013 A4 8K | https://vagcode.info/components/8aad58ed4a86c16b9a2486eb144760f0.html | MLB sibling labels; byte 1 bits 4 to 7 named differently from the C7 label |
| L17Q | vagcode.info, cluster 8R0 920 931 G, 2014 Q5 8R | https://vagcode.info/components/acb8febdce5c74fcb91fcbcb82e181b5.html | MLB sibling labels, same as L17K |
| VCN-GSR | vag-coding.net, A6 (C7) activate gearshift recommendation | https://www.vag-coding.net/audi/a6-c7/a6-c7-activate-gearshift-recommendation/ | 17 byte 1 bit 5, no label text; same page exists for the A7 C7 (https://www.vag-coding.net/audi/a7-c7/a7-c7-activate-gearshift-recommendation/) |
| VCN-120 | vag-coding.net, A4 (B8) 120 km/h overrun warning | https://www.vag-coding.net/audi/a4-b8/a4-b8-120-km-h-overrun-warning | 17 byte 0, label "Speed warning at 120 kph (75 mph) active"; bit not stated |
| VCN-LAP | vag-coding.net, A6 (C7) oil temperature / boost via lap timer | https://www.vag-coding.net/audi/a6-c7/a6-c7-oil-temperature-boost-via-lap-timer/ | 17 byte 1 bit 3 "Lap Timer active"; oil temperature from mid-2012 |
| VCN-OPS-B8 | vag-coding.net, A4 (B8) parking aid display on MMI | https://www.vag-coding.net/audi/a4-b8/a4-b8-parking-aid-display-on-mmi | 10, login 71679, byte 0 bit 4 "Optical illustration active"; A4 B8 phase 1, rear parking system only |
| VCN-OPS-8R | vag-coding.net, Q5 (8R) parking aid display on MMI | https://www.vag-coding.net/audi/q5-8r/q5-8r-parking-aid-display-on-mmi/ | Same as VCN-OPS-B8 for the Q5 8R phase 1 |
| VCN-OPS-C7 | vag-coding.net, A6 (C7) parking aid display on MMI | https://www.vag-coding.net/audi/a6-c7/a6-c7-parking-aid-display-on-mmi/ | Address 76, 7-digit coding, second digit 0 to 2; also A7 C7 page https://www.vag-coding.net/audi/a7-c7/a7-c7-reversing-radar-display-on-mmi/ |
| AW-APS | AudiWorld, S4 B8 "Audi Parking System Plus" | https://audiworld.com/forums/s4-b8-platform-discussion-134/audi-parking-system-plus-2796376 | Same 76 digit method (sworksone, 14 Dec 2010); reported to work on "an A6", failed on his S4 |
| VCN-RADAR | vag-coding.net, A6 (C7) speed of radar deactivation | https://www.vag-coding.net/audi/a6-c7/a6-c7-speed-of-radar-deactivation-or-reversing-camera/ | 10 adaptation channel 233, 0 to 20 km/h |
| V10A | vagcode.info, 10 ParkSteer 4H0 919 475 R, 2012 A7 | https://vagcode.info/en/components/42b4df9042bed0f277ed1aa5ba4830cb.html | Coding 992B03, no labels |
| V10B | vagcode.info, 10 ParkSteer 4H0 919 475 AA, 2015 A6 | https://vagcode.info/en/components/e61ac3a909684c18c2f801a2eb81e1b7.html | Coding A8C105, no labels |
| V10VW | vagcode.info, 10 ParkSteer 3AA 919 475 L (hardware 4H0 919 475 E), VW Tiguan 2012 | https://vagcode.info/en/components/bf2658512fd98394400226d1c2aa5ec4.html | VW labels on the same hardware: byte 1 bit 0 automatic gearbox, bit 1 start-stop, bit 4 RHD, bit 7 mute function. Does not fit this car (see disagreements) |
| V19G | vagcode.info, gateway 4G0 907 468 G, 2012 A7 | https://vagcode.info/en/components/3e3806d864ed0d29fb5ca0845ec080d6.html | Coding 00CD077D00, software 0214, no labels |
| V19E | vagcode.info, gateway 4G0 907 468 E, 2012 A7 | https://vagcode.info/en/components/65f610a86f69b20022e25bcbba50f787.html | Coding 00CD077D00, software 0213, no labels |
| V08 | vagcode.info, 08 Auto HVAC 4G0 820 043 AQ, 2015 A6 | https://vagcode.info/en/components/7eff3f8a014da3768037ed68e984f023.html | 5-byte coding 64812018C9, no labels |
| VLOG180 | vagcode.info, VCDS log 180, 2012 A7 | https://vagcode.info/en/brands/audi/a7/4GA/log-180.html | 08 4G0 820 043 L = 3603007E24; 42/52 = 011F56225E00... (already V1 in earlier notes) |
| VLOG171 | vagcode.info, VCDS log 171, 2015 A6 | https://vagcode.info/en/brands/audi/a6/4G2/log-171.html | Facelift codings of 08, 10, 17, 19, 09, 46, 42, 52 |
| VLOG170 | vagcode.info, VCDS log 170, 2016 A6 | https://vagcode.info/en/brands/audi/a6/4G2/log-170.html | As VLOG171; 08 has 7 bytes on 4G0 820 043 CD |
| V42 / V52 | vagcode.info, doors 4G8 959 793 D and 4G8 959 792 E, 2012 A7 | https://vagcode.info/en/components/764ba8151ab13f2dbbf5682e9b01d033.html ; https://vagcode.info/en/components/38fa099cd0a720ea58ef8e67687f83a6.html | 12-byte codings, no labels |
| VCN-DOORLED | vag-coding.net, A6 (C7) activate door mood lighting (retrofit) | https://www.vag-coding.net/audi/a6-c7/a6-c7-activate-door-mood-lighting-retrofit/ | 42, 52, 62, 72 byte 1 bit 1, after the 09 mood lighting step |
| VCN-AMB | vag-coding.net, A7 (C7) activate ambient lighting | https://www.vag-coding.net/audi/a7-c7/a7-c7-activate-ambient-lighting/ | 09 byte 16 bit 6 "Interior/Ambiance Lighting Adaptation active" plus MMI hidden menu (confirms cat-c7-footwell-lights) |
| VCN-TOUR | vag-coding.net, A6 (C7) display travel mode on MMI | https://www.vag-coding.net/audi/a6-c7/a6-c7-display-travel-mode-on-mmi/ | 09 byte 4 bit 6 "Tourist Mode Adjustable via MMI/Car Menu" (confirms c7-tourist) |
| VCN-HWY | vag-coding.net, A6 (C7) automatic headlight activation from 140 km/h | https://www.vag-coding.net/audi/a6-c7/a6-c7-automatic-headlight-activation-from-140-km-h/ | 09, sub-coding "2 EPIRBs", byte 0 bit 0 "Highway Light Function active above (140kph/90mph)"; screenshots named A5 8T |
| AW-HVAC | AudiWorld, A8 D4 "HVAC styles" | https://www.audiworld.com/forums/a8-s8-d4-platform-discussion-190/hvac-styles-3003963/ | 08 byte 4 bit 6 "Function Climate Styles Blocked" (richard-tx, 31 Aug 2020); uncheck to enable |
| AZ-C7 | Audizine, "C7 A6/A7 & S6/S7 VAG-COM list and help" | https://www.audizine.com/forum/showthread.php/566240-C7-A6-A7-amp-S6-S-amp-VAG-COM-list-and-help | 403 to fetches; search text only: 08 byte 1 bit 3 and bit 4 set to 1 next to an auxiliary heating hidden-menu step |
| RT-17 | Ross-Tech wiki, Audi A6 (4G) instrument cluster | https://wiki.ross-tech.com/wiki/index.php/Audi_A6_(4G)_Instrument_Cluster | Coding via Long Coding Helper; no bits; service reset channel names |
| R6 | Ross-Tech wiki, A4/A5 (8K/8T) tweaks | https://wiki.ross-tech.com/wiki/index.php/Audi_A4/S4/A5/S5_(8K/8T)_Tweaks | BCM1 (09) and BCM2 (46) roles and labels (already in earlier notes) |
| B2 | Ross-Tech wiki, battery replacement | https://wiki.ross-tech.com/wiki/index.php/Battery_Replacement | Gateway 4G0 907 468 E holds the battery adaptation (already in `vag-sources.md`) |
| CAR | Carista, A6 C7 supported features | https://carista.com/apps/supported-cars/audi/a6/c7 | Search text only: lists "Speed warning at 120 km/h (75 mph)" as a C7 option. Hint, not a coding source |
| VCN-IDX | vag-coding.net, A6 (C7) index (55 guides) and A7 (C7) index (53 guides) | https://www.vag-coding.net/audi/a6-c7/ ; https://www.vag-coding.net/audi/a7-c7/ | Used to find the pages above |

Pages read with nothing usable: vis4vag.com A6 4G 08 coding (demo mode, numbers masked), Ross-Tech wiki A4 8K KLIMA 3 ZONEN (no bits), vagcode.info 8T gateway 8T0 907 468 G (3-byte coding, different layout), several vagcode.info 8K/8T/8R parking and HVAC pages (404), AudiWorld "2016 VCDS codes" (owner results, no bytes), AudiWorld A8 D4 tweaks page 2 (no bytes).

## Per-module findings

### 17 Instrument cluster (4G8920950K)

The dials, warning lamps and driver information display. Long coding is 11 bytes, as on both labelled C7 clusters. UDS on this car.

Labels from L17A and L17B (both C7, identical for every bit below):

| Byte | Bit | Label (as on the page) | Kind |
|---|---|---|---|
| 0 | 2 to 4 | Seat belt warning field | Safety, not offered |
| 0 | 5 | "Right-Hand-Drive (RHD)" | Equipment |
| 0 | 6 | "Speed Warning at 120 kph (75 mph) active" | Setting (new) |
| 0 | 7 | "Brake System Warning Light North American Region (NAR) OR Australia (AUS) active" | Market, not offered |
| 1 | 0 | "Gauge Test/Needle Sweep active" | Setting (c7-needle-sweep) |
| 1 | 1 | "Engine Start Note (i.e. "Press Clutch to Start Engine")" | Setting (new) |
| 1 | 2 | "Driver Information System (DIS) active" | Equipment |
| 1 | 3 | "Lap Timer active" | Setting (c7-lap-timer) |
| 1 | 5 | "Cruise Control System installed" | Disputed, see disagreements |
| 2 | 3 to 7 | Model field | Not decoded |
| 3 | 0 to 4 | Tyre circumference field | Not decoded |
| 3 | 7 | "Wheel Speed Error Counter active" | Not offered |
| 4 | 0 to 7 | TPMS, EPB, ACC, swivelling headlights, DRC, dynamic steering, lane assist, quattro sport "installed" | Equipment flags; only TPMS is in the catalogue |
| 5 | 0 | "Electronic Power Steering (EPS) installed" | Equipment, disputed with siblings |
| 5 | 1 | "Rear Spoiler installed" | Equipment |
| 6 | 5 to 6 | Fuel volume unit field | Not decoded |
| 6 | 7 | "Time Display (0 = 24h / 1 = 12h AM/PM)" | Setting (cat-c7-12h-clock) |
| 7 | 2 to 3 | Consumption unit field | Not decoded |
| 8 | 0 to 4 | Language field | Not decoded |
| 8 | 7 | "Special Characters allowed" | Not offered |
| 9 | 0 to 7 | Country field | Not decoded |
| 10 | 0 | "Brake Pad Wear Warning active" | Brake warning, not offered |

MLB sibling labels (L17K, L17Q) name 4 bits the C7 label leaves blank or names differently: byte 1 bit 4 "Washer Fluid Warning active", bit 5 "Shift Suggestion (Economy) active", bit 6 "Multi Media Interface Generation 3 (MMI 3G) installed", bit 7 "Key Warning active"; byte 5 bit 0 "Adaptive Air Suspension installed". Because bit 5 and byte 5 bit 0 conflict with the C7 label, these sibling names are kept as low and not offered.

New settings: 120 km/h chime (high: L17A, L17B, VCN-120, siblings L17K, L17Q; CAR lists it as a C7 option), engine start hint (medium, labels only).

Field values: the label pages print the same option name whatever the value (for example "Chinese" for language values 1 and 3, "Country: Japan" for value 0), so fields cannot be decoded from them.

### 08 Heating and air conditioning (4G0820043G)

The Climatronic control: temperature, fan, flaps, A/C request; heated seat timers are adaptations here. Coding is 5 bytes (2012 A7 and 2015 A6 also 5 bytes; a 2016 A6 with 4G0 820 043 CD has 7). No public label for any bit.

Low-confidence hints only:
- Byte 1 bits 3 and 4: auxiliary heating or ventilation (AZ-C7 search text; already A6C7-048 from the Audi SG list). Needs parking heater or ventilation support; not offered.
- Byte 4 bit 6: "Function Climate Styles Blocked" (AW-HVAC, A8 D4, one post; coding length of that unit not stated). Not offered.

### 10 Parking aid (4H0919475L)

Parking sensors, tones and the MMI parking graphic. Coding is 3 bytes, as on the 2012 A7 and 2015 A6.

- Byte 0 bit 4 "Optical illustration active", login 71679 (VCN-OPS-B8, VCN-OPS-8R, MLB siblings, one publisher): medium, new.
- Switch-off speed: adaptation, channel 233 at 0 to 20 km/h (VCN-RADAR) or channel 23 (earlier notes, A6C7-054). Not coding.
- The VW labels on the same hardware (V10VW) do not fit this car and are not used.

### 19 CAN gateway (4G0907468F, software 0214)

Links the data buses, lists fitted modules, holds battery data, and is the diagnostic entry point. Coding is 5 bytes. No public bit meaning. The two 2012 A7 gateways (V19G, V19E) are coded 00CD077D00; this car is 00CD074400 (byte 3: 44 against 7D, my decode). Facelift gateways differ (4G0 907 468 AD = 00C1032900, VLOG171; 4G8 907 468 F = C0CD073010, VLOG170). Battery registration is an adaptation (B2). No settings.

### 09 Central electronics (not read)

Exterior lights, DRL, indicators, wipers and washers, interior and footwell lights. KWP2000 on TP2.0 on the C7. New evidence only:
- VCN-TOUR gives byte 4 bit 6 "Tourist Mode Adjustable via MMI/Car Menu": with the Google Doc already behind c7-tourist, that item now has two sources (can move from medium to high).
- VCN-AMB repeats byte 16 bit 6 "Interior/Ambiance Lighting Adaptation active" on an A7 C7 page (supports cat-c7-footwell-lights, same publisher as VCN-MOOD already cited).
- VCN-HWY: highway light above 140 km/h, byte 0 bit 0 of a sub-coding the page calls "2 EPIRBs", screenshots from an A5 8T. The byte is inside a sub-coding the app does not read, so it is low and not offered.

### 46 Comfort system (not read)

Central locking, alarm, remote, comfort windows and sunroof, emergency brake flashing. KWP2000 on TP2.0 on the C7. No new byte or bit beyond `vag-tweaks.md` and `carista-a6-map.md`.

### 42 Driver door and 52 Passenger door (not read)

Window, lock, mirror adjust, fold and heat, door lights. KWP2000 on TP2.0 on the C7. 12-byte codings on the 2012 A7 (V42, V52), no labels.
- Byte 1 bit 1: door ambient lighting for retrofitted lamps, in 42, 52, 62 and 72 (VCN-DOORLED): medium, new. The 2012 A7 (log 180), 2015 A6 (log 171) and 2016 A6 (log 170) all have byte 1 = 1F in the front doors, bit 1 set (my decode).

## Current coding decoded

### 17: 23 A7 10 00 03 01 A6 00 01 00 00

| Byte | Bit | Meaning (C7 label) | State |
|---|---|---|---|
| 0 | 5 | Right-hand drive | on (fits a UK car) |
| 0 | 6 | 120 km/h chime | off |
| 0 | 7 | NAR/AUS brake warning lamp | off |
| 1 | 0 | Needle sweep | on |
| 1 | 1 | Engine start hint | on |
| 1 | 2 | Driver information display | on |
| 1 | 3 | Lap timer | off |
| 1 | 5 | Cruise control installed (C7 label) or shift suggestion (siblings, VCN-GSR) | on |
| 4 | 0 | TPMS installed | on |
| 4 | 1 | EPB installed | on |
| 4 | 2 to 7 | ACC, swivelling headlights, DRC, dynamic steering, lane assist, quattro sport | all off |
| 5 | 0 | Electronic power steering installed (C7 label) | on |
| 5 | 1 | Rear spoiler installed | off |
| 6 | 7 | Clock: 1 = 12-hour | on (12-hour). The 2015 A6 is also set; the MMI clock setting may override it (not confirmed) |
| 10 | 0 | Brake pad wear warning | off |

Not decoded: byte 0 bits 2 to 4 (field value 0), byte 2 bits 3 to 7 (value 2), byte 3 (0), byte 6 bits 5 to 6 (value 1), byte 7 bits 2 to 3 (0), byte 8 bits 0 to 4 (value 1), byte 9 (0). Unlabelled set bits: byte 0 bits 0 and 1, byte 1 bit 7, byte 6 bits 1 and 2.

### 08: 34 22 00 08 A0

No high or medium meaning. Low only: byte 1 bits 3 and 4 (auxiliary heating) both off; byte 4 bit 6 (climate styles blocked, A8 D4) off.

### 10: 08 03 07

Byte 0 bit 4 (parking graphic on MMI, A4 B8 / Q5 8R layout): off. The 2012 A7 has it on (992B03), the 2015 A6 off (A8C105). Nothing else decoded.

### 19: 00 CD 07 44 00

No public meanings; nothing decoded.

## Disagreements

1. 17 byte 1 bit 5. L17A and L17B (C7): "Cruise Control System installed". L17K and L17Q (A4 8K, Q5 8R): "Shift Suggestion (Economy) active". VCN-GSR (A6 C7 and A7 C7 pages, no label text): bit 5 "activates the gearshift recommendation". Set on this car. Clearing it could remove cruise control if the C7 label is right, so it is not offered.
2. 17 byte 5 bit 0. C7 labels: "Electronic Power Steering (EPS) installed"; sibling labels: "Adaptive Air Suspension installed". Decode only.
3. 10 parking graphic. VCN-OPS-B8 and VCN-OPS-8R: long coding byte 0 bit 4. VCN-OPS-C7 and AW-APS: address 76, 7-digit coding, second digit 2. The C7 car answers on address 10 with 3-byte coding, so the 76 method fits an older module; but no C7 page confirms byte 0 bit 4.
4. 10 switch-off speed. VCN-RADAR: adaptation channel 233; Google Doc and Audi SG list (A6C7-054): channel 23.
5. 10 VW labels on the same hardware (V10VW) name byte 1 bit 4 as RHD; this RHD car has it clear (byte 1 = 03), so the VW layout does not match the Audi software.

## Not found

- Any labelled bit for 08 (4G0 820 043) or 19 (4G0 907 468) long coding, on the C7 or a close MLB sibling.
- C7-specific meaning of cluster byte 1 bits 4, 6 and 7 and byte 5 bits 2 to 7.
- Values for the cluster fields (units, language, country, model), so the app cannot set units or language from coding.
- Parking aid volume, front or rear tone, or mute bits for the Audi 4H0 919 475 software.
- Any new 46 bit, and any 42/52 bit label (the A7 door pages carry none).
- An owner report from a C7 for the 120 km/h chime or the engine start hint.
- This car's 09, 46, 42 and 52 part numbers and codings (not read; KWP route).

## Notes for the app

- Only the 2 cluster settings are writable now (17 is UDS). 10 and 08 also answered UDS in the backup; the 10 item needs login 71679 first. 42 and 52 need the KWP2000 on TP2.0 write route.
- Suggested confidence changes to existing items: c7-tourist medium to high (VCN-TOUR); cat-c7-12h-clock stays medium (label only, now on 2 C7 clusters).
- `carista-a6-map.md` already proposed c7-speed-warning-120 at medium; this note raises it to high with VCN-120 and the second C7 label.
