# Caristini: SEAT Leon II Cupra (1P1, PQ35) sources

Research note, 11 Nov 2026. Car: 2007 SEAT Leon Cupra, type 1P1 (Leon II, PQ35), VIN VSSZZZ1PZ7R000000, 2.0 TFSI (owner believes BWJ, 240 PS), probably 6-speed manual. Adapter: Carista BLE, reports "ELM327 v1.5" (clone), OBD pins 6/14.

Companion to `tp20-sources.md` (TP2.0 framing, ELM327 recipes, timing), `uds-sources.md` and `coding-sources.md` (section B already lists Leon 1P coding items). This note does not repeat the TP2.0 frame layouts; it adds what is specific to the KWP2000 application layer on PQ35 cars and to the Leon.

Confidence key (same as the other notes):

- **High**: two or more independent public sources agree, or one primary source plus a real-car capture.
- **Medium**: one public source, or two sources that agree only by inference.
- **Low**: single community post, different car or bus (K-line, not TP2.0), untested code, or sources disagree.
- **Unconfirmed**: no public source found. Do not ship as fact.

"Independent" matters here: kw1281test's formula table is a copy of blafusel's, and vag-tool's formula table is a copy of VAG Blocks' and teensycanbusdisplay's. Copies are counted once.

---

## Answer in brief

| Question | Answer | Confidence |
|---|---|---|
| Protocol of the 2007 Leon modules | KWP2000 over TP2.0 through the gateway, for the modules that matter (01, 09, 17, 44, 46 and others). The Leon 1P range (2006 to 2013) also had UDS cluster variants, probably later ones. No public source shows KW1281 or UDS on a 2007 1P1. | Medium (inference, see 1.1) |
| TP2.0 address = VCDS address? | No. Gateway 0x1F (VCDS 19) and power steering 0x09 (VCDS 44) are proven on PQ cars. 17, 09, 46 logical addresses on PQ35: **not public**. Read them from the gateway with `1A 9F`. | High that they differ; values for 17/09/46 Unconfirmed |
| `1A 9F` record format | Two length-prefixed blocks ending in `FF`; block 1 holds 4-byte records `[VCDS number, TP2.0 address, unknown, status]`, status bit 0 = present. One implementation only (VAG Blocks). | Medium |
| Identification | `1A 9B`: part number (12), software version (4), coding type/length byte (`03` = 3-byte short coding), coding (3), workshop code (6), component text (20), then 47-byte subsystem blocks. `1A 91`: length-prefixed strings. | High for part, SW, text and short coding offsets; Medium for the rest |
| Measuring blocks | `21 <group>` → `61 <group>` then 3-byte cells `[formula, A, B]`, 4 cells on older ECUs, up to 8 on TP2.0 ECUs padded with `25 00 00`. The formula byte makes values self-describing. | High |
| Boost | Engine 01 group 115: field 3 specified, field 4 actual (absolute mbar) on the MED9 2.0 TFSI. Standard OBD PID `01 0B` (MAP) is a second route. | Medium (group 115); High (PID exists in J1979, car support to test) |
| Oil temperature, odometer on the cluster | No PQ35 source. Some Mk5 2.0 TFSI cars have no oil temperature sensor. Find values by unit: formula 36 (`0x24`) is km, 5 and 26 (`0x1A`) are °C. | Unconfirmed |
| Coding write | `3B 9A <workshop code:6> <SW version:4 ASCII> 03 <coding:3>` for 3-byte short coding (cluster). Shown in 2 codebases, neither on TP2.0 or a Leon. Long coding (09, 46) write bytes: **not public**. | Low (short); Unconfirmed (long) |
| Security access | `27 03` → `67 03 <seed:4>`; `27 04 <seed + code, 32-bit>`. 3 codebases agree on the formula. | Medium |
| Adaptation (service reset) | Ross-Tech: cluster channel 002 = 0 resets the service reminder, after security access 13861. KWP2000 bytes: a `31 B8/B9/BA/BB` + `32 B8` routine family, but the two sources disagree on what each routine does, and neither is a cluster. | Channel High; bytes Low |
| Clone ELM327 and TP2.0 | Possible with raw CAN, but ACK timing through BLE is the risk. Covered in `tp20-sources.md` section 4. | Medium |

---

## Sources

| Key | Source | URL | Notes |
|---|---|---|---|
| P1 | jazdw/vag-blocks (GPL-3.0), `kwp2000.cpp`, `README.md`, last push 19 Oct 2020 | https://github.com/jazdw/vag-blocks/blob/master/kwp2000.cpp | ELM327 TP2.0 tool for PQ cars. `1A 9F`, `1A 9B`, `1A 91`, `21` parsing, formula table |
| P2 | gmenounos/kw1281test (MIT), `Tester.Kwp2000Diag.cs`, `Tester.Kwp2000DiagHelpers.cs`, commit 23142fb9 by Blair Campbell, 4 Sep 2026, "KWP2000: protocol layer + full diagnostics over K-line" | https://github.com/gmenounos/kw1281test/blob/master/Tester.Kwp2000Diag.cs | VAG KWP2000 on **K-line, EDC16 diesel ECU**: identification, coding write `3B 9A`, workshop code codec, adaptation routines, security access |
| P3 | kw1281test `Blocks/SensorValue.cs` | https://github.com/gmenounos/kw1281test/blob/master/Blocks/SensorValue.cs | Formula table, comment cites P4 (a copy of P4, not independent) |
| P4 | blafusel.de, "KW1281", Florian Schäffer, last change 15 Jul 2009 | https://www.blafusel.de/obd/obd2_kw1281.html | Measuring value formula table, IDs 1 to 70 |
| P5 | blafusel.de, "VAG KW 2000 Protokoll", Florian Schäffer, created 15 Jul 2009, modified 23 Feb 2016 | https://www.blafusel.de/obd/vag_kw2000.html | K-line only. `10 89`, `1A 9B` with a real ME7.1 response |
| P6 | blafusel.de forum, "OBD2 VAG KWP2000 Kodierung", lukas425608, 1 Sep 2022 | https://blafusel.de/phpbb/viewtopic.php?f=15&t=3710 | Real `1A 9B` response from a radio at address 0x56 (K-line) |
| P7 | TBK/vag-tool (Rust, no licence file), `README.md`, `src/kwp2000.rs`, `src/blocks.rs`, last push 21 Oct 2026 | https://github.com/TBK/vag-tool | KWP2000 over TP2.0 for an Audi A3 8P (PQ35) 2.0 TDI. README: "**Not yet tested against the car.**" |
| P8 | michaeldove/vag-diag-sim (MIT), `vagvehicle.py`, 2017 | https://github.com/michaeldove/vag-diag-sim/blob/master/vagvehicle.py | TP2.0 simulator with canned responses labelled "2.0l R4/4V TFSI". Origin of the bytes not stated |
| P9 | I-CAN-hack/pq-flasher (MIT), `kwp2000.py`, `01_dump.py`, `03_flasher.py`, last push 11 Mar 2024 | https://github.com/I-CAN-hack/pq-flasher | Real PQ35 power steering on TP2.0 address 0x09: `10 89`, `1A 9B`, `1A 9C`, `27 01/02` |
| P10 | seishuku/teensycanbusdisplay, `vwtpkwp2k.c`, 2019 | https://github.com/seishuku/teensycanbusdisplay/blob/master/vwtpkwp2k.c | Real 2013 Jetta TDI, `21 xx` capture with 8 cells, formulas 0x60 and 0x7E |
| P11 | MartijnD92/PyVCDS, `vw.py` | https://github.com/MartijnD92/PyVCDS/blob/master/vw.py | PQ address table (2007 VW), formula table |
| P12 | OVMS v3 `xvu-ecu.js` (e-Up / Mii, NSF platform, 2013 onwards) | https://github.com/openvehicles/Open-Vehicle-Monitoring-System-3/blob/master/plugin/v-vweup/ecutoolkit/xvu-ecu.js | TP2.0 logical addresses 09 = 0x20, 08 = 0x2C, 19 = 0x1F, 61 = 0x33; gateway list via `22 04A1` |
| P13 | uholeschak/ediabaslib, `BmwDeepObd/VagCodingActivity.cs`, `XmlToolActivity.cs`, `docs/Deep_OBD_for_BMW_and_VAG.md` | https://github.com/uholeschak/ediabaslib | VAG coding through EDIABAS jobs (bytes inside binary job files, not in source). VAG mode needs replacement ELM327 firmware |
| R8 | Ross-Tech wiki, Seat Leon (1P) | https://wiki.ross-tech.com/wiki/index.php/Seat_Leon_(1P) | Module list |
| R9 | Ross-Tech wiki, Seat Leon (1P) Instrument Cluster (redirects to VW Golf (1K)) | https://wiki.ross-tech.com/wiki/index.php/Seat_Leon_(1P)_Instrument_Cluster | Short coding, security access 13861, adaptation channels |
| R10 | Ross-Tech wiki, Seat Leon (1P) Central Electronics (redirect, example is a 2006 Passat) | https://wiki.ross-tech.com/wiki/index.php/Seat_Leon_(1P)_Central_Electronics | Adaptation 000 to 008 and the coding bits they depend on |
| R12 | Ross-Tech wiki, 2.0l TFSI (AXX/BGB/BPJ/BPY/BWA) | https://wiki.ross-tech.com/wiki/index.php/2.0l_TFSI_(AXX/BGB/BPJ/BPY/BWA) | Groups 103, 106, 140, 230; basic settings. No group 115, no BWJ |
| S1 | SeatCupra.net, "GUIDE: The Mk2 Leon VAG-COM Guide", DanGB, 10 Apr 2008, edited 20 May 2010, "2006 Sport" | https://www.seatcupra.net/forums/threads/guide-the-mk2-leon-vag-com-guide.167515/ | Leon 1P bytes and bits (already in `coding-sources.md` B) |
| S2 | SeatCupra.net, "VCDS coding - faults found - help", 9 Oct 2023, 2012 Leon 1P, VCDS 23.3.1 | https://www.seatcupra.net/forums/threads/vcds-coding-faults-found-help.474010/ | 09 = 5K0 937 087 R "BCM PQ35 H", 30-byte long coding, no ASAM line; 44 shop code "WSC 06402 785 00200" |
| V1 | vis4vag, Seat Leon (1P) control unit list | https://diagnostics.vis4vag.com/en/seat/leon-1p | Variants tagged "CAN" or "UDS" per address |
| V2 | vis4vag, Leon 1P, "17 - dashboard -> 10/08 (KOMBIINSTRUMENT VD1/VDD) CAN", fixed service interval reset (demo mode, numbers masked) | https://diagnostics.vis4vag.com/en/seat/leon-1p/17-dashboard-10-08-kombiinstrument-vd1-vdd-can/reset-of-service-intervals-fixed-service-interval | Channel names only |
| V3 | vis4vag, Leon 1P, "17 - dashboard KOMBI (EV_DashBoardUDSJCIPQ25) UDS", QI6 reset (masked) | https://diagnostics.vis4vag.com/en/seat/leon-1p/17-dashboard-kombi-ev-dashboardudsjcipq25-uds/reset-of-variable-oil-change-interval-qi6 | UDS cluster variants exist for the 1P |
| A1 | APR, "VAG-COM/VCDS Logging" (read with curl and a browser user agent; WebFetch got HTTP 403) | https://www.goapr.com/support/vcds_logging/ | "MED 9 ECU found in the 2.0 TFSI": 115-3 boost specified, 115-4 boost actual |
| O1 | OBDeleven forum, "Oil temperature", thread 3518, Apr 2018 to Mar 2020 | https://forum.obdeleven.com/thread/3518/oil-temperature | Mk5 GTI (BWA) owner: no oil temperature sensor; "channel 134 value 1" claim |
| N1 | car-auto-repair.com, "Needle Sweep staging calibration by VCDS for Seat Leon", 8 Oct 2020 | https://www.car-auto-repair.com/needle-sweep-staging-calibration-by-vcds-for-seat-leon/ | Uses UDS channel "IDE01087-Staging": a Leon 5F (MQB) method, **not 1P** |
| T1, T6, T7, T11, T12, T16, E1 | As in `tp20-sources.md` | | TP2.0 framing, ELM327 behaviour |

Blocked or not readable on 11 Nov 2026: vag-coding.net (HTTP 404 on every Leon 1P page), vwvortex.com, uk-mkivs.net, ttforum.co.uk (paywall redirect), mhhauto.com and audizine.com (403). Nothing from them is used as evidence.

---

## 1. Modules, protocols and addresses on a 2007 Leon 1P1

### 1.1 Which protocol

| Evidence | What it shows | Source |
|---|---|---|
| vis4vag lists Leon 1P variants as "09 - central electrics (BCM PQ35) CAN", "46 - comfort system - (KSG PQ35)", "19 - Gateway (J533 Gateway) CAN", "44 - steering booster 3. of generation ... CAN", "17 - dashboard -> 10/08 (KOMBIINSTRUMENT VD1/VDD) CAN" | CAN modules. vis4vag tags UDS variants separately, so "CAN" here reads as KWP2000 over TP2.0 (inference) | V1 |
| The same list has UDS cluster variants: "17 - dashboard KOMBI (EV_DashBoardUDSJCIPQ25) UDS" and six "KOMBI VDD RM09" entries; also UDS variants of 08, 16 and 55 | The 1P range (2006 to 2013) had both. Which one a 2007 car has: not stated | V1, V3 |
| 2012 Leon 1P scan (VCDS 23.3.1): 09 "BCM PQ35 H 021 0064", 30-byte long coding, no "ASAM Dataset" line; 44 "EPS_ZFLS Kl. 142", no ASAM line | On VCDS, UDS modules print an ASAM line (see `tp20-sources.md` 1.1). Even a 2012 car's 09 and 44 are non-UDS | S2 |
| PQ35 power steering opened on TP2.0 0x09 and answered `10 89` and `1A 9B` (real car, panda) | KWP2000 over TP2.0 on PQ35 | P9 |
| A3 8P (PQ35) 2.0 TDI engine on TP2.0 0x01, KWP2000 | Same platform, different engine. Untested on the car | P7 |

Reading: on a 2007 1P1, expect KWP2000 over TP2.0 for 01, 02 (if DSG), 03, 08, 09, 15, 16, 17, 19, 44, 46 and the doors. **Medium.** A cluster that does not open a TP2.0 channel may be one of the UDS variants: try UDS on 0x714/0x77E (the VW UDS cluster IDs seen on e-Up, P12; not shown on a Leon, **Low**).

KW1281 (K-line, pin 7): no public source shows any 2007 Leon module on KW1281. The ELM327 cannot run KW1281 (byte-by-byte complement handshake; P13 and kw1281test both need a "dumb" KKL cable or replacement firmware). **Unconfirmed** whether any module on this car needs it; the gateway list will show what is installed.

### 1.2 Modules on the Leon 1P (R8)

01 Engine, 02 Transmission (DSG 02E or 09G auto), 03 Brakes (MK60 or MK70), 08 HVAC, 09 Central Electronics, 15 Airbag, 16 Steering wheel, 17 Instruments, 18 Aux heating, 19 CAN gateway, 25 Immobiliser, 37 Navigation, 3D Special functions, 42 / 52 / 62 / 72 Doors, 44 Steering assist, 46 Comfort, 47 Sound, 55 Headlight range, 56 Radio, 69 Trailer, 76 Parking aid, 77 Telephone, 7D Aux heater. Not all are fitted to every car. A manual Cupra has no 02.

### 1.3 TP2.0 logical addresses (destination byte in `<addr> C0 00 10 00 03 01`)

| VCDS | Module | TP2.0 address | Car | Source | Confidence for the Leon |
|---|---|---|---|---|---|
| 01 | Engine | 0x01 | PQ engine (T1), 2013 Jetta TDI (P10), A3 8P (P7), "2.0l R4/4V TFSI" simulator (P8) | T1, P10, P7, P8 | **High** |
| 02 | Gearbox | 0x02 | VW TCU | T9 in `tp20-sources.md`, P11 | Medium |
| 03 | ABS | 0x03 | 2007 VW | P11 | Medium |
| 15 | Airbag | 0x05 | 2007 VW | P11 | Low (one source) |
| 19 | Gateway | **0x1F** | VAG Blocks (PQ), PyVCDS (2007 VW), OVMS (Seat Mii) | P1, P11, P12 | **High**. vag-tool's README says "the gateway is `0x19`" (untested, P7): disagrees, do not use |
| 44 | Power steering | 0x09 | PQ35 EPS (real), Golf Mk6 (T8) | P9, T8 | **High** |
| 09 | Central electronics | 0x20 on e-Up (NSF, 2013+) | e-Up | P12 | **Unconfirmed** for PQ35; P11 marks 0x09 on a 2007 VW as power steering, so 09 is not 0x09 |
| 08 | HVAC | 0x2C on e-Up | e-Up | P12 | Unconfirmed for PQ35 |
| 17 | Instruments | not found | | | **Unconfirmed** |
| 46 | Comfort | not found | | | **Unconfirmed** |
| 42 / 52 | Doors | 0x52 was the radio head unit on a 2007 VW | 2007 VW | P11 | Unconfirmed; do not assume |

P11 states the issue in a code comment: "ross-tech IDs seem to diverge from components on CAN-bus vehicles". vag-tool (P7) uses the VCDS number as the TP2.0 address for all 89 modules; that table comes from a K-line project and is untested on CAN. **Do not use VCDS numbers as TP2.0 addresses except where the table above says High.**

---

## 2. Gateway module list: `1A 9F`

### 2.1 What VAG Blocks does (P1, `kwp2000.cpp`)

1. Open a TP2.0 channel to destination **0x1F** (`openChannel(31)`).
2. Send `1A 9F` straight away. No `10 89` first: VAG Blocks sends `1A 9F` in the channel-open handler only "if `tp->getChannelDest() == 31`", and `10 89` for every other module.
3. Positive answer `5A 9F <data>`.
4. Split `<data>` into length-prefixed blocks: first byte = block length **including the length byte**, then length minus 1 data bytes; stop at a length byte of `FF` (`interpretRawData`). Expect exactly 2 blocks, else close the channel.
5. Block 1 holds 4-byte records:

| Offset | Field (VAG Blocks name) | Use |
|---|---|---|
| 0 | `number` | VCDS address, e.g. 0x17 (matched against the VCDS name table: 0x17 "Instrument Cluster", 0x46 "Comfort System") |
| 1 | `addr` | TP2.0 logical address to open a channel to |
| 2 | (not used) | unknown |
| 3 | status | record skipped if 0; bit 0 = present; bits 1 to 4 = status (`(lsb & 0x1E) >> 1`) |

6. Skip records whose address is 0x13: "module numbers 0x0 and 0x4 seem to report this addr but these modules dont exist".
7. Block 2: not parsed by VAG Blocks. Contents unknown.
8. Close the channel (`A8`). To open module N, look up `moduleList[N].addr`; if N is not in the list, VAG Blocks falls back to using N itself.

Confidence: **Medium**. One implementation (OBDScanner, T11, copies it). No published raw `5A 9F` capture found. The meaning of the status bits 1 to 4 is not given.

### 2.2 Other gateway list formats (do not mix)

- OVMS on the e-Up reads the list with UDS-style `22 04A1` over TP2.0 after `10 89`, 4-byte records `[VCDS id, 3 bytes]`, installed = bit 0 of the record's third byte (P12). A newer gateway generation; different service and different status byte position from 2.1.
- MLB (A7) used UDS DIDs 2A2A/2A29/2A2C (`tp20-sources.md` 1.2). Not relevant to PQ35.

### 2.3 Fallback if `1A 9F` is refused

Probe TP2.0 setup on addresses 0x01 to 0x7F (setup, `A0`, `10 89`, `1A 9B`, `A8`: all read-only), and identify each responder by its `1A 9B` part number (for example 1P0 920 ... = cluster, 1K0 937 ... or 1K0 937 049 ... = central electronics, 1K0 959 433 ... = comfort). Part number families are from R10 and S2 examples; matching rules are mine.

---

## 3. Identification over KWP2000

### 3.1 `1A 9B` (VAG "ECU identification")

Request after `10 89`. Response `5A 9B <data>`. Byte offsets below count from the `9B` echo (offset 0), as P2 and P7 do.

| Offset | Length | Field | Sources |
|---|---|---|---|
| 1 | 12 | Part number, ASCII, space padded ("022906032GK ", "5Z0035152D  ") | P5 sample, P6 capture, P1 (takes bytes 1 to 16 as part + SW), P2, P7, P9 (prints `ident[:10]`) |
| 13 | 4 | Software version, ASCII ("6243", "0004") | P5, P6, P2, P7 |
| 17 | 1 | Coding type / length. `03` = 3-byte short coding | P5 (`03`), P6 (`3`), P2 ("length of the value that follows"), P7 ("coding length"). P8 simulator has `10` here for a TFSI: meaning not known |
| 18 | 3 | Coding, big endian. Mask `0x7FFFFF` (P7); P2 notes the top bit is set for a login value (`0x800000|login`) | P6: `00 27 D8` = 10200, which the poster read as the radio's coding "10200". P2, P7 |
| 21 | 6 | Workshop code record (WSC / importer / equipment, packed, see 3.3) | P2, P7 |
| 27 | 20 | Component text ("MOTRONIC ME7.1.*G", "Radio DE2") | P5, P6, P1 (from offset 27 to end), P2, P7 ("system description" offsets 27 to 46) |
| 47 | 47 each | Subsystem blocks (wiper, rain/light sensor on 09) | P7 only. **Low** |

Confidence: **High** for part number, software version and component text (3 independent readers, 2 real responses, plus P9 on a real PQ35 EPS over TP2.0). **Medium** for coding at offset 18 and the type byte (2 real K-line responses agree; no TP2.0 capture). **Unconfirmed** for long-coded modules (09 BCM with 30 bytes, 46): the type byte will not be `03` and the layout from offset 17 may change. Show raw bytes for those.

On the 2014 A7 (MLB) `1A 9B` was refused with `7F 1A 11` (`tp20-sources.md` T15). On PQ35 it is answered (P9 real car, P1). Keep the fallback to `1A 91`.

### 3.2 Other identification requests

| Request | Answer | Source | Confidence |
|---|---|---|---|
| `1A 91` | `5A 91` then length-prefixed ASCII strings (first byte = length including itself) until `FF`. Simulator example: `0E "8P0907115B   " FF` | P1 (`shortIdHandler`), P8 | Medium |
| `1A 9A` | `5A 9A <6 bytes> <SW 4> <type> <coding...> FF` in the simulator: the same shape as the `3B 9A` write record (3.4) | P8 only; P7 calls 0x9A the "coding identifier, for both writeDataByLocalIdentifier and readEcuIdentification" | Low |
| `1A 9C` | flash status | P9 (PQ35 EPS) | Medium (not needed) |
| `1A 86`, `1A 92`, `1A 94` | extended ident, supplier HW / SW numbers | nefariousmotorsports thread seen as a search snippet only | Unconfirmed |
| `22 0600` (coding) | Used over TP2.0 on the e-Up's 09, 08, 61 | P12 | Unconfirmed on a 2007 PQ35 module |

### 3.3 Workshop code record (6 bytes)

P2 (`DecodeKwp2000Wsc`): 48-bit big endian; bits 0 to 16 = WSC (5 digits), bits 17 to 26 = importer, bits 27 to 46 = equipment number, bit 47 unused. Worked example in P2: WSC 45678, importer 345, equipment 987654 → `78 90 32 B2 B2 6E`.

Check against real data (arithmetic mine): P6's radio bytes `00 06 46 22 00 00` decode to WSC 00000, importer 785, equipment 00200. A real 2012 Leon VCDS scan prints "WSC 06402 785 00200" for module 44 (S2): the same importer and equipment numbers. P5's ME7.1 `00 00 00 00 19 23` decodes to WSC 06435. **Medium-High** for the codec.

### 3.4 Coding record used by `3B 9A`

| Field | Length | P2 (EDC16, K-line, tested on a car per its comments) | P7 (A3 8P TP2.0, untested) |
|---|---|---|---|
| Workshop code | 6 | Echo the 6 bytes from `1A 9B` offset 21, or encode a new one (3.3) | "4 bytes" of unknown meaning + 2-byte WSC (example `05 97 38 DE` + `30 39` = 12345) |
| Software version | 4 | Echo `1A 9B` offset 13 to 16 | "software version in ASCII" |
| Length / type | 1 | `03` | `03` |
| Value | 3 | New coding, big endian (or `0x800000 | login`) | 3-byte code |

Both agree on the shape `3B 9A <6> <SW 4> 03 <3>`. They disagree on what the first 6 bytes mean; P2's reading (the packed WSC) matches the real decodes in 3.3. Positive answer: `7B 9A` (KWP rule SID + 0x40; no capture found). P2 waits 3 s after the write because the EDC16 re-initialises.

---

## 4. Measuring blocks (`21 <group>`)

### 4.1 Request and response

- Request `21 <group>`, group 1 to 255, after `10 89`. Response `61 <group>` then 3-byte cells `[formula, A, B]`. **High** (T1 trace, P1, P2, P7, P10).
- KW1281-era ECUs return 4 cells (P4). TP2.0 ECUs can return more: P10's real 2013 Jetta capture has message length `0x1A` (26) = `61` + group + 8 cells; P2 says EDC16 bodies are "padded to a fixed 8 cells with 0x25 00 00 markers"; P8 pads with `25 00 00`. Treat trailing `25 00 00` cells as empty. **High** (2 real ECUs plus simulator).
- P2 notes some EDC16 ECUs "IGNORE readDataByLocalIdentifier (measuring blocks) until a startDiagnosticSession has been sent". Always send `10 89` first.
- VAG Blocks polls with a 16 ms ELM listen timeout and reaches "up to 12 samples per second" (P1).

### 4.2 Formula table

`F` = formula byte, `a` = A, `b` = B. Primary table: P4 (blafusel, 1 to 70; P3 is a copy). Independent lineages: P1 (VAG Blocks; P7 copies it), P11 (PyVCDS), P10 (teensy, real car). Decimal and hex IDs are the same numbers (36 = 0x24).

| F dec / hex | P4 formula | Unit | Agreement |
|---|---|---|---|
| 1 / 01 | 0.2·a·b | rpm | P1, P10, P11 agree. High |
| 2 / 02 | a·0.002·b | % | P11 agrees |
| 3 / 03 | 0.002·a·b | deg | |
| 4 / 04 | abs(b−127)·0.01·a; ATDC if b > 127 else BTDC | deg | P1 agrees; P11 signed (b−127)·0.01·a |
| 5 / 05 | a·(b−100)·0.1 | °C | P10 (real car) agrees. High |
| 6 / 06 | 0.001·a·b | V | |
| 7 / 07 | 0.01·a·b | km/h | P1, P11 agree. High |
| 8 / 08 | 0.1·a·b | none | **P1 and P11 treat 0x08 as binary flags.** Disagree |
| 9 / 09 | (b−127)·0.02·a | deg | |
| 10 / 0A | b = 0 "COLD" else "WARM" | | |
| 11 / 0B | 0.0001·a·(b−128)+1 | | |
| 12 / 0C | 0.001·a·b | Ω | |
| 13 / 0D | (b−127)·0.001·a | mm | |
| 14 / 0E | 0.005·a·b | bar | |
| 15 / 0F | 0.01·a·b | ms | |
| 16 / 10 | bit value | binary | P1, P11 agree (binary) |
| 17 / 11 | chr(a) chr(b) | ASCII | P1, P11 agree |
| 18 / 12 | 0.04·a·b | mbar | P1 (a·b/25) agrees. **P11 has a·b·25: wrong by 625x**. High for 0.04·a·b |
| 19 / 13 | a·b·0.01 | l | |
| 20 / 14 | a·(b−128)/128 | % | **P1 and P11: a·b/128 − 1.** Disagree |
| 21 / 15 | 0.001·a·b | V | P1, P11 agree. High |
| 22 / 16 | 0.001·a·b | ms | P1, P11 agree. High |
| 23 / 17 | b/256·a | % | P1, P11 agree. High |
| 24 / 18 | 0.001·a·b | A | P11 agrees |
| 25 / 19 | b·1.421 + a/182 | g/s | **P11: (100/a)·b.** Disagree |
| 26 / 1A | b − a | °C | P1, P11 agree. High |
| 27 / 1B | abs(b−128)·0.01·a | deg | |
| 28 / 1C | b − a | | |
| 29 / 1D | b < a "map 1" else "map 2" | | |
| 30 / 1E | b/12·a | deg k/w | |
| 31 / 1F | b/2560·a | °C (P4) | |
| 32 / 20 | b > 128 ? b−256 : b | | |
| 33 / 21 | a = 0 ? 100·b : 100·b/a | % | P1, P11 agree. High |
| 34 / 22 | (b−128)·0.01·a | kW | P1, P11 agree. High |
| 35 / 23 | 0.01·a·b | l/h | P1, P11 agree. High |
| 36 / 24 | a·2560 + b·10 | **km** | P11 agrees. High |
| 37 / 25 | not known ("Oil Pr. 2 < min") | | P1, P11 "binary"; P2, P8 use `25 00 00` as an empty cell |
| 38 / 26 | (b−128)·0.001·a | deg k/w | |
| 39 / 27 | b/256·a | mg/h (P4) | P1, P11: same formula, unit mg/stroke |
| 40 / 28 | b·0.1 + 25.5·a − 400 | A | |
| 41 / 29 | b + a·255 | Ah | |
| 42 / 2A | b·0.1 + 25.5·a − 400 | kW | |
| 43 / 2B | b·0.1 + 25.5·a | V | |
| 44 / 2C | a : b | h:m | |
| 45 / 2D | 0.1·a·b/100 | | |
| 46 / 2E | (a·b − 3200)·0.0027 | deg k/w | |
| 47 / 2F | (b−128)·a | ms | |
| 48 / 30 | b + a·255 | | |
| 49 / 31 | (b/4)·a·0.1 | mg/h (P4) | P1, P11: a·b/40 (same number), unit mg/stroke |
| 50 / 32 | a = 0 ? (b−128)/0.01 : (b−128)/(0.01·a) | mbar | |
| 51 / 33 | ((b−128)/255)·a | mg/h | P1, P11 agree on formula |
| 52 / 34 | b·0.02·a − a | Nm | |
| 53 / 35 | (b−128)·1.4222 + 0.006·a | g/s | |
| 54 / 36 | a·256 + b | count | P1, P11 agree. High |
| 55 / 37 | a·b/200 | s | P1, P11 agree. High |
| 56 / 38 | a·256 + b | WSC | |
| 57 / 39 | a·256 + b + 65536 | WSC | |
| 58 / 3A | b > 128 ? 1.0225·(256−b) : 1.0225·b | /s | |
| 59 / 3B | (a·256 + b)/32768 | | |
| 60 / 3C | (a·256 + b)·0.01 | s | |
| 61 / 3D | a = 0 ? b−128 : (b−128)/a | | |
| 62 / 3E | 0.256·a·b | S | |
| 63 / 3F | chr(a) chr(b) "?" | | |
| 64 / 40 | a + b | Ω | |
| 65 / 41 | 0.01·a·(b−127) | mm | |
| 66 / 42 | a·b/511.12 | V | |
| 67 / 43 | 640·a + b·2.5 | deg | |
| 68 / 44 | (256·a + b)/7.365 | deg/s | |
| 69 / 45 | (256·a + b)·0.3254 | bar | |
| 70 / 46 | (256·a + b)·0.192 | m/s² | |
| 81 / 51 | (a·112000 + b·436)/1000 (P1); (a·11200 + b·436)/1000 (P11) | °CF | Both say "check formula". Disagree. Low |
| 94 / 5E | a·(b/50 − 1) | Nm | P1, P11 "check formula". Low |
| 95 / 5F | variable-length ASCII string | | P11 only. Low |
| 96 / 60 | 0.1·a·b | mbar | P10 (real 2013 Jetta TDI boost). Medium |
| 126 / 7E | 0.1·a·b | g | P10. Medium |

Not in any public table: every other ID. P7's rule is the safe one: "an unknown formula index is reported as a raw 16-bit value rather than silently mis-scaled". P4: "the same ID can mean different things in different units" (paraphrase). Where sources disagree (8, 20, 25, 81), show the raw value and the unit with a "?" until checked against VCDS or the car's own display.

### 4.3 What the owner wants, mapped to groups

| Value | Module | Group / field | Source | Confidence |
|---|---|---|---|---|
| Engine speed | 01 | 001-1 | A1 ("001-1 Engine Speed", MED9 2.0 TFSI) | Medium |
| Boost specified | 01 | 115-3, mbar absolute | A1 | Medium |
| Boost actual | 01 | 115-4, mbar absolute | A1. Gauge boost = actual − ambient (subtract about 1000 mbar or the engine-off reading; forum guidance in the search results, not verified) | Medium |
| N75 duty, load | 01 | 114-4, 114-1, 114-3 | A1 | Medium |
| Intake air mass, ignition timing | 01 | 003-2, 003-4 | A1 | Medium |
| Fuel pressures | 01 | 103-1, 106-2, 140-3, 230-1/2 | R12 (BWA family), A1 | Medium (BWJ not named on R12) |
| Oil temperature | 01 | "channel 134 value 1" | O1: one poster cites Ross-Tech; a BWA GTI owner found "no oil temperature sensor" on his car | **Unconfirmed** for the Cupra |
| Oil temperature | 17 | none found for PQ35. On the Golf IV (1J) cluster a search snippet of a Ross-Tech label put it in group 003 on cars with the oil sump sensor | | **Unconfirmed** |
| Odometer | 17 | none found for PQ35 (1J cluster label: group 002 field 1, search snippet only) | | **Unconfirmed**. Find it by scanning cluster groups for formula 36 (km) |
| Service interval remaining | 17 | adaptation channels 040 to 049, see section 6 (not a measuring block) | R9 | High for channel meaning |
| Coolant temperature | 01 / 17 | look for formula 5 or 26 | | Unconfirmed by group |

Group and field numbers come from label files and can vary by ECU software (Ross-Tech: "the data presented in each Group varies greatly from Control Module to Control Module", from the VCDS tour page as seen in search results). The formula byte gives the unit, so a unit-based discovery scan (read groups 1 to 255, list every cell with its unit) is safe and needs no label file. Labels: Ross-Tech label files are copyrighted; do not ship them.

### 4.4 Standard OBD route for the engine (no TP2.0)

The 2.0 TFSI is a petrol EOBD engine, so SAE J1979 mode 01 on 7DF/7E0 should answer: PID `0B` intake manifold absolute pressure (kPa), `05` coolant, `0F` intake air temperature, `0C` rpm. Check support first with `01 00` / `01 20`. This avoids TP2.0 for boost. **High** that the PIDs exist in J1979; **Unconfirmed** that this ECU reports `0B` (test on the car). Oil temperature PID `5C` and odometer PID `A6` are later additions; a 2007 ECU is unlikely to support them (test, do not assume).

---

## 5. Coding, login and adaptation over KWP2000

### 5.1 Security access ("login")

| Step | Bytes | Sources |
|---|---|---|
| Seed | `27 03` → `67 03 <seed:4>` | P2, P7, P9 (enum `REQUEST_SEED = 3`) |
| Key | `27 04 <key:4>`, key = (seed + code) mod 2^32, big endian | P2 ("key = seed + code (32-bit BE)"), P7 ("VAG's key is simply `code + seed`"), P13 (same formula on UDS) |

**Medium**: three codebases, none a PQ35 cluster or BCM. Code for the Leon cluster: 13861 "Adaptation Enabling" (R9). `27 01/02` is the flash-programming level with a different algorithm (P9); do not use. A wrong key can lock the module for a period (NRC 0x36/0x37, P9 table); allow one attempt per ignition cycle.

P2 and P7 both separate "security access" from "login": P2 says the KWP2000 login is a `3B 9A` write with `0x800000 | login` as the value; P7 says VCDS function 11 ("Coding-II") is a `3B 9A` write. VCDS uses "Login" (11) and "Security Access" (16) as different functions. Which one the Leon cluster wants for 13861: R9 puts 13861 under "Security Access". **Low**.

### 5.2 Short coding write (cluster 17)

Sequence built from P2 (K-line EDC16) and P7 (untested):

1. Open channel, `10 89` → `50 89`.
2. `1A 9B` → keep SW (offset 13, 4 bytes), WSC record (offset 21, 6 bytes), check offset 17 = `03`, read current coding (offset 18, 3 bytes). Save the whole response as a backup.
3. `3B 9A <WSC 6> <SW 4> 03 <new coding 3>` → expect `7B 9A`.
4. Wait about 3 s (P2).
5. `1A 9B` again, compare coding.

Cluster short coding meaning (R9): options digits `00??x0x`: +01 brake pad warning, +02 seat belt warning, +04 washer fluid warning, +16 sedan (Jetta only); country `00xx?0x`; distance impulse number `00xxx0?`. Seat belt warning off = subtract 2 from the options digits (R9, S1). R9 and S1 agree; the digit positions apply to the 7-digit decimal coding.

Confidence of the byte sequence on a Leon cluster: **Low** (no TP2.0 or cluster capture; the two sources disagree on the first 6 bytes). Coding meaning: **High**.

### 5.3 Long coding write (09 central electronics, 46 comfort)

**Not public.** Nothing found shows how a PQ35 BCM or comfort module receives its 23 to 30 byte long coding over KWP2000. Hints only:

- P13 (Deep OBD) has separate EDIABAS jobs `LangeCodierung_lesen` / `LangeCodierung_schreiben` (long coding read / write) and `CodierungS22_lesen` for KWP modules; their bytes are inside VW job files, not in the source. Low.
- P12 writes 09 coding on the e-Up over TP2.0 with `22 0600` / `2E 0600` after `10 89` (UDS-style services on a TP2.0 module). That is a 2013+ NSF BCM, not PQ35. Low.
- The `1A 9B` type byte (offset 17) presumably carries the long coding length; P8 shows `10` for a TFSI engine. Unconfirmed.

Do not offer 09 or 46 coding changes until a capture exists. One VCDS or OBDeleven session on this car, sniffed with a CAN logger (T-piece on pins 6/14, listen-only), would settle it. An alternative is an iOS PacketLogger capture of Carista's BLE traffic while it changes a 46 setting.

### 5.4 Adaptation (service reset, comfort settings)

Two descriptions of the same `31` routine family, which **disagree**:

| Step | P2 (EDC16, K-line; tested per its comments) | P7 (A3 8P TP2.0; untested) |
|---|---|---|
| Enumerate | `31 B8 00 00` | |
| Enter adaptation | `31 B8 01 03` | `31 BA 01 03` ("open") |
| Select channel | `31 B9 01 03 <channel>` ("Omitting [01 03] gives NRC 0x12") | `31 B9 01 <ident> <data>` ("run") |
| Test value | `31 B9 01 03 <value hi> <value lo>` | |
| Read current | `31 BA 01 03` → body `BA 01 03 <status> 03 <value hi> <value lo> ...` | |
| Save | `31 BB 01 03 <value:2> <WSC:6>` | |
| Exit | `32 B8 01 03` | `32 B8 01 03` ("close") |
| Basic setting | `31 B8 00 <group>`, read `31 BA 00 <group>`, exit `32 B8 00 <group>` | `31 BA 00 <group>`, `31 B9 00 <group>`, `32 B8 00 <group>` |

Agreement: service `31` with routine bytes `B8`/`B9`/`BA`, mode byte `00` = basic setting and `01` = adaptation, `03` = plain 2-byte channel value (P7 adds `0A` = long adaptation), `32 B8` to exit. P8's simulator answers `31 B8` with `71 B8 01 01 01 03 01 02 01 06 01 07 01 08 01 0D 01 18`, a list of 2-byte entries that fits P2's "enumerate" reading.

Confidence for a PQ35 cluster: **Low**. Channel numbers are 1 byte in P2, so channels 002 and 040 to 049 fit.

---

## 6. Service interval reset on the Leon 1P cluster

| Method | Detail | Source | Confidence |
|---|---|---|---|
| Adaptation | Cluster 17, security access 13861, channel **002** Service Reminder: "To reset the service reminder save 0 as new value" (0 = not due, 1 = due) | R9; r32oc.com thread (Mk5, "channel 02 ... set to 00", seen in search results) | **High** for the channel |
| Interval settings | 040 distance since service (1 = 100 km), 041 time since service (days), 042 / 043 minimum / maximum distance (1 = 1000 km), 044 maximum time (365 fixed, 730 LongLife), 045 oil quality (1 fixed, 2 LongLife), 049 minimum time | R9 | High for meaning; do not offer by default |
| vis4vag, VD1/VDD CAN cluster | Separate entries for distance to oil change, distance to inspection, time to inspection; "some older dashboards require input of value in thousands of km". Channel numbers masked | V2 | Medium (names only) |
| UDS cluster variants | "WIV/ESI: Reseting of WIV/ESI stored value" etc., IDE numbers masked | V3 | Applies only if the car has a UDS cluster |
| Without a tool | SEAT owner's manual: reset with ignition off and the trip button held; manualslib copies seen only as search snippets, button name cut off | manualslib search results | Low; read the car's own handbook |
| KWP2000 bytes | Section 5.4: `27 03/04` with 13861, then the `31 B8/B9/BB` family on channel `02`, value `00 00` | P2, P7 | **Low** |

Ross-Tech's general rule (from `coding-sources.md` R6): do not change adaptation channels without instruction. Read 002 and 040 to 049 first and show them before any write.

---

## 7. Leon 1P coding items (popular mods)

Bits from `coding-sources.md` section B, re-checked where possible. Byte n bit m = `(byte[n] >> m) & 1`.

| Mod | Module | Byte / bit or channel | Sources | Confidence | Writable now? |
|---|---|---|---|---|---|
| Coming home | 09 | Long coding byte 0 bit 7 | R10 (adaptation 001 "Active only if Byte 00 Bit 7"), S1 | High | No (long coding write not public) |
| Leaving home | 09 | Byte 0 bit 5 | R10, S1 | High | No |
| Coming / leaving home time | 09 | Adaptation 001 / 002, 10 to 60 s | R10, S1 | High | Low (adaptation bytes) |
| Footwell dimming | 09 | Adaptation 005, needs byte 0 bit 1 | R10 | Medium | Low |
| Comfort indicators | 09 | S1 says "Byte 2 Bit 8" (bit 8 does not exist) | S1 | Low, do not offer | No |
| Emergency brake flashing | 09 | Byte 17 bit 0; author says it did not work on his car | S1 | Low | No |
| DRL | 09 | Golf 5K and Mk V forum bits (bytes 0, 8, 11, 14, 15) disagree by BCM version; "Do NOT modify Byte 18" warning on a PQ35 BCM thread | search results only | **Unconfirmed** for 1P | No |
| Tear wipe (drip wipe) | 09 (wiper subsystem) | not found | | **Unconfirmed** | No |
| Comfort windows by key / remote | 46 | Byte 4 bits 0, 2, 3, 5; one 2006 owner also cleared byte 3 bit 5 | S1; R11 (`coding-sources.md`) channel 017 "Comfort Function" = 1 | Medium | No (long coding) |
| Selective unlock | 46 | Byte 0 bit 0 (S1) or adaptation 003 (R11) | S1, R11 disagree on method | Medium | No |
| Lock / unlock confirmation | 46 | Bytes 6, 7 bits 0 to 3 (S1) or adaptation 007/008/010/011 (R11) | disagree | Medium | No |
| Auto-lock at 15 km/h | 46 | Adaptation channel 0 (S1) or 004 (R11) | disagree | Medium | Low |
| Seat belt warning off | 17 | Short coding options digits minus 2 | R9, S1 | High | Low (5.2) |
| Needle sweep | 17 | Not found for 1P. The "IDE01087-Staging" method (N1) is a UDS (MQB, Leon 5F) channel | N1 | **Unconfirmed**, likely not available | No |
| CH/LH | see coming / leaving home | | | | |

---

## 8. Clone ELM327 v1.5 and TP2.0

Covered in `tp20-sources.md` section 4. Points that matter for the Leon:

- On PQ35 the OBD pins 6/14 reach only the gateway's diagnostic CAN (500 kbit/s); all module traffic goes through the gateway on TP2.0 (T1, P1, P9; `aep/vag_reverse_engineering` README: "on a VW, the only thing reachable from the obd can bus is the can gateway", other model).
- Raw frames: `AT CAF0` + `AT CFC0` on protocol 6, or VAG Blocks' `AT PB C0 01` + `AT SP B` (11-bit, variable DLC, no formatting). Without variable DLC the ELM pads every frame to 8 bytes; whether PQ35 modules accept padded 1-byte ACKs and `A3`: **Unconfirmed** (T12). Test `AT V1` / `AT PB` on the adapter first.
- Use the "responses digit" (`01 C0 00 10 00 03 01 1`) so the ELM returns after the first reply (T7, VW Mk6 GLI with a plain ELM327).
- `AT AT0` and a short fixed `AT ST` (VAG Blocks: 16, 24 or 40 ms) so ACKs go out inside the module's T1 of 100 ms (P1, T12). The BLE round trip on the owner's adapter is not measured: measure before choosing `AT ST`.
- The ELM only hears the bus while it waits for a reply; frames between commands are lost (T11, T12). Multi-frame answers (8-cell `61` blocks are 26 bytes = 4 TP2.0 frames; P10) need the ELM to keep listening until the frame with opcode `1x`, then the app sends the ACK.
- Multi-frame requests (`3B 9A` is 16 bytes = 3 frames) need opcodes `2x` / `2x` / `1x` (or `0x` at block end) and a wait for the module's `B` ACK (T1, T2). Every write therefore passes several timing-critical steps through BLE; abort cleanly on any missed ACK (send `A8`).
- VAG Blocks: "the communication protocol is unstable ... implementing VW TP 2.0 difficult" (P1). Deep OBD refuses VAG on a plain ELM327 (P13). Both are reasons to keep writes off until reads are stable on this adapter.
- Carista does TP2.0 through this same adapter on the owner's A6, so the hardware path exists; whether Carista uses standard AT commands: **Unconfirmed** (`tp20-sources.md` 4.4).

---

## 9. Implementable command lists (High / Medium only)

Per module, after the TP2.0 channel is open (setup, `A0`, sequence numbers as in `tp20-sources.md` 2.5):

1. Discovery: open **0x1F**, send `1A 9F` (no `10 89`), parse per 2.1, close. Fallback: probe setups 0x01 to 0x7F (read-only). Known: engine 0x01, gateway 0x1F, power steering 0x09.
2. `10 89` → `50 89`.
3. `1A 9B` → part (1..12), SW (13..16), type (17), short coding (18..20 if type `03`), WSC (21..26, decode 3.3), text (27..46). Fallback `1A 91`.
4. Faults `18 02 FF 00`; clear `14 FF 00` (both already in `src/obd/tp20.ts`).
5. Live data `21 <group>`, decode cells by formula (4.2), drop trailing `25 00 00`. Engine: 001, 003, 114, 115 (boost 115-3/115-4), 103, 230. Unit-based scan of cluster groups for km and °C.
6. Keep-alive `A3` every 500 ms; `A8` to close.
7. Engine boost without TP2.0: `01 00`, then `01 0B` on 7E0/7DF if supported.

Not implementable yet (Low or Unconfirmed): `3B 9A` cluster coding write, security access with 13861, the `31 B8/B9/BA/BB` adaptation family, service reset over OBD, all 09 and 46 long coding changes, DRL, tear wipe, needle sweep, oil temperature and odometer group numbers, TP2.0 addresses of 17/09/46.

---

## 10. Open items (do not code as fact)

1. TP2.0 addresses of 17, 09, 46, 15, 03 on this car: answer with `1A 9F` on the car.
2. Is the cluster the KWP "VD1/VDD CAN" type or a UDS type: read its `1A 9B` part number, or try UDS 0x714/0x77E if no TP2.0 channel opens.
3. A raw `5A 9F` response from a PQ35 gateway, to confirm the record format and block 2.
4. `1A 9B` layout for long-coded modules (09, 46): log the raw bytes.
5. Cluster group numbers for odometer and oil temperature; whether the BWJ has an oil temperature sensor.
6. KWP2000 adaptation routine semantics (P2 vs P7) and the KWP "login" vs "security access" question, from a capture of a VCDS or OBDeleven service reset on this car.
7. Long coding read and write bytes for 09 and 46.
8. Adapter: `AT V1`, `AT PB`, `AT CRA`, `AT CFC0` support and BLE round-trip time (same as `tp20-sources.md` 8.5).
