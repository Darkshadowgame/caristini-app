# Caristini: coding, adaptation and service reset sources

Research note, 11 Nov 2026. Scope: which "customisations" and service resets the app may offer, with a public source for each. Companion to `uds-sources.md` (CAN IDs and read services).

Cars: 2012 Audi A6 C7 (4G, MLB, 2.0 TDI, main car), Seat Leon II (1P, PQ35, 2007), Ford Focus Mk3 (about 2015), Mazda6 GJ 2.2 diesel (2016).

Confidence key (same as `uds-sources.md`):

- **High**: two or more independent sources agree, or one official source (Audi, Mazda, Ross-Tech wiki) that covers this car or module.
- **Medium**: one detailed source, or a Ross-Tech label seen in a real log but not yet tied to a working change.
- **Low**: single short forum post, a different platform, or sources disagree.
- **Unconfirmed**: no public source found. Do not offer in the app.

Bit numbering: VCDS "Byte n" is the n-th byte of the coding (byte 0 = first data byte after `62 06 00`). "Bit 0" is the least significant bit. Shown by vagcode.info logs of A7 clusters: byte 0 `13` = binary `00010011` with bits 0, 1 and 4 ticked (V2, V3). So bit n = `(byte >> n) & 1`.

---

## Sources

| Key | Source | URL | Notes |
|---|---|---|---|
| R1 | Ross-Tech wiki, Audi A6 (4G) Instrument Cluster | https://wiki.ross-tech.com/wiki/index.php/Audi_A6_(4G)_Instrument_Cluster | Coding via Long Coding Helper only; adaptation service reset channel names |
| R2 | Ross-Tech wiki, Audi A6/S6/RS6/allroad (4G/FC) | https://wiki.ross-tech.com/wiki/index.php/Audi_A6/S6/RS6/allroad_(4G/FC) | Module list and sub-pages |
| R3 | Ross-Tech wiki, MLB based Cent. Elect. (J519) BCM1 | https://wiki.ross-tech.com/wiki/index.php/MLB_based_Cent._Elect._(J519)_BCM1 | Applies to A4 8K, A5 8T, Q5 8R, A6/A7/A8 4G/4H. No bytes listed; "Security access codes will appear in the form of a pop-up balloon" |
| R4 | Ross-Tech wiki, MLB based Central Conv. (J393) BCM2 | https://wiki.ross-tech.com/wiki/index.php/MLB_based_Central_Conv._(J393)_BCM2 | Same model list as R3. No bytes listed |
| R5 | Ross-Tech wiki, Audi A6 (4G) Steering Wheel Electronics | https://wiki.ross-tech.com/wiki/index.php/Audi_A6_(4G)_Steering_Wheel_Electronics | Login 40168 = Basic Setting enabling |
| R6 | Ross-Tech wiki, Audi A4/S4/A5/S5 (8K/8T) Tweaks (oldid 7823) | https://wiki.ross-tech.com/wiki/index.php/Audi_A4/S4/A5/S5_(8K/8T)_Tweaks | Official tweak list for MLB siblings, "Similar models include the Audi 2008 + Q5 (8R/FP)". Option labels, adaptation channel rules, no byte numbers |
| R7 | Ross-Tech wiki, SRI Reset Procedure | https://wiki.ross-tech.com/wiki/index.php/SRI_Reset_Procedure | UDS clusters "do not support conventional Adaptation Channels"; use "ESI: Resetting ESI" |
| R8 | Ross-Tech wiki, Seat Leon (1P) | https://wiki.ross-tech.com/wiki/index.php/Seat_Leon_(1P) | Module index for the Leon 1P |
| R9 | Ross-Tech wiki, Seat Leon (1P) Instrument Cluster (redirects to VW Golf (1K) Instrument Cluster) | https://wiki.ross-tech.com/wiki/index.php/Seat_Leon_(1P)_Instrument_Cluster | Short coding, login 13861, service reset channel 002 |
| R10 | Ross-Tech wiki, Seat Leon (1P) Central Electronics | https://wiki.ross-tech.com/wiki/index.php/Seat_Leon_(1P)_Central_Electronics | Byte 00 bit 7 coming home, byte 00 bit 5 leaving home, adaptation 001/002 |
| R11 | Ross-Tech wiki, VW Golf (1K) Comfort System (linked from R8 as the Leon 1P [46] page) | https://wiki.ross-tech.com/wiki/index.php/VW_Golf_(1K)_Comfort_System | Adaptation channels 003 to 019 (auto-lock, lock confirmation) |
| G1 | "Audi C7 VCDS Tweaks", Google Doc, author and date not stated | https://docs.google.com/document/d/1v-dzsYc6OlPT-RGjtRTecjr8Shj85WCZhlQpruSH5XM/mobilebasic | Most detailed C7 byte/bit list found. One source; byte and bit only, often without original value |
| AW1 | AudiWorld, "VAG-COM (VCDS) coding for 2016 FL A6/A7", jlr83 24 Apr 2015, 6CHICAGO 15 Jul 2015 | https://www.audiworld.com/forums/a6-c7-platform-discussion-194/vag-com-vcds-coding-2016-fl-a6-a7-2882436/ | Needle sweep, lap timer, single gear display, Shift P to EPB (login 78713), comfort windows adaptation 62 |
| AW2 | AudiWorld, "anyone programmed remote window operation by fob using VCDS?", Jan 2016 | https://www.audiworld.com/forums/a6-c7-platform-discussion-194/anyone-programmed-remote-window-operation-fob-using-vcds-2894483/ | C7 46 "Comfort Operation: Remote Control active" plus MMI setting |
| AW3 | AudiWorld, "Passenger Mirror Tilt in Reverse", Apr 2012 to Jun 2013 | https://audiworld.com/forums/a6-c7-platform-discussion-194/passenger-mirror-tilt-reverse-2825183/ | C7 reverse tilt works from the factory via mirror memory (no coding) |
| V1 | vagcode.info, complete VCDS log #180, Audi A7 Sportback 2012, 40 modules, scanned 14 Apr 2021 | https://vagcode.info/en/brands/audi/a7/4GA/log-180.html | Real codings and part numbers for 09, 17, 42, 46, 52 etc. |
| V2 | vagcode.info, Instruments 4G8 920 931 R (from V1), label `4H0-920-xxx-17.clb-SRI1`, ASAM `EV_RBD4K 004045` | https://vagcode.info/en/components/31efa0ba8917e512d6ff0c1465c23711.html | Ross-Tech label text per byte and bit for the C7 cluster |
| V3 | vagcode.info, Instruments 4G8 920 931 C, A7 Sportback 2012, same label file | https://vagcode.info/ru/components/d72f817c6aaad80fa2ab9da63f4f3417.html | Second C7 cluster, same byte 0 and byte 1 layout as V2 |
| VC1 | vag-coding.net, A6 (C7) page titles seen in search results (site returned 404 to every fetch on 11 Nov 2026) | https://www.vag-coding.net/audi/a6-c7/ | Titles: "Needle check", "Delete belt alarm", "Oil temperature / Boost via Lap Timer", "Automatic folding of mirrors". Content not read |
| VC2 | vag-coding.net, A4 (B8) "Delete belt alarm" (search snippet only) | https://www.vag-coding.net/audi/a4-b8/a4-b8-delete-belt-alarm/ | "Byte 0, Bit 2-4: select Seat Belt Warning inactive" |
| VC3 | vag-coding.net, A8 (D3) lock/unlock confirmation (search snippet only) | https://www.vag-coding.net/audi/a8-d3/a8-d3-lock-unlock-confirmation-beeps | 46 byte 1 bit 2 "Horn Confirmation active". D3 is not MLB |
| U1 | OVMS v3, `xvu-ecu.js` v0.5.1, Michael Balzer, VW e-Up / Mii / Citigo ECU toolkit, last commit 28 Aug 2021 | https://github.com/openvehicles/Open-Vehicle-Monitoring-System-3/blob/master/plugin/v-vweup/ecutoolkit/xvu-ecu.js | Full public UDS coding write sequence and security key formula |
| U2 | OVMS ECU toolkit docs | https://docs.openvehicles.com/en/latest/plugin/v-vweup/ecutoolkit/README.html | "Most codings don't need a security code"; "ECUs will record all your write operations" |
| U3 | commaai/openpilot `tools/scripts/car/vw_mqb_config.py` (MQB EPS coding) | https://github.com/commaai/openpilot/blob/master/tools/scripts/car/vw_mqb_config.py | Second independent code source for the same sequence |
| U4 | commaai/opendbc `uds.py` DID names | https://github.com/commaai/opendbc/blob/master/opendbc/car/uds.py | F198 = REPAIR_SHOP_CODE_OR_TESTER_SERIAL_NUMBER, F199 = PROGRAMMING_DATE, F19A = CALIBRATION_REPAIR_SHOP_CODE |
| T1 | Audi of America, "2012 A6-S6 Executive Service" document, dated 16 Jun 2015 (NHTSA copy) | https://static.nhtsa.gov/odi/tsbs/2015/MC-10120898-9999.pdf | Owner's manual text: MMI oil change reset path |
| T2 | vis4vag diagnostics, A6 (4G) 17 dashboard `EV_RBD4K 004048`, reset fixed oil interval QI1-4 (demo mode, numbers masked) | https://diagnostics.vis4vag.com/de/audi/a6-4g/a-2997-17-armaturenbrett-tdierdw-ev-rbd4k-004048/o-17-festes-serviceintervall-fur-olwechsel-zurucksetzen-qi1-4 | Channel names, IDE numbers masked |
| T3 | vis4vag, Service intervals, UDS vehicles, reset of service interval QI (demo mode) | https://diagnostics.vis4vag.com/en/service-intervals/vehicles-2008-protocol-uds/vehicles-up-to-2013-qi/reset-of-service-interval-qi | FIX channel names, IDE numbers masked |
| T4 | CarPort-OBD wiki, MQB service reset | https://carport-obd.com/en/wiki/mqb-service-reset | MQB only. Channel numbers 8754, 8870, 8871, 8776 (base not stated) |
| T5 | ilexa, "VCDS help - Service Reminder Resetting for UDS Protocol clusters" | https://www.ilexa.co.uk/sri-reset/237-vcds-help-service-reminder-resetting-uds.html | Same channel names as R1 |
| S1 | SeatCupra.net, "GUIDE: The Mk2 Leon VAG-COM Guide", DanGB, 10 Apr 2008, last edited 20 May 2010, "acording to my '2006 Sport'" | https://www.seatcupra.net/forums/threads/guide-the-mk2-leon-vag-com-guide.167515/ | Leon 1P bytes and bits |
| F1 | FORScan forum, "How to manage module configuration in FORScan", FORScan admin, 25 Feb 2021 onwards | https://forum.forscan.org/viewtopic.php?p=59999 | Central configuration used on EU 2006-2013 MY Fords incl. "focus Mk3" |
| F2 | Niall Best's blog, "Ford automatic door locking via Forscan (MK3 Focus)", 8 Oct 2020 | https://niallbest.com/ford-automatic-door-locking-via-forscan-mk3-focus/ | UK Mk3 Focus and Mk7 Fiesta, BCMii central configuration |
| F3 | Google Sheet "2017 Focus ST" FORScan list, MuddledGuy, "copied from the 2017 Super Duty Spreadsheet" | https://docs.google.com/spreadsheets/d/1MFz6H7_f7Ez61L---H_u1SaTOdo_22qPJy7BIM46lR8/edit | US. Most rows are Super Duty values |
| F4 | FORScan forum, "How to program Central Configuration using FORScan" | https://forum.forscan.org/viewtopic.php?p=15952 | Warnings: "Invalid Data" no-start after a CC attempt on a 2014 US Fiesta |
| F5 | Ford Owners Club, "Forscan Focus MK3" (page returned 403; search snippet only) | https://www.fordownersclub.com/forums/topic/125779-forscan-focus-mk3/ | BdyCM item names "Global Close", "Double Lock Configuration" |
| M1 | Mazda, 2016 Mazda6 Owner's Manual (US), section 9 "Personalization Features" and "Maintenance Monitor" | https://www.mazdausa.com/siteassets/global-resources/vehicle-resources/owner-manuals/2016/mazda6/2016-mazda6-owners-manual.pdf | Official. US petrol market |
| M2 | Mazda owner's manual site, CX-5, "Vehicle Engine Control Unit Reset Procedure (SKYACTIV-D 2.2)" | https://owners-manual.mazda.com/gen/en/cx-5/cx-5_8ft7eo17b/contents/07030404.html | Official, CX-5 with the same engine. Model and year not stated on page |
| M3 | Mirror of a Mazda service page, "ENGINE OIL DATA RESET [SKYACTIV-D 2.2]" (not Mazda's site) | https://mazda6.neocities.org/esicont/srvc/html/id0140z7444700 | Tripmeter, M-MDS and test-terminal methods |
| E1 | PyVCDS (MartijnD92) | https://github.com/MartijnD92/PyVCDS | "ELM327 is not supported" for VW TP 2.0 |

Sources that blocked automated reading on 11 Nov 2026 (not used as evidence): Audizine (403), vag-coding.net (404 on every page), Ford Owners Club (403), focusrs.org, focusfanatics.com, kugaownersclub.co.uk and vwvortex.com (paywall redirect), nefariousmotorsports.com (403).

---

## A. Audi A6 C7 (4G, MLB) and siblings

CAN IDs below are from `uds-sources.md` (A7 capture or ODIS name match). Real coding lengths are from the 2012 A7 log (V1).

| Addr | Module | Request / response | Part no. in V1 (2012 A7) | Coding length in V1 | Subsystems in V1 |
|---|---|---|---|---|---|
| 17 | Instruments J285 | 714 / 77E (owner's car confirmed) | 4G8 920 931 R | 11 bytes | none |
| 09 | Cent. Elect. J519 (BCM1 2.0) | 70E / 778 (Medium, MQB only) | 4H0 907 063 BN | 30 bytes | 4 (wiper, rain/light sensor, LDS, humidity) |
| 46 | Central Conv. J393 (BCM2 2.0) | 70D / 777 (Medium, name match) | 4H0 907 064 BP | 30 bytes | 3 (roof, HSP, tailgate) |
| 42 | Door Elect, Driver J386 | 74A / 7B4 (Medium, name match) | 4G8 959 793 D | 12 bytes | |
| 52 | Door Elect, Pass. J387 | 74B / 7B5 (Medium, name match) | 4G8 959 792 E | 12 bytes | |
| 53 | Parking Brake | 752 / 7BC (High) | 4H0 907 801 E | none shown | |
| 02 | Auto Trans J217 | 7E1 / 7E9 (High) | 4G0 927 158 AB | 3 bytes | |

Use these lengths as a sanity check: refuse to write if the length read with `22 0600` differs from the length the item was sourced against.

### A1. Instrument cluster [17]

Label text is the Ross-Tech label `4H0-920-xxx-17.clb-SRI1`, as rendered by vagcode.info from two real 2012 A7 clusters (V2, V3).

| Item | Method | Byte / bit | Off / On | Login | Risk notes | Sources | Confidence |
|---|---|---|---|---|---|---|---|
| Needle sweep (staging) | Long coding | Byte 1 bit 0 "Gauge Test/Needle Sweep active" | 0 = off, 1 = on | None stated | R6: "may Not be supported on all instrument clusters" | V2, V3 (label), AW1 ("byte 1"), G1 ("byte 1"), R6 (label, B8/8T/Q5) | **High** |
| Lap timer | Long coding | Byte 1 bit 3 "Lap Timer active" | 0 / 1 | None stated | | V2, V3, AW1, G1, R6 | **High** |
| Oil temperature (shown via lap timer) | Long coding | Same bit as lap timer | | | Only a page title seen; content not read | VC1 title only | Low |
| Seat belt warning | Long coding | Byte 0 bits 2-4, a 3-bit value field (not a single bit) | V2: field value 4 (byte 0 `13`) = "Seat Belt Warning Rest of World (RoW) EURO NCAP2 escalated active". Value for "inactive": **not found** | None stated | G1 says "byte 0, bit 4"; VC2 (B8) says "Bit 2-4: select Seat Belt Warning inactive". Writing a whole field needs the enum value, which no source gives. Safety system | V2, V3, VC2, G1 | Location **Medium**; "inactive" value **Unconfirmed** |
| Tyre pressure (TPMS) display | Long coding | Byte 4 bit 0 "Tire Pressure Monitoring (TPMS) installed" | 0 / 1 | G1: also needs ABS 1AT (not 1AS), ABS [03] coding byte 1 bit 3 with login 61378 ("probably"), and MMI green-menu entries | Multi-module; wrong ABS coding is a brake fault risk | V2 (label), G1 | Medium (cluster bit); do not offer the ABS part |
| Digital speed display | | Not in the C7 cluster label list (V2 bytes 0 to 10) | | | | Not found | **Unconfirmed** |
| Battery voltage | MMI green menu (Car > Carextdevicelist > Battery), after 5F adaptation channel 6 = 1 | | | | Not a cluster coding; 5F CAN ID not confirmed on MLB | G1 | Low |
| Cluster dimming curves | Adaptation, 4 channels "dimming_characteristic_curve_adjustment_..." to 0 | | | "Security 16, code shown by VCDS" | Adaptation DID not known | G1 | Low |

Other labelled bits in V2 (for display only, not changes): byte 0 bit 5 RHD, bit 6 speed warning 120 km/h, byte 1 bit 2 DIS active, byte 1 bit 5 cruise control installed, byte 4 bits 1 to 7 EPB / ACC / AFS / DRC / dynamic steering / lane assist / quattro sport installed, byte 6 bit 7 12 h clock, byte 8 language, byte 9 country, byte 10 bit 0 brake pad wear warning.

### A2. Central electronics [09] (BCM1)

All bytes from G1 only. R6 (Ross-Tech, B8/8T/Q5) confirms the option labels exist on MLB BCM1 but gives no bytes.

| Item | Method | Byte / bit | Value | Login | Sources | Confidence |
|---|---|---|---|---|---|---|
| LED DRL off with indicator ("winking") | Long coding | Byte 3 bit 7 | 1 = DRL off on indicator side | None stated | G1; label in R6 ("Daytime Running Lights inactive with Turn Signal ("Winking") active") | Medium |
| Parking light LEDs at full brightness | Long coding | Byte 3 bit 2 | 1 | None stated | G1 | Medium |
| DRL adjustable in MMI | Long coding | Byte 3 bit 0 | 1 | None stated | G1 | Medium |
| DRL brightness | Adaptation channel 3 | | 5 to 100 | 20113 | G1 | Medium (adaptation DID unknown) |
| Tail lights with DRL | Long coding | Byte 2 bit 7 | 1 | None stated | G1 | Medium |
| Kerb lighting | Long coding | Byte 4 bit 0 | 1 | None stated | G1 | Medium |
| Fog lights stay on with high beam | Long coding | Byte 4 bits 1 and 2 | both 0 | None stated | G1 | Medium |
| Tourist mode in MMI | Long coding | Byte 4 bit 6 | 1 | None stated | G1 | Medium |
| Coming / leaving home | Long coding | Byte 6 bit 4 | G1 says "disable"; on/off meaning of 0 and 1 not stated | None stated | G1; R6 confirms labels "Coming-Home active", "Leaving-Home active" in 09 coding | Low (direction unclear) |
| Amber side markers off | Long coding | Byte 10 submodule 0 bit 3 | 0 | None stated | G1. Byte 10 "submodule" means a subsystem coding, not DID 0600 | Low |
| Footwell lighting | Long coding | Byte 16 bit 6 | 1, then MMI green menu | None stated | G1 | Medium |
| Start-stop: remember last state | Adaptation channel 34 | | add 32 (also: subtract 4 = always off, add 64 = button light) | 20113 | G1 | Medium (adaptation DID unknown) |
| Emergency brake flashing | | | | | Not found for C7 | **Unconfirmed** |
| Rear fog behaviour | | | | | Not found for C7 | **Unconfirmed** |

### A3. Central convenience [46] (BCM2)

| Item | Method | Byte / bit or channel | Value | Login | Sources | Confidence |
|---|---|---|---|---|---|---|
| Lock confirmation horn | Long coding | Byte 1 bit 2 "Anti-Theft-System: Horn Confirmation active" | 1 | None stated | G1 (C7); VC3 same byte and bit on A8 D3 (not MLB); needs factory alarm (VC3) | Medium |
| Double unlock chirp | Adaptation channel 63 | add 4 | | None stated | G1 | Low |
| Comfort windows / sunroof by remote | Long coding option "Comfort Operation: Remote Control active", then MMI Car > Vehicle settings > Central locking (open settings) | Byte and bit **not stated** in any source | 1 | None stated | R6 (label and MMI step, B8/8T/Q5), AW2 (C7, two owners, worked after MMI step) | Label **High**; byte/bit **Unconfirmed** |
| Comfort windows (alternative) | Adaptation channel 62 | 8738 to 48059 (hex 2222 to BBBB) | | None stated | AW1 (6CHICAGO, one post); R6 says channels 061 and 062 hold comfort open/close | Low |
| Auto-lock at 15 km/h | Long coding "Auto-Lock active" plus per-key adaptation channels 001 to 004 (+4) | Byte and bit not stated | | None stated | R6 (B8/8T/Q5) | Label Medium; byte **Unconfirmed** |
| Auto-unlock on key out | As above, +8 | | | | R6 | Label Medium; byte Unconfirmed |
| Selective (single door) unlock | As above, +1 | | | | R6 | Label Medium; byte Unconfirmed |
| Adaptive brake lights | Long coding | Byte 8 bits 0 and 1 | both 1 | None stated | G1 | Medium |
| Rear side marker LEDs | Adaptation channels 209 and 210 | 0 and 32 | | 16017 | G1 ("Record originals first") | Low |
| Remote boot close | 46 byte 2 bit 2, then 6D adaptation | | | 6D: 12345 | G1 | Low |

### A4. Door modules [42] / [52]

| Item | Method | Byte / bit | Value | Login | Sources | Confidence |
|---|---|---|---|---|---|---|
| Passenger mirror dip in reverse | 52 long coding | Byte 4 bit 2 | 1 | None stated | G1. AW3: on the C7 the tilt works from the factory with the mirror switch on the passenger side, stored in key memory. V1 A7 52 byte 4 = `5E`, bit 2 already set | Low (likely already active) |
| Mirror fold on lock | 42, 52 and 46 coding, "Comfort Mirror Folding active" byte 04 bit 6 | | | | VC1 search snippet only | Low |

### A5. Other modules (adaptation, login required)

| Item | Module | Channel | Value | Login | Sources | Confidence |
|---|---|---|---|---|---|---|
| Single gear display | 02 Auto Trans | "Single Gear Display" | "D on/S on" | None stated | AW1, G1 | Medium (adaptation DID unknown) |
| EPB applies on P | 53 Parking Brake | "Shift P to EPB" | "Activated" | 78713 | AW1 (djjuice, 20 Sep 2015: did not work on a 2016 A6), G1 | Low |
| Lane assist steering time menu | 8E | "Menu for time of assisted steering" | Activate | 20103 | G1 | Low |
| Heated seat level 3 timeout | 08 | "time until heated seat stage withdrawal from 3-2" | default 10 | None stated | G1 | Low |
| Park assist off speed | 10 | Channel 23 | 20 km/h | None stated | G1 | Low |
| ACC default distance | 13 | Channel 07 | 0 to 1 | None stated | G1 | Low |
| Steering angle sensor calibration (not a customisation) | 16 | Basic setting | | 40168 | R5 | High (do not offer) |

### A6. Security access on UDS ("login") and the write sequence

What public code does when writing VW UDS coding. Neither source is an MLB car.

| Step | Request | Purpose | U1 (OVMS, e-Up, 2021) | U3 (openpilot, MQB EPS) |
|---|---|---|---|---|
| 1 | `10 03` | Extended session | Yes (default "login" for ISO-TP modules) | Yes |
| 2 | `22 0600` | Read current coding (backup) | Yes, plus subsystem codings at other DIDs | Yes |
| 3 | `27 03` | Request seed | Only when a security code is supplied | Yes |
| 4 | `27 04 <key>` | Send key. **key = seed (4 bytes, big-endian) + login code (decimal)**, 32-bit | `parseInt(seed,16) + parseInt(code,10)` | `seed + 28183  # yeah, it's like that` |
| 5 | `2E F199 <YYMMDD>` | Programming date (BCD) | Yes, errors ignored ("optional (fail) on some ECUs") | Yes, "must be written before making a change, or write to CODING will fail with request sequence error" |
| 6 | `2E F198 <6 bytes>` | Workshop code (WSC) / tester number | Writes back the value read from `22 F1A5` | Writes back the value read from `22 F19A` |
| 7 | `2E 0600 <new coding>` | Write coding | Yes | Yes |
| 8 | `22 0600` | Read back and compare | Not in code | Yes |
| 9 | `10 01` | Default session | Yes ("logout") | Not shown |

Findings:

- The key formula seed + login code is in two independent public codebases (U1, U3). Medium for MLB: no MLB capture found.
- U2: "Most codings don't need a security code, so leave the field empty unless Write aborts with a security clearance error." No source states that 17, 09, 46 or 52 coding on the C7 needs a login. G1 and AW1 list logins only for adaptation.
- Login codes seen for C7 adaptation (all from forum or G1, Ross-Tech says the code "will appear in the form of a pop-up balloon" in VCDS): 09 = 20113 (G1; also a B9 list), 46 = 16017 (G1 only), 53 = 78713 (G1, AW1), 8E = 20103 (G1), 6D = 12345 (G1), 03 = 61378 (G1, "probably"), 16 = 40168 basic setting (R5, Ross-Tech). Confidence: R5 High; 78713 Medium; the rest Low.
- U3 writes F198/F199 before 0600 because the ECU otherwise refuses with request sequence error (NRC 0x24). U1 and U3 read the workshop code from different DIDs (F1A5 vs F19A). On the C7, read both and log which answers.
- U2: "ECUs will record all your write operations." The workshop code and date are stored in the module.
- **Adaptation channels** on UDS are DIDs, but no public source maps C7 channel names (for example "ESI: Resetting ESI") to DIDs. Every adaptation item above is therefore not implementable until the DID is captured from a VCDS or OBDeleven session on the owner's car.

### A7. Service interval reset (A6 C7)

| Method | Detail | Sources | Confidence |
|---|---|---|---|
| MMI (owner) | "CAR function button > Car systems control button > Servicing & checks > Service Interval displays > Reset oil change interval". Oil change only; inspection is reset by the dealer. "Do not reset the display between oil changes" | T1 (Audi of America, 2012 A6 owner's manual text) | **High** |
| OBD, oil service | Cluster [17] adaptation "ESI: Resetting ESI" = Reset; cycle ignition if the warning stays | R1, R7, T5; T2 uses "WIV/ESI: WIV/ESI zurücksetzen" | **High** for the method |
| OBD, inspection | [17] adaptation "FIX: Distance covered since last mileage-dependent inspection" = 0 and "FIX: Time since last time-dependent inspection" = 0 | R1, T3, T5 | **High** for the method |
| If cluster "uninitialized" | Write default WSC, importer and equipment numbers first | R1 | High |
| UDS DIDs for these channels on the C7 (`EV_RBD4K`) | **Not public.** vis4vag masks the IDE numbers (T2, T3) | | **Unconfirmed** |
| MQB channel numbers (not MLB) | Oil reset 8754 = "Reset"; inspection 8870 and 8871 = 0; oil quality 8776 (base not stated; if decimal, 8754 = 0x2232) | T4 | Low for the C7. Do not use on the A6 |

R6 (Ross-Tech): "Do not attempt to tweak individual adaptation channels unless you were instructed to do so by us". T2 and T3 also warn that both service events (oil and inspection) must be checked after a reset.

### A8. What Ross-Tech lists for the A6 4G (A4 of the brief)

- R2 module pages with content: [16] coding and security access (R5), [17] coding, adaptation, service reminder (R1), [53] basic setting, [55] coding and basic setting, [19] battery replacement adaptation, [09] (R3) and [46] (R4).
- R1, R3, R4 give no byte or bit tables. All three say coding is in the VCDS Long Coding Helper; R3 and R4 say adaptation channels are in a drop-down and "Security access codes will appear in the form of a pop-up balloon".
- R3 and R4 cover the A4 8K, A5 8T, Q5 8R and A6/A7/A8 4G/4H with BCM1 1.0/2.0 and BCM2 1.1/2.0, so the B8 tweak page (R6) is the closest official sibling list.

---

## B. Seat Leon II (1P, PQ35, 2007)

Protocol: Ross-Tech pages for the 1P show KWP-era adaptation channel numbers (001, 002, ...) and a 5-digit cluster short coding. For VW TP 2.0, E1 says the ELM327 "is not supported" and has raw CAN bugs. U1 (e-Up) opens TP 2.0 channels on 0x200 with logical addresses 09 = 0x20, 19 = 0x1F, 08 = 0x2C and sends `10 89` as login. TP 2.0 logical addresses for the Leon 1P cluster and 46: not found.

| Item | Module | Method | Byte / bit or channel | Value | Login | Sources | Confidence |
|---|---|---|---|---|---|---|---|
| Seat belt warning off | 17 | Short coding `00??x0x`, options +01 brake pad, +02 seat belt, +04 washer fluid | Subtract 2 from the options digits | S1: "By default it would be 02, but we need to change it to 00" | None for coding; 13861 for adaptation | R9, S1 | **High** |
| Service reminder reset | 17 | Adaptation channel 002 | 0 = Service NOT Due | 13861 ("Adaptation Enabling") | R9 | **High** |
| Service interval settings | 17 | Channels 040 to 049 (distance, time, oil quality 1 = fixed, 2 = LongLife) | | 13861 | R9 | High (do not offer by default) |
| Needle sweep | 17 | Not found for the 1P. Forum: availability "blocked internally in the cluster firmware" | | | | SeatCupra search snippet only | **Unconfirmed** |
| Coming home | 09 | Long coding byte 0 bit 7 | 1 | None | R10, S1 | **High** |
| Leaving home | 09 | Long coding byte 0 bit 5 | 1 | None | R10, S1 | **High** |
| Coming / leaving home time | 09 | Adaptation 001 / 002 | 10 to 60 s, steps of 10 | None stated | R10, S1 | **High** |
| Emergency brake flashing | 09 | Long coding byte 17 bit 0 | 1 | None | S1 ("not sure this features works") | Low |
| Comfort indicators (3 flashes) | 09 | S1 says "Byte 2 Bit 8" | | | Bit 8 does not exist (bits are 0 to 7) | Low, do not offer |
| Selective unlocking | 46 | Long coding byte 0 bit 0 (S1) or adaptation 003 (R11) | 0 / 1 | None stated | S1, R11 (sources use different methods) | Medium |
| Comfort windows via remote / key | 46 | Long coding byte 4: bit 0 open via door lock, bit 2 open via remote, bit 3 close via door lock, bit 5 close via remote | 1 | None | S1 ("on newer cars (MY07?) these features are already active"); R11 channel 017 "Comfort Function" must be 1 | Medium |
| Lock / unlock beep | 46 | S1: coding byte 6 bits 0 to 3 (unlock), byte 7 bits 0 to 3 (lock; bit 1 and bit 3 = horn). R11: adaptation 007, 008, 010, 011 with 0 off, 1 blink, 2 horn, 3 both | | None stated | S1, R11 (**disagree on method**; may depend on module version) | Medium |
| Auto-lock at 15 km/h | 46 | Adaptation 004 (R11); S1 says "Ch.0, 1=on 0=off" | 0 / 1 | None stated | R11, S1 (channel number differs) | Medium |
| Synchronised mirror adjustment | 46 | Long coding byte 9 bit 6 | | None | S1 | Medium |
| Steering weight | 44 | Adaptation 01 | 1 to 6 | None stated | S1 | Low |
| Parking sensor volume | 76 | Adaptation 01 | 0 to 100, default 60 | None stated | S1 | Low |

S1 caveat: "These are acording to my '2006 Sport', the controller module versions may differ in newer cars".

---

## C. Ford Focus Mk3 (about 2015) and Mazda6 GJ (2016)

### C1. Ford Focus Mk3

| Item | Module | Method | Block / parameter | Value | Sources | Confidence |
|---|---|---|---|---|---|---|
| Configuration type | BdyCM (BCMii) and IPC | **Central configuration** (CCC), not per-module as-built, on EU 2006-2013 MY Fords incl. "focus Mk3" | | | F1 (FORScan) | High for pre-facelift EU; 2015 facelift not stated |
| Auto-lock by speed | BCMii Central Configuration (main) | Engineering mode 1, block "02 – Automatic Locking", "Automatic locking by speed" | Old/new value not stated | F2 (UK Mk3 Focus and Mk7 Fiesta, needs FORScan licence, sets DTCs to clear) | Medium |
| Global close / double locking | BdyCM CCC | Item names "Global Close - Initial value", "Global Close Mode", "Double Lock Configuration" | | F5 (search snippet only, page blocked) | Low |
| Global windows open/close | BCM 726-17-01, 726-17-02, 726-30-01; DDM 740-05-01; PDM 741-05-01; IPC 720-02-01 | As-built | e.g. 726-17-01 `0000 0000 0045` to `0101 0101 014A` | F3, copied from a 2017 US Super Duty sheet, "may NOT be compatible with the 2017 Focus ST" | Low, do not offer |
| Seat belt chime | IPC 720-01-01 | As-built | `xxxx xx6x xxxx` to `xx2x` (driver) | F3 (Super Duty values) | Low, do not offer |
| DRL | BCM 726-45-01 / 726-50-01 | As-built | DRL mask | F3 (Super Duty values) | Low, do not offer |
| Service reset | | US Focus manuals describe a cluster method; EU 2015 procedure not read | | | Unconfirmed |

Service 3B vs 2E for as-built or CCC writes: **no public source found**. No public source maps FORScan block names (726-xx-yy) to UDS DIDs. F1: As-Built lines carry "a special checksum field that is calculated by special algorithm"; the algorithm is not published. F4: a CC attempt caused "a no-start condition with an error displayed of "Invalid Data"" on a 2014 US Fiesta. Bus: `uds-sources.md` notes many Ford modules sit on MS CAN (pins 3 and 11), which a standard ELM327 on pins 6/14 does not reach.

### C2. Mazda6 GJ

No public FORScan as-built or configuration change for the Mazda6 GJ was found. Results for "Mazda" were Ford truck values or other Mazda models.

| Item | Method | Detail | Sources | Confidence |
|---|---|---|---|---|
| Auto lock/unlock modes, unlock once/twice, relock time, answer-back beep volume, interior light timers, DRL on/off, auto headlight off time, coming/leaving home, three-flash indicator, lane departure and SCBS settings | Centre display Settings (no OBD) | "Personalization features which can be changed differ depending on the market and specification" | M1 (US 2016) | High (US); EU list not read |
| Oil change reset, petrol, Type A audio | Hold selector, ignition on, hold over 5 s, master warning light flashes | | M1 | High (US petrol) |
| Engine oil data reset, SKYACTIV-D 2.2 | Ignition off; ignition on with the instrument illumination knob pressed; hold about 5 s until the master warning light flashes | | M2 (official, CX-5 with the same engine) | Medium for the Mazda6 |
| Engine oil data reset, diesel, alternative | Tripmeter switch method; M-MDS "Powertrain > Data Reset > Engine oil"; test terminal plus 5 accelerator presses (can set P1905:00) | | M3 (unofficial mirror) | Low |
| Oil data reset over OBD | M-MDS routine on the PCM; DID or routine ID not public | | M3 | Unconfirmed |

---

## D. Counts

| Car | High | Medium | Low | Notes |
|---|---|---|---|---|
| Audi A6 C7 | 2 coding (needle sweep, lap timer) + 2 service reset methods (oil, inspection) + MMI reset | 15 (cluster TPMS bit, seat belt location, 10 x 09 items, 46 horn and adaptive brake lights, single gear display) | 16 | Comfort windows, auto-lock and seat belt "inactive" have labels but no public byte/bit or value |
| Seat Leon 1P | 5 (seat belt short coding, service reset ch 002, coming home, leaving home, home light time) | 5 (selective unlock, comfort windows, lock beep, auto-lock, mirror sync) | 4 | Lock beep method disagrees between S1 and Ross-Tech |
| Ford Focus Mk3 | 0 | 1 (auto-lock by speed, CCC) | 4 | Byte-level CCC map not public |
| Mazda6 GJ | 0 over OBD (owner-menu items High) | 0 | 0 | No public OBD coding found |

---

## E. Red flags

1. **Adaptation needs DIDs that are not public for MLB.** Only long coding items (22/2E 0600, bit flips) are implementable now. Every adaptation item (ESI reset, FIX counters, comfort windows ch 62, DRL brightness, login-protected channels) needs the DID captured from the owner's car first.
2. **Seat belt warning is a 3-bit field**, not a bit. The value for "inactive" is not public. Writing a guessed value changes a safety warning.
3. **G1 is a single anonymous source** for most C7 bytes. Treat as Medium at best and verify each against the read coding (for example, show the current bit before offering the change).
4. **Write order:** two codebases write F199 (date) and F198 (workshop code) before 0600; skipping them gives a request sequence error on MQB. The module stores the workshop code and date. Decide what WSC the app writes (copy the existing one, as U1 and U3 do).
5. **Security key formula** (seed + login) is proven only on e-Up and MQB EPS. Wrong keys may lock the module for a period (vis4vag notes "turn-off the ignition for X minutes and repeat the operation"). Limit to one attempt per ignition cycle.
6. **09 and 46 have subsystems** (V1); U1 writes subsystem codings at other DIDs. A "byte 10 submodule 0" item (G1) is not in DID 0600.
7. **C7 mirror dip** is already a factory memory feature (AW3); V1 shows the bit set. Do not offer.
8. **S1 "Byte 2 Bit 8"** is impossible; the comfort indicator entry is wrong as written.
9. **Leon 1P is KWP over TP 2.0**; the ELM327 is a poor fit (E1). Coding writes on KWP use different services; none was sourced here.
10. **Ford**: Focus Mk3 uses central configuration with a checksum and engineering-mode access; Super Duty spreadsheets are not valid for the Focus; no public DID map; MS CAN may be out of reach.
11. **Mazda**: no public coding source; offer the owner-menu settings and the manual's oil reset steps as guidance only.
12. **Correction for `uds-sources.md`**: U1 (`xvu-ecu.js`, e-Up) lists 44 Steering Assist at 712 / **77C**, which disagrees with the 712 / 71A row taken from S3 (`vweup_obd.h`) in that note.
