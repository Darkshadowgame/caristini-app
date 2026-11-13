# Caristini: VW group (MQB, MLB, MLB evo) sources for discovery, coding, service and live data

Research note, 11 Nov 2026. Scope: Carista-level functions on all VW group cars, starting with the owner's 2012 Audi A6 C7 2.0 TDI (MLB, VIN WAUZZZ4GXCN000000). Companion to `uds-sources.md` (CAN IDs, read services), `tp20-sources.md` (TP2.0 + KWP2000 transport) and `coding-sources.md` (current coding catalogue). PQ35 KWP detail (Seat Leon 1P) is in `leon-sources.md` and is not repeated here.

Confidence key (same as the other notes):

- **High**: two or more independent public sources agree, or one primary source plus a real-car capture.
- **Medium**: one public source with real-car data, or two sources that agree only by my inference.
- **Low**: single community post, different platform or generation, untested code, or sources disagree.
- **Unconfirmed**: no public source found. Do not ship as fact.

"My inference" or "my decode" marks a step I made by combining sources; it is never a quote.

---

## Sources

| Key | Source | URL | Notes |
|---|---|---|---|
| G1 | OBDCracker (MIT) test vectors: raw `22 2A2A` and `22 2A2C` replies from the 2014 Audi A7 3.0 TDI (C7, MLB) gateway 0x710, car session 6 (#124), 22 Oct 2026 | https://github.com/DaSonOfPoseidon/OBDCracker/blob/HEAD/crates/obdcracker-core/tests/uds.rs | Verbatim bytes, quoted below |
| G2 | OBDCracker issues #170, #169, #231 (2A29 values per module, TP2.0 setups, 0x71D/0x755 silent) | https://github.com/DaSonOfPoseidon/OBDCracker/issues/170 , https://github.com/DaSonOfPoseidon/OBDCracker/issues/169 , https://github.com/DaSonOfPoseidon/OBDCracker/issues/231 | Same A7 |
| G3 | dspl1236/VAG-CP-Docs, "AU57X ODIS MCD Project findings" (AU57X = A6 C7 / A7 4G / A8 D4), decoded from ODIS MCD DVR 72 (2022-09-22), gateway `EV_GatewPKOUDS_001` | https://github.com/dspl1236/VAG-CP-Docs/blob/HEAD/technical/au57x-mcd-project-findings.md | DID names and structures for 04A3, 2A26 to 2A2C. No licence stated |
| G4 | bri3d/mcd-diag-rs (BSD-3), `installation.rs`, ODIS MCD based tool, tested on MQB (VW37/AU37) | https://github.com/bri3d/mcd-diag-rs/blob/HEAD/crates/mcd-db/src/installation.rs | 2A26 present, 04A3 specified, 2A28 DTC, 2A27 sleep, 2A2D bus, 2A44 additional; node to CAN ID rule |
| G5 | pashokitsme/vagcan, `gateway.rs`, from a capture of VCDS on a Skoda Octavia III (MQB, gateway 3Q0 907 530 B) | https://github.com/pashokitsme/vagcan/blob/HEAD/crates/uds/vag-uds-client/src/gateway.rs | 32-byte bitmap at 2A26 and 04A3, LSB first |
| G6 | basilfx/project-egolf, VCDS autoscan of an e-Golf (MQB, gateway 3Q0 907 530 H), 1 May 2025 | https://github.com/basilfx/project-egolf/blob/HEAD/assets/posts/2025-05-01/vcds/autoscan.txt | `GVL:` line = VCDS print of the installation list, plus the full module list |
| G7 | Ross-Tech VCDS tour, Installation List | https://mail.register.ross-tech.com/vcds/tour/installation-list.php | "bitfield coding"; "only works on UDS Gateways and some CAN Gateways" |
| G8 | bbear3d/ovtsuite (MPL-2.0), `gateway.py` and module definitions for the Audi A6 C6 (KWP2000 on TP2.0), from the author's VCDS autoscan capture, 20 Sep 2026 | https://github.com/bbear3d/ovtsuite/blob/HEAD/ovtsuite/diag/gateway.py , https://github.com/bbear3d/ovtsuite/blob/HEAD/ovtsuite/diag/data/definitions/vag-generic/modules/17-instruments/module-kwp2000-c6.yaml , https://github.com/bbear3d/ovtsuite/blob/HEAD/ovtsuite/diag/data/definitions/vag-generic/modules/19-gateway/module-kwp2000-c6.yaml | C6 is not MLB; closest public KWP-on-TP2.0 Audi capture |
| K1 | gmenounos/kw1281test (MIT), `Tester.Kwp2000Diag.cs` (KWP2000 on K-line, EDC16 engine) | https://github.com/gmenounos/kw1281test/blob/HEAD/Tester.Kwp2000Diag.cs | `3B 9A` short-coding record, WSC codec, `27 03/04` seed + code |
| K2 | Boromatic/SpeckMobil (GPL-3.0), `kwp2000.cpp`, ELM327 TP2.0 tool for PQ cars, 2014 | https://github.com/Boromatic/SpeckMobil/blob/master/kwp2000.cpp | `1A 9A` long coding read, `1A 9B` layout, WSC bit split |
| K3 | TBK/vag-tool, README (KWP2000 on TP2.0, Audi A3 8P PD engine), "Not yet tested against the car" | https://github.com/TBK/vag-tool | Coding-II and security access via `27 03/04` |
| C1 | Ross-Tech forum, "MQB Platform tweaks", post by Andy (Ross-Tech), 10 Aug 2016, edited 3 Jul 2018 | https://forums.ross-tech.com/index.php?threads/512/ | 09 comfort windows adaptation channel names, login 20103 |
| C2 | Stuart Dalby, Golf Mk7 VCDS page | https://www.stuartdalby.co.uk/vwgolfmk7/VCDS | 17 byte 1 bit 0 label text |
| C3 | AutoInstruct, "MK7 Golf OBDeleven / VCDS Tweaks", Luke, 12 Jun 2017 | https://www.autoinstruct.com.au/manufacturer/volkswagen/mk7-golf/mk7-golf-obdeleven-vcds-tweaks/ | MQB bytes, bits, adaptation names, login 31347 |
| C4 | Audizine, "VCDS Mod List for B9" (search-result text only; page not read) | https://audizine.com/threads/vcds-mod-list-for-b9.958772/ | MLB evo needle sweep |
| C5 | vag-coding.net, A7 (C8) lap timer and Q7 (4M) needle check (search-result text only; site returns 404 to fetches) | https://www.vag-coding.net/audi/a7-c8/a7-c8-lap-timer , https://www.vag-coding.net/audi/q7-4m/q7-4m-needle-check | MLB evo |
| C6 | Car Scanner, MQB coding list (item names only, no bytes) | https://www.carscanner.info/coding-mqb/ | Shows which items an ELM327 app offers |
| S1 | Ross-Tech wiki, VW Golf VII (5G/AU) Instrument Cluster, Service Reminder | https://wiki.ross-tech.com/wiki/index.php/VW_Golf_VII_(5G/AU)_Instrument_Cluster | Same channel names as the A6 4G cluster page |
| S2 | dspl1236/PCM-Forge, service-reset tool for Porsche Cayenne 958 / VW Touareg 7P cluster (`EV_KombiUDSRBVW526`), "EXPERIMENTAL", "needs validation on a live Cayenne 958" | https://github.com/dspl1236/PCM-Forge/blob/HEAD/tools/service-reset/README.md | Claims IDE number (decimal) = UDS DID |
| S3 | CarPort-OBD wiki, MQB service reset | https://carport-obd.com/en/wiki/mqb-service-reset | Channel numbers 8754, 8870, 8871 (already T4 in `coding-sources.md`) |
| B1 | Ross-Tech wiki, Diesel Particle Filter Emergency Regeneration | http://wiki.ross-tech.com/wiki/index.php/Diesel_Particle_Filter_Emergency_Regeneration | UDS CR-TDI section |
| B2 | Ross-Tech wiki, Battery Replacement | https://wiki.ross-tech.com/wiki/index.php/Battery_Replacement | Gateway 4G0 907 468 E (A6 C7 family) channel names |
| B3 | Ross-Tech wiki, Audi A6 (4G/4H) Parking Brake | https://wiki.ross-tech.com/wiki/index.php/Audi_A6_(4G/4H)_Parking_Brake | "Start/End lining change mode" |
| L1 | v-cu/dpf-load-monitor-wide, `can_dpf.c` (shipping DPF display, reads only, "EDC17 and newer", README: DIDs "differ between engine codes") | https://github.com/v-cu/dpf-load-monitor-wide/blob/HEAD/firmware/main/can_dpf.c | Request on 0x7E0, `03 22 hi lo` |
| L2 | OBDb Audi-A6, test captures for model year 2012 | https://github.com/OBDb/Audi-A6/tree/main/tests/test_cases/2012/commands | Real replies with expected values |
| L3 | OBDb Audi-A4, test captures (2009 to 2024) | https://github.com/OBDb/Audi-A4/tree/main/tests/test_cases | 2014 `10E0`, 2018 `295A`, 2012 `11BA` |
| L4 | OBDb Audi-Q5, 2015 capture of `22 114E` in session 03, and the Q5 signalset | https://github.com/OBDb/Audi-Q5/tree/main/tests/test_cases/2015/commands , https://github.com/OBDb/Audi-Q5/blob/main/signalsets/v3/default.json | Signalset rows without captures are Low |
| L5 | OBDb Volkswagen-Golf, `22 1044` captures in session 03 (2011 to 2020) | https://github.com/OBDb/Volkswagen-Golf/tree/main/tests/test_cases | |

Sources that blocked automated reading on 11 Nov 2026: vag-coding.net (404), Audizine (not fetched; search text only).

---

## 1. Module discovery from the gateway

### 1.1 MLB (A6/A7 C7, and by the AU57X project name the A8 D4)

The C7 gateway (UDS, 0x710/0x77A) holds parallel tables, one entry per slot, read with `22` (G3, G1). Names and layouts from the ODIS data (G3), checked against the real A7 replies (G1, G2):

| DID | ODIS name (G3) | Layout (G3) | What the 2014 A7 returned (G1, G2) | Confidence |
|---|---|---|---|---|
| `2A2A` | Gateway Component List allocation | G3: "`{ECU_ID u8, ECU_Name u8}` pairs, `byte_size=1` each" | 80 bytes, one VAG address word per slot, then `00` padding. **Disagreement:** G3 says pairs, the car shows one byte per slot | High that each byte is an address word; record shape: show both |
| `2A29` | Gateway Component List DiagProt | "One byte per module slot ... bit0=ISO-TP, bit1=TP2.0, bit2=TP1.6, bit3=K-Line, bit4=Ethernet" | `01` for modules that answered UDS, `02` for the TP2.0-silent ones and 52, `03` for 1B and 6C, `00` for the gateway (G2; OBDCracker called it "a guess") | **High** (ODIS name plus car data agree) |
| `2A2C` | Gateway Component List TP-Identifier | "`u16` big-endian CAN TX IDs, one per module slot" | 160 bytes; only 8 slots non-zero: 03→0713, 13→0757, 8B→0756, 34→0755, 22→071D, 3B→0721, 44→0712, 8E→0758 | High for layout. Zero slots: request ID not given, use `modules.ts` |
| `04A3` | Gateway Component List | "1-byte bitfield records. Each byte covers 8 sequential module slots; bit N set = slot coded" | Not read on the A7 | Medium (one source); bit order on MLB **Unconfirmed** |
| `2A26` | ... present | Same bitmap; "module is online" | Not read | Medium |
| `2A27` | ... sleep indication | Same bitmap | Not read | Medium |
| `2A28` | ... DTC | Same bitmap; "module has an active DTC" | Not read | Medium |

Raw A7 replies, verbatim from G1:

```
710 → 22 2A 2A
77A ← 62 2A 2A 01 02 03 03 04 05 06 08 09 0E 10 11 13 8B 34 15 16 17 17 18 19 1B 1E 20 22 28 2E 30 36 3C 3D 3E 42 46 47 52 53 55 56 57 85 5F 62 26 65 69 6C 6D 6F 72 3B 7F 82 84 48 5B 88 89 8A 8D 8F 90 AC 44 81 8E C0 A9 40 51 8C BA 14 00 00 00 00 00 00 00
710 → 22 2A 2C
77A ← 62 2A 2C 00 00 00 00 07 13 ... (2 bytes per slot, 80 slots; see G1 for the full string)
```

Red flags:

1. **2A2A is not the installed list.** The A7 is a 3.0 TDI (no hybrid), yet its 2A2A holds 51 (electric drive) and 8C (hybrid battery), and 03 and 17 twice. G3's own name is "allocation". My inference: 2A2A is the gateway's slot table; use `04A3` (coded) and `2A26` (present) to decide what is fitted. OBDCracker's "73 installed" is their reading, not the gateway's.
2. On the A7 the IDs 0x71D (22) and 0x755 (34) from 2A2C stayed silent for 5.1 s each (G2). A 2A2C entry does not prove the module is fitted.
3. 2A2A (83 bytes with header) and 2A2C (163 bytes) are multi-frame: the flow control setup in `uds-sources.md` section 5 is needed.

Read-only command list for the C7 (all `22`, default session per G4 and G1):

```
ATSH 710 / ATCRA 77A / ATFCSH 710 / ATFCSD 30 00 00 / ATFCSM 1
22 2A 2A    slot → address word (00 = empty)
22 2A 29    slot → protocol bits (bit0 UDS on ISO-TP, bit1 TP2.0)
22 2A 2C    slot → request CAN ID (0000 = not given)
22 04 A3    coded bitmap
22 2A 26    present bitmap
22 2A 28    DTC bitmap
```

Decode (my proposal, confirm on the owner's car): slot i is fitted if bit i of `04A3` or `2A26` is set. Try LSB-first numbering (proven on MQB, 1.2) and check it against the modules that answer; if the bitmaps contradict the modules that answer, fall back to probing every slot whose `2A29` bit 0 is set. A slot with `2A29` bit 1 set is a TP2.0 module (on the C7: 09, 42, 46, 52 and others; see `tp20-sources.md`).

### 1.2 MQB (Golf 7, Octavia III, A3 8V, Leon 5F and others)

`22 2A26` (present) and `22 04A3` (coded) on 0x710 return a 32-byte bitmap (G4, G5, G6). Bit n, counted least significant bit first (byte n/8, bit n%8), is **node n**:

- G5: "decoding them least-significant bit first yields `700 70A 70C 70E 712 713 714 715 746 74A 74B 767 773 776 777`. Every one of the seven units separately observed answering in that capture is in the list"; most significant first gave only 2 of 7.
- G4 (from ODIS data): node = "the low byte of the module's UDS request CAN id"; "`0x76..=0x7F` is the OBD window: `0x7E0 + (node - 0x76)`"; "`0x01..=0x09` and `0xE0..=0xF7` ... get only the 29-bit `0x17FC00nn` form"; everything else `0x700 + node`, then `0x17FC00nn`.
- G5 could not explain bits 0x76 and 0x77 ("unresolved"). By G4's rule they are the engine (7E0) and gearbox (7E1). My inference, consistent with G6 below.
- G6 check (my decode of VCDS's `GVL: 01563C000000060854CC8000A000481800000000000200000000000000000000` on an e-Golf): nodes 00, 09, 0A, 0C, 0E, 12, 13, 14, 15, 31, 32, 3B, 42, 44, 46, 4A, 4B, 4E, 4F, 57, 65, 67, 73, 76, 7B, 7C, C9 = 27 nodes; the autoscan lists 27 modules besides the gateway. Nodes 7B and 7C map to 7E5 and 7E6, which ODIS gives to 8C HV battery and 51 electric drive (`uds-sources.md` S1), both fitted on that car. The gateway does not list itself (G5).
- Node 00 (0x700) is set on both MQB cars. G5 treats 0x700 as VCDS's broadcast tester-present address; the G6 count only matches if node 00 is a real module. **Unresolved.**

Confidence: **High** for the MQB bitmap (three independent sources). Other G4 tables: `2A28` DTC flag, `2A2D` bus per node (256 bytes), `2A27` sleep, `2A44` additional installations (Medium, one source). Response IDs: +0x6A, or +8 in the OBD window (`uds-sources.md`).

Commands:

```
ATSH 710 / ATCRA 77A (+ flow control as above)
22 2A 26   → 62 2A 26 + 32 bytes
22 04 A3   → 62 04 A3 + 32 bytes
for each set bit n: request = (0x76 ≤ n ≤ 0x7F) ? 0x7E0 + (n − 0x76) : 0x700 + n
```

### 1.3 MLB evo (A4 B9, Q7 4M, A5 F5, Q5 FY)

No public capture or ODIS extract found. G4 says it reads whichever of these DIDs the gateway's ODIS data lists, so the MQB route may work, but that is not shown. **Unconfirmed.** Try `22 2A26` first, then the MLB tables, and log what answers.

### 1.4 KWP2000 gateways (C6 and other TP2.0 gateways, for reference)

G8, A6 C6 gateway 4F0 907 468 x over TP2.0: `22 04 A1` returns 4-byte records `<module address> <TP 2.0 logical address> <status> <bus>`, e.g. `17 07 05 03` (cluster at TP2.0 dest 0x07). Status `00` = not fitted; status bit 2 (0x04) = faults stored. One capture, one car: **Medium** for C6. Whether the C7 UDS gateway answers `22 04 A1` on 0x710 is **Unconfirmed**; it is a read and worth one try, because it would give the C7's TP2.0 logical addresses for 09/42/46/52 (the open item in `tp20-sources.md` section 8).

---

## 2. MLB KWP2000 modules (09 central electronics, 46 comfort): coding

### 2.1 What is public

| Step | Request | Evidence | Confidence |
|---|---|---|---|
| Reach the module | TP2.0 channel setup on 0x200, `A0` parameters, `10 89` | `tp20-sources.md` sections 2 and 3. On the 2014 A7 only 52 and 20 opened a channel; 09, 42, 46 did not at their own address numbers | Medium for transport; MLB logical addresses **Unconfirmed** |
| Identification | `1A 9B` | Refused with `7F 1A 11` by the A7's 52 and 20 (`tp20-sources.md` T15) and by the C6 cluster and gateway (G8: "it refuses 1A 9B (7F 1A 11) and identifies through data identifiers") | High that Audi KWP-on-TP2.0 modules of this era refuse it |
| Identification fallback | `22 F187`, `22 F189`, `22 F191`, `22 F1A3`, `22 F197`, `22 F1A5` (workshop code field) | G8 module definitions for the C6 cluster and gateway, from a capture | Medium for C6; Unconfirmed for C7 |
| Read long coding | `22 06 01` (length), then `22 06 00` | G8: "an 11-byte long coding on 22 06 00" (C6 cluster), "its coding is the three-byte long form read with 22 06 00 (length from 22 06 01)" (C6 gateway) | Medium for C6; **Low** for C7 09/46 (different generation, not tried) |
| Read long coding (older form) | `1A 9A`; reply byte 10 = `10`, byte 11 = length, coding from byte 12 | K2 (PQ, ELM327). In `1A 9B`, the byte after the 4-character software version is `03` for short coding or `10` for long coding (K2; K1 agrees on `03`) | Low (PQ only; the C7 refuses `1A 9B` anyway) |
| Write long coding | | **Not public.** G8 writes long coding only over UDS (`2E 06 00`) and says "KWP2000 long coding is not written here (the 0x9A record is the short form)". No capture of a KWP long-coding write on any Audi was found | **Unconfirmed** |
| Write short coding (engines, K-line) | `3B 9A` + WSC(6) + software version(4) + `03` + coding(3) | K1 (EDC16 on K-line; WSC and software echoed from `1A 9B`); K3 describes the same Coding-II record (untested) | Medium for EDC16 short coding; not applicable to 09/46 long coding |
| Security access | `27 03` → 4-byte seed; `27 04` + key, key = seed + code (32-bit big-endian) | K1 (code), K3 (README), G8 ("seed_plus_code"); same formula as UDS in `coding-sources.md` A6 | Medium (KWP generally); which 09/46 functions need it on the C7: Unconfirmed |
| Login (KWP) | Code carried in the `9A` record as `0x800000 | login` in place of the coding | K1 comment; G8 variant name `record_9a_bit23` | Low |

WSC field (6 bytes, big-endian 48-bit):

- K1: bits 0-16 = WSC (17 bits), bits 17-26 = importer (10 bits), bits 27-46 = equipment (20 bits), bit 47 unused; worked example "WSC 45678, importer 345, equipment 987654 -> 78 90 32 B2 B2 6E".
- K2 comment: "Shop number 6 Byte: 21bit=3.Block, 10bit=2.Block, 17bit=1.Block". Equipment is 21 bits in K2 and 20 bits in K1: **sources disagree** on the top bit. Copy the 6 bytes unchanged; do not re-encode them.

### 2.2 Conclusion for the A6 C7

- Read path worth trying (read-only): open TP2.0 to the module's logical address (found via 1.1 or 1.4), `10 89`, `22 F187`, `22 06 01`, `22 06 00`. Compare the length with V1 in `coding-sources.md` (30 bytes for both 09 and 46 on a 2012 A7).
- **Writing 09/46 coding on the C7 is not implementable from public sources.** Every 09 and 46 item in `src/coding/items.ts` (DRL, tail lights, tourist mode, lock horn, adaptive brake lights) assumes UDS on 70E/70D; on the C7 these modules are KWP on TP2.0 (`tp20-sources.md` 1.1). Flag for the code owner: those items cannot be written on the C7 as built.
- A capture of Carista coding one 09 item on the owner's car (iOS PacketLogger) would settle transport, logical address, read and write in one session.

---

## 3. Customisation catalogue (Carista-style items)

Bit n = `(byte >> n) & 1` (`coding-sources.md`). "C7" column: whether the item can be written on the owner's A6 C7 with what is public.

| Item | Platform | Module, method | Byte / bit or channel | Value | Sources | Confidence | C7 |
|---|---|---|---|---|---|---|---|
| Needle sweep | MLB C7 | 17, UDS long coding | Byte 1 bit 0 | 1 | `coding-sources.md` A1 | High | **Yes** (17 is UDS, 714/77E) |
| Needle sweep | MQB | 17, long coding | Byte 1 bit 0 "Gauge Test/Needle Sweep (Staging) Active" | 1 | C2, C3 | High | n/a |
| Needle sweep | MLB evo | 17, long coding | Byte 1 bit 0 | 1 | C4, C5 (search text only) | Medium | n/a |
| Lap timer | MLB C7 | 17 | Byte 1 bit 3 | 1 | `coding-sources.md` A1 | High | **Yes** |
| Lap timer | MQB | 17 | Byte 1 bit 3 | 1 | C3 | Medium | n/a |
| Lap timer | MLB evo (A7 C8) | 17 | Byte 1 bit 3 "Lap Timer active" | 1 | C5 (search text only) | Low to Medium | n/a |
| Oil temperature in cluster | MQB | 17 | C3: "Byte 10 Bit 01 Activate" (bit 0 or bit 1 is ambiguous) | 1 | C3 | Low | Not found for C7 |
| Seat belt warning | MQB, MLB C7, B8 | 17, 3-bit field | Byte 0 bits 2-4; MQB also adaptation "Disable channel belt warning" = Yes (C3) | Field value for "off" **not public** | C3, `coding-sources.md` A1 | Location Medium; value **Unconfirmed** | No (safety warning, value unknown) |
| Mirror dip in reverse | MQB | 52 coding byte 4 bits 2 and 3, plus 09 adaptation "Access Control 2-Spiegelabsenkung bei Rueckwaertsfahrt" = Active, login 31347 | | | C3 | Low (one source; adaptation DID unknown) | No: factory feature on C7 (`coding-sources.md` A4) |
| Comfort windows by remote | MQB | 09 adaptation, Security Access 16 code 20103; channels "IDE08542-ENG116652 ... Funk Komfort oeffnen" and "IDE08542-ENG116651 ... Funk Komfort schliessen" = active (MK7.5: prefix ENG141681) | | active | C1 (Ross-Tech staff post; one user confirmed on a 2018 Alltrack) | Method Medium; DIDs **Unconfirmed** | No (C7 46 byte unknown, 46 is KWP) |
| Coming home time | MQB | 09 adaptation "Comfort illumination-Menueeinstellung Cominghome", login 31347 | 15 s default, 60 s max (C3) | | C3 | Low (DID unknown) | C7 09 byte 6 bit 4 is Low and 09 is KWP |
| DRL off with indicator | MLB C7 | 09 coding byte 3 bit 7 | 1 | | `coding-sources.md` A2 | Medium | No (09 is KWP) |
| DRL off with indicator | MQB | Named only ("DRL: wink with turn lights") | | | C6 | **Unconfirmed** | n/a |
| Emergency brake flashing | MLB C7 | 46 coding byte 8 bits 0 and 1 | both 1 | | `coding-sources.md` A3 | Medium | No (46 is KWP) |
| Emergency brake flashing | MQB | Named only | | | C6 | **Unconfirmed** | n/a |
| Tear wipe (front or rear) | MQB, MLB | Named only ("Teardrop mode") | | | C6 | **Unconfirmed** | No |
| Start-stop off by default | MLB C7 | 09 adaptation channel 34 (`coding-sources.md` A2) | | | G1 doc in `coding-sources.md` | Medium (DID unknown) | No |
| Start-stop off | MQB | 19 adaptation "Start Stop Limit voltage" = 12 (C3) | | | C3 | Low; changes battery management, do not offer | n/a |
| Single gear display | MLB C7 | 02 adaptation (`coding-sources.md` A5) | | | | Medium (DID unknown) | No |

Implementable today on the A6 C7: **needle sweep and lap timer only** (both on 17, UDS, write sequence in `coding-sources.md` A6). On MQB the same two cluster bits plus mirror dip (52 coding bits) are coding-only; everything else Carista offers on MQB 09 is an adaptation channel whose UDS DID is not public.

---

## 4. Service reset over OBD (MQB and MLB clusters)

| Item | Detail | Sources | Confidence |
|---|---|---|---|
| Method, MLB C7 and MQB | 17 adaptation "ESI: Resetting ESI" = Reset; then "FIX: Distance covered since last mileage-dependent inspection" = 0 and "FIX: Time since last time-dependent inspection" = 0; cycle ignition | S1 (Golf VII), `coding-sources.md` A7 (A6 4G) | High (method and names) |
| UDS DIDs, claim 1 | IDE number in decimal = DID: IDE00342 → `0x0156` (`2E 01 56` + value), IDE03351 → `0x0D17`, IDE03352 → `0x0D18`; extended session `10 03` first | S2: Touareg 7P / Cayenne 958 cluster, "EXPERIMENTAL", "needs validation on a live Cayenne 958"; the written value bytes (`00`, `00 00 00 00`) are not sourced | Low |
| UDS DIDs, claim 2 (MQB) | "channel" 8754 = Reset; 8870, 8871 = 0 | S3; not stated as DIDs | Low |
| Disagreement | Both MQB VCDS adaptation maps (basilfx e-Golf clusters 5G1 920 795 B and 5GE 920 755 C) name the reset "IDE00342-ESI: Resetting ESI", while S3 uses 8754. If S2's rule held, MQB would use 0x0156, not 0x2232. No capture settles it | basilfx `adpmap-17-*.csv` (https://github.com/basilfx/project-egolf/tree/main/assets/posts/2025-05-16/vcds), S2, S3 | Unresolved |
| Ross-Tech | "Channel numbers are history under UDS adaptation"; IDE names are factory data-object identifiers (Ross-Tech VCDS tour and beta notes) | https://www.ross-tech.com/vcds/tour/adaptation_screen.php | High that there is no public channel number scheme |

**Not public:** a verified UDS DID and value for the oil or inspection reset on any MLB or MQB cluster. Safe next step (reads only): in `10 03` on 714, read `22 01 56`, `22 0D 17`, `22 0D 18` and compare with the cluster's service display; a matching distance or day count would support S2's rule. Do not write until a capture of VCDS, OBDeleven or Carista doing the reset on the owner's car shows the exact `2E` request.

---

## 5. Adaptations and basic settings (DPF, EPB, battery)

No public source gives the UDS routine IDs (`31 01 xxxx`) or adaptation DIDs for these on MLB or MQB. Several GitHub "service routine catalogues" list values such as "31 01 F0 00 = start EPB service mode" without any capture or source; they are not used here.

| Function | Module | Tool-level method (verbatim names) | Preconditions and safety | Sources | UDS bytes |
|---|---|---|---|---|---|
| DPF service regeneration (standstill), CR-TDI on UDS | 01 | Basic Settings "Service regeneration of particle filter"; if missing, adaptation "Service regeneration of particulate filter while driving" ("A Security Access code may be required") | Engine idling, fuel at least 1/4, P or N, coolant above 70 °C, consumers on, bonnet closed; operator steps on screen. B1 (CAN section): the car "may burn down when regenerating" if the filter load is above specification. A 2026 VW bulletin: above 130 % soot load regeneration is disabled (https://static.nhtsa.gov/odi/tsbs/2026/MC-11028120-0001.pdf) | B1 | **Not public** |
| EPB pad change (A6 4G/4H) | 53 | Basic Settings "Start lining change mode" / "End lining change mode" | Battery charger connected; cycle the brake on/off first; "Do not perform any of these Basic Settings while the brakes are disassembled!"; fault 721152 expected; module 4H0 907 801 E | B3 | **Not public** |
| Battery registration (UDS gateway, part 4G0 907 468 E = A6 C7 family) | 19 | Adaptation "IDE03256-MAS04490 Battery adaptation - Size", "IDE03256-MAS03159 ... Manufacturer", "IDE03256-IDE00010 ... Serial number", "IDE03256-MAS06106 ... Battery technology" (values Fleece/EFB/Wet) | "MLB based CAN Gateway modules often reject ZET, EMC and JCB vendor codes" | B2 | **Not public** (by S2's unproven rule IDE03256 would be `0x0CB8`; Low) |

Recommendation: offer these as guided instructions only (as `src/service/procedures.ts` does for service reset). A wrong DPF regeneration or EPB command has fire and brake risks; nothing here meets the High bar for a write.

---

## 6. Maker live data (beyond `src/obd/extras.ts`)

All reads with `22`. "Capture" = a real reply with an expected value in the source. Engine IDs 7E0/7E8.

| Value | Module | DID | Formula | Session | Evidence | Confidence |
|---|---|---|---|---|---|---|
| Soot mass measured | Engine | `114E` | (A×256+B)/100 g | `10 03` in L4 | L4 2015 Q5 capture (`62 11 4E 01 B8` = 4.4), L1 (shown 2 dp), T6 forum (`uds-sources.md`) | **High** for EDC17 on MLB (already in extras.ts; add session 03 fallback) |
| Soot mass calculated | Engine | `114F` | (A×256+B)/100 g | | L1, T6 forum | Medium |
| DPF outlet temperature | Engine | `10F9` | (A×256+B)/10 − 273.1 °C | | L1 (`(raw − 2731)/10`), L4 signalset | Medium |
| Exhaust temperature before turbo | Engine | `10FB` | same | | L1 ("Turbo_temp"), L4 signalset ("Exhaust gas temperature sensor 1") | Medium |
| DPF inlet temperature | Engine | `11B2` | same | | L1 | Low |
| DPF differential pressure | Engine | `14F5` | raw u16, unit not documented | | L1 | Low |
| Distance since last regeneration | Engine | `1156` | 24-bit (data bytes 2 to 4 of the reply) / 1000; unit not stated (km if raw is metres) | | L1 | Low |
| Time since last regeneration | Engine | `115E` | 24-bit / 60; unit not stated (minutes if raw is seconds) | | L1 | Low |
| Oil ash | Engine | `1153` | (A×256+B)/100 g | | L1. **Disagrees** with T6 forum `178C` / `406C` | Low |
| Engine oil temperature | Engine | `11BE` | (A×256+B)/10 − 273.1 °C | | L1 | Low |
| Battery voltage | Engine | `105E` | L4 signalset: /50 V. L1: raw × 2, unit not stated | | **Sources disagree** | Low |
| Odometer (engine) | Engine | `10E0` | 32-bit km | | L3 2014 A4 B8 capture (`62 10 E0 00 02 49 57` = 149847) | Medium (MLB) |
| Odometer (engine) | Engine | `295A` | 24-bit km | | L3 2018 A4 B9 capture (3 data bytes) | Medium (MLB evo); already in extras.ts |
| Oil level | Engine | `11BA` | (A×256+B)/250, unit unclear | | L3 2012 A4 capture | Low (unit) |
| Oil level max / min marks | Engine | `11C4` / `11C5` | (A×256+B)/250 | | L2 2012 A6 captures | Low (unit) |
| Gearbox total drive time | Gearbox 7E1 | `0302` | (A×256+B)/4 h | | L2 2012 A6 capture (`62 03 02 24 A7` = 2345.75) | Medium (gearbox type not stated) |
| Drive time eco / sport / manual | Gearbox | `0303` / `0304` / `0305` | A/2.5 % | | L2 2012 A6 | Medium |
| Gear engaged | Gearbox | `210F` | 1 = R, 3 = 1st ... 10 = 8th | | L2 2012 A6 (8-gear map: likely ZF 8HP; the 2.0 TDI's gearbox may differ) | Low for the owner's car |
| Wheel speeds FL/FR/RL/RR | ABS 713 | `2B1B` to `2B1E` | (A×256+B)/10 km/h | | L3 2020 A4 capture on 713 | Medium (MLB evo) |
| Tyre pressures | TPMS 70B | `18A0` to `18A3` | byte 5 (bit index 40)/40 bar | | L2/L3 signalsets, no capture; TPMS ID disagrees on MLB (`uds-sources.md`) | Low |
| Range, fuel remaining | Cluster 714 | `2294`, `229A` | km; /8 L | | L2 signalset, no capture | Low |
| Interior temperature | 714 | `2613` | /10 °C | | L2 2012 capture: the reply came from **7B0** (HVAC) and decoded to the 255 cap | Low; read it from 746/7B0 |
| DPF surface temperature (MQB) | Engine | `1044` | /10 − 273.1 °C | `10 03` | L5 captures (2016 reply `7F FF`, likely "not available") | Low |
| 12 V battery data (start-stop) | Gateway 710 | `2A00`, `2A06`, `2A07`, `2A09`, `2A0B`, `2A0C`, `2A0E`, `2A10` | per L4 signalset | | L4 signalset only | Low |

Service distance and days on MLB/MQB clusters: still not public (e-Up `2260`/`2261` only, `uds-sources.md`).

---

## 7. Summary by platform

### MLB (A6 C7, owner's car)

Implementable now (High/Medium):

1. Module discovery reads: `22 2A2A`, `22 2A29`, `22 2A2C` on 710 (High for layout); `22 04A3`, `22 2A26`, `22 2A28` (Medium). Use `2A29` bit 0/bit 1 to split UDS from TP2.0 modules.
2. Coding writes on 17 only: needle sweep (byte 1 bit 0), lap timer (byte 1 bit 3), sequence in `coding-sources.md` A6.
3. Live data: `114E` soot (try `10 03` if refused), `114F`, `10F9`, `10FB`, `10E0`, gearbox `0302` to `0305`.

Not implementable (Unconfirmed or Low): any 09/46/42/52 write (KWP on TP2.0, write sequence not public); TP2.0 logical addresses for those modules (try `22 04A1` and the `2A29` slots); service reset DIDs; DPF, EPB and battery routines.

### MQB

Implementable: discovery with `22 2A26` / `22 04A3` (High, decode rule in 1.2); 17 needle sweep (High) and lap timer (Medium); `114E` soot. Not implementable: 09 adaptation items (comfort windows, coming home, DRL) and service reset, because no public IDE-to-DID mapping is verified.

### MLB evo

Needle sweep and lap timer at 17 byte 1 bits 0 and 3 (Medium, search text only); `295A` odometer and 713 wheel speeds (Medium). Discovery: Unconfirmed.

### Open items, cheapest first

1. Read `2A2A`, `2A29`, `2A2C`, `04A3`, `2A26`, `2A28`, `04A1` on the owner's gateway and check the bitmaps against the modules that answer.
2. Capture Carista (PacketLogger) doing: a 09 coding change, an oil service reset, and its module scan. This answers sections 2, 4 and 1.1 together.
3. Read `22 0156`, `22 0D17`, `22 0D18` on 714 in `10 03` to test S2's IDE rule (reads only).
