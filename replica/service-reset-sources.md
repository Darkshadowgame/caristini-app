# Caristini: service interval and oil reset sources

Research note, 12 Nov 2026. Scope: how to reset the oil service or service interval on the 4 cars, by the car's own controls and over OBD, with exact bytes only where a public source gives them. Companion to `coding-sources.md` (A7, B, C), `kwp-write-sources.md` (KWP adaptation routine), `vcds-sources.md` (UDS login and adaptation), `focus-st-sources.md` (section 6) and `mazda6-sources.md` (oil DIDs). Settled points there are referenced, not repeated.

Confidence key for byte sequences:

- **Confirmed by a log**: a capture or adapter log from a real car shows the request and a positive answer.
- **Documented by one source**: one public source gives the bytes, with no log.
- **Not found**: no public source gives the bytes. The app must not send anything for this item.

Headline: no byte-exact service reset sequence confirmed by a log was found for any of the 4 cars. Every reset over OBD stays **not implementable** until the bytes are captured on the owner's car.

---

## Sources

| ID | Source | URL | Notes |
|---|---|---|---|
| S1 | Ross-Tech wiki, Audi A6 (4G) Instrument Cluster | https://wiki.ross-tech.com/wiki/index.php/Audi_A6_(4G)_Instrument_Cluster | Channel names for oil and inspection reset; no login code on the page |
| S2 | Ross-Tech wiki, SRI Reset Procedure | https://wiki.ross-tech.com/wiki/index.php/SRI_Reset_Procedure | Lists 2011+ A6/A7/A8 under the "Resetting ESI" method |
| S3 | Ross-Tech wiki, VW Golf (1K) Instrument Cluster (the Seat Leon 1P cluster page redirects here, `coding-sources.md` R9) | https://wiki.ross-tech.com/wiki/index.php/VW_Golf_(1K)_Instrument_Cluster | Channel 002 and 040 to 049; code 13861 |
| S4 | dspl1236/PCM-Forge (MIT), `tools/service-reset/README.md`, `tools/service-reset/scripts/service_reset.sh`, `research/SERVICE_RESET_RESEARCH.md`; last push 10 Nov 2026 | https://github.com/dspl1236/PCM-Forge/blob/HEAD/tools/service-reset/README.md , https://github.com/dspl1236/PCM-Forge/blob/HEAD/tools/service-reset/scripts/service_reset.sh , https://github.com/dspl1236/PCM-Forge/blob/HEAD/research/SERVICE_RESET_RESEARCH.md | Cayenne 958 / Touareg 7P cluster `EV_KombiUDSRBVW526`. DIDs guessed from IDE numbers; never run on a cluster |
| S5 | basilfx/project-egolf, VCDS adaptation map of an e-Golf cluster 5G1 920 795 B (`EV_DashBoardVDDMQBAB`), 17 May 2025 | https://github.com/basilfx/project-egolf/blob/master/assets/posts/2025-05-16/vcds/adpmap-17-5G1-920-795-B.csv | Real VCDS export: IDE names of the service channels, no DIDs |
| S6 | CarPort-OBD wiki, MQB service reset | https://carport-obd.com/en/wiki/mqb-service-reset | MQB channel numbers 8754, 8870, 8871 etc.; number base not stated |
| S7 | OVMS 3, VW e-Up module, `vweup_obd.h` and `vweup_obd.cpp` (commit 7f8b5d6, 15 May 2026) | https://github.com/openvehicles/Open-Vehicle-Monitoring-System-3/blob/7f8b5d67622ee49e521af8bbf83392f4b716948b/vehicle/OVMS.V3/components/vehicle_vweup/src/vweup_obd.h | Polls cluster 714/77E for service distance and days, read only |
| S8 | OBDb Volkswagen and Audi-A6 signalsets | https://github.com/OBDb/Volkswagen/blob/main/signalsets/v3/default.json , https://github.com/OBDb/Audi-A6/blob/main/signalsets/v3/default.json | Cluster 714 DIDs in the `22xx` range |
| S9 | dspl1236/CerberusCAN, `docs/example-scan-c7-a6.md` | https://github.com/dspl1236/CerberusCAN/blob/HEAD/docs/example-scan-c7-a6.md | Real C7 A6 scan: 714/77E = 4G8920983E, `EV_RBD4K` |
| S10 | alibekkrona/cv, Audi A8 instrument cluster research, `api/app.py` | https://github.com/alibekkrona/cv/blob/HEAD/projects/audi-a8-instrument-cluster-research/api/app.py | A8 D4 cluster 4H0920840F also reports `F19E` = `EV_RBD4K` |
| S11 | Kanaduchi/vwcoding, PQ26 instrument panel | https://github.com/Kanaduchi/vwcoding/blob/HEAD/docs/PQ26/instrPanel.en.md | Same channel names on a PQ26 UDS cluster, login 25327 |
| S12 | vis4vag, Seat Leon (1P) 17 dashboard VD1/VDD CAN, reset of fixed service interval (demo mode) | https://diagnostics.vis4vag.com/en/seat/leon-1p/17-dashboard-10-08-kombiinstrument-vd1-vdd-can/reset-of-service-intervals-fixed-service-interval | Channel numbers masked as "XX" |
| S13 | Seat Leon owner's manual (manualslib 827502, page 67; year not stated, page links a 2012 to 2014 Leon) | https://www.manualslib.com/manual/827502/Seat-Leon.html?page=67 | Button and ignition reset |
| S14 | Seat Leon owner's manual (manualslib 1242817, page 82; year not stated) | https://www.manualslib.com/manual/1242817/Seat-Leon.html?page=82 | Same method, second press within 20 s |
| S15 | Ford 2016 Focus RS / ST owner manual (CEW), enGBR, AUS/NZ, edition 03/2016 (`focus-st-sources.md` FS20) | https://www.fordservicecontent.com/Ford_Content/%43atalog/owner_information/2016_Focus_RS_ST.pdf | Message "Oil change required"; no reset text found in the extracted manual |
| S16 | Ford 2013 Focus owner manual (US), page 250 (`focus-st-sources.md` FS21) | https://www.manualslib.com/manual/624810/Ford-Focus.html?page=250 | Pedal reset |
| S17 | FORScan forum, oil life reset thread (Aug 2020 to Jun 2022) | https://forum.forscan.org/viewtopic.php?p=51235 | Expedition, Focus Mk4; no bytes |
| S18 | OBDb Ford-Focus, Ford, Mazda-6, Mazda-CX-5 signalsets and `command_support.yaml` (Mazda-6 2018, CX-5 2016) | https://github.com/OBDb/Ford-Focus/blob/main/signalsets/v3/default.json , https://github.com/OBDb/Mazda-6/blob/main/tests/test_cases/2018/command_support.yaml , https://github.com/OBDb/Mazda-CX-5/blob/main/tests/test_cases/2016/command_support.yaml | PCM oil life DIDs |
| S19 | Mazda owner's manual, CX-5, "Vehicle Engine Control Unit Reset Procedure (SKYACTIV-D 2.2)" | https://owners-manual.mazda.com/gen/en/cx-5/cx-5_8gj7eo18b/contents/07030404.html | Official, same engine as the Mazda6 GJ |
| S20 | Mazda6 owner's manual (manualslib 1271741, page 594; year and market not stated, UK spelling) | https://manualslib.com/manual/1271741/Mazda-6.html?page=594 | Reset with the "selector" |
| S21 | Mirror of Mazda workshop manual, "ENGINE OIL DATA RESET [SKYACTIV-D 2.2]" (`mazda6-sources.md` Z4) | https://mazda6.neocities.org/esicont/srvc/html/id0140z7444700 | Tripmeter, M-MDS and test-terminal methods |
| S22 | Same mirror, "DTC P253F:00 [PCM (SKYACTIV-D 2.2)]" | https://mazda6.neocities.org/esicont/srvc/html/id0102j5154400 | Why the reset matters |
| S23 | Same mirror, "ENGINE OIL REPLACEMENT [SKYACTIV-D 2.2]" | https://mazda6.neocities.org/esicont/srvc/html/id0111s6800400 | Reset is a step of the oil change |
| S24 | Mazdas247 forum, "How to reset oil data? CX-5 Diesel" (Feb 2013 to Dec 2023) | https://mazdas247.com/forum/goto/post?id=6129212 | Owners used a dealer M-MDS; no bytes |
| S25 | Audi of America, 2012 A6 owner's manual text (`coding-sources.md` T1) | https://static.nhtsa.gov/odi/tsbs/2015/MC-10120898-9999.pdf | MMI reset path |

Searched with no usable result: GitHub code for `"oil data reset"`, `"oil life reset" uds`, `"oil reset" "31 01"`, `"31 B9 01 03"`, `"31BB0103"`, `"0x31, 0xB9"`; GitHub repositories for "oil reset", "service reset"; web searches for Mazda oil reset ELM327 or `31 01` routines, FORScan Mazda oil data reset, VW cluster `2E` service reset bytes, KWP TP2.0 cluster channel 02 logs. A Mazda Motor Europe bulletin (Dec 2012) on the mazdaspeed.pl forum was seen in search results only; the file needs a login, so it is not used.

---

## 1. Audi A6 C7 2.0 TDI 2012 (cluster 17, UDS, 714/77E)

Cluster identity: a real C7 A6 scan shows 714/77E as 4G8920983E with dataset `EV_RBD4K` (S9). The A8 D4 cluster 4H0920840F reports the same dataset name (S10). vis4vag lists `EV_RBD4K 004048` for an A6 4G TDI cluster (`coding-sources.md` T2). Read `22 F19E` on the owner's car to confirm.

### 1.1 Own-menu method

| Method | Detail | Source | Confidence |
|---|---|---|---|
| MMI | "CAR > Car systems > Servicing & checks > Service Interval displays > Reset oil change interval". Oil change only. Inspection: dealer. | S25 | High (oil); inspection has no owner method |

### 1.2 Tool-only resets

| Reset | Tool method | Source | Confidence |
|---|---|---|---|
| Oil service | VCDS 17, Adaptation, "ESI: Resetting ESI", select Reset; "It may be necessary to cycle the key" | S1, S2 | High for the method |
| Inspection (distance and time) | "FIX: Distance covered since last mileage-dependent inspection" = 0 and "FIX: Time since last time-dependent inspection" = 0 | S1 | High for the method |
| Login / security access | S1 lists no code for these channels. The PQ26 cluster needs "Login code: 25327 (legacy 20103)" for the same names (S11). For the C7: **not known** | S1, S11 | Not known |
| Kind of operation | UDS adaptation, so `2E <DID> <record>` (`vcds-sources.md` section 2). Not a routine (`31 01`) in any source found | S1, `vcds-sources.md` | High that it is a `2E` write; DID not known |

OBDeleven, Carista and ODIS also offer a one-click service reset on this car (`carista-a6-map.md`); none publishes the request bytes.

### 1.3 Byte sequences

| Item | Bytes | Source | Confidence |
|---|---|---|---|
| Oil reset, Touareg 7P / Cayenne 958 cluster (`EV_KombiUDSRBVW526`) | `10 03`, then `2E 01 56 00` | S4 | **Documented by one source, and wrong method**: see below. Do not send |
| Inspection reset, same cluster | `2E 0D 17 00 00 00 00`, `2E 0D 18 00 00 00 00` | S4 | Same. Do not send |
| Oil reset, A6 C7 (`EV_RBD4K`) | none | | **Not found** |
| Inspection reset, A6 C7 | none | | **Not found** |

Why S4 does not count:

- S4 states "DID values derived from VCDS IDE channel numbers (decimal → hex conversion)", so IDE00342 becomes `0x0156`, IDE03351 `0x0D17`, IDE03352 `0x0D18`.
- That rule is disproved by ODIS extracts: IDE00003 = `0x0600`, IDE03875 = `0x02B9` (`vcds-sources.md` section 2, D8, D9).
- S4's own research file says the target module 0x29 is the display, not the cluster, and that the cluster "does not respond on the diagnostic bus via standard addressing". Its `2E` writes to "service DIDs" returned NRC `0x33`. Nothing in S4 shows a cluster accepting these DIDs.
- S4 labels IDE00510 as "Service interval (soot)"; the real VCDS export (S5) names IDE00510 "ESI: distance driven from inspection". The two disagree.

### 1.4 DID ranges to read before and after a reset done with another tool

All reads are `22 <DID>` to 714, reply on 77E. Reads are safe; log every reply, including `7F 22 31`.

| DID | Meaning per source | Source | Confidence on the C7 |
|---|---|---|---|
| `2260` | Service range left, km (uint16; OVMS ignores 0) | S7 (e-Up cluster, 714) | Not known on MLB |
| `2261` | Service time left, days (uint16) | S7 | Not known on MLB |
| `2203` | Odometer (dash) | S8 (also in the Audi-A6 set), S10 (A8 `EV_RBD4K` reply `01 EB 3A`) | Medium |
| `224B` | "Oil thermal wear", km | S8 (Volkswagen set, car not stated) | Low |
| `2232`, `2245` to `2248`, `2293`, `22A4` to `22A7` | My inference only: S6's MQB channel numbers read as decimal give 8754 = `0x2232` (oil reset), 8870 = `0x22A6` and 8871 = `0x22A7` (inspection), 8773 to 8776 = `0x2245` to `0x2248`, 8851 = `0x2293`, 8868 and 8869 = `0x22A4`, `0x22A5`. S6 does not state the base. These fall in the same `22xx` block as S7 and S8 | S6 plus inference | Low. Read only |
| `0156`, `0D17`, `0D18`, `01FE`, `01FF` | S4's guesses | S4 | Low. Read only, to rule them out |

Recommended capture plan: sweep `22 2200` to `22 22FF` on 714 (256 reads), save the replies, do the reset with VCDS, OBDeleven or Carista, sweep again and diff. The DIDs whose value drops to 0 or jumps to the interval maximum are the service records. Better still: capture the other tool's own request (Carista over BLE with Apple's PacketLogger, as proposed in `tp20-sources.md`, or a second ELM327 on a Y-cable in `AT MA` monitor mode filtered to 714/77E). Only a captured `2E <DID> <record>` with a `6E <DID>` reply moves this to "confirmed by a log".

### 1.5 Open questions (A6)

1. The DIDs and record lengths for "ESI: Resetting ESI" and the two FIX channels on `EV_RBD4K`.
2. Whether the C7 cluster wants `27 03/04` (login code not known) or the `F199`/`F198` workshop writes before the `2E`.
3. Whether `2260`/`2261` exist on MLB clusters.

---

## 2. Seat Leon II (1P) Cupra 2007 (cluster 17, KWP2000 on VW TP2.0)

Cluster: "KOMBIINSTRUMENT VD1/VDD CAN" for 1P cars 2006 to 2013 (S12). vis4vag also lists a UDS cluster (`EV_DashBoardUDSJCIPQ25`) under the 1P; which one the owner's car has is **not known**: check with `1A 9B` / `22 F1 87` (`kwp-write-sources.md`). TP2.0 logical address of 17: `0x07` (Medium, `kwp-write-sources.md` F25).

### 2.1 Own-menu method

| Method | Detail | Source | Confidence |
|---|---|---|---|
| Cluster button | "turn the ignition off and press and hold the button"; "Switch the ignition back on."; "Release the button". The button is in a figure only | S13 | Medium (manual year not stated; S13's page links a 2012 to 2014 Leon) |
| Variant | Release, then press "the button again for the next 20 seconds" | S14 (year not stated) | Low (text garbled) |
| Workshop manual | "Resetting the service interval display → VAS 5051" (Leon Mk1 page) | https://workshop-manuals.com/seat/leon-mk1/vehicle_electrics/electrical_system/instruments_gci/service_interval_display/service_interval_display/ | Low for the 1P |

S13 and S14 both say the owner reset applies "If the service was not carried out by a SEAT dealership".

### 2.2 Tool-only resets

| Reset | Tool method | Source | Confidence |
|---|---|---|---|
| Service reminder | 17, Adaptation, channel 002: "0 = Service NOT Due", reset: "save 0 as new value" | S3 | High for the channel |
| Interval settings | 040 mileage since service (100 km steps), 041 time since service (days), 042/043 min/max distance (1000 km), 044 max time (365 fixed, 730 LongLife), 045 oil quality (1 fixed, 2 LongLife), 049 min time | S3 | High (do not offer by default) |
| Login | 13861, listed by S3 under Security Access ("Adaptation Enabling") | S3 | High for the code; how it is sent: see 2.3 |
| vis4vag | Oil change distance, inspection distance and inspection time channels; numbers masked "XX" | S12 | Method only |

### 2.3 Byte sequences

| Step | Bytes | Source | Confidence |
|---|---|---|---|
| Session | `10 89` → `50 89` | `tp20-sources.md`, `kwp-write-sources.md` | High on other TP2.0 modules |
| Login 13861 | Either `27 03` → `67 03 <seed 4>`, `27 04 <seed + 13861, 4 bytes>`, or `3B 9A ... <0x800000 | code>`. Sources disagree on which one the cluster wants (`leon-sources.md` 5.1) | `leon-sources.md` 5.1, `kwp-write-sources.md` F22, F28 | Low |
| Adaptation channel 002 = 0 | `31 B8 01 03`, `31 B9 01 03 02`, `31 BA 01 03`, `31 B9 01 03 00 00`, `31 BB 01 03 00 00 <WSC 6>`, `32 B8 01 03` | `kwp-write-sources.md` section (b), from a Carista decompile and kw1281test on an EDC16 engine | **Documented by one source family, not on a cluster.** No TP2.0 cluster log |

Result: **not found** as a confirmed sequence for the Leon cluster. The routine family is the best public lead, but no log shows a PQ35 cluster accepting it.

### 2.4 Values to read before and after a reset

- KWP adaptation read inside the routine: `31 BA 01 03` after selecting channels 002, 040, 041 (`kwp-write-sources.md` F19 reply layout). Medium for the layout, not tested on a cluster.
- If the cluster is the UDS variant: `22 2203` (odometer) and the `22xx` sweep from section 1.4, Low.
- KWP measuring blocks (`21 xx`) on the cluster: no public group list for PQ35 clusters (`leon-groups.md`).

### 2.5 Open questions (Leon)

1. KWP or UDS cluster on this car.
2. Whether 13861 is sent with `27 03/04` or with the `3B 9A` login record.
3. Positive answer bytes of `31 BB` on a cluster.

---

## 3. Ford Focus ST-3 Mk3 2015 (IPC 720/728)

### 3.1 Own-menu method

| Method | Detail | Source | Confidence |
|---|---|---|---|
| Pedals (US 2013 Focus) | Ignition on, engine off; "Press both the accelerator and brake pedals at the same time"; "After 25 seconds, the Service: Oil reset complete message" | S16 | High for US Mk3 |
| UK / EU ST | S15 (enGBR ST manual, AUS/NZ edition) lists "Oil change required" ("Displays when the engine oil life is depleted"); I searched the extracted manual text and found no reset procedure. A UK (CG3630en) manual was not read | S15 | **Not known** for the UK car |
| Forum (Mk4, not Mk3) | Pedals "for something like 15-30s while ignition is on" (Tapiiri, 3 Jun 2022) | S17 | Low |

### 3.2 Tool-only resets

- FORScan: no FORScan service procedure for oil life reset was found. In S17 a poster "could not find a service procedure for resetting the counter" (Tapiiri, 1 Jun 2022); others enabled a menu item in IPC configuration on a 2018 Expedition. No bytes.
- Ford IDS / FDRS: no public source found.

### 3.3 Byte sequences

**Not found.** No public source gives a Ford `31 01` routine or a `2E` write for oil life. `focus-st-sources.md` section 6 notes a Ford routine that "kills the engine" on another model, a reason never to probe routines.

### 3.4 DIDs to read before and after a pedal reset

All on the PCM, `7E0` / `7E8`:

| DID | Meaning | Source | Confidence |
|---|---|---|---|
| `054B` | Oil life remaining, A % | S18 (Ford-Focus, Ford, Mazda sets) | Medium (`focus-st-sources.md` has a 2013 and 2016 capture) |
| `053F` | "Time since last oil change", raw x 200 / 13107 | S18 | Low |
| `0542` | Ford sets: "Distance since last oil change", km. Mazda sets: "Max distance to oil change". **Sources disagree** | S18 | Low |
| `054C` | "Dilution of oil with fuel", % | S18 (Ford set only) | Low |

A UK ST may not run the oil life monitor at all; if `054B` is refused, that is the likely reason (not confirmed).

### 3.5 Open questions (Ford)

1. Whether the UK 2015 ST has an oil life reset (pedals or menu) and an oil life value in the PCM.
2. Which module stores the reset (IPC or PCM) and what CAN message carries it.

---

## 4. Mazda6 GJ 2016 2.2 Skyactiv-D

### 4.1 What the oil data reset is, and whether it is needed

- It "clears the PCM's stored oil replacement calculation data and oil dilution amount" (S21, paraphrase of the workshop text).
- Mazda: for SKYACTIV-D 2.2, reset "whenever replacing the engine oil regardless of the message/wrench indicator light display" (S19 family of pages; S20 says the same for SKYACTIV-D 2.2).
- If not done: the wrench light "may not turn off or it may turn on earlier than normal" (S19, S20).
- The PCM also compares oil pressure with the value stored at the last oil change. DTC P253F:00 (engine oil deteriorated) lists "Engine oil data reset procedure does not perform" as a cause, and sets on a pressure drop of 40 kPa or more versus that baseline (S22).
- The workshop oil change procedure includes "Perform engine oil data reset procedure" as a step (S23).
- Answer: **yes, needed after every oil change on this engine.** It is a PCM reset, separate from the Mazda Connect maintenance reminder.
- Caution (my inference from S21 and S22): resetting without changing the oil discards the PCM's dilution estimate and resets the pressure baseline on old oil, so the oil deterioration monitor would then judge from a wrong baseline. The app should only offer it as a post-oil-change step.

### 4.2 Own-control methods (sources disagree on the button)

| Method | Detail | Source | Confidence |
|---|---|---|---|
| Illumination knob | Ignition off; ignition on while pressing the instrument panel illumination knob; hold about 5 s until the master warning light flashes | S19 (CX-5, same engine) | High for the CX-5; Medium for the Mazda6 |
| Selector | Same steps with "the selector" | S20 (Mazda6, year not stated) | Medium |
| Tripmeter switch (oil warning light **not** on) | Ignition off; hold the tripmeter switch; ignition on, engine off; hold more than 5 s; master warning light flashes | S21 | Medium (unofficial mirror) |
| Test terminal (oil warning light on, no M-MDS) | Ignition on; jumper the DLC test terminal to body ground; press the accelerator fully 5 times within 5 s; glow lamp flashes 5 times; remove the jumper. May set P1905:00, which clears when the jumper is removed | S21 | Medium; terminal position only in a figure |
| Maintenance monitor | Mazda Connect "Maintenance" list, Oil Change tab reset (flexible setting). This is the reminder, not the PCM oil data | Mazda manuals for CX-3/CX-5/Mazda6 (US), see `coding-sources.md` C2 | Medium |

After the reset, S23 says "Wait for 20 s" and "Clear the DTCs".

### 4.3 Tool-only resets

| Tool | Method | Source | Confidence |
|---|---|---|---|
| M-MDS / IDS | "Powertrain", then "Data Reset", then "Engine oil" | S21 | Medium |
| Dealer | Owners paid a dealer to use M-MDS (ausy, 10 Mar 2013) | S24 | Low |
| FORScan | No source found that FORScan offers this reset on a Mazda | | Not found |

### 4.4 Byte sequences

**Not found.** No public source gives the M-MDS request (a `31 01 <routine>` or a `2E` write) for the oil data reset.

### 4.5 DIDs to read before and after (PCM `7E0` / `7E8`)

| DID | Meaning | Source | Confidence |
|---|---|---|---|
| `0435` | "Oil dilution events" (count). S21's dilution is an amount, so the unit is **not known** | S18; supported on a 2016 CX-5 and 2018 Mazda6 (engines not stated) | Low |
| `0519` | "Distance since oil changed", (A*256+B) x 4 km | S18 | Low |
| `053F` | "Time since last oil change" | S18 | Low |
| `0542` | "Max distance to oil change" (Mazda sets; Ford set disagrees, see 3.4) | S18 | Low |
| `054B` | Oil life remaining, A % | S18 | Low |

A correct reset should take `0519` and `053F` to near 0, `054B` to 100, and `0435` to 0. That is the expected pattern, not a documented one.

### 4.6 Open questions (Mazda)

1. Which button the UK 2016 GJ uses (illumination knob, selector or tripmeter switch).
2. The M-MDS routine or DID behind "Data Reset > Engine oil".
3. Units of `0435`.

---

## 5. Summary for the app

| Car | Owner method | OBD reset bytes | What the app can do now |
|---|---|---|---|
| A6 C7 | MMI, oil only (High) | Not found (S4 bytes are guesses, do not send) | Guide to MMI; read `22 2260`, `22 2261`, `22 2203` and sweep `22 2200` to `22 22FF` before and after another tool's reset |
| Leon 1P | Cluster button (Medium) | Not found on a cluster; KWP routine family documented on other modules | Guide to the button method; identify KWP vs UDS cluster |
| Focus ST | US pedal method (High for US, not known for UK) | Not found | Guide to pedals with a "may not apply to UK cars" note; read `7E0 22 054B`, `053F`, `0542`, `054C` |
| Mazda6 GJ | Button methods, sources disagree on the button (Medium) | Not found | Guide to the button methods after every oil change; read `7E0 22 0435`, `0519`, `053F`, `0542`, `054B` before and after |
