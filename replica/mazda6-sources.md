# Caristini: Mazda6 sources

Research note, 11 Nov 2026. Same confidence key as `uds-sources.md` (High, Medium, Low, Unconfirmed). Every command below has a source key; the source table gives the URL.

**Scope.** The owner confirmed the car is a **2016 Mazda6 GJ 2.2 Skyactiv-D (UK)**, engine family SH-VPTS. Variant B is the main subject. Variant A (Mazda6 MPS GG 2005-2007) was dropped on the owner's confirmation; see section 9 for the little that was found.

**UK GJ facts that matter.** "GJ" is 2012-2015 and "GL" is the 2016-on refresh of GJ (Z13). A 2016 car may be either; the module list below comes from the GJ workshop manual and covers both "SKYACTIV-D 2.2 (MTX)" and "(ATX)" pages. A manual car has no TCM.

Already in the repo: `uds-sources.md` section 2 (Mazda pairs, response = request + 8) and `src/obd/modules.ts`.

---

## Sources

| Key | Source | URL | Notes |
|---|---|---|---|
| Z1 | Mazda6 workshop manual mirror, "MULTIPLEX COMMUNICATION SYSTEM" | https://mazda6.neocities.org/esicont/srvc/html/id100000001400.html | Unofficial mirror of Mazda ESI for the GJ. Module-to-bus list, terminating resistors |
| Z2 | Same mirror, "CONTROLLER AREA NETWORK (CAN) MALFUNCTION DIAGNOSIS FLOW [SKYACTIV-G 2.0/2.5, SKYACTIV-D 2.2 (MTX) (L.H.D.)]" | https://mazda6.neocities.org/esicont/srvc/html/id100238000100 | DLC-2 terminals for HS-CAN and MS-CAN |
| Z2b | Same mirror, CAN diagnosis flow SKYACTIV-D 2.2 (ATX) (R.H.D.) | https://mazda6.neocities.org/esicont/srvc/html/id100241000100 | R.H.D. (UK) variant of Z2 |
| Z3 | Same mirror, "PCM INSPECTION [SKYACTIV-D 2.2]" PID/data monitor table | https://mazda6.neocities.org/esicont/srvc/html/id0140z7802500.html | M-MDS PID names and units only; no hex IDs |
| Z4 | Same mirror, "ENGINE OIL DATA RESET [SKYACTIV-D 2.2]" | https://mazda6.neocities.org/esicont/srvc/html/id0140z7444700 | Oil data reset methods |
| Z5 | OBDb Mazda-3 signalset and test captures (CC-BY-SA-4.0) | https://github.com/OBDb/Mazda-3/blob/main/signalsets/v3/default.json | DPF DIDs filtered to model years 2014-2016 (BM Mazda3; diesel DIDs imply a 2.2 Skyactiv-D car). Captures in `tests/test_cases/2014/commands/` |
| Z6 | OBDb Mazda-6 signalset and test captures | https://github.com/OBDb/Mazda-6/blob/main/signalsets/v3/default.json | Captures for 2014, 2016, 2017, 2019, 2020 (engine not stated; US data is petrol) |
| Z7 | OBDb Mazda-CX-5 signalset | https://github.com/OBDb/Mazda-CX-5/blob/main/signalsets/v3/default.json | Same DIDs as Z6 for most items |
| Z8 | mazda-si.net "Torque PRO seznam dodatnih PID-ov" (Aless, 8 Nov 2018; Mda, 9 Nov 2018 with a Mazda3 2.2d 2010; Aless 19 Jul 2021) | https://www.mazda-si.net/topic/15024-torque-pro-seznam-dodatnih-pid-ov/ | Torque custom PIDs. Poster's own car and engine not stated in the list post |
| Z9 | opendbc Mazda `values.py` (`FW_QUERY_CONFIG`) and `fingerprints.py` (CAR.MAZDA_6) | https://github.com/commaai/opendbc/blob/master/opendbc/car/mazda/values.py , https://github.com/commaai/opendbc/blob/master/opendbc/car/mazda/fingerprints.py | Queries `22 F188`; module IDs 7E0, 7E1, 730, 760, 764, 706 for "Mazda 6 2017-20" |
| Z10 | FORScan forum "SkyActiv Mazda ASBuilt Configurations" (SNapEl, 6 Apr 2017; replies to 2020) | https://forum.forscan.org/viewtopic.php?t=3379 | Bit meanings for 731, 7B7, 720; replies from a "mazda 6 2.2 skyactive diesel 175 pk 2013" owner; Mazda as-built XML of a Mazda3 BM 2.2D (VIN JMZBM6426...) |
| Z11 | miatafy.com "FORScan Mod List for Mazda" (ND MX-5, CX-5 KE/KF, Mazda3 BM/BN; Mazda6 not covered) | https://miatafy.com/forscan/complete-mod-list/ | Third-party guide |
| Z12 | mazdas247 "i-ELOOP missing from fuel economy monitor + Forscan queries" (8-23 Feb 2026; OP 2017 Mazda6 2.5 Wagon, Malaysia) | https://mazdas247.com/forum/goto/post?id=6834831 | 720 block 4 checksum line; SSU 731-01-01 i-stop example |
| Z13 | Wikipedia, Mazda6 (third generation) | https://en.wikipedia.org/wiki/Mazda6_(third_generation) | GJ 2012-2015, GL 2016 refresh |
| Z14 | FORScan forum, "How to access MS CAN bus using FORScanV2 and modified ELM327", 15 Jun 2014 | https://forum.forscan.org/viewtopic.php?p=4 | MS-CAN pins 3/11; stock ELM327 is HS-CAN only; STN11xx has MS-CAN support |
| Z15 | Mazda owner's manual, "Diesel Particulate Filter" (SKYACTIV-D 2.2; CX-5 edition, same engine) | https://owners-manual.mazda.com/gen/en/cx-5/cx-5_8ft1ee17b/contents/05160100.html | Driving regeneration |
| Z16 | FORScan forum "Mazda CX-5 2.2 SkyActiv-D - DPF filling fast" (2018-2020) | https://forum.forscan.org/viewtopic.php?p=55901 , https://forum.forscan.org/viewtopic.php?t=4974&start=10 | Owners use PM_ACC, PM_ACC_DSD, PM_GEN; dealer-tool path for static regeneration |
| Z17 | Carista blog "Carista vs FORScan" | https://carista.com/blogs/news/carista-vs-forscan-which-obd2-scanner-is-actually-worth-it-1 | Vendor claim of MS-CAN support (Carista EVO) |
| Z18 | GitHub gist muresan, Car Scanner DTC report, "Mazda 6", VIN JMZGJ621691000000, 24 Jul 2023 | https://gist.github.com/muresan/c5510980304babaaee7f95a623ba324b | 3-byte DTCs with UDS status text from a Mazda PCM (model year 2009 by VIN, so not a GJ) |
| Z19 | Ford 2014 Fiesta service manual 418-00 (mirror) | https://vnx.su/content/avto/ford/fiesta-2014/Resources/Service_Manual/serg1600204.htm | Ford MS-CAN 125 kbit/s, HS-CAN 500 kbit/s (Ford, not Mazda) |
| U1 | `uds-sources.md` in this repo | `replica/uds-sources.md` | F5 (opendbc rx_offset 0x8), S17 (19 02 layout), S22 (ELM327 datasheet) |

---

## 1. Modules, buses and request IDs (variant B: 2016 Mazda6 GJ/GL 2.2 Skyactiv-D, UK)

### 1.1 Which bus each module is on (Z1)

Z1 is Mazda's own description for the GJ. Many items are fitted to some specs only.

- **HS-CAN:** PCM, DSC HU/CM (ABS), radar unit (with smart brake support), TCM (ATX), front body control module (FBCM), AFS / auto levelling module, DC-DC converter (i-ELOOP), 4WD control module, position memory module, electric parking brake (EPB), audio amplifier (Bose), forward sensing camera (FSC), EPS control module, ERA-GLONASS module, start stop unit (SSU), connectivity master unit (CMU), SAS control module, instrument cluster.
- **MS-CAN:** instrument cluster (on both buses), parking assist unit, climate control unit, rear body control module (RBCM), rear mount camera, blind spot monitoring (BSM) LH.
- **Local CAN (not on the DLC):** PCM to TCM; CMU, CD player and TAU; audio unit and Bluetooth unit; BSM LH to BSM RH.
- **ISO line (not CAN):** RBCM to SSU, RBCM to power window main switch.
- "SAS control module" is Mazda's name for the airbag (sophisticated air bag sensor) module. This expansion is general Mazda usage, not stated on Z1. Confidence that SAS = airbag: Medium.
- Bus speeds: Z1 gives none. Ford states MS-CAN 125 kbit/s and HS-CAN 500 kbit/s (Z19); a Toyota document uses 250 kbit/s for its MS-CAN. **Mazda MS-CAN speed: not publicly confirmed.**

**Disagreement:** Z11 (MX-5/CX-5/Mazda3 guide) says every module it lists, including IC 720, FBCM 726 and SSU 731, is on MS-CAN. Z1 (Mazda, GJ) puts IC, FBCM and SSU on HS-CAN. For the GJ, Z1 is the primary source. OBDb captures support Z1: a 2014 Mazda3 answered on 720, 726, 760 and 793 (Z5 `tests/test_cases/2014/command_support.yaml`), and a 2014 Mazda6 answered `22 DD01` on 720 (Z6). The adapter OBDb used is not stated.

### 1.2 DLC terminals

- Z2: HS-CAN on DLC-2 terminals F (CAN_H) and E (CAN_L); MS-CAN on terminals L (CAN_H) and K (CAN_L). Z2 measures MS-CAN at the DLC-2, so MS-CAN is wired to the socket.
- The letter-to-SAE-pin mapping is not in the Z2 text. FORScan (Z14) gives MS-CAN = pins 3 and 11, HS-CAN = pins 6 and 14 for Ford and Mazda in general. Confidence that the GJ uses 3/11 for MS-CAN: Medium (Z2 shows MS-CAN at the DLC; Z14 gives the pin numbers but is not GJ-specific).

### 1.3 Module table

Response = request + 8 in every Mazda source (U1 F5, Z9). Protocol column: "UDS" means the module answers ISO 14229 services (22 read DID) in a public source. No source shows KWP2000-on-CAN or a proprietary protocol for any GJ module; OBDb also lists a few `21 xx` (KWP-style local identifier) reads on 7E0 (Z6), engine not stated.

| Module | Request | Response | Bus (Z1) | Protocol evidence | ID source | Confidence (ID on this car) |
|---|---|---|---|---|---|---|
| PCM (engine) | 7E0 | 7E8 | HS | UDS `22 F188` (Z9); Mode 22 DIDs with captures (Z5, Z6); `F188 = SH12-188K2-E` on a Mazda3 2.2D PCM (Z10 XML) | Z9, Z5, Z6, Z8 | High |
| TCM (ATX only) | 7E1 | 7E9 | HS (and local CAN to PCM) | UDS `22 F188` (Z9); `22 1E1C` capture on a 2016 Mazda6 (Z6) | Z9, Z6 | High (absent on manual cars) |
| DSC HU/CM (ABS) | 760 | 768 | HS | UDS `22 F188` (Z9); `22 2B06` etc. captures, 2007 Mazda6 and 2014 Mazda3 (Z6, Z5) | Z9, Z5 | High |
| EPS | 730 | 738 | HS | UDS `22 F188` (Z9) | Z9 ("Mazda 6 2017-20") | Medium (no 2016 GJ source) |
| Instrument cluster (IC) | 720 | 728 | HS and MS | `22 DD01` capture on a 2014 Mazda6 (Z6); `22 2A05` on a 2016 Mazda6 (Z6) | Z6, Z10, Z11 | High |
| Front body control (FBCM) | 726 | 72E | HS | `22 402A` etc. on a 2014 Mazda3 (Z5); Mazda XML block `726-01-01` on a Mazda3 2.2D (Z10) | Z5, Z10, Z11 | Medium (Mazda3 and CX-5 sources; not a GJ capture) |
| Start stop unit (SSU) | 731 | 739 | HS | As-built `731-01-01` on a 2013/2014 Mazda6 2.2D (Z10 reply, kevini92) | Z10, Z11 | Medium |
| Airbag (SAS / RCM) | 737 | 73F | HS (as "SAS control module") | Mazda XML block `737-01-01` on a Mazda3 2.2D (Z10); Ford RCM is 737 (uds-sources F1) | Z10 | Low |
| Radar (SBS / MRCC) | 764 | 76C | HS | `22 F188` (Z9) | Z9 (2017-20) | Low for a 2016 car |
| Radar / cruise target (older unit) | 793 | 79B | not stated | `22 D901` "distance from bumper to target", captures 2014 Mazda3 and 2016 Mazda6 (Z5, Z6) | Z5, Z6 | Low. Disagrees with 764 above; fitted cars only |
| Forward sensing camera (FSC) | 706 | 70E | HS | `22 F188` (Z9) | Z9 (2017-20) | Low for a 2016 car |
| 4WD control | 761 | 769 | HS | `22 1E7A` coupling solenoid (Z6, no capture) | Z6 | Low; UK 2016 diesel availability not checked |
| Rear body control (RBCM) | 7B7 | 7BF | **MS** | As-built `7B7-01-0x` (Z10, Z11) | Z10, Z11 | Medium for the ID; **not reachable on pins 6/14** |
| EPB, AFS/levelling, DC-DC (i-ELOOP), CMU, audio amp, position memory, ERA-GLONASS | not found | | HS | | | Unconfirmed |
| Climate control, parking assist, rear camera, BSM | not found | | MS | | | Unconfirmed |

### 1.4 Reachable with a standard pins-6/14 adapter

From Z1 + Z14: PCM, TCM, ABS, EPS, IC, FBCM, SSU, airbag, radar, camera, 4WD, EPB, AFS, DC-DC, CMU, amplifier (the HS-CAN list). **Not reachable:** RBCM, climate control, parking assist, rear camera, BSM (MS-CAN only). The IC is on both buses; no source says it routes diagnostic requests from HS to MS (Z2 does not mention a gateway). **Whether the IC gateways diagnostics to MS-CAN: not publicly known.**

---

## 2. Identification DIDs

| Request | Meaning | Modules | Source | Confidence |
|---|---|---|---|---|
| `22 F188` | Vehicle manufacturer ECU software number. Reply is ASCII like `PYH7-188K2-E` then 0x00 padding; opendbc regex `[A-Z0-9-]{11,16}\x00{8,13}` | 7E0, 7E1, 730, 760, 764, 706 | Z9 | High |
| `22 F188` on the diesel PCM | Example value `SH12-188K2-E` (Mazda3 2.2D, Mazda's own as-built XML `<F188>`) | 7E0 | Z10 | Medium |
| `22 F111`, `22 F112`, `22 F113` | Mazda XML for the same PCM lists `F111 = SH12-188K1-`, `F112 = SH12-18881-E`, `F113 = SH12-18881-A`. That these XML tags are DIDs is my inference from the F188 tag matching Z9; their names are not given | 7E0 | Z10 | Low |
| `09 02` (OBD service 09) | VIN | 7E0 (or 7DF) | SAE J1979 / ISO 15765-4 standard; required for EOBD | High (standard), not captured on a GJ |
| `22 F190`, `22 F18C`, `22 F187`, `22 F191` | VIN, serial, part number, hardware number | any | No Mazda source found | Unconfirmed |

Parse F188 as ASCII and stop at the first 0x00 (Z9 regex). The owner's PCM should start "SH" for the SH-VPTS engine (from the Z10 example); not verified on his car.

---

## 3. Faults: read and clear

| Request | Use | Source | Confidence |
|---|---|---|---|
| `03`, `07`, `0A` (OBD) on 7DF/7E0 | Emission DTCs, PCM only | OBD standard | High |
| `19 02 <mask>` | Read DTCs by status, any UDS module | Layout: U1 S17. Mazda DTCs are 3 bytes with a failure-type byte (workshop manual writes them as `P2458:00`, `U0100:00`). A Car Scanner report from a Mazda PCM shows 3-byte codes with UDS status text (Z18) | Medium (no raw Mazda `59 02` capture found) |
| Mask choice | Z18 shows many codes whose only status is "Test not completed during this operation cycle". Use mask `0x08` (confirmed) or `0x2F` and hide records whose only bits are 4 or 6 | Z18, U1 S17 | Medium |
| `04` (OBD) | Clear emission DTCs on PCM | OBD standard | High |
| `14 FF FF FF` | Clear all DTCs, UDS modules | U1 S17 for the format. **No Mazda capture of the positive reply `54` found** | Low |
| `10 03` before 14 | Whether Mazda modules need the extended session | not found | Unconfirmed |

---

## 4. Maker live data (Mode 22) for the 2.2 Skyactiv-D PCM (7E0/7E8)

Byte names: A is the first data byte after `62 DID DID`. Formulas are as written by each source. Z3 confirms the parameter exists on this engine (M-MDS name) but gives no hex.

| Value | Request | Formula and unit | Source | Confidence |
|---|---|---|---|---|
| DPF soot load (PM_ACC) | `22 042C` | Z5: (A*256+B) * 100 / 65535 g/l. Z8: (A*256+B) / 628 g/l. Same DID; scale differs by about 4%. Z5 capture `62 04 2C 01 A9` = 0.649 g/l (Z8 formula gives 0.677) | Z5 (capture, filter 2014-2016), Z8; name in Z3 | Medium (DID); Low (exact scale) |
| PM accumulation desired (PM_ACC_DSD) | `22 044B` | Z5: (A*256+B) * 100 / 65535 g/l. **Z8 main list says `22 042B`, a later Z8 reply says `22 044B`.** | Z5 (capture), Z8 | Medium for 044B |
| PM generated (PM_GEN) | `22 042D` | Z5: (A*256+B) * 100 / 65535 g/l. Z8: /628. Z8 also uses 042D for "DPF load %" as PM/10 g/l * 100 (Z8's own scaling) | Z5 (capture), Z8 | Medium |
| DPF regeneration active | `22 0380` | A (0 = off, 1 = on per Z8). Z5 capture: `62 03 80 00 00 00 00` decodes 0 | Z5, Z8 | Medium |
| DPF regeneration count | `22 0432` | A*256+B. Z5 capture `62 04 32 00 82` = 130 | Z5, Z8 (header 7E0) | Medium |
| DPF lamp count | `22 0433` | A*256+B | Z5 (capture) | Medium (one source) |
| Distance since last regeneration (REG_DIS) | `22 0434` | Reply has 4 data bytes. Z5: bytes B,C,D as 24-bit * 100 / 65535 km. Z8: (B*65536 + C*256 + D) / 640 km (Z8 writes `B<16` meaning shift). Z5 capture `62 04 34 00 00 0F 94` = 6.09 km (Z8 gives 6.23 km) | Z5, Z8 | Medium (DID); Low (scale) |
| DPF differential pressure | `22 F47A` | signed(B*256+C) / 100 kPa | Z8 (header 7E0), Z5 (filter 2019+, so later engine) | Medium |
| Oil dilution | `22 0435` | Z5/Z6/Z7: A = "oil dilution events" (count). Z3's OIL_DIL is an amount in kg. **Whether 0435 is the kg amount or a count: not known** | Z5 (capture, 0), Z6, Z7 | Low |
| Engine oil temperature | `22 1310` | (A*256+B) / 100 - 40 deg C. Captures on 2014-2017 Mazda6 (Z6, for example `62 13 10 33 00` = 90.56); a 2014 Mazda3 that also answers the DPF DIDs answers `22 1310` via 7DF (Z5 command_support) | Z5, Z6, Z7 | Medium |
| Engine oil temperature (alt) | `22 F45C` / `01 5C` | A - 40 deg C | Z6, Z7; OBD standard for 015C | Low (no diesel capture) |
| Intake manifold pressure, measured and desired | `22 F470` | Desired = (B*256+C)/32 kPa; measured = (D*256+E)/32 kPa (absolute) | Z8 (header 7E0), Z6/Z7 (same bytes) | Medium. Boost = measured minus barometric (`01 33`) |
| Desired boost | `22 1305` | (A*256+B) / 6400 bar | Z8, Z5, Z6 | Medium |
| VGT position | `22 03DF` | (A*256+B) * 100 / 65535 % | Z5, Z6 (filter 2014+) | Low |
| EGR position | `22 03FB` | Z6: A * 100 / 255 %. **Z8 lists 03FB twice: as VGT % 16-bit and as EGR % 8-bit.** | Z6, Z8 | Low (disagree) |
| Odometer (PCM) | `22 DD01` on 7E0 | A*65536 + B*256 + C km. Captures 2014-2020 Mazda6 (Z6, for example `62 DD 01 02 F3 F3` = 193523) | Z6, Z7, Z5, Z8 (2021, header 7E0) | High |
| Odometer (cluster) | `22 DD01` on 720 | same formula; same value as 7E0 in the Z6 capture | Z6 | High |
| Distance since oil change | `22 0519` | (A*256+B) * 4 km | Z5 (filter 2014-2016), Z6, Z7 | Low |
| Oil life remaining | `22 054B` | A % | Z5, Z6, Z7 (no filter, no capture seen) | Low |
| 12 V battery voltage (FBCM) | `22 402A` on 726 | (A*256+B) / 1000 V | Z5 (2014 Mazda3 answered), Z6, Z7 | Medium |
| Injector corrections INJ1_CMP to INJ4_CMP, FI_LRN_xx | not found | Z3 gives names and units (mm3/stroke, us) only | Z3 | Unconfirmed |
| Oil dilution amount in kg (OIL_DIL), DPF_LMP | not found | names in Z3 | Z3 | Unconfirmed |

Note on Z5 formulas: OBDb "expected values" are computed from OBDb's own formula, so the captures confirm the DID and byte layout, not the scale. Z8 posters are Torque users with no stated method. The 2010 Mazda3 2.2d in Z8 has the older MZR-CD engine, not Skyactiv-D.

---

## 5. Customisations (as-built)

### 5.1 Format and checksum

- FORScan line format: `MMM-BB-LL` (module request ID, block, line), then data bytes, last byte is a checksum (Z10, Z11).
- Checksum: low byte of the sum of the module ID high and low bytes, block, line and all data bytes. I derived this and it matches five public lines: `731-01-01 1014 E024 20|82` and its edit `...|72` (Z10), `7B7-01-03 0018 5400 |2E` and `0018 9000 |6A` (Z10), `720-04-01 2CE7 0100 FF|3F` (Z10, Mazda2), `731-01-01 B814 C684 E1|31` and `B804 C684 E1|21` (Z12). Confidence: Medium (derived, not stated by any source).
- Block 4 of the IC has an extra checksum in `720-04-01` B0:B1 that must be recalculated when any block-4 line changes (Z10, Z12). Algorithm not public; Z12 used a spreadsheet ("SergSlim"). Block 3 is read-only (Z12).
- **How FORScan reads and writes these lines on the bus (service, DID or routine numbers, security access): not publicly known.** No source gives the wire commands. The app cannot implement customisation until a capture from FORScan on this car (or a public source) shows them.

### 5.2 Known bits (only HS-CAN modules are reachable)

| Feature | Line, byte, bit | Tested on | Source | Confidence for a 2016 GJ |
|---|---|---|---|---|
| i-stop default off (SSU) | `731-01-01` B1 bit 4: 1 = on, 0 = off | CX-5 (Z10); 2013/2014 Mazda6 2.2D owner's line `1014 E024 2082`, reply suggests `1004 E024 2072` (untested reply); Z12 reports success on an unstated car (Feb 2026) | Z10, Z11, Z12 | Medium |
| i-stop button and logo (IC) | `720-01-01` B2 bit 4 | not stated | Z10 | Low |
| Digital cruise speed on IC | `720-01-02` B1 bit 7 (Z10: 0 = shown; Z11: set 1) | Z11: ND only | Z10, Z11 (**disagree on polarity**) | Low |
| Cruise type (IC block 4) | `720-04-23` B4 b6 LIM, b5 standard/MRCC, b4 none; then fix `720-04-01` | Mazda2 2019 (Z10 reply) | Z10, Z11 | Low |
| Headlight levelling / AFS flags (IC block 4) | `720-04-14` B1 b5, b4 | not stated | Z10 | Low |
| Rear camera guide lines (IC block 4) | `720-04-27` B2 bit 3 | ND (Z11) | Z10, Z11 | Low |
| i-ELOOP display (IC block 4) | `720-04-25`, then `720-04-01` | 2017 Mazda6 2.5 (Z12) | Z12 (bit not given) | Unconfirmed bit |
| DRL options (FBCM) | `726-50-01` values; `726-01-01` B0 bit 2 | ND, CX-5, Mazda3 | Z11 | Low |
| Emergency stop signal (FBCM) | `726-01-02` B0 b1, B1 b0, B3 b1 all = 1 | ND, CX-5, Mazda3 | Z11 | Low |
| RBCM items (auto lock `7B7-01-01` B1 b7; Find My Car `7B7-01-02` B0 b6; coming home `7B7-01-03` B1 b5; rain/auto lights `7B7-01-03 0018 5400 2E` to `0018 9000 6A`) | as listed | CX-5 (Z10); 2017 Mazda6 2.2G reported DTCs after auto-lock and Find My Car edits (Z10 reply, Aug 2019) | Z10, Z11 | Low, and **MS-CAN only** |

Z11: do not change PCM, ABS, airbag or EPS lines. Z10 and Z11 both say values vary by year, trim and region; read and back up first.

---

## 6. Service functions

| Function | Method | Source | Confidence |
|---|---|---|---|
| Engine oil data reset (clears oil replacement calculation and oil dilution amount) | M-MDS: Powertrain > Data Reset > Engine oil | Z4 | High (as a dealer-tool path) |
| Same, no tool, oil warning light **not** on | Ignition off; hold the tripmeter switch; ignition on (engine off); hold more than 5 s; master warning light flashes = done | Z4 | High (Mazda manual mirror) |
| Same, no tool, oil warning light on | Ignition on; jumper the DLC test terminal to body ground; press the accelerator fully 5 times within 5 s; glow lamp flashes 5 times = done; remove jumper (may set P1905:00, clears when removed). Test terminal position is only in a figure | Z4 | Medium (terminal not identified in text) |
| Oil reset over UDS (`31 01 ...` or `2E ...`) | not found | | Unconfirmed |
| DPF regeneration, owner method | Warm up (coolant 80 deg C or more), drive at 20 km/h or more for about 15-20 minutes when the DPF light is steady; a flashing light needs a repairer | Z15 | High (owner's manual, CX-5 edition of the same engine) |
| DPF static (forced) regeneration | Dealer tool path quoted as Powertrain > service functions > PCM > DPF static regeneration; check DPF DTCs first | Z16 | Medium (as a path) |
| DPF regeneration over UDS (`31 01 xx xx`) | not found | | Unconfirmed |
| Injector amount correction | M-MDS "Injector Amount Correction" (mazda3.neocities.org page found in search, not read in full) | search result only | Unconfirmed bytes |

---

## 7. Can the Carista adapter reach MS-CAN?

- An unmodified ELM327 supports HS-CAN only; MS-CAN needs a switch-modified ELM327 or an STN11xx chip (OBDLink EX, MX, MX+, ELS27) (Z14). Confidence: High for genuine and clone ELM327 chips.
- Carista's blog says Carista supports Ford HS-CAN and MS-CAN and names Carista EVO with 30+ brands including Mazda (Z17). This is a vendor claim about the EVO; **no public source says whether the older Carista BLE adapter (reports "ELM327 v1.5") has pins 3/11 wired or a bus switch.**
- No AT command to move an ELM327 to pins 3/11 exists in the ELM327 datasheet (U1 S22). Test on the car: send `AT SH 7B7`, `22 F188`; no reply means RBCM is out of reach. A reply would mean the adapter has its own switching (not expected).
- Practical result: with this adapter, plan for HS-CAN modules only.

---

## 8. Red flags

1. Z1 is an unofficial mirror of Mazda's manual. It is the only source for which GJ modules are on which bus.
2. All Mode 22 formulas are community-sourced; Z5 and Z8 agree on DIDs but disagree on DPF scales by about 2-4%.
3. Most module IDs beyond 7E0/7E1/760/720 come from Mazda3, CX-5 or MX-5 sources, or from 2017-on Mazda6 (Z9). No public scan of a 2016 UK GJ diesel was found.
4. As-built wire protocol is not public, so the app cannot write any customisation yet.
5. RBCM (locks, Find My Car, coming home, windows) is MS-CAN only.
6. Z18 shows Mazda PCMs return codes whose only status is "test not completed"; a 0xFF mask would show them as faults.

---

## 9. Variant A (Mazda6 MPS GG 2005-2007): dropped

Dropped after the owner confirmed the car. Found before the drop, not researched further:

- OBDb Mazda-6 `generations.yaml` describes the first generation (GG/GY, 2003-2008) and the Mazdaspeed6 (2006-2007 in North America) with a turbocharged 2.3 direct-injection engine and AWD (https://github.com/OBDb/Mazda-6/blob/main/generations.yaml).
- OBDb has 2005, 2007 and 2008 Mazda6 captures, including `22 2B06`-`2B11` on 760 and `22 C150` on 726 for 2007 (Z6 `tests/test_cases/2007/`). Engine not stated.
- FORScan says Ford and Mazda models from about 2003-2004 have MS-CAN (Z14). A FORScan thread "Mazda 6 gg not all modules" exists (https://forum.forscan.org/viewtopic.php?t=13055), not read.
- Nothing else is recorded here; treat every GG item as Unconfirmed.
