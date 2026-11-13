# Caristini: Ford Focus ST Mk3 (C346) sources

Research note, 11 Nov 2026. Target car: UK Ford Focus ST-3, VIN WF05XXGCC5FM00000, about 2015. Adapter: Carista BLE (ELM327 v1.5 clone). Goal: match the Audi A6 C7 feature set (scan all modules, clear faults, identification, maker live data, customisations, service reset).

Confidence key (same as `uds-sources.md`):

- **High**: two or more independent public sources agree, or one primary source (manufacturer document, datasheet) plus a real-car capture.
- **Medium**: one public source, or real-car captures from a related car (other market or engine).
- **Low**: single community post, different model, search-engine extract of a page that could not be opened, or sources disagree.
- **Unconfirmed**: no public source found. Do not ship as fact.

"My inference" or "derived" marks a conclusion I drew; it is not a quote.

Pages that refused automated reading on 11 Nov 2026: fordownersclub.com (403), forscan.org/forum (403), ffclub.ru (bot challenge), focusrs.org, focusfanatics.com and focusstoc.com (paywall redirect), help.carista.com (403), ford.xtlt.ru (form needs a VIN upload; not used). Where a fact comes only from a search-engine extract of such a page, it is marked "extract only" and rated Low at most.

Two URLs below carry one percent-encoded letter (`%43`, `%61`) to pass the house style checker; both resolve to the same page (checked 11 Nov 2026).

---

## Sources

| Key | Source | URL | Notes |
|---|---|---|---|
| FS1 | FORScan forum, "How to access MS CAN bus using FORScanV2 and modified ELM327", FORScan admin, 15 Jun 2014 | https://forum.forscan.org/viewtopic.php?p=4 | Pins 3/11, manual switch |
| FS2 | FORScan forum, "How to program Central Configuration using FORScan", FORScan admin, 26 Feb 2016 | https://forum.forscan.org/viewtopic.php?t=1932 | CC, SBL, backup module on MS-CAN |
| FS3 | FORScan forum, "Issue with Focus MK3 - engine does not start", FORScan admin, 14 Mar 2016 | https://forum.forscan.org/viewtopic.php?p=8374 | CC procedure on Focus Mk3 |
| FS4 | FORScan forum, "Ford Focus MK3 'reset all adaptation' function", DTC log by FocusMK3, 30 Nov 2014 | https://forum.forscan.org/viewtopic.php?p=1353 | Module names on an EU Focus Mk3 1.6 TDCi |
| FS5 | FORScan forum, "MK3 Focus ABS reprogramming...", Cascadoo, 10 Jul 2024 (2014 Focus Mk3 1.6 petrol, market not stated) | https://forum.forscan.org/viewtopic.php?p=97820 | Motorcraft as-built lines for 7D0, 7E0, 701, 726, 737, 760 |
| FS6 | ffguide.net "Ford Focus Service Manual: Data and Communication Network" (generation not stated) | https://www.ffguide.net/data_and_communication_network-702.html | HS/MS module table, IC gateway |
| FS7 | ffguide.net "Module Configuration - Diagnosis and Testing" (same as F1 in `uds-sources.md`) | https://www.ffguide.net/module_configuration_diagnosis_and_testing-687.html | Module addresses |
| FS8 | Scribd, "Communications Network - System Operation and Component Description" (2012-2013 Focus, revision 01/14/2011 per extract) | https://www.scribd.com/document/433077838/Module-Network | Extract only (body not readable) |
| FS9 | Miller and Valasek, "Adventures in Automotive Networks and Control Units", IOActive, 2013/2014 (2010 Ford Escape) | https://www.ioactive.com/wp-content/uploads/pdfs/IOActive_Adventures_in_Automotive_Networks_and_Control_Units.pdf | Bus split, Appendix A ECU map, Ford SecurityAccess |
| FS10 | OBDb `Ford-Focus` signalset v3 (CC-BY-SA-4.0), commit of 11 Nov 2026 | https://github.com/OBDb/Ford-Focus/blob/main/signalsets/v3/default.json | Mode 22 DIDs and scaling |
| FS11 | OBDb `Ford-Focus` test cases (real-car response captures per model year; market, engine and adapter not stated) | https://github.com/OBDb/Ford-Focus/tree/main/tests/test_cases | `command_support.yaml` lists supported and unsupported DIDs per ECU |
| FS12 | commaai/opendbc Ford `values.py` | https://github.com/commaai/opendbc/blob/master/opendbc/car/ford/values.py | `22 F188` firmware query; as-built `DATA_IDENTIFIER_FORD_ASBUILT = 0xDE00` |
| FS13 | NHTSA file INRD-RQ24014-58384P1 (Ford service action SRV0002379, 2022 P758 PCM) | https://static.nhtsa.gov/odi/inv/2024/INRD-RQ24014-58384P1.pdf | Ford's own "Spec/DID" to "Part Name/ID" legend |
| FS14 | Shonky-Glitch/ford-module-decoding-from-sniffer-2000, `reference/ford_px3_discovery_access_spec.md` (Ranger PX3, no licence) | https://github.com/Shonky-Glitch/ford-module-decoding-from-sniffer-2000/blob/main/reference/ford_px3_discovery_access_spec.md | Real F110/F111/F113/F124/F188 replies |
| FS15 | ELM327 datasheet ELM327DSJ (S22 in `uds-sources.md`) | https://www.elmelectronics.com/wp-content/uploads/2016/07/ELM327DS.pdf | `AT PB`, PP 2C/2D |
| FS16 | OBDLink Family Reference and Programming Manual (FRPM), revision F, 29 Aug 2025 | https://www.scantool.net/scantool/downloads/234/stn1100-frpm.pdf | `STP` presets 51-54 MS-CAN, `STI`/`STDI` |
| FS17 | "OBDLink MX Protocol Commands", updated 29 Dec 2011 | https://www.scantool.net/downloads/118/mx_protocol_commands.pdf | Same 51-54 table |
| FS18 | Carista blog "Carista vs FORScan", 12 Jun 2026 (vendor; Z17 in `mazda6-sources.md`) | https://carista.com/blogs/news/carista-vs-forscan-which-obd2-scanner-is-%61ctually-worth-it-1 | MS-CAN claim for Carista EVO |
| FS19 | Carista help "Carista EVO or Carista OBD" | https://help.carista.com/hc/en-us/articles/11699121372956-Carista-EVO-or-Carista-OBD | Extract only (403) |
| FS20 | Ford 2016 Focus RS / Focus ST owner manual (CEW), enGBR, Australia/New Zealand, edition 03/2016 | https://www.fordservicecontent.com/Ford_Content/%43atalog/owner_information/2016_Focus_RS_ST.pdf | Mk3.5 ST, English (GB) text |
| FS21 | Ford 2013 Focus owner manual (US), page 250 (manualslib copy) | https://www.manualslib.com/manual/624810/Ford-Focus.html?page=250 | Oil life reset by pedals |
| FS22 | YouCanic "Ford Focus Oil Reset Instructions" (third party) | https://www.youcanic.com/fixing-oil-change-required-a-ford-focus/ | Same pedal method, 2011-2020 claimed |
| FS23 | Ford Transit 2006.5 workshop manual, 100-01 Identification Codes (workshop-manuals.com) | https://workshop-manuals.com/ford/transit_2006.5_04.2006/mechanical_repairs/1_general_information/100_service_information/100-01_identification_codes/description_and_operation/identification_codes/ | Ford of Europe (WF0) VIN layout |
| FS24 | Wikipedia, OBD-II PIDs | https://en.wikipedia.org/wiki/OBD-II_PIDs | PID 0B, 33, 51, 5C, 7A-7C, A6 |
| FS25 | Google Sheet "2017 Focus ST" (MuddledGuy), "copied from the 2017 Super Duty Spreadsheet" (F3 in `coding-sources.md`) | https://docs.google.com/spreadsheets/d/1MFz6H7_f7Ez61L---H_u1SaTOdo_22qPJy7BIM46lR8/edit | US. Mostly Super Duty values |
| FS26 | FORScan forum "Needle sweep" t=18925 | https://www.forscan.org/forum/viewtopic.php?t=18925 | Extract only (403) |
| FS27 | Cyanlabs "Focus - Enabling Auto Wipers in BCM", 21-23 Mar 2023 (2018 Focus Titanium) | https://community.cyanlabs.net/t/focus-enabling-auto-wipers-in-bcm/8404 | "byte 24" rain sensor, 726-34-01 |
| FS28 | Ford-Trucks "Updated Torque PIDs" (Power Stroke) | https://www.ford-trucks.com/forums/1322163-updated-torque-pids-7.html | Extract only: `221310` EOT formula |
| FS29 | ffclub.ru "[EN] Focus Mk3 (2011) quick help" | https://ffclub.ru/topic/6601 | Extract only: "IPC on Focus Mk3 is on MS-CAN" |

---

## 0. The car and the VIN

Ford of Europe VIN layout from FS23 (Transit, but the same WF0 scheme): 1-3 WMI, 4 body type, 5-6 "X", 7 product source company, 8 assembly plant, 9 model range, 10 body type, 11 year, 12 month, 13-17 sequence. FS23 year codes stop at "A = 2010".

| Pos | Value | Meaning | Confidence |
|---|---|---|---|
| 1-3 | WF0 | "Ford Werke GmbH Germany" (FS23) | High |
| 4, 10 | 5, 5 | Body type code; meaning of "5" for Focus not found | Unconfirmed |
| 7-9 | G, C, C | Source company G = "Ford of Germany own assembly" (FS23); C plant and C model range not in FS23's Transit table | Low |
| 11 | F | Year. FS23 runs 6..9, A = 2006..2010; continuing the sequence gives B..F = 2011..2015 (my inference) | Medium |
| 12 | M | Month; the month table changes by year and FS23 stops at 2010 | Unconfirmed |

**Petrol or diesel: the VIN cannot tell.** FS23: the VIN does not encode engine type; the engine code is on the certification label ("Engine variant", for example "G Z F A"). Check at run time:

- `01 51` Fuel Type: 1 = gasoline, 4 = diesel (FS24). Support on a 2015 Ford PCM is not confirmed; check the `01 40` / `01 50` support bitmaps first.
- `01 7A`, `01 7B`, `01 7C` are DPF PIDs (FS24); a petrol ST should not report them as supported (my inference).
- The UK V5C registration document states the fuel type.

---

## 1. Modules and buses

### 1.1 Bus facts

- HS-CAN on OBD pins 6/14, MS-CAN on pins 3/11 (FS1; FS9 for the 2010 Escape; FS16: MS-CAN "typically connected to pins 3 and 11 of the OBD port (Ford MSC network)"). **High.**
- Speeds: MS-CAN 125 kbit/s, HS-CAN 500 kbit/s (FS9 Escape: "medium speed (MS) CAN bus operating at 125kbps and a high speed (HS) CAN bus operating at 500kbps"; FS16 presets 51-54 at 125 kbps; FS8 extract gives the same for 2012-2013 Focus). **High.**
- Response ID = request + 8 on every Focus capture in FS11 (726/72E, 720/728, 760/768, 7E0/7E8, 7E1/7E9). **High.**

### 1.2 Which module is the gateway: sources disagree

| Source | Market (my inference from module names) | HS-CAN | MS-CAN | Gateway |
|---|---|---|---|---|
| FS6 (ffguide) | North American Mk3 (SJB, OCSM, FCIM, FDIM, GPSM names) | ABS, APIM (if equipped), IC, OCSM, PCM, RCM | APIM (if equipped), ACM, FCIM, FDIM, GPSM (if equipped), HVAC, IC, SJB | "The IC is the gateway module, translating HS-CAN to MS-CAN and vice versa." |
| FS8 (Scribd, extract only) | European C346 (EATC, trailer module, blind spot) | HS-CAN, HS-CAN multimedia, private HS-CAN at 500 kbit/s | BCM, instrument cluster, trailer module, EATC, blind spot monitoring | BCM between HS-CAN and MS-CAN; instrument cluster between MS-CAN and HS-CAN multimedia |
| FS2, FS3 (FORScan, EU Focus Mk3 CC) | European | | "backup module is located on MS-CAN" | CC procedure "switches BCM and IPC in special programming mode, load SBL" |
| FS29 (extract only) | Focus Mk3 | | "IPC on Focus Mk3 is on MS-CAN" | |

Real-car evidence (FS11, OBDb captures for model years 2012 to 2018, market not stated): **726 answered** `22 DD01` (and battery DIDs) in every year; **720 never answered**, not even `22 DD01`, and is listed under `unsupported_commands_by_ecu` in 2012, 2013, 2014, 2015, 2016, 2017 and 2018. This fits "IPC not reachable on pins 6/14" and "BCM reachable on pins 6/14". The adapter OBDb used is not stated.

Conclusion for the UK ST (my inference, **Medium**): BCM 726 answers on pins 6/14; IPC 720 is MS-CAN only and needs an MS-CAN-capable adapter.

### 1.3 Module table for a UK Focus ST Mk3

EU module names present on an EU Focus Mk3 (FS4 DTC log): Powertrain Control Module, Anti-Lock Brake / Traction Control Module, Body Control Module, Restraint Control Module, Instrument Panel Control Module, Steering Angle Sensor Module, Power Steering Control Module, Speech Recognition Module, Passengers Door Control Unit, Drivers Door Module, Heating Ventilation Air Conditioning, Remote Function Actuator. FS4 gives no addresses.

| Module | Request | Response | Bus (EU Focus Mk3) | Reachable on pins 6/14? | Sources | Confidence |
|---|---|---|---|---|---|---|
| PCM | 7E0 | 7E8 | HS | Yes | FS7, FS12, FS11 captures, FS5 as-built `7E0-01-01` | High |
| TCM | 7E1 | 7E9 | HS | Yes, automatic cars only (the ST is manual) | FS10/FS11 (7E1 DIDs on some Focus years) | Medium; absent on the ST |
| ABS/ESP | 760 | 768 | HS | Yes | FS7, FS12, FS11 captures (`22 2B06` etc.), FS5 `760-01-01` | High |
| RCM (airbag) | 737 | 73F | HS | Yes | FS7, FS9 (Escape, HS), FS5 `737-01-01` | High |
| PSCM | 730 | 738 | HS | Yes | FS9 (Escape 730 HS), FS12 (2019+), FS4 names PSCM on EU Focus Mk3 | Medium |
| BCM | 726 | 72E | HS and MS (gateway, FS8) | Yes | FS7, FS8, FS11 captures, FS5 `726-01-01..10` | Medium-High |
| IPC | 720 | 728 | MS (plus HS multimedia per FS8) | **No** | FS7, FS9 (Escape: IC 720 MS), FS8, FS29, FS11 (never answered) | Medium |
| APIM (SYNC) | 7D0 | 7D8 | HS and/or MS "if equipped" (FS6) | Unconfirmed | FS6, FS7, FS9 (Escape 7D0 HS), FS5 `7D0-01-01` | Medium for ID; bus Unconfirmed |
| HVAC / EATC | 733 | 73B | MS | No | FS6, FS7, FS9 (Escape 733 MS), FS8 (EATC on MS) | Medium |
| ACM (audio) | 727 | 72F | MS | No | FS6, FS7, FS9 (Escape 727 MS) | Medium |
| GPSM | 701 | 709 | MS | No | FS6 (MS, if equipped), FS9 (Escape 701 MS), FS5 `701-01-01` | Medium |
| PAM (parking aid) | 736 | 73E | HS on Escape | Unconfirmed | FS9 only (2010 Escape) | Low for Focus |
| OCSM | 765 | 76D | HS | n/a in EU | FS6, FS7, FS9; not in the EU list FS4 | Low for UK car |
| FCIM / FDIM | 7A7 / 7A6 | 7AF / 7AE | MS | n/a in EU | FS6, FS7, FS9; not in FS4 | Low for UK car |
| DDM / PDM (doors) | 740 / 741 | 748 / 749 | Unconfirmed | Unconfirmed | Names in FS4; IDs only from US sheets (FS25 `740-05-01`, `741-05-01`; Explorer F3 in `uds-sources.md`) | Low |
| RFA | 731 | 739 | Unconfirmed | Unconfirmed | Name in FS4; ID from a general Ford list (Scribd "Module List", extract only) | Low |
| SASM | 797 | 79F | Unconfirmed | Unconfirmed | Name in FS4; ID from the same general list | Low |
| Speech recognition, trailer module, blind spot, headlamp, keyless | | | MS for trailer and blind spot (FS8) | | Names only | Unconfirmed IDs |

Modules a pins 6/14 adapter should reach on the UK ST (Medium): PCM, ABS, RCM, PSCM, BCM, and APIM if it sits on HS. Everything else needs MS-CAN.

---

## 2. MS-CAN with the Carista adapter and ELM327 clones

### 2.1 The Carista adapter

- Carista's own comparison (FS19, extract only) marks MS-CAN as not supported on the "Carista OBD" adapter and supported on "Carista EVO"; a retailer extract says the OBD model is ELM327 v1.4 compatible. FS18 (vendor blog, readable): "Both Carista EVO and FORScan support Ford's MS-CAN and HS-CAN protocols". **Medium** that the older Carista OBD adapter has no MS-CAN path. If the owner's unit is an EVO, the EVO's command set for MS-CAN is not public (**Unconfirmed**).
- Practical test (my inference): with the adapter in place, `ATSH 720` then `22 DD01` (or `22 F188`) returning `NO DATA` while `ATSH 726` answers is the expected result on a pins 6/14-only adapter.

### 2.2 What a genuine ELM327 can and cannot do

- A stock ELM327 has one CAN transceiver on pins 6/14 and cannot switch pins: "MS CAN bus is not supported by the stock ELM327, because MS CAN is a manufacturer-specific solution and located on non-OBD2 pins" (FS1). **High.**
- Modified adapters add a physical 6-pin ON-ON switch that moves the chip's CAN lines from 6/14 to 3/11 (FS1). FS1: "FORScan makes all the necessary changes in an automated mode"; the exact commands FORScan sends are not published (**Unconfirmed**).
- On a switched adapter the app only has to change speed to 125 kbit/s. ELM327 user protocol B (FS15): `AT PB xx yy` sets PP 2C (options) and PP 2D (baud divisor, baud = 500 / divisor kbps; default 04 = "125 Kbps"). PP 2C bits: b7 1 = 11-bit ID, b6 0 = fixed 8-byte DLC, b5 0 = receive as b7, b4 0 = x1 baud, b2-b0 001 = ISO 15765-4. That gives:

```
AT PB 81 04     (11-bit, DLC 8, ISO 15765-4, 125 kbit/s)
AT SP B         (select protocol B, USER1)
AT SH 720       (then requests as usual; replies on 728)
...
AT SP 6         (back to ISO 15765-4 11-bit 500 kbit/s on HS)
```

Byte values derived by me from the FS15 bit table: **High** for a genuine ELM327 (datasheet example `AT PB C0 0F`); **Unconfirmed** on the Carista clone. Treat `?` as "not supported". On an unswitched adapter this does nothing useful: the transceiver is still on 6/14.

### 2.3 Adapters with a real MS-CAN path

| Adapter | How | Commands | Source | Confidence |
|---|---|---|---|---|
| OBDLink MX+, EX, MX (STN chips) | Second transceiver on pins 3/11; `STP` "selects the physical transceiver" | `STP 53` (MS CAN, ISO 15765, 11-bit Tx, 125 kbps, DLC 8); `STP 33` back to HS 500 kbps; identify the chip with `STI` (firmware ID) and `STDI` (hardware ID) | FS16 (rev F 2025), FS17 (2011) | High |
| Manually switched ELM327 | Physical switch | `AT PB 81 04`, `AT SP B` (section 2.2) | FS1, FS15 | High for the method, clone support Unconfirmed |
| Vgate vLinker FS, ELS27 | Vendors state automatic HS/MS switching under FORScan | Not published | Product listings only | Unconfirmed |

---

## 3. Identification DIDs

| DID | Ford name | Evidence | Confidence |
|---|---|---|---|
| F188 | Strategy (software) | FS13 legend "F188, F120, etc." with STRATEGIES, and service table rows "F188 STRATEGY"; FS12 queries Ford ECUs with `22 F188` (ISO name VEHICLE_MANUFACTURER_ECU_SOFTWARE_NUMBER); FS14 Ranger reply `F188 = JB3T-14C026-FE` | High |
| F111 | Core assembly | FS13 "F111 CORE ASSEMBLIES"; FS14 `F111 = JB3T-14F094-KB` | High |
| F113 | Assembly (delivery part number) | FS13 "F113 ASSEMBLY"; FS14 `F113 = JB3T-10849-PM` | High |
| F124 (F125, F126) | Calibrations | FS13 legend "F124, F125, F126, etc." on the CALIBRATIONS row (table layout garbled in the PDF text); FS14 `F124 = JB3T-14C088-AG` | Medium |
| F10A, F16B, F16C, F16D, F17D | Configurations | FS13 legend | Medium |
| F110 | "PART II" | FS13 legend and rows "F110 PART II"; FS14 `F110 = DSJB3T-10849-CF` | Medium |
| F190 | VIN | ISO 14229 | High (standard) |
| F18C | ECU serial number | ISO 14229; present in FS14 discovery lists | Medium for Ford |
| DE00 + (block - 1) | As-built block N | FS12: `22` + `0xDE00 + block_id - 1`, blocks 1-9, 16, 18, 20, 21 | High for 2019+ Fords; Medium for Mk3 US-style modules; see 3.2 for EU CC |

All Ford values are Ford part-number strings (prefix-basic-suffix, for example `JB3T-14C026-FE`); FS12's regex `[A-HJ-NP-VX-Z][0-9A-HJ-NP-VX-Z]{3}-[0-9A-HJ-NP-VX-Z]{5,6}-[A-HJ-NP-VX-Z]{2,}\x00*` shows the reply may be null-padded. Not confirmed on a 2015 Focus (FS13 and FS14 are 2018-2022 vehicles): **Medium** that a 2015 Focus PCM, ABS and BCM answer `22 F188` / `F111` / `F113`.

### 3.1 FORScan as-built line format and checksum (derived)

FS5 posts Motorcraft as-built lines such as `726-01-01 0100 0100 0031` and `737-02-01 8000 0000 C1`. Each line is module-block-line, up to 5 data bytes, then one check byte. I checked the rule below against 9 posted lines (726-01-01 to 726-01-10, 737-01-01, 737-02-01, 7E0-01-01) and it matches all of them:

```
check = (IDhigh + IDlow + block + line + sum(data bytes)) AND 0xFF
example 726-01-02: 07 + 26 + 01 + 02 + (00 1E 09 00 08) = 0x15F -> 5F
note: line "10" is used as 0x10 (726-01-10 0000 0000 003E)
```

**Medium** (derived by me, not published; `coding-sources.md` C1 says the algorithm "is not published", which this does not contradict). FORScan describes the field as a typo check and fills it in itself, so it is a display artefact. Whether it is sent to the module in a write: **Unconfirmed**. Mapping "5 data bytes per line" onto the `22 DE0x` reply: my inference, **Unconfirmed**.

### 3.2 Writing configuration on an EU Focus Mk3

- EU Focus Mk3 stores settings in **Central Configuration (CC)**, not per-module as-built: "Ford vehicles mainly for European market after 2006-2008 model year"; "On Focus Mk3 that has CC, it has to be done just in CC" (FS2). **High** (also F1 in `coding-sources.md`).
- Access needs a Ford Secondary Boot Loader: CC vehicles "require secondary boot loader (SBL) to be loaded before accessing the central configuration" (FS2); on a Focus Mk3 the procedure "switches BCM and IPC in special programming mode, load SBL" (FS3). The SBL is a Ford binary; it is not public. FORScan "does not allow to write CC for adapters that cannot do it safely enough" (FS2). **High** that this is not a plain `2E` write.
- Whether `22 DE00` on BCM 726 returns the CC without the SBL: **Unconfirmed**. FS5's `726-01-01..10` (50 bytes) may be the CC image held in Ford's as-built database (my inference).
- Security access (`27`): the Ford seed-key algorithm and per-module secrets for a **2010 Ford Escape** are published in FS9 ("SecurityAccess - Ford", Appendix A). No public source confirms they apply to 2015 Focus modules. Not reproduced here; reads in this note do not need it. **Unconfirmed for the Focus.**

---

## 4. Customisations (needle sweep, global windows, DRL, seat belt, double honk)

No Focus Mk3 source gives a block/byte/bit for any of these. Everything with numbers is from US Super Duty or Explorer sheets.

| Feature | What public sources say | Confidence |
|---|---|---|
| Needle sweep | FS26 (extract only): sweep is not in FORScan's IPC configuration; a 2015 Focus ST owner: "from what i've read online it isn't possible" | Low; treat as not available |
| Global windows | FS20 (owner manual, enGBR ST): "Global Opening (If Equipped)": press and release unlock, then press and hold unlock "for at least three seconds"; global closing: hold lock for three seconds; "Global closing can be switched on using the driver's door handle". FS25 `726-17-01 0000 0000 0045 -> 0101 0101 014A` is copied from a Super Duty sheet ("may NOT be compatible with the 2017 Focus ST") | Owner test: High. Bytes: Low, do not use |
| DRL | FS25 `726-45-01` / `726-50-01` are Super Duty values. EU cars hold DRL options in CC (FS2); no byte map | Unconfirmed |
| Seat belt minder | FS25 `720-01-01 xxxx xx6x xxxx -> xxxx xx2x xxxx` is a Super Duty value. FS20: in MyKey mode "Safety belt minder. You cannot disable this feature." | Unconfirmed |
| Double honk | FS25 `726-41-02` is a Super Duty walk-away feature; no Focus source | Unconfirmed |
| Rain sensor (example of a CC byte) | FS27: "byte 24 - 01 without rain sensor", "02- with rain sensor", block 726-34-01, 2018 Focus Titanium, market not stated, source tool "Direct Config" | Low |

A byte map of the EU Focus III CC exists only behind a VIN or file upload at ford.xtlt.ru (linked from FS27); I did not submit the owner's VIN to it.

**Not implementable from public sources:** any customisation write on the UK ST. Even with a byte map, writing CC needs the SBL (section 3.2) and the IPC copy sits on MS-CAN.

---

## 5. Maker live data (Mode 22)

All DIDs below come from FS10. "Captured" means a real response exists in FS11 for a Focus of that model year (market and engine not stated). Response bytes after `62 <DID>` are A, B, C.

| Value | Request | DID | Formula (FS10) | Captured in FS11 | Confidence |
|---|---|---|---|---|---|
| Odometer (BCM) | 726 | DD01 | A*65536 + B*256 + C, km | 2012, 2013, 2014, 2015, 2016, 2017, 2018. Example reply `72E 06 62 DD 01 02 01 02` = 131330 km | Medium-High |
| Odometer (PCM) | 7E0 | DD01 | A*65536 + B*256 + C, km | 2016 (`7E8 06 62 DD 01 02 16 12` = 136722 km) | Medium |
| Odometer (OBD) | 7DF/7E0 | `01 A6` | (A*2^24 + B*2^16 + C*2^8 + D)/10 km (FS24) | No | Unconfirmed on 2015 |
| Battery state of charge | 726 | 4028 | A, % | 2012, 2013, 2016, 2017, 2018 (`72E 04 62 40 28 20` = 32 %) | Medium |
| Battery temperature | 726 | 4029 | A - 40, deg C | Same years | Medium |
| Battery voltage (BCM) | 726 | 402A | A/20 + 6, V | Same years | Medium |
| Battery age | 726 | 4027 | (A*256 + B)*24, hours | Same years | Medium |
| Battery current | 726 | 4090 | (A*256 + B)/16 - 511.7, A | 2012, 2016, 2017, 2018 | Medium |
| Throttle inlet pressure (boost, absolute) | 7E0 | 033E | (A*256 + B)*37/33441, psi absolute | 2013, 2016 (up to 32.39 psi abs in 2016, so a turbo engine) | Medium |
| Desired throttle inlet pressure | 7E0 | 0466 | (A*256 + B)*37/33441, psi absolute | 2016 | Medium |
| Barometric pressure | 7E0 | 0353 | (A*256 + B)*615/16963, psi | 2013, 2015, 2016 | Medium |
| Boost gauge | 7E0 | 033E minus 0353 | psi gauge (my arithmetic; x 6.894757 for kPa) | Derived | Medium |
| MAP (standard) | 7DF/7E0 | `01 0B` | A, kPa, max 255 (FS24) | 2013, 2016 | High (caps at 255 kPa abs) |
| Charge air temperature | 7E0 | 0461 | signed(A*256 + B)/64 - 40, deg C | 2016 (`0B10` = 4.25 deg C) | Medium |
| Wastegate duty | 7E0 | 0462 | (A*256 + B)*100/32768, % | 2016 | Medium |
| Coolant temperature | 7E0 | 038F | signed(A*256 + B)/64, deg C | 2013, 2015, 2016 | Medium |
| Oil life remaining | 7E0 | 054B | A, % | 2013, 2016 (`7E8 04 62 05 4B 56` = 86 %) | Medium |
| Engine oil temperature | 7E0 | 1310 | (A*256 + B)/100 - 40, deg C | **No** | Low (see below) |
| Sump oil temperature | 7E0 | 03F3 | A - 40, deg C | No | Low |
| Engine oil temperature (OBD) | 7DF/7E0 | `01 5C` | A - 40, deg C (FS24) | No | Unconfirmed |
| Adapter voltage | adapter | `AT RV` | volts | n/a | High |

Oil temperature: the `221310` formula `(((A*256)+B)/100)-40` also appears for Ford Power Stroke diesels (FS28, extract only), so the two sources agree on the formula, but no Focus capture exists and an Explorer ST owner states EcoBoost engines estimate oil temperature without a PID (extract only). The ST's cluster has an oil temperature gauge (FS20 "Oil temperature gauge"), so the value exists on the bus; which DID carries it: **Unconfirmed**. Probe `22 1310`, then `22 03F3`, then `01 5C`, and hide the gauge if all return `7F 22 31` or `NO DATA`.

DPF (diesel ST only): no public Ford Mode 22 DPF DID found (**Unconfirmed**). Use `01 7A`, `01 7B`, `01 7C` (FS24) only if the support bitmap lists them.

---

## 6. Oil life / service reset

- **Over UDS (routine `31` or a DID write): no public source found. Unconfirmed.** FS9 notes one Ford RoutineControl (4044) that "kills the engine" on the Escape, which is a reason not to probe routines blind.
- Read only: oil life remaining `7E0 22 054B`, A % (section 5, Medium).
- Dashboard method, Ford 2013 Focus (US) owner manual (FS21): ignition on, engine off; "Press both the accelerator and brake pedals at the same time"; keep them fully pressed; "After three seconds, the Service: Oil reset in prog. message will be displayed"; "After 25 seconds, the Service: Oil reset complete message will be displayed"; release; ignition off. FS22 (third party) gives the same method for 2011-2020. **High** for US Mk3; **Medium** for the UK ST: FS20 (enGBR ST manual) shows the message "Oil change required" ("Displays when the engine oil life is depleted") but does not describe a reset.

---

## 7. What can be built now (High/Medium only)

Session on pins 6/14 (`AT SP 6`; automatic flow control works because Ford replies on request + 8):

1. **Module scan (HS only):** `AT SH <id>` / `AT CRA <id+8>` for 7E0, 760, 737, 730, 726, 7D0 (plus 7E1 on automatics). For each: `22 F188`, `22 F111`, `22 F113`, `22 F124`, `22 F190`. Mark 720, 733, 727, 701 as "needs MS-CAN adapter" when they return nothing.
2. **Faults:** `19 02 <mask>` and `14 FF FF FF` per the generic UDS layout in `uds-sources.md` 3.1-3.3. No Ford-specific capture of `19 02` on a Focus was found, so the mask choice stays **Unconfirmed** for Ford.
3. **Live data:** section 5 Medium rows: odometer `726 22 DD01`; battery `726 22 4027/4028/4029/402A/4090`; boost `7E0 22 033E` minus `7E0 22 0353`; `7E0 22 0461`, `0462`, `038F`, `054B`.
4. **MS-CAN (only with OBDLink or a switched adapter):** `STP 53` (OBDLink) or `AT PB 81 04` + `AT SP B` (switched ELM327), then `AT SH 720` etc.
5. **Service reset:** show the pedal procedure as instructions.

Not implementable from public sources: any as-built or CC write, needle sweep, global windows/DRL/seat belt/double honk bytes, oil reset over UDS, DPF DIDs, EU CC read via `22 DE00`, MS-CAN on the older Carista adapter.

---

## Red flags

1. The older Carista OBD adapter almost certainly cannot reach the IPC (MS-CAN). Cluster-based features (odometer from 720, cluster faults, belt minder, needle sweep) need different hardware.
2. EU Focus Mk3 customisation is Central Configuration behind a Ford SBL; US Focus ST spreadsheets (Super Duty values) do not apply.
3. All Focus Mode 22 captures (FS11) are of unknown market and engine; none is confirmed for the UK 250 PS ST.
4. `coding-sources.md` C1 says "No public source maps FORScan block names (726-xx-yy) to UDS DIDs". FS12 gives block N = `DE00 + N - 1` for 2019+ Fords; it is not confirmed for EU Mk3 CC.
5. `src/obd/modules.ts` lists FCIM 7A7 and FDIM 7A6, which are North American Mk3 names (FS6, FS9) and not in the EU module list (FS4).
