# Caristini: VW TP2.0 + KWP2000 sources, and UDS retry and clear behaviour

Research note, 11 Nov 2026. Car: 2012 Audi A6 C7 (MLB), 2.0 TDI, VIN WAUZZZ4GXCN000000. Adapter: Carista BLE, reports "ELM327 v1.5" (a clone: Elm Electronics never made a v1.5, E3).

Confidence key (same as `uds-sources.md`):

- **High**: two or more independent public sources agree, or one primary source plus a real-car capture.
- **Medium**: one public source, or two sources that agree only by inference.
- **Low**: single community post, different platform (PQ, not MLB), or sources disagree.
- **Unconfirmed**: no public source found. Do not ship as fact.

"PQ" below means the older VW platforms (Golf 5/6, Passat B6, Seat Mii and similar). Most TP2.0 sources are PQ cars. MLB evidence is marked as such.

---

## Answer in brief

| Question | Answer | Confidence |
|---|---|---|
| Are 09, 42, 46 (and 52) on the C7 non-UDS modules? | Yes. On a C7 (2014 S7) VCDS shows these four with no "ASAM Dataset" line and KWP-style fault lines (5-digit number plus a 3-digit symptom); the same scan shows 01, 03, 17, 19 with ASAM data and UDS U-codes. Carista's 00256 on 09 and 02123 on the doors on the owner's car are the same numbers VCDS printed for 09 and 42/52 on that S7. | High |
| Is the transport TP2.0? | Probably. On a 2014 A7 (MLB) two KWP modules (VCDS-numbered 52 and 20) opened TP2.0 channels through the gateway from the OBD port and answered `10 89` with `50 89`. Not yet shown for 09, 42 or 46 on any MLB car. | Medium |
| Is the TP2.0 destination byte the VCDS address? | **Not in general.** On PQ cars 0x09 is power steering, 0x1F the gateway, 0x05 the airbag. VAG Blocks reads the VCDS-number to TP2.0-address map from the gateway (`1A 9F`). On the 2014 A7, 27 of 29 VCDS addresses sent as the destination byte got no reply at all. | High that they can differ; MLB values Unconfirmed |
| Is ABS (03) a TP2.0 module? | No evidence for it. Carista shows ABS as `U111300` (UDS format) on the owner's car; the 2014 S7 shows 03 with ASAM data and `U1111 00 [008]`; the A7 gateway maps 03 to request ID 0x713. The NO DATA on ABS is a separate problem. | Medium |
| Can a clone ELM327 do TP2.0? | Possible but marginal. VAG Blocks (ELM327, Bluetooth and USB, PQ cars) does it with plain AT commands and calls it unstable. Car Scanner (ELM327 app) lists "VW TP2.0 Readings". The tester must ACK each module frame within the module's T1 (100 ms in every trace found), through BLE. A module repeats an unACKed frame (up to 2 retries in one implementation), which gives some slack. | Medium |
| Does the ELM327 wait through `7F xx 78`? | Genuine v2.1 and later: yes, extends to 5 s per 78 (PP 2A bit 2, default on). v1.5 clones run v1.4 code: assume no. Workaround: `ATAT0` + `ATST FF` (about 1 s per gap). | High (datasheet), clone behaviour Unconfirmed |
| Does VW need `10 03` before UDS `14 FF FF FF`? | No VW-specific public source found. openpilot's generic clear script sends `10 03` first. NRC 0x11 means "service not supported", not "wrong session" (that is 0x7F). For the engine, OBD mode 04 is the standard clear. | Unconfirmed for VW |

---

## Sources

| Key | Source | URL | Notes |
|---|---|---|---|
| T1 | Jared Wiltshire, "VW Transport Protocol 2.0 (TP 2.0) for CAN bus" (no date on page); full copy with tables kept in the OVMS repo | https://jazdw.net/tp20 , https://github.com/openvehicles/Open-Vehicle-Monitoring-System-3/blob/master/vehicle/OVMS.V3/components/vehicle/docs/VW-TP-2.0.txt | Author says it is worked out from presentations and logs, not VW documents. Engine trace. |
| T2 | OVMS v3 `vehicle_poller_vwtp.cpp` (MIT), Michael Balzer 2021, tested on a Seat Mii | https://github.com/openvehicles/Open-Vehicle-Monitoring-System-3/blob/master/vehicle/OVMS.V3/components/poller/src/vehicle_poller_vwtp.cpp | Exact frame bytes, ACK and 78 handling |
| T3 | OVMS developer list, Michael Balzer, 31 May 2021 | https://lists.openvehicles.com/archives/list/ovmsdev@lists.openvehicles.com/thread/FDVRIIZNUR765CESHVMECH73E4DF4EOC | Gateway 0x1F, one channel at a time |
| T4 | `ecu_diagnostics` Rust crate 0.107.2, `vwtp.rs` | https://docs.rs/crate/ecu_diagnostics/0.107.2/source/src/hardware/vwtp.rs | Timing byte encode/decode, keep-alive 1000 ms |
| T5 | EliasTuning/KWP2000-CAN (MIT), `tp20/constants.py`, `tp20/timing.py` | https://github.com/EliasTuning/KWP2000-CAN/tree/HEAD/kwp2000_can/protocols/can/tp20 | Constants cite "TP2.0_1_1 §5.1" (a VW spec the repo does not include). J2534 adapter. |
| T6 | jazdw/vag-blocks (GPL-3.0), `tp20.cpp`, `kwp2000.cpp`, `README.md`, last push 19 Oct 2020 | https://github.com/jazdw/vag-blocks | **ELM327 TP2.0 implementation**, Bluetooth and USB tested, PQ cars |
| T7 | jazdw-software Google Group, "Understanding all this !", Mar 2013 to Mar 2014 | https://groups.google.com/g/jazdw-software/c/EMob6kjhKt4 | Plain ELM327 setup and A0/A1 log (VW Mk6 GLI) |
| T8 | Willem Melching, "Hacking a VW Golf Power Steering ECU - Part 1", 1 Jan 2022 | https://icanhack.nl/blog/vw-part1/ | Golf Mk6 EPS on TP2.0 address 0x09 |
| T9 | rusEFI Lua example `vw-tp-tcu.txt` (TP2.0 to a VW gearbox, address 0x02) | https://github.com/rusefi/rusefi/blob/master/firmware/controllers/lua/examples/vw-tp-tcu.txt | `18 02 FF 00` and `14 FF 00` over TP2.0, real car |
| T10 | MartijnD92/PyVCDS (GPL text placeholder), `vw.py`, `kwp.py`; tested on "an old (2007...) VW"; README: "THE ELM327 IS NOT SUPPORTED" | https://github.com/MartijnD92/PyVCDS | PQ module address table, KWP retry logic |
| T11 | parhipov/OBDScanner (MIT), `Tp20.kt`, Sep to Nov 2026 | https://github.com/parhipov/OBDScanner/blob/HEAD/core/src/commonMain/kotlin/com/obdscanner/vag/Tp20.kt | Plain ELM327 raw mode. No car result published with it. |
| T12 | DaSonOfPoseidon/OBDCracker (MIT), `docs/tp20.md`, `docs/elm327.md` | https://github.com/DaSonOfPoseidon/OBDCracker/blob/HEAD/docs/tp20.md , https://github.com/DaSonOfPoseidon/OBDCracker/blob/HEAD/docs/elm327.md | ELM/STN TP2.0 driver, real MLB car |
| T13 | OBDCracker issue #124, car session 6, **2014 Audi A7 3.0 TDI (C7, MLB)**, OBDLink EX (STN2232), Oct 2026 | https://github.com/DaSonOfPoseidon/OBDCracker/issues/124 | TP2.0 discovery, gateway tables 2A2A/2A29/2A2C |
| T14 | OBDCracker issue #169, car session 7, same A7 | https://github.com/DaSonOfPoseidon/OBDCracker/issues/169 | 52 and 20 open channels; module ACK in 20 to 36 ms |
| T15 | OBDCracker issues #232 (session 9) and #304 (session 10, 10 Nov 2026), same A7 | https://github.com/DaSonOfPoseidon/OBDCracker/issues/232 , https://github.com/DaSonOfPoseidon/OBDCracker/issues/304 | `10 89` → `50 89`, `1A 9B` → `7F 1A 11`, CAN ACK problem, UDS `7F 22 78` traces |
| T16 | ediabaslib Deep OBD docs and adapter table | https://uholeschak.github.io/ediabaslib/docs/Deep_OBD_for_BMW_and_VAG.html , https://uholeschak.github.io/ediabaslib/docs/AdapterTypes.html | VAG mode needs replacement ELM327 firmware; plain ELM327 marked "No" for VAG |
| T17 | Car Scanner profile database changelog (versions 1.108.11, 1.115.8) | https://www.carscanner.info/profile-database-changelog/ | "VW TP2.0 Readings" in an ELM327 app |
| T18 | SAE J2819 "TP2.0 Vehicle Diagnostic Protocol" (paywalled, not read) | https://saemobilus.sae.org/standards/j2819_200802-tp20-vehicle-diagnostic-protocol | The formal TP2.0 description |
| V1 | audizine, "2014 S7 Auto-Scan" (C7, FC-AU57), VCDS 17.8.0, 4 and 5 Nov 2017 | https://audizine.com/threads/2014-s7-auto-scan.788489/ | Full autoscans with fault lines |
| V2 | audiworld, "se so many trouble codes help", 2012 A6 C7 (VIN 10th digit C), VCDS 18.9.0.2, 12 May 2021 | https://www.audiworld.com/forums/a6-c7-platform-discussion-194/se-so-many-trouble-codes-help-3018482/ | Same 09/42/46/52 part families as V1 |
| V3 | the owner's own recording review, `replica/review-2026-11-11.md` | local | Carista showed ABS and parking brake `U111300` |
| K1 | ISO/DIS 14230-3 (KWP2000 Part 3), draft, 16 Dec 1996 | https://raw.githubusercontent.com/wiki/synfinatic/sv650sds/pdfs/14230-3.pdf | Service 18/58 layout, NRC 21 and 78 flows |
| K2 | gmenounos/kw1281test (MIT), `Kwp2000/KW2000Dialog.cs`, `Blocks/FaultCodesBlock.cs` | https://github.com/gmenounos/kw1281test | VW KWP2000 on K-line (not CAN): `18 02 FF 00`, `14 FF 00`, `1A 9B`, 78 handling |
| E1 | ELM327 datasheet ELM327DSJ (v2.1) | https://www.elmelectronics.com/wp-content/uploads/2016/07/ELM327DS.pdf | Pages cited inline |
| E2 | Elm AT command table with "version first appeared" (SparkFun copy) | https://cdn.sparkfun.com/assets/4/e/5/0/2/ELM327_AT_Commands.pdf | |
| E3 | Wikipedia, ELM327 | https://en.wikipedia.org/wiki/ELM327 | "Elm Electronics never made a v1.5"; clones report false versions |
| U1 | python-uds knowledge base, time parameters | https://uds.readthedocs.io/en/latest/pages/knowledge_base/time_parameters.html | P2 50 ms, P2* 5000 ms |
| U2 | commaai/opendbc `uds.py` | https://github.com/commaai/opendbc/blob/master/opendbc/car/uds.py | 78 loop, 21 not retried |
| U3 | commaai/openpilot `tools/scripts/car/clear_dtc.py` | https://github.com/commaai/openpilot/blob/master/tools/scripts/car/clear_dtc.py | `10 03` then `14 FF FF FF` |
| U4 | OVMS v3 `vehicle_poller_isotp.cpp` | https://github.com/openvehicles/Open-Vehicle-Monitoring-System-3/blob/master/vehicle/OVMS.V3/components/poller/src/vehicle_poller_isotp.cpp | +500 ms per 78 |
| U5 | udsoncan client configuration | https://udsoncan.readthedocs.io/en/latest/udsoncan/client.html | p2 1 s, p2* 5 s, request_timeout 5 s |
| U6 | pyudskit NRC table | https://pyudskit.readthedocs.io/en/latest/reference/nrc-table/ | 0x11 vs 0x7F, 0x21 "Wait and retry" |
| U7 | OBDCracker issue #86, car session 4, same 2014 A7 | https://github.com/DaSonOfPoseidon/OBDCracker/issues/86 | Gearbox 7E9 and airbag 715/77F behaviour |

---

## 1. Is TP2.0 the cause? Evidence

### 1.1 VCDS on a C7 separates UDS modules from the others (V1)

2014 S7 (chassis FC-AU57, VCDS 17.8.0), scan of 4 Nov 2017:

| Address | Part | "ASAM Dataset:" line | Fault line format (verbatim) |
|---|---|---|---|
| 01 Engine | 4G0 906 014 E | Yes | `17881` / `P0477 00 [032] - Signal too Low` |
| 03 ABS | 4G0 907 379 M | Yes | `0040` / `U1111 00 [008] - -` |
| 17 Instruments | 4G8 920 985 H | Yes | `16776960` / `U1111 00 [008] - -` |
| 19 Gateway | 4G0 907 468 AC | Yes | `4879` / `U1045 00 [008] - No communication` |
| 09 Cent. Elect. | 4H0 907 063 CG | **No** | `00256` / `004 - No Signal/Communication - Intermittent` |
| 42 Door Elect, Driver | 4G8 959 793 H | **No** | `02123` / `012 - Electrical Fault in Circuit - Intermittent` |
| 46 Central Conv. | 4H0 907 064 CR | **No** | `01403` / `011 - Open Circuit` |
| 52 Door Elect, Pass. | 4G8 959 792 H | **No** | `02123` / `012 - Electrical Fault in Circuit - Intermittent` |

Also KWP-style on that car: 05, 47, 5F, 62, 72. The 2012 A6 in V2 has the same part families for 09 (4H0 907 063 BA), 46 (4H0 907 064 BH), 42 (4G8 959 793 E), 52 (4G8 959 792 E) and 03 (4G0 907 379 H).

Reading: UDS fault lines carry a `[008]`-style status and a U/P/B/C code; the 09/42/46/52 lines carry a 5-digit VAG number and a 3-digit symptom (`004`, `012`), which is the KWP numbering Carista shows on the owner's car. Confidence: **High** that 09/42/46/52 are not UDS on C7. That they are KWP2000 is **Medium** (inference from format; VCDS does not print the protocol in these scans).

### 1.2 The 2014 A7 (MLB) through an OBDLink (T13, T14, T15)

- TP2.0 channel setups sent to `0x200` with the destination byte set to each of 29 VCDS addresses (`05 09 0E 16 36 42 46 47 52 56 5F 62 72` and `06 10 14 18 1E 20 2E 30 3C 3D 3E 48 57 5B 69 7F`): **only 52 and 20 answered**, identical over 3 passes. 52 gave `00 D0 00 03 DB 04 01` (module sends on 0x300, listens on 0x4DB) about 46 ms after the request; 20 gave channel 0x518. The other 27 sent nothing, not even a D6 to D8 refusal (T13, T14).
- `10 89` answered `50 89` on both; `1A 9B` answered `7F 1A 11` (service not supported) on both, in and out of the 89 session (T15 #304).
- Gateway UDS DID `2A2A` (on 0x710) lists all installed addresses; `2A29` is `01` for every UDS module that answered and `02` for all 13 TP2.0-silent addresses and for 52. The author's words: "My best guess is a protocol or bus byte. That's not confirmed." `2A2C` holds request IDs for some UDS modules (03 → 0x713, 44 → 0x712, 13 → 0x757, 8B → 0x756, 3B → 0x721, 8E → 0x758) (T13).

### 1.3 TP2.0 logical address is not the VCDS address on PQ cars

| TP2.0 address | Module | Car | Source |
|---|---|---|---|
| 0x01 | Engine | PQ engine trace | T1 |
| 0x02 | Gearbox (TCU) | VW, rusEFI example | T9 |
| 0x09 | Power steering (VCDS 44) | Golf Mk6, 2010 | T8 |
| 0x1F | Gateway (VCDS 19), answers `22 F197` with `GW-K-CAN TP20` | Seat Mii | T3 |
| 0x1F | Gateway, used to read the module list with `1A 9F` | PQ cars | T6 (`tp->getChannelDest() == 31`) |
| 0x01, 0x02, 0x03, 0x05 airbag, 0x09 power steering, 0x19 parking brake, 0x1F gateway, 0x4F satellite radio, 0x52 radio head unit | | 2007 VW | T10 (`vw.py`, with the comment "ross-tech IDs seem to diverge from components on CAN-bus vehicles") |

VAG Blocks (T6) opens the gateway (0x1F), sends `1A 9F`, and parses 4-byte records `[VCDS module number, TP2.0 logical address, unknown, status]`, with status bit 0 = present and bits 1 to 4 = status; it skips address 0x13 ("module numbers 0x0 and 0x4 seem to report this addr but these modules dont exist"). It then opens channels by the logical address from that list. Confidence: **High** that the two numbering schemes can differ; **Unconfirmed** for which logical addresses MLB uses for 09, 42, 46. On the A7, 52 and 20 opened channels, but nothing shows those are the passenger door and the high-beam module (their identity is still unknown because `1A 9B` is refused, T15).

### 1.4 Conclusion

TP2.0 + KWP2000 is the most likely route for 09, 42, 46 and the other "02" modules. Two open points before code: the MLB logical addresses, and which identification service MLB KWP modules answer (`1A 9B` failed on the A7). ABS is a separate UDS problem (V3: Carista `U111300`; V1: ABS with ASAM data; T13: gateway table maps 03 → 0x713).

---

## 2. TP2.0 frame layouts

All frames are 11-bit CAN, 500 kbit/s, on the OBD diagnostic CAN behind the gateway. Variable DLC (T1, T2).

### 2.1 Channel setup (7 bytes)

Request, CAN ID **0x200** (T1, T2, T4, T6, T7, T8):

| Byte | Field | Value sent by OVMS, VAG Blocks, rusEFI, OBDCracker | Meaning |
|---|---|---|---|
| 0 | Destination | logical address, e.g. `01` | TP2.0 logical address of the module |
| 1 | Opcode | `C0` | setup request |
| 2 | RX ID low | `00` | ID the module should listen on, low 8 bits |
| 3 | V / RX prefix | `10` | high nibble = validity (1 = invalid, "you choose"), low nibble = ID bits 10..8 |
| 4 | TX ID low | `00` | ID the module should send on, low 8 bits |
| 5 | V / TX prefix | `03` | valid, prefix 3 → 0x300 |
| 6 | Application | `01` | "seems to always be 0x01 (maybe only for KWP)" (T1); KWP2000 (T5, T12) |

Example: `200: 01 C0 00 10 00 03 01` (T1). T1 says to offer 0x300 to 0x310 as the module's transmit ID.

Positive response, CAN ID **0x200 + destination** (for 0x01: 0x201):

| Byte | Field | Example `00 D0 00 03 40 07 01` |
|---|---|---|
| 0 | Destination (the tester) | `00` |
| 1 | Opcode | `D0` positive; `D6` to `D8` negative |
| 2, 3 | ID the **tester listens on** (module sends on), low byte then V/prefix | `00 03` → 0x300 |
| 4, 5 | ID the **tester sends on** (module listens on) | `40 07` → 0x740 |
| 6 | Application | `01` |

Parsing (T2): `rxid = data[3] << 8 | data[2]`; `txid = data[5] << 8 | data[4]`. Mask the prefix with `& 0x07` (11-bit) and check the validity nibble is 0 (T6 rejects `rxV > 0 || txV > 0`; T12 treats any other high bit as malformed). Confidence **High**.

Negative opcodes: T12 names them "application not supported, no resources, not ready" for D6, D7, D8; T1 only says "negative response". Confidence of the names: **Low**.

Observed MLB values: module 52 on the 2014 A7 answered `00 D0 00 03 DB 04 01` (tester listens 0x300, sends 0x4DB), module 20 gave 0x518 (T13, T14). PQ modules answer 0x740 (T1, T7) or 0x7A8 (T8: `209: 00 D0 00 03 A8 07 01`).

Setup timing: T5 constants (citing the VW spec) `T_E_MS = 50` setup timeout and `MNTC = 10` repetitions. The A7 replies came 44 to 64 ms after the request (T14), so a 50 ms wait is too short on that car. OBDScanner waits 100 ms (`ATST 19`) (T11). Use 100 ms and retry the setup at least 2 times. Confidence **Medium**.

Only one channel at a time through a VW gateway (T3). Close one (`A8`) before opening the next.

### 2.2 Channel parameters (1 or 6 bytes), on the negotiated IDs

| Opcode | Length | Direction | Meaning (T1, T2, T5) |
|---|---|---|---|
| `A0` | 6 | tester → module | parameters request: `A0 BS T1 T2 T3 T4` |
| `A1` | 6 | module → tester | parameters response, same layout; also the answer to `A3` |
| `A3` | 1 | either | channel test (keep-alive); answer is `A1` with parameters |
| `A4` | 1 | either | break: receiver discards data since the last ACK |
| `A8` | 1 | either | disconnect; receiver answers `A8` |

- BS: block size, frames the sender may send before it must wait for an ACK, 1 to 15 (T5 "0 < BS < 16"; T12). OVMS uses the BS from the module's `A1` as its own transmit block size (T2). **High**
- T2 and T4: always `FF` (T1). **High**
- T1: time to wait for an ACK; T3: gap between frames ("T1 should be greater than 4*T3", T1). **High**
- Timing byte: bits 7..6 = unit (`0` 0.1 ms, `1` 1 ms, `2` 10 ms, `3` 100 ms), bits 5..0 = count (T1, T2 code, T4, T5 code). **High**
  - `8A` = 10 ms x 10 = **100 ms**; `4A` = 1 ms x 10 = 10 ms; `32` = 0.1 ms x 50 = 5 ms; `0A` = 0.1 ms x 10 = 1 ms. (T2 comments: "`0x8A` time to wait for ACK: 10ms x 10 = 100 ms", "`0x0A` interval between two packets: 0.1ms x 10 = 1 ms". T5's docstring says `0x8A` = 10 ms, but its own decode code gives 100 ms; the docstring is wrong.)

Tester `A0` values seen: `A0 0F 8A FF 32 FF` (T1, T9, T11, T12), `A0 0F 8A FF 4A FF` (T6, T7), `A0 0F 8A FF 0A FF` (T2). Module answers seen: `A1 0F 8A FF 4A FF` (T1, T7 PQ, T8 Golf EPS). Every module trace found asks for T1 = 100 ms.

Keep-alive interval: VAG Blocks 500 ms timer (T6); OBDCracker sends `A3` after 500 ms idle (T12); `ecu_diagnostics` pings after 1000 ms (T4); T5 `T_CT_AKTIV_MS = 1000`, `T_CT_PASSIV_MS = 1050`, `MNCT = 5`. Answer to a module's `A3`: OVMS and rusEFI send `A1 0F 8A FF 0A FF` / `A1 0F 8A FF 4A FF` (T2, T9); VAG Blocks sends `A3` back (T6, line 626). Use `A1`. Confidence **Medium** (sources differ on the reply).

### 2.3 Data frames (2 to 8 bytes)

Byte 0 = opcode (high nibble) | sequence number (low nibble, 0 to F, wraps) (T1, T2, T4, T12):

| High nibble | Meaning | Who sends it |
|---|---|---|
| `0` | more frames follow, ACK wanted now (end of block) | data sender |
| `1` | last frame of the message, ACK wanted | data sender |
| `2` | more frames follow, no ACK | data sender |
| `3` | last frame, no ACK | data sender (OVMS also uses `3n` to abort a transmit) |
| `B` | ACK, ready for next frame | receiver |
| `9` | ACK, not ready (wait) | receiver |

- **First frame of a message**: bytes 1..2 = message length, big endian; then up to 5 payload bytes. Later frames carry up to 7 payload bytes (T1, T2, T6). **High**
- Length high byte quirk: OVMS masks to 12 bits, "we've seen 0x80 on byte 1 for response type UDS_RESP_NRC_RCRRP" (T2); VAG Blocks masks `0x7FFF`, "some modules seem to set this" (T6). Mask before use. **High**
- **ACK value**: `B` | (received sequence + 1) & 0x0F, the next sequence number the receiver expects (T1 trace, T2 `0xB0 | rxseqnr` after increment, T4 `next_packet_id`, T12). **High**
- Sequence counters: one per direction, start at 0 on each new channel, and continue across messages on the same channel (T1 trace: tester `10…` then `11…`; T12). **High**
- A tester request of 5 bytes or fewer is one frame with opcode `1`, e.g. `10 00 02 10 89` = message `10 89` (T1, T12).
- Missed ACK: T5 `MNT = 2` ("Max retries for Ack request (T1 timeout); channel closed when RC_S > MNT"). OBDScanner treats a repeated frame with the previous sequence number as "our ACK came late and the module repeated it" and ACKs again (T11). **Medium**

### 2.4 Example traces

Engine, PQ (T1, verbatim bytes; comments mine):

```
200  01 C0 00 10 00 03 01      setup request, module please send on 0x300
201  00 D0 00 03 40 07 01      OK: tester listens 0x300, sends 0x740
740  A0 0F 8A FF 32 FF         tester parameters
300  A1 0F 8A FF 4A FF         module parameters (BS 15, T1 100 ms, T3 10 ms)
740  10 00 02 10 89            tester seq 0, last frame, len 2: 10 89
300  B1                        module ACK
300  10 00 02 50 89            module seq 0, last frame: 50 89
740  B1                        tester ACK
740  11 00 02 21 01            tester seq 1: 21 01 (measuring block 1)
300  B2                        module ACK
300  21 00 1A 61 01 01 00 00   module seq 1, more follow, no ACK, len 0x1A
300  22 27 00 00 22 00 80 1A   seq 2
300  23 32 4B 25 02 7A 25 00   seq 3
300  14 00 25 00 00 25 00 00   seq 4, last, ACK wanted
740  B5                        tester ACK
740  A8                        disconnect
```

Golf Mk6 power steering (T8, verbatim):

```
0.339  0x200  09c00010000301   dongle: request channel open (address 0x09)
0.342  0x209  00d00003a80701   ECU: channel open response (tester sends on 0x7A8)
0.352  0x300  a10f8aff4aff     ECU: parameter response
0.422  0x300  1000025089       ECU: 0x50 0x89, mode 0x89 entered
```

Plain ELM327, VW Mk6 GLI, 2014 (T7, verbatim lines; `ATD1` shows the DLC after the ID):

```
ATCM000 / ATCF000
01 C0 00 10 00 03 01          → 201 7 00 D0 00 03 40 07 01 (repeated), then 300 A8
01 C0 00 10 00 03 01 1        → 201 7 00 D0 00 03 40 07 01  >
ATSH740 / ATCRA300
A0 0F 8A FF 4A FF             → 300 6 A1 0F 8A FF 4A FF  >
```

### 2.5 Sequence for one fault read (numbered steps)

From T1, T2, T6, T9, T12. Sequence numbers assume a fresh channel.

1. Tester on 0x200: `<addr> C0 00 10 00 03 01`.
2. Module on 0x200+addr: `00 D0 <lo> <hi> <lo> <hi> 01`. Tester takes listen ID (bytes 2,3) and send ID (bytes 4,5).
3. Tester on send ID: `A0 0F 8A FF 32 FF`.
4. Module on listen ID: `A1 <BS> <T1> FF <T3> FF`. Keep BS, T1, T3.
5. Tester: `10 00 02 10 89` (KWP startDiagnosticSession 0x89).
6. Module: `B1`, then `10 00 02 50 89`.
7. Tester: `B1`.
8. Tester: `11 00 04 18 02 FF 00` (readDTCByStatus).
9. Module: `B2`, then one or more frames with module sequence 1, 2, …; the last one has opcode `1`.
10. Tester: `B<next>` after every frame with opcode `0` or `1`.
11. Every 500 to 1000 ms of idle: tester `A3`, module `A1 …`. If the module sends `A3`, answer `A1 0F 8A FF 32 FF`.
12. Tester: `A8`; module: `A8`. Channel closed; the 0x89 session ends with it (T12 #302 maintainer decision; no VW document found). **Medium**

Constructed example of step 9 with two faults (built from the layouts in 2.3 and 3.1, **not a capture**): message `58 02 01 00 44 08 4B 4C` is 8 bytes, so the module sends `21 00 08 58 02 01 00 44` then `12 08 4B 4C`, and the tester ACKs `B3`.

rusEFI's TCU script (T9) treats `00 02 58 00` at the start of the first frame's data as "NO CODES".

---

## 3. KWP2000 services over TP2.0 for VW

| Request | Positive answer | Notes | Sources | Confidence |
|---|---|---|---|---|
| `10 89` | `50 89` | VW diagnostic session. PyVCDS: "0x89 is diag, 0x85 is PROG". Do not send 85 or 86. | T1, T8, T10, T15 (A7: 52 and 20 answer `50 89`) | High |
| `1A 9B` | `5A 9B …` | VAG long identification: part number, software, component text. PyVCDS parses part number from bytes 2..13 and name from 0x1C; falls back to `1A 91` (short part number). | T6, T8, T10, K2 | High on PQ. **On the 2014 A7, modules 52 and 20 answered `7F 1A 11`** (T15). OBDCracker's next fallback is `22 F1 87` and `22 F1 9E`, not yet run on the car. |
| `1A 9F` (gateway 0x1F) | `5A 9F …` | Installed-module list with VCDS number → TP2.0 address (1.3 above) | T6, T11 (copies T6) | Medium on PQ; Unconfirmed on MLB |
| `18 02 FF 00` | `58 n [DTC hi, DTC lo, status] x n` | statusOfDTC 02, groupOfDTC FF00. PyVCDS falls back to `18 00 FF 00` if refused with 0x12. | T9 (TP2.0, gearbox), T10, K2 (K-line) | High |
| `14 FF 00` | `54 FF 00` | clearDiagnosticInformation, group FF00 | T9 (TP2.0), K2 (expects `54 FF 00`) | Medium |
| `3E` | `7E` | testerPresent. PyVCDS sends it every 1 s (half of a 2 s timeout). With TP2.0 the `A3` channel test also runs. Whether the 0x89 session needs `3E` as well: Unconfirmed. | T10, T5 | Medium |
| `20` | `60` | stopDiagnosticSession (ISO 14230). Not seen in any VW TP2.0 trace; tools send `A8`. | T10 list, T6 | Low |
| `21 xx` | `61 xx …` | readDataByLocalIdentifier (measuring block xx) | T1, T6 | High |

### 3.1 Response layout of 58 (K1, section 8.2.2)

```
58  numberOfDTC  [DTC#1 (2 bytes)  statusOfDTC#1]  …  [DTC#m  statusOfDTC#m]
```

"listOfDTCAndStatus is only present if numberOfDTC is > $00" (K1). The DTC length and the status format are "vehicle manufacturer specific" (K1). For VW: K2 reads 2-byte DTC + 1 status byte ("count, then count x [DTC hi, DTC lo, status]"), and checks `1 + 3n == length` before trusting the count byte. PyVCDS steps 2 bytes per DTC (ignoring status), which does not match K1 or K2; do not copy that. Confidence **High** for 3-byte records.

### 3.2 Negative responses

`7F <SID> <NRC>`; for KWP: 0x11 serviceNotSupported, 0x12 subFunctionNotSupported-invalidFormat, 0x21 busy-RepeatRequest, 0x22 conditionsNotCorrect, 0x31 requestOutOfRange, 0x33 securityAccessDenied, 0x78 reqCorrectlyRcvd-RspPending (K1 table 4.4). On TP2.0, OVMS ACKs the 78 frame and resets its wait to 2000 ms (T2). **High**

### 3.3 Turning DTC bytes into Carista's 5-digit numbers

- KW1281 records (K-line, older protocol) print as `{Dtc:d5} - {Status & 0x7F:d2}-{(Status >> 7) * 10:d2}` (K2 `FaultCodesBlock.cs`): 16-bit DTC as 5 decimal digits, low 7 bits of status = fault type, bit 7 = intermittent.
- The same decimal rule matches the owner's numbers: 00256 = 0x0100, 00471 = 0x01D7, 02123 = 0x084B (arithmetic). That KWP2000 on CAN uses the same 16-bit decimal display: **Medium** (format match with V1, no document).
- The KWP2000 status byte bits for VW (how `004 … Intermittent` and `… MIL ON` are coded): **Unconfirmed**. K1 says manufacturer specific. Calibrate against Carista: read the raw status bytes for 00256 on 09 and compare with Carista's text.

---

## 4. Driving TP2.0 through an ELM327

### 4.1 What the ELM327 does that matters

| Fact | Datasheet E1 page / table E2 | Effect on TP2.0 |
|---|---|---|
| `AT CAF0`: "you must provide all of the required data bytes exactly as they are to be sent"; received bytes shown as received | E1 p13 to 14; v1.0 | Raw TP2.0 frames on protocol 6 |
| With CAF0 the ELM still "will add some trailing 'padding' bytes to ensure that the required eight data bytes are sent" | E1 p14 | Use `AT V1` (v1.3) or protocol B with variable DLC |
| `AT V1`: "send variable data length messages" | E1 p28; v1.3 | 1-byte ACKs go out as 1 byte |
| `AT PB xx yy`, PP 2C bits: b7 1 = 11-bit, b6 1 = variable DLC, b2..b0 000 = no formatting; `AT PB C0 01` + `AT SP B` = 11-bit, variable DLC, no formatting, 500 kbit/s | E1 p22, p73; v1.4 | The VAG Blocks route (T6), no CAF0 needed |
| Automatic flow control answers any frame that looks like an ISO-TP First Frame "(it does not matter if auto formatting is on or not)" | E1 p14 | A TP2.0 frame starting `1x` would trigger a stray flow control: send `AT CFC0` on protocol 6 (T12 relies on this) |
| `AT CRA hhh` filter, `X` wildcard (`AT CRA 7EX`) | E1 p46; v1.3 | `ATCRA2XX` for setup replies, `ATCRA300` on a channel. Clone without CRA: `AT CF` + `AT CM` (T11 does this) |
| `AT ST hh`: timeout = hh x 4 ms, default 32 (about 200 ms); the timer is reused "after a response has been received, while waiting to see if any more is coming (but this depends on the AT AT setting)" | E1 p27; v1.0 | Sets how long the ELM listens before the prompt |
| Adaptive timing (`AT AT1` default) can shorten waits; `AT AT0` disables it | E1 p52; v1.2 | OBDCracker lost data because a learned 45 to 80 ms timeout ended the listen right after the module's ACK (T12, #218): use `AT AT0` |
| "Responses digit": `01 05 1` returns after 1 frame; "If you set the last digit to a number that is less than the actual number of responses, then acknowledgements that may be required will not be sent" | E1 p32, p52 | Works in raw mode: `01 C0 00 10 00 03 01 1` (T7) |
| `AT R0`: does not wait for a reply; "not recommended … for normal OBD communications" | E1 p23; v1.0 | Possible for ACK frames; not used by any TP2.0 tool found |
| Any character sent while the ELM listens interrupts it (`STOPPED`) | E1 p7 and p47 (as cited by T12) | OBDCracker interrupts with `X` to send an ACK in time (T12) |
| `AT CSM0/1` silent monitoring, default from PP 21 | E1 p16; v1.4b | Only matters if listening with `AT MA`: a silent monitor leaves module frames un-ACKed at CAN level (T15 #232: a module frame repeated 31 times, then `CAN ERROR`) |
| `AT D1` shows the DLC | E1 p13; v1.3 | Helps to see 1-byte ACKs (T6, T7 use it) |

**The ELM only hears the bus while it is waiting for a reply** (T11: "The chip only hears the bus while a command waits for its answer"; T12: "Frames between the prompt and the next line are lost"). So every ACK, `A3` or request is also the tester's chance to catch frames that arrive next. Confidence **High**.

### 4.2 Recipe A: protocol B (VAG Blocks, T6, verbatim commands)

```
AT E0
AT I            (log version)
ST I            (STN only; if not "?", ST FAP 000,000)
AT PB C0 01     11-bit, variable DLC, no formatting, 500 kbit/s
AT SP B
AT H1
AT D1
AT L0
AT ST <ms/4>    VAG Blocks uses 16, 24 or 40 ms (fast, normal, slow)
AT SH 200
AT CRA 2<dest>  e.g. AT CRA 201
<dest> C0 00 10 00 03 01
AT SH <tx>      from the reply, e.g. 740
AT CRA <rx>     300
A0 0F 8A FF 4A FF
…data frames, ACKs, A3 every 500 ms…
A8
```

To go back to UDS: `AT SP 6` (protocol 6 has ISO-TP formatting). Confidence **High** that this is VAG Blocks' sequence; **Medium** that it works on MLB.

### 4.3 Recipe B: stay on protocol 6 (OBDScanner T11, OBDCracker T12)

Enter raw mode:

```
AT CAF0
AT CFC0
AT V1           (if "?", frames go out padded to 8 bytes; effect on modules Unconfirmed)
AT AT0
AT H1
AT S1           (spaces; parsing choice)
```

Leave raw mode: `AT ST 32`, `AT AT1`, `AT V0`, `AT CFC1`, `AT CAF1` (T11 retries `AT CAF1` up to 4 times), `AT AR` (T11).

Per channel (T11 values):

```
AT ST 19         100 ms for the setup
AT SH 200
AT CRA 2XX       or AT CRA 2<dest>
<dest> C0 00 10 00 03 01
AT SH <tx>
AT CRA <rx>
A0 0F 8A FF 32 FF
AT ST <T1/2 in 4 ms steps, 6..25>   T11: "half the module's ACK wait, 24–100 ms"
10 00 02 10 89
B1
11 00 04 18 02 FF 00
B<n> …
A8
```

### 4.4 Can a clone keep up with the ACK timing?

- Budget: the module waits T1 = 100 ms for the tester's ACK (every `A1` found). Through the ELM the ACK costs: the ELM's listen timeout after the module's last frame (the `ATST` value) + BLE notification to the phone + app + BLE write back + ELM parse and send. The BLE part on the owner's adapter and iPhone is not measured: **measure it** (send `ATI` 50 times, time the round trip) before choosing `ATST`.
- Slack: the module repeats an unACKed frame (T5 `MNT = 2`; T11 handles the repeat). **Medium**
- Real results with plain ELM327 or similar:
  - VAG Blocks: "Both Bluetooth and USB adapters have been tested … Sample rates of up to 12 samples per second", and "the communication protocol is unstable … its raw CAN mode is limited which makes implementing VW TP 2.0 difficult" (T6 README). PQ cars. **High** that it can work.
  - Google Group 2014 (VW Mk6 GLI, plain ELM327): setup and `A1` received; without the responses digit "the ELM327 device keeps reading data without returning control … until the timeout occurs", the module repeated its setup reply and finally sent `A8` because "the ECU was timing out waiting for me to send the chan parameters". Fix: `01 C0 00 10 00 03 01 1`, then `ATSH740`, `ATCRA300`, `A0 0F 8A FF 4A FF` → `300 6 A1 0F 8A FF 4A FF` (T7). **High**
  - Car Scanner (ELM327 app): "VW TP2.0 Readings" and "UDS + VWTP2.0 AT/DSG" profiles (T17). **Medium** (no adapter detail).
  - OBDCracker on an STN2232 (not a clone) on the 2014 A7: channels, `A1`, `10 89` → `50 89` all worked once it (a) interrupted the listen with `X` to ACK in time, (b) kept listening after the module's ACK, (c) set `STCMM 1` so its monitor ACKed frames at CAN level (T12, T15). It refuses TP2.0 on adapters that do not echo each character as it arrives (T12). **High** for STN; clone behaviour **Unconfirmed**.
  - ediabaslib: plain ELM327 marked "No" for VAG; VAG mode "requires a Bluetooth D-CAN/K-Line adapter" with replacement firmware (T16). **High** (for that project).
- Carista reads 09/42/46 on the owner's car **through the same adapter**, so the hardware path exists. How Carista drives it (TP2.0 or something else, standard AT commands or Carista-only ones) is **Unconfirmed**. A capture of Carista's BLE writes (iOS Bluetooth logging profile with Apple's PacketLogger) would answer both open MLB questions (logical addresses and identification service) in one session.

### 4.5 Clone-specific checks before use

Send each and treat `?` as "not supported": `AT V1`, `AT CRA 300`, `AT PB C0 01`, `AT CSM0`, `AT CFC0`, `AT D1`. All exist in genuine v1.4b (E2); a "v1.5" clone runs v1.4 code (E3) but may leave commands out. T11 falls back from `AT CRA` to `AT CF` + `AT CM`. **Medium**

---

## 5. UDS: gearbox `7F 19 78` and airbag `7F xx 21`

### 5.1 Timing values

| Item | Value | Source | Confidence |
|---|---|---|---|
| P2Server max (first answer) | default 50 ms | U1 | High |
| P2*Server max (after each 78) | default 5000 ms; "If the final response is still not available, the server shall send another Response Pending (0x78)" | U1 | High |
| Client P2 / P2* timeouts | P2Server_max + ΔP2, P2*Server_max + ΔP2response | U1 | High |
| udsoncan defaults | `p2_timeout` 1 s, `p2_star_timeout` 5 s, `request_timeout` 5 s overall ("even if the server requests that the client wait … this timeout will still trigger") | U5 | High |
| opendbc | `timeout` 1 s, `response_pending_timeout` 10 s, loops on every 78 with no count limit; 0x21 raises an error | U2 | High |
| OVMS ISO-TP | each 78 adds 500 ms to the wait | U4 | High |
| OVMS TP2.0 | each 78: ACK it and reset the wait to 2000 ms | T2 | High |
| OBDScanner TP2.0 | gives up after 30 consecutive 78s | T11 | Medium |

### 5.2 Does the ELM327 handle `7F xx 78`?

- Genuine ELM327 v2.1 and later: "Beginning with v2.1 … The ELM327 now checks each reply to see if it is a special 'Response Pending' message … changing the timeout to 5 seconds for you if it sees a Response Pending message. This will only occur for the CAN and ISO14230 (KWP) protocols". Enabled by PP 2A bit 2 (default `3C`, bit 2 set). "the current implementation of this feature does not keep track of multiple ECUs … you may need to filter for only one ECU address" (E1 p45, p73). **High**
- A "v1.5" clone runs the older v1.4 code (E3), so assume it does not. **Unconfirmed** for the owner's adapter: test it (below).
- Even without 78 handling, the ST timer restarts on each received frame (E1 p27), so with `AT AT0` and `AT ST FF` (255 x 4 ms, about 1.02 s) the ELM keeps listening while the gearbox sends a 78 at least every 1 s. **Medium** (inference from E1).
- STN behaviour on the 2014 A7, one listen each (T15 #304, verbatim):

```
STPX d:22F187F188F189F191 → 7E8 03 7F 22 78 7E8 10 21 62 F1 87 34 47 30 …
ATSH7E1 / ATCRA7E9, same request → 7E9 03 7F 22 78 7E9 10 21 62 F1 87 34 47 30 …
```

Why "78 repeatedly" can happen on a clone (inference, **Unconfirmed**): if the ELM ends its listen after the 78 (short `ATST` or adaptive timing) and the app sends `19 02` again, the gearbox restarts the job and answers 78 again. If the final answer is multi-frame and the ELM has stopped listening, no flow control is sent and the answer is lost.

### 5.3 What to do (values from 5.1; retry counts are my recommendation)

For `7F <sid> 78`:

1. Before slow requests (`19 02`, `14`, `31`) to the gearbox: `AT AT0`, `AT ST FF`, `AT CRA <reply ID>`.
2. Send once. Do not resend while a 78 is pending.
3. If the reply lines contain `7F 19 78` and then the final answer: done.
4. If the prompt comes after a 78 with no final answer, the ELM has stopped listening and that answer is lost (OVMS and opendbc keep waiting, which an ELM cannot do after its prompt). Mark the read "timed out after response pending", wait 5 s (P2*), and try once more. Do not loop.
5. Restore `AT ST` and `AT AT1` afterwards.

For `7F <sid> 21` (busyRepeatRequest):

- ISO 14230-3 (K1 5.3.1.3): the server answers 21 to each repeat while busy; when done it answers positively or with another code; "The communication timing is not affected!" pyudskit: "Wait and retry" (U6). PyVCDS repeats after its frame interval with no limit (T10). opendbc does not retry (U2).
- Recommendation (mine, **Unconfirmed**): repeat the same request after 100, 200, 500, 1000, 1000 ms (5 tries, about 3 s), then report "busy". Make sure no other request (for example a tester present) is in flight to the same module.
- Airbag context: on the 2014 A7 the airbag 715/77F answered DIDs and `19 02` (no faults) without 21, and answered `19 01` with a short `59 01 00 00` (U7, T15 #304). Which request got 21 on the owner's car matters; log it.

---

## 6. Clearing faults

| Case | Request | Evidence | Confidence |
|---|---|---|---|
| Engine, emissions DTCs | OBD mode `04` to 7E0 (or 7DF) → `44` | ELM datasheet: mode 04 erases DTCs, freeze frame, O2 data, mode 06/07 data, not permanent (mode 0A) codes; "Some vehicles may require a special condition to occur (eg. the ignition on but the engine must not be running)" (E1 p35) | High |
| Any UDS module | `10 03` then `14 FF FF FF` | openpilot `clear_dtc.py` does exactly this (generic, used across makes) (U3). No VW document found | Medium (generic), Unconfirmed for VW |
| Meaning of the owner's `7F 14 11` | 0x11 = "ECU does not implement"; wrong session is 0x7F "Service blocked in session" | U6 | Medium |
| KWP2000 module on TP2.0 | `10 89` then `14 FF 00` → `54 FF 00` | rusEFI sends `14 FF 00` after `10 89` on a TP2.0 gearbox (T9); kw1281test expects `54 FF 00` (K2, K-line) | Medium |
| Busy after clear | KWP clear may answer 21 until done (K1 lists clearDiagnosticInformation among services that use this flow) | K1 5.3.1.3 | High |

Order to test on the engine (each a separate test, ignition on, engine off): `04` on 7E0; if that fails, `10 03` → `50 03 …`, then `14 FF FF FF`, then `10 01`. Read faults again after 1 to 2 s.

---

## 7. Module addresses

| VCDS address | Name (A6 C7, V1/V2) | UDS IDs from earlier research | Protocol on C7 | TP2.0 logical address |
|---|---|---|---|---|
| 01 | Engine | 7E0/7E8 | UDS (V1) | 0x01 on PQ (T1) |
| 02 | Gearbox | 7E1/7E9 | UDS (U7) | 0x02 on PQ (T9, T10) |
| 03 | ABS | 713/77D (T13 gateway table) | UDS (V1) | 0x03 on PQ (T10) |
| 05 | Acc/Start Auth. | | KWP (V1) | Unconfirmed |
| 08 | HVAC | 746/7B0 | UDS (answers on the owner's car) | Unconfirmed |
| 09 | Cent. Elect. | | KWP (V1) | Unconfirmed on MLB. On PQ 0x09 is power steering (T8, T10) |
| 15 | Airbag | 715/77F | UDS (U7) | 0x05 on a 2007 VW (T10) |
| 17 | Instruments | 714/77E | UDS (V1) | Unconfirmed |
| 19 | Gateway | 710/77A | UDS (V1) | 0x1F on PQ (T3, T6, T10) |
| 42 | Door, driver | | KWP (V1) | Unconfirmed; no TP2.0 reply at 0x42 on the 2014 A7 (T13) |
| 46 | Central Conv. | | KWP (V1) | Unconfirmed; no TP2.0 reply at 0x46 on the 2014 A7 (T13) |
| 52 | Door, passenger | | KWP (V1) | 0x52 opened a channel on the 2014 A7 (T13), identity unconfirmed; 0x52 was the radio head unit on a 2007 VW (T10) |

---

## 8. Open items (do not code as fact)

1. MLB TP2.0 logical addresses for 09, 42, 46, 05, 62, 72. Ways to find out, cheapest first: capture Carista's BLE traffic; try gateway `1A 9F` on TP2.0 address 0x1F; read UDS `22 2A2A`, `22 2A29`, `22 2A2C` on 0x710 (T13) and look at the "02" entries; probe TP2.0 setup on 0x01..0x7F (setup and `A8` only, read-only).
2. Identification on MLB KWP modules: `1A 9B` refused on the A7 (T15). Try `1A 91`, then `22 F1 87`.
3. KWP2000 status byte bits for VW.
4. Whether `AT V1` is needed: do MLB modules accept 8-byte padded TP2.0 frames? T12 says a module that pads its own frames "is not understood" by its raw-CAN path; nothing found on modules receiving padded frames.
5. the owner's adapter: which of `AT V1`, `AT CRA`, `AT PB`, `AT CSM`, `AT CFC0` it accepts; whether it waits through 78; BLE round-trip time.
6. Why ABS gives NO DATA on 713/77D on the owner's car (UDS, not TP2.0).
