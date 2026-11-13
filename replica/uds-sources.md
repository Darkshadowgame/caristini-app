# Caristini: UDS and CAN ID sources

Research note, 11 Nov 2026. Read-only diagnostics on 11-bit 500 kbit/s CAN through an ELM327-compatible BLE adapter.

Confidence key:

- **High**: two or more independent public sources agree, or one primary source (manufacturer document, ODIS extract) plus a real-car capture.
- **Medium**: one public source, or a name match between two sources (for example a Ross-Tech address-word name matched to an ODIS logical-link name). Name matches are my inference and are marked "name match".
- **Low**: single community post, different model or platform, or sources disagree.
- **Unconfirmed**: no public source found. Do not ship as fact.

Already confirmed on the owner's car (2012 Audi A6 C7, MLB, VIN WAUZZZ4GXCN000000): 7E0/7E8, 7E1/7E9, 714/77E answer `22 F187`, `22 F189`, `22 F190`.

---

## Sources

| Key | Source | URL | Notes |
|---|---|---|---|
| S1 | ConnorHowell/vag-uds-ids ("extracted from ODIS"), 90 rows, 11-bit only, no licence, no platform stated | https://github.com/ConnorHowell/vag-uds-ids | Logical-link names such as `LL_DashBoardUDS`. No address words. |
| S2 | commaai/opendbc, Volkswagen `values.py`: `VOLKSWAGEN_RX_OFFSET = 0x6a` for srs, eps, fwdRadar, fwdCamera; engine and transmission use the default offset | https://github.com/commaai/opendbc/blob/master/opendbc/car/volkswagen/values.py | MQB and PQ cars |
| S3 | OVMS v3, VW e-Up `vweup_obd.h`: TX/RX defines with VAG address words in comments, plus DIDs | https://github.com/openvehicles/Open-Vehicle-Monitoring-System-3/blob/master/vehicle/OVMS.V3/components/vehicle_vweup/src/vweup_obd.h | e-Up (NSF platform, not MQB or MLB) |
| S4 | OVMS v3, VW e-Up `vweup_obd.cpp`: decoding of service range, service days, 12 V | https://github.com/openvehicles/Open-Vehicle-Monitoring-System-3/blob/master/vehicle/OVMS.V3/components/vehicle_vweup/src/vweup_obd.cpp | e-Up |
| S5 | OBDCracker issue #86, real-car session on a 2014 Audi A7 (C7, MLB, same 4G family as the A6 C7), 12-13 Oct 2026 | https://github.com/DaSonOfPoseidon/OBDCracker/issues/86 | Reply/request pairs, 0600 reads, 19 01 behaviour |
| S6 | OBDCracker PR #230, A7 address words confirmed from the gateway's installed-module list, 29 Oct 2026 | https://github.com/DaSonOfPoseidon/OBDCracker/pull/230 | 03, 13, 8B, 3B, 44, 8E |
| S7 | OBDCracker issue #172, gateway installed-module list DIDs 2A2A / 2A29 / 2A2C, 2014 A7, 23 Oct 2026 | https://github.com/DaSonOfPoseidon/OBDCracker/issues/172 | |
| S8 | OBDb Audi-RS-3 PR #91, 30 Oct 2026 | https://github.com/OBDb/Audi-RS-3/pull/91 | 70B/775, 710/77A, 714/77E, 715/77F, 746/7B0; cluster DIDs read in session 03 |
| S9 | OBDb Audi-A6 signalset (all A6 generations, per-year filters) | https://github.com/OBDb/Audi-A6/blob/main/signalsets/v3/default.json | Odometer, crash counters, oil level |
| S10 | OBDb Volkswagen-Golf signalset (MQB) | https://github.com/OBDb/Volkswagen-Golf/blob/main/signalsets/v3/default.json | Battery voltage on gateway, odometer, oil level |
| S11 | NinjaStyle82/dtcsweep (MIT), VW DTC sweeper | https://github.com/NinjaStyle82/dtcsweep | 0x700-0x774 with reply +0x6A; 29-bit 17FC00xx/17FE00xx; mask 0x2D |
| S12 | perkthefox/mqb_contitool issue #1, MQB gateway identification dump, 8 Nov 2026 | https://github.com/perkthefox/mqb_contitool/issues/1 | Labels for F187, F191, F189, F1A3, F197, F18C, F17C, F19E, F1A2, 0600 |
| S13 | Ross-Tech wiki, Audi A6/S6/RS6/allroad (4G/FC) | https://wiki.ross-tech.com/wiki/index.php/Audi_A6/S6/RS6/allroad_(4G/FC) | Address-word names for the A6 C7 |
| S14 | Ross-Tech VCDS tour, fault code screen | https://mail.register.ross-tech.com/vcds/tour/dtc_screen.php | Display format, clearing notes |
| S15 | Volkswagen of America Tech Tip 00-18-02TT "DTC Status Bit Explanation", 28 Sep 2018, all models 2006-2019 | https://static.nhtsa.gov/odi/tsbs/2018/MC-10150854-9999.pdf | Primary VW source for status bits |
| S16 | python-uds knowledge base, DTC | https://uds.readthedocs.io/en/latest/pages/knowledge_base/dtc.html | Status byte bits, letter bits |
| S17 | python-uds knowledge base, services | https://uds.readthedocs.io/en/latest/pages/knowledge_base/service.html | 19 02 and 14 layouts |
| S18 | opendbc `uds.py` (ISO 14229 DID names) | https://github.com/commaai/opendbc/blob/master/opendbc/car/uds.py | |
| S19 | opendbc Volkswagen `fingerprints.py` (real F187/F189 replies) | https://github.com/commaai/opendbc/blob/master/opendbc/car/volkswagen/fingerprints.py | Space padding of F187 |
| S20 | t6forum "VW T6 Custom PID codes for DPF", 2022 | https://www.t6forum.com/threads/vw-t6-custom-pid-codes-for-dpf.33964/ | 2.0 TDI DPF, odometer, DSG temperature |
| S21 | vmmms1791/car-scanner-elm-logger (Car Scanner emulator log, VW MEB) | https://github.com/vmmms1791/car-scanner-elm-logger | ATFCSD300000, ATFCSM1, 1902AE/AF/08 |
| S22 | ELM327 datasheet ELM327DSJ (firmware v2.1) | https://www.elmelectronics.com/wp-content/uploads/2016/07/ELM327DS.pdf | FC commands, filler byte PP 26 |
| S23 | Elm Electronics AT command table, Oct 2010 (SparkFun copy) | https://cdn.sparkfun.com/assets/4/e/5/0/2/ELM327_AT_Commands.pdf | "Version in which the command first appeared" column |
| S24 | Wikipedia, ELM327 | https://en.wikipedia.org/wiki/ELM327 | Version history, v1.5 |
| S25 | Wikipedia, ISO 15765-2 | https://en.wikipedia.org/wiki/ISO_15765-2 | First Frame 12-bit length |
| S26 | Wikipedia, OBD-II PIDs | https://en.wikipedia.org/wiki/OBD-II_PIDs | DTC letter bits, PID 42, reply = ID + 8 |
| F1 | Ford Focus Service Manual, Module Configuration (generation not stated on page) | https://www.ffguide.net/module_configuration_diagnosis_and_testing-687.html | Ford module addresses |
| F2 | opendbc Ford `values.py` and `fingerprints.py` (2019+ Ford models incl. Focus Mk4; no Focus Mk3) | https://github.com/commaai/opendbc/blob/master/opendbc/car/ford/values.py , https://github.com/commaai/opendbc/blob/master/opendbc/car/ford/fingerprints.py | |
| F3 | FORScan settings sheet "Common Settings for 2016-2017MY", Ford Explorer, last update 1 Aug 2017 | https://www.pickuptrucks.de/media/kunena/attachments/5776/FORScan2011-2018.pdf | As-built prefixes BCM 726, IPC 720, PSCM 730, APIM 7D0, ACM 727, SCCM 724, DDM 740, PDM 741 |
| F4 | FORScan forum, MS CAN post by FORScan admin, 15 Jun 2014 | https://forum.forscan.org/viewtopic.php?p=4 | MS CAN on pins 3 and 11 |
| F5 | opendbc `fw_query_definitions.py`: `rx_offset: int = 0x8` default | https://github.com/commaai/opendbc/blob/master/opendbc/car/fw_query_definitions.py | Ford and Mazda queries use this default |
| M1 | opendbc Mazda `values.py` and `fingerprints.py` ("Mazda 6 2017-20", CX-5 2017-21, Mazda 3 2017-18, CX-9) | https://github.com/commaai/opendbc/blob/master/opendbc/car/mazda/fingerprints.py | |
| M2 | miatafy FORScan mod list (ND MX-5, CX-5 KE/KF, Mazda3 BM/BN; Mazda6 not mentioned) | https://miatafy.com/forscan/complete-mod-list/ | Third-party guide |

---

## 1. VW group module IDs (11-bit, physical addressing)

### The +0x6A rule

- **Confirmed for the 0x7xx VW range, with exceptions.**
- S1 (ODIS extract): 85 of 90 rows have response = request + 0x6A. The 5 exceptions are all in the OBD range and use +8: 7E0/7E8, 7E1/7E9, 7E2/7EA, 7E5/7ED, 7E6/7EE.
- S2 (opendbc): `VOLKSWAGEN_RX_OFFSET = 0x6a` for airbag, steering, radar, camera; engine and gearbox use +8.
- S11 (dtcsweep): "0x700-0x774, with the response at request + 0x6A"; OBD 0x7E0-0x7E7 at +8.
- **Disagreement (S3, VW e-Up):** three e-Up modules answer at +8, not +0x6A: 44 steering 712/**71A**, 23 brake boost 73B/**743**, AD brake sensors 762/**76A**. S1 gives 712/77C and 762/7CC. On the 2014 A7 (S5) steering answered at 712/77C. Treat +0x6A as the default for MLB/MQB and probe +8 as a fallback.
- S11 also lists 29-bit VW IDs `0x17FC00xx` (request) and `0x17FE00xx` (response). Some later modules use these; no address list for 29-bit was found.

### Module table

Address-word names from S13 (A6 4G page) unless stated. "A7 capture" means S5/S6 on a 2014 A7 (C7, MLB).

| Addr | Module | Request | Response | Applies to | Source | Confidence |
|---|---|---|---|---|---|---|
| 01 | Engine electronics | 7E0 | 7E8 | All (owner's A6 confirmed) | S1 `LL_EnginContrModul1UDS`, S3 "ECU 01", owner | High |
| 11 | Engine electronics 2 | 7E2 | 7EA | Not stated | S1 `LL_EnginContrModul2UDS` (addr 11 by name match) | Medium |
| 02 | Transmission electronics | 7E1 | 7E9 | All (owner's A6 confirmed) | S1 `LL_TransContrModulUDS`, owner | High |
| 03 | Brake electronics (ABS/ESP) | 713 | 77D | MLB (A7 capture), MQB, e-Up | S1 `LL_Brake1UDS`, S3 "ECU 03", S5, S6 | High |
| 08 | Heating/air conditioning | 746 | 7B0 | MLB (A7 capture), MQB | S1 `LL_AirCondiUDS`, S5, S8 | High |
| 28 | Heating/AC rear | 71A | 784 | MLB (A7 capture) | S1 `LL_ClimaContrUnitRearUDS`, S5 | High |
| 09 | Central electronics | 70E | 778 | MQB (Golf signalset) | S1 `LL_CentrElectUDS`, S10 | Medium |
| 46 | Comfort system | 70D | 777 | Not stated | S1 `LL_CentrModulComfoSysteUDS` (name match) | Medium |
| 05 | Access/start authorisation | 732 | 79C | Not stated | S1 `LL_KessyUDS` and `LL_AccesStartInterUDS` share this pair (name match). On MLB, Ross-Tech files Acc/Start under J393 BCM2 | Low |
| 10 (76 on other models: unconfirmed) | Park/steer assist, parking aid | 70A | 774 | MLB (A7 capture) | S1 `LL_ParkiAssisUDS`, S5 | High |
| 13 | Distance regulation (ACC) | 757 | 7C1 | MLB (A7 capture) | S1 `LL_AdaptCruisContrUDS`, S5, S6 | High |
| 8B | Distance regulation 2 | 756 | 7C0 | MLB (A7 capture) | S1 `LL_AdaptCruisContr2UDS`, S5, S6 | High |
| 15 | Airbag | 715 | 77F | MLB (A7 capture), MQB | S1 `LL_AirbaUDS`, S2 (srs 0x715, +0x6A), S5, S8 | High |
| 8F / 90 | Belt pretensioner front left / right | 75E / 75F | 7C8 / 7C9 | MLB (A7 capture) | S5 ("belt tensioner left/right"); address words by name match to S13 | Medium |
| 16 | Steering wheel electronics (steering column) | 70C | 776 | Not stated | S1 `LL_SteerColumElectUDS` (name match) | Medium |
| 17 | Instrument cluster | 714 | 77E | MLB (owner's A6, A7 capture), MQB, e-Up | S1 `LL_DashBoardUDS`, S3 "ECU 17", S5, S8, owner | High |
| 19 | Gateway | 710 | 77A | MLB (A7 capture), MQB | S1 `LL_GatewUDS`, S5, S8, S12 (77A) | High |
| 1B | Active steering | 716 | 780 | Not stated | S1 lists 716/780 for both `LL_DashBoardDisplUnitUDS` and an active-steering link | Low |
| 25 | Immobiliser | 711 | 77B | e-Up | S1 `LL_ImmobUDS`, S3 "ECU 25" | Medium (not seen on MLB) |
| 3B | Sensor electronics | 721 | 78B | MLB (A7 capture) | S5, S6 | Medium |
| 42 | Door electronics driver | 74A | 7B4 | Not stated | S1 `LL_DoorElectDriveSideUDS` (name match) | Medium |
| 52 | Door electronics passenger | 74B | 7B5 | Not stated | S1 `LL_DoorElectPasseSideUDS` (name match) | Medium |
| 62 | Door electronics rear left | 73E | 7A8 | Not stated | S1 `LL_DoorElectRearDriveSideUDS` (name match, LHD assumed) | Low |
| 72 | Door electronics rear right | 73F | 7A9 | Not stated | S1 `LL_DoorElectRearPasseSideUDS` (name match, LHD assumed) | Low |
| 44 | Steering assist | 712 | 77C | MLB (A7 capture), MQB | S1 `LL_SteerAssisUDS`, S2 (eps, +0x6A), S5, S6 | High |
| 44 | Steering assist (e-Up) | 712 | **71A** | e-Up only | S3 | Disagrees with the row above |
| 53 | Parking brake | 752 | 7BC | MLB (A7 capture) | S1 `LL_ParkiBrakeUDS`, S5 | High |
| 55 | Headlight aim control | 754 | 7BE | MLB (A7 capture) | S1 `LL_HeadlRegulUDS`, S5 | High |
| 5F | Information electronics | 773 | 7DD | e-Up; MQB per ODIS | S1 `LL_InforContrUnit1UDS`, S3 "ECU 5F" | Medium. S5 did not find the MMI on the A7 |
| 69 | Trailer | 747 | 7B1 | Not stated | S1 `LL_TrailFunctUDS` (name match) | Medium |
| 6D | Trunk electronics (rear lid) | 723 | 78D | MLB (A7 capture) | S5 ("rear lid") | Medium |
| 82 | Head-up display | 71B | 785 | MLB (A7 capture) | S1 `LL_HeadUpDisplUDS`, S5 | High |
| 84 | Night vision | 727 | 791 | MLB (A7 capture) | S5 | Medium |
| 85 | On-board camera | 726 | 790 | MLB (A7 capture) | S1 `LL_OnBoardCamerUDS`, S5 | High |
| 8E | Image processing | 758 | 7C2 | MLB (A7 capture) | S5, S6 | Medium |
| 6C (unconfirmed word) | Rear view / top view camera | 769 | 7D3 | MLB (A7 capture, "top view") | S1 `LL_CamerSysteRearViewUDS`, S5 | Medium |
| A5 (unconfirmed word) | Front sensors driver assist (camera) | 74F | 7B9 | MQB | S1 `LL_FrontSensoDriveAssisSysteUDS`, S2 (`0x74f`) | High for MQB |
| 22 (unconfirmed word) | All-wheel drive | 70F | 779 | Not stated | S1 `LL_AllWheelContrUDS`; S20 used header 70F for Haldex on a T6 | Medium |
| unconfirmed | Tyre pressure monitoring | 70B | 775 | MQB/MLB per ODIS, RS 3 | S1 `LL_TirePressMonit1UDS`, S8, S9 | Medium |
| unconfirmed | Tyre pressure (A7 capture) | 72A | 794 | MLB (A7 capture) | S5 | Disagrees with the row above |
| unconfirmed | Steering angle sensor | 751 | 7BB | Not stated | S1 `LL_SteerAngleSendeUDS` | Medium |
| unconfirmed | Gear shift module | 753 | 7BD | Not stated | S1 `LL_GearShiftContrModulUDS` | Medium |
| 23 | Brake boost | 73B | 743 | e-Up only | S3; not in S1 | Low |
| AD | Brake system sensors | 762 | 7CC (S1) / 76A (S3) | Disagree | S1, S3 | Low |
| 51 | Electric drive | 7E6 | 7EE | e-Up | S1, S3 | High (EV only) |
| 8C | Hybrid battery management | 7E5 | 7ED | e-Up | S1, S3 | High (EV only) |

Not found: a public table of A6 C7 address word to CAN ID for every module. **Address 47 Sound system, 56 Radio, 0E Media player, 18 Auxiliary heating, 34 Level control, 36/06 Seat adjustment, 3C Lane change assist** are on the A6 4G Ross-Tech page but no CAN ID was confirmed for them.

**Useful for discovery on MLB:** gateway 710/77A, `22 2A2A` returns "the VAG addresses of the installed modules"; `2A29` and `2A2C` are parallel tables; the meaning of `2A29` is "a guess" (S7, 2014 A7). This would let the app list the car's modules the way Carista does.

---

## 2. Ford (Focus Mk3, about 2011-2018) and Mazda (2013-2018)

Response IDs: Ford and Mazda use response = request + 8 in every public source found. opendbc queries Ford and Mazda with the default `rx_offset: int = 0x8` (F5); S26 states the OBD rule "assigned ID plus 8". No public source gives a Ford or Mazda module that breaks this.

FORScan as-built prefixes (for example `726-41-02`) use the module's request ID as the first field (F3, M2).

### Ford

| Module | Request | Response | Applies to | Source | Confidence |
|---|---|---|---|---|---|
| PCM | 7E0 | 7E8 | Focus (F1), all Ford (F2) | F1, F2 `(Ecu.engine, 0x7e0)` | High |
| TCM | 7E1 | 7E9 | Standard OBD range | No Ford-specific source found | Unconfirmed for Ford |
| ABS | 760 | 768 | Focus (F1), 2019+ Ford incl. Focus Mk4 (F2) | F1, F2 `(Ecu.abs, 0x760)` | High |
| RCM (restraints) | 737 | 73F | Focus (F1) | F1 | Medium |
| OCSM (occupant classification) | 765 | 76D | Focus (F1) | F1 | Medium |
| IPC / IC (cluster) | 720 | 728 | Focus (F1), Explorer (F3) | F1, F3 | High |
| SJB / BCM | 726 | 72E | Focus "Smart Junction Box" (F1), Explorer "BCM" (F3) | F1, F3 | High |
| PSCM | 730 | 738 | 2019+ Ford (F2 `Ecu.eps 0x730`), Explorer (F3) | F2, F3 | Medium (no Focus Mk3 source) |
| APIM (SYNC) | 7D0 | 7D8 | Focus (F1), Explorer (F3), F2 comment "Accessory Protocol Interface Module" | F1, F2, F3 | High |
| HVAC | 733 | 73B | Focus (F1) | F1 | Medium |
| ACM (audio) | 727 | 72F | Focus (F1), Explorer (F3) | F1, F3 | High |
| FCIM | 7A7 | 7AF | Focus (F1) | F1 | Medium |
| FDIM | 7A6 | 7AE | Focus (F1) | F1 | Medium |
| DDM / PDM (doors) | 740 / 741 | 748 / 749 | Explorer 2016-18 (F3) | F3 | Low for Focus |
| SCCM (steering column) | 724 | 72C | Explorer (F3) | F3 | Low for Focus |
| IPMA camera / radar | 706 / 764 | 70E / 76C | 2019+ Ford (F2) | F2 | Not Focus Mk3 |
| GWM | 716 | 71E | None | Not found | Unconfirmed |

**Red flag, Ford bus:** FORScan (F4): "MS CAN bus occupies pins 3 and 11", and "Many Ford and Mazda models (approximately since 2003-2004) are equipped with MS CAN bus." A standard BLE adapter on pins 6/14 (HS CAN) may not see MS CAN modules. Which Focus Mk3 modules sit on MS CAN was not confirmed by any public source. MS CAN speed (125 kbit/s) also not confirmed by the sources read.

### Mazda

| Module | Request | Response | Applies to | Source | Confidence |
|---|---|---|---|---|---|
| PCM | 7E0 | 7E8 | "Mazda 6 2017-20", CX-5, Mazda3, CX-9 (M1); ND, CX-5, Mazda3 (M2) | M1, M2 | High |
| TCM | 7E1 | 7E9 | Same as M1 | M1 | High |
| ABS/DSC | 760 | 768 | Same as M1 | M1 | High |
| EPS | 730 | 738 | Same as M1 | M1 | High |
| Front radar | 764 | 76C | Same as M1 (fitted cars only) | M1 | Medium |
| Front camera | 706 | 70E | Same as M1 (fitted cars only) | M1 | Medium |
| IC (cluster) | 720 | 728 | ND MX-5, CX-5 KE/KF, Mazda3 BM/BN | M2 | Low for Mazda6 GJ |
| FBCM (front body) | 726 | 72E | Same as M2 | M2 | Low for Mazda6 GJ |
| RBCM (rear body) | 7B7 | 7BF | Same as M2 | M2 | Low for Mazda6 GJ |
| SSU (start stop unit) | 731 | 739 | Same as M2 | M2 | Low for Mazda6 GJ |
| RCM / airbag, HVAC, TPMS | | | | Not found | Unconfirmed |

Mazda6 GJ (2013-2016 pre-facelift) is not named in any source found. M1 covers "Mazda 6 2017-20" only.

---

## 3. UDS details

### 3.1 Service 19 02 (reportDTCByStatusMask)

Layout (S17):

- Request: `19 02 <DTCStatusMask>`.
- Positive response: `59 02 <DTCStatusAvailabilityMask>` then repeated `<DTC high> <DTC mid> <DTC low> <status>` (24-bit DTC + 8-bit status). Records are present "If at least one DTC matches the criteria."
- Matching rule (S17): "A DTC is included in the response if `(DTC Status & DTCStatusMask) != 0`."
- Long lists come back multi-frame, so flow control must work (see section 5).

Status bits, from Volkswagen's own Tech Tip (S15, all models 2006-2019): bit 0 testFailed ("set to 1 if the fault is active ... 0 if the fault is passive or sporadic"), bit 1 testFailedThisOperationCycle, bit 2 pendingDTC, bit 3 confirmedDTC, bit 4 testNotCompletedSinceLastClear, bit 5 testFailedSinceLastClear, bit 6 testNotCompletedThisOperationCycle, bit 7 warningIndicatorRequested ("MIL light is turned on"). S16 gives the same ISO names.

Which mask:

| Mask | Bits | Who uses it | Source |
|---|---|---|---|
| 0x2D | 0, 2, 3, 5 ("failing now / pending / confirmed / failed since clear") | dtcsweep (VW); narrows the mask if a module answers responseTooLong | S11 |
| 0xAE, 0xAF, 0x08 | AF = 0, 1, 2, 3, 5, 7 | Car Scanner on VW MEB (emulator log); "5902FF" is the no-DTC reply | S21 |
| 0x08 | confirmed only | ISO meaning | S16 |
| 0xFF | all bits | No VW-specific source found either way | Unconfirmed |

Advice: use **0x2D** (or 0xAF) for "stored faults". Mask 0xFF also matches bits 4 and 6 (test not completed), which by the S17 rule can return DTCs that have never failed; this is my reading of the rule, not a reported VW behaviour. **Whether VW modules reject 0xFF: not confirmed by any source found.** Show bit 0 as "active/static" versus "passive/sporadic" per S15.

Related A7 finding (S5): most modules refuse `19 01` (count) with NRC 0x12 subFunctionNotSupported, and the airbag replied with a short `59 01 00 00`. Use 19 02 directly.

### 3.2 DTC text format (for example U111300, P071600)

- 3-byte DTC: first 2 bytes are the SAE J2012 code, third byte is the failure type byte (FTB). S16 shows the text form as letter + 4 digits + dash + 2 symptom digits.
- First byte bits 7-6: P = 00, C = 01, B = 10, U = 11; second character 0-3 from bits 5-4; the remaining digits are hex (S26, S16).
- So `D1 13 00` decodes to `U1113` + `00` = "U111300". This matches the Carista-style text.
- VCDS shows UDS faults differently: a VAG fault number (decimal, "the number of digits may vary" on UDS modules) and on the second line the P-code (S14). Ross-Tech titles a UDS fault as "29797/U1101/053505" (https://wiki.ross-tech.com/wiki/index.php/U1101). dtcsweep shows "369232 [05A250]" (decimal and hex of the 3 bytes). How VCDS derives "29797" from the DTC bytes: not known.
- Note from S11: P/C/B/U letters "only carry standard SAE meanings for emissions-relevant codes".

### 3.3 Service 14 FF FF FF (clear all)

- Format: `14 FF FF FF`, groupOfDTC 0xFFFFFF = "all" (S17). ISO 14229-1:2020 adds an optional MemorySelection byte.
- Session or security needs on VW modules: **not confirmed by any public source found.**
- VCDS notes (S14): some faults cannot be cleared (for example internal processor faults); individual codes cannot be erased while others remain; the ignition may need cycling after a clear.
- Recommendation: keep the app read-only until a capture from the owner's car shows the module's reply.

### 3.4 Identification DIDs

| DID | ISO name (S18) | VW label and example (S12, MQB gateway) | Other source | Confidence |
|---|---|---|---|---|
| F187 | VEHICLE_MANUFACTURER_SPARE_PART_NUMBER | "Part number: 3Q0907530AR" | S19: 11 characters, short numbers padded with spaces (0x20), for example `04E906016A ` | High |
| F189 | VEHICLE_MANUFACTURER_ECU_SOFTWARE_VERSION_NUMBER | "Software version: 5504" | S19: 4 characters | High |
| F191 | VEHICLE_MANUFACTURER_ECU_HARDWARE_NUMBER | "Hardware number: 3Q0907530E" | S11 reads it | High |
| F197 | SYSTEM_NAME_OR_ENGINE_TYPE | "System name: GW MQB High" | S11 reads it | High |
| F18C | ECU_SERIAL_NUMBER | "Serial number: 17092330000876" | | High |
| F19E | ODX_FILE | "ODX variant: EV_GatewNF" | S1 says module names can be inferred from the ASAM dataset identifier | High |
| F1A3 | none (0xF1A0-0xF1EF is manufacturer-specific) | "Hardware version: 524" | OBDCracker #49 calls it hardware version | Medium |
| F1A2 | none | "ODX version: 013026" | S2 names it ASAM ODX file version | Medium |
| F17C | none | "FAZIT: 8PO-CGQ17.09.23..." | | Medium |
| F1AA | none | | OBDCracker #49 calls it "workshop system name" (https://github.com/DaSonOfPoseidon/OBDCracker/issues/49) | Low |
| 0600 | VW-specific | "Coding: 0309000..." (long coding, hex) | S5: A7 coding values per module, 1 to 18 bytes | High |

**0x55 padding finding (red flag in our own code):** S19 shows VW returns F187 as exactly 11 characters, space-padded. "03L906018LB" is 11 characters. The reply `62 F1 87` + 11 bytes = 14 bytes, which arrives as a First Frame (6 data bytes) and 2 Consecutive Frames (7 + 1 data bytes). The last frame then carries exactly 6 unused bytes, matching the 6 "U" (0x55) seen. The First Frame holds the real message length in 12 bits (S25). So the "UUUUUU" is CAN frame padding read past the end of the message, not part of the DID. Fix: truncate the reassembled payload to the First Frame length. That the ECU pads with 0x55 is what our capture shows; no public VW source for the padding value was found. The ELM327 pads its own frames with 00 by default (PP 26, S22).

### 3.5 Does 0x0600 need an extended session?

- 2014 A7 (S5): "Most modules return 0600 in the default session." Sensor cluster (78B), tyre pressure (794) and parking brake (7BC) refused with `7F 22 31` (requestOutOfRange).
- Some other DIDs do need `10 03`: A7 HUD DIDs 0100 and 0102 only in extended session (S5); OBDb RS 3 reads cluster DIDs 202F, 2203, 2294, 229A in session 03 (S8). Keep the session alive with `3E 00` (S5) and return with `10 01` (S11).

---

## 4. Live-data DIDs (VW group)

None of these come from a VW document. All are community-sourced and engine or model dependent. The 2012 A6 2.0 TDI with ECU 03L906018LB is not named in any source.

| Value | Module | Request | DID | Formula | Applies to | Source | Confidence |
|---|---|---|---|---|---|---|---|
| Battery voltage (adapter pin) | ELM327 | n/a | `AT RV` | volts as text | Any | S23 ("RV Read the Voltage", v1.0) | High (measures at the OBD socket) |
| Control module voltage | Engine | 7DF or 7E0 | OBD service 01 PID 42 | (256A+B)/1000 V | OBD standard | S26 | High (standard), not tested on VW |
| Battery voltage | Gateway | 710/77A | 2A07 | 16 bit, div 1000, add 4 (as written) | MQB Golf | S10 | Low |
| Battery voltage at rest | Gateway | 710/77A | 2A10 | 8 bit, div 10, add 9 | MQB Golf | S10 | Low |
| Odometer (cluster) | Cluster | 714/77E | 2203 | 24 bit, km | Audi A6 signalset; RS 3 reads it in session 03 | S9, S8; S3 defines it for e-Up | Medium |
| Odometer (engine) | Engine | 7E0/7E8 | 295A | 24 bit km (S10, S20) or 32 bit km (S9) | MQB Golf, T6 CXEB, A6 | S10, S20, S9 | Medium (bit length disagrees) |
| Odometer (gateway) | Gateway | 710/77A | 2A0A | 32 bit, km | A6 signalset | S9 | Low |
| Service distance | Cluster | 714/77E | 2260 | uint16, km, 0 ignored | e-Up only | S3, S4 | Low for MLB/MQB |
| Service days | Cluster | 714/77E | 2261 | uint16, days | e-Up only | S3, S4 | Low for MLB/MQB |
| DPF soot calculated / measured | Engine | 7E0 | 114F / 114E | (A*256+B)/100 g | 2016 T6 (one poster; failed on CXEB) | S20 | Low |
| DPF oil ash | Engine | 7E0 | 178C | (A*256+B)/10 g | 2016 T6 (one poster) | S20 | Low |
| DPF soot calculated / measured | Engine | 7E0 | 208B / 208C | (A*256+B)/100 g | 2018 T6 CXEB (CAN sniff) | S20 | Low |
| DPF oil ash | Engine | 7E0 | 406C | (A*256+B)/100 g | 2018 T6 CXEB | S20 | Low |
| Gearbox (DSG) temperature | Gearbox | 7E1 | 2104 | A, degrees C ("Totally not sure" before later agreement) | T6 DSG | S20 | Low; not for A6 C7 gearboxes |
| Crash counters front / driver / passenger / rear / rollover | Airbag | 715/77F | 2353 / 2354 / 2355 / 2356 / 2357 | 8 bit count each | Audi A6 signalset (generation not stated) | S9 | Low to medium |
| Engine oil temperature | Cluster | 714 | 202F | A - 58 | Audi A6 signalset | S9 | Low |
| Oil level | Engine | 7E0 | 11BA | 16 bit, div 250 (S9) or div 2500 cm (S10) | A6, Golf | S9, S10 | Low (disagree) |

Not found: any public DID for battery voltage from the engine ECU over UDS, service interval on an MLB or MQB cluster, or gearbox temperature for the A6 C7 gearboxes (multitronic 0AW, S tronic). Mark these unconfirmed in code until read on the owner's car.

---

## 5. ELM327 flow control (ATFCSH / ATFCSD / ATFCSM)

- Commands exist and were added in **v1.1**: the Elm AT command table (Oct 2010) lists `FC SD [1-5 bytes]`, `FC SH hhh`, `FC SH hh hh hh hh`, `FC SM h` as "1.1" (S23). Wikipedia: "v1.1 ... Added Flow Control commands" (S24). `CRA hhh` was added in 1.3 (S23).
- Datasheet (S22, ELM327DSJ v2.1):
  - `FC SH hhh`: header for Flow Control messages; "This command only affects Flow Control mode 1."
  - `FC SD`: "One to five data bytes may be specified", rest filled with the CAN filler byte.
  - `FC SM h`: "0 (the default) for fully automatic responses, 1 for completely user defined responses, or 2 for user defined data bytes". Modes 1 and 2 return an error (`?`) unless the header and data are set first.
  - Order shown in the datasheet: `AT FC SH 7E8`, `AT FC SD 00 11 22`, `AT FC SM 1`.
  - "the ELM327 will only send Flow Control messages if the protocol's data format is ISO15765-4".
- Mode 0 sends the flow control the ISO 15765-4 way (S22), which suits OBD pairs that differ by 8. VW pairs differ by 0x6A, so for the cluster use: `AT FC SH 714`, `AT FC SD 30 00 00`, `AT FC SM 1`. Car Scanner does the same on VW (S21: "ATFCSD300000", "ATFCSM1"). How mode 0 picks the flow-control ID is not spelled out in the datasheet; the "response minus 8" behaviour is inferred from the OBD convention (S26).
- **Red flag, adapter version:** Wikipedia (S24): "Elm Electronics never made a v1.5"; clones may "report an as-yet non-existent version". A Carista adapter reporting "ELM327 v1.5" is not a genuine Elm chip, so FC command support is not guaranteed by the version string. Test at start-up: send `AT FC SH 714`, `AT FC SD 30 00 00`, `AT FC SM 1` and treat `?` as "no custom flow control".

---

## Red flags summary

1. Our ISO-TP reassembly reads padding as data ("03L906018LBUUUUUU"). Truncate to the First Frame length.
2. +0x6A is not universal: e-Up (S3) has +8 pairs; TPMS pair differs between ODIS (70B/775) and the A7 capture (72A/794).
3. 2014 A7 discovery did not find the MMI (5F); some MLB modules refuse 0600 and 19 01.
4. Ford and Mazda body modules may be on MS CAN (pins 3/11), out of reach of a pins 6/14 adapter. Not confirmed per module.
5. All live-data DIDs are community-sourced and vary by engine code; none is confirmed for the owner's 03L906018LB engine.
6. The adapter's "v1.5" string is not a real Elm version.
