# Caristini: KWP2000 writes on VW TP2.0 modules (long coding, adaptation, read-back)

Research note, 11 Nov 2026. Follows `tp20-sources.md`, `leon-sources.md` (sections 3 and 5) and `vcds-sources.md` (section 3). Those notes left three gaps: no public capture of a long-coding write to a TP2.0 module, a disagreement on the KWP adaptation routines (kw1281test vs vag-tool), and no settled way to read long coding. This note adds new public evidence only; settled points are referenced, not repeated.

Targets: 2007 SEAT Leon Cupra 1P1 (PQ35; 09 J519, 46 J393, 17 cluster, 08 climate) and 2012 Audi A6 C7 (MLB) modules 09, 46, 42, 52.

Confidence key (as set for this task):

- **High**: working code tested on a car, or a real capture.
- **Medium**: documentation, or two independent code sources that agree without a capture.
- **Low**: forum claim, single untested code source, or a decompile.
- **Unconfirmed**: no public source found.

"Old-style module" below means a module that answers `1A 9B` with `5A 9B`. "DID-style module" means a TP2.0 module that refuses `1A 9B` with `7F 1A 11` and serves identification and coding as `22 xxxx` data identifiers.

---

## Answer in brief

| Question | Answer | Confidence |
|---|---|---|
| Is there now a public capture of a long-coding write to a TP2.0 body module? | **Yes, for a DID-style BCM.** A VW Polo 6R (PQ25) J519, part 6R0937087K, TP2.0 unit 0x20, through a Carista ELM327 v1.5: `2E F1 98 <WSC 6>` → `6E F1 98`, then `2E 06 00 <30 bytes>` → `6E 06 00`, then `22 06 00` read back the new value. Repeated on several days (W1). | High for that BCM class |
| Session and login for that write | No `10 89` and no `27` were sent before the write; the channel was opened and the writes followed. `2E F1 99 <YYMMDD>` was refused with `7F 2E 31` and the write still succeeded. | High for that BCM |
| Long-coding write on an old-style module (`3B 9A`) | Carista's own binary builds `<prefix> <workshop code: exactly 6> <component ID: exactly 4> <type> <N+1> <coding N> FF` for long coding. The read side (`1A 9A`) has the same shape in two codebases and a simulator. No capture of the write. | Low |
| Type byte for long coding | `10` on the read side (1A 9B offset 17 and 1A 9A), in 4 sources. The Polo project's guessed table maps long to `03`; it contradicts every read-side source. | Medium (`10`) |
| Reading long coding | Old-style: `1A 9A` → `5A 9A <WSC 6> <SW 4> 10 <N+1> <coding N> FF`. DID-style: `22 06 01` (length) and `22 06 00`. | Medium (old-style); High (DID-style on PQ25 BCM) |
| Long vs short coding | `1A 9B` byte at offset 17 (count `9B` as offset 0): `03` short (3 bytes at 18 to 20), `10` long (field 18 to 20 is `00 00 00`), `00` no coding. A `7F 1A 11` reply means a DID-style module. | High for `03`; Medium for `10` |
| Adaptation routine bytes | Carista's binary and kw1281test now agree: `31 B8 01 03` enter, `31 B9 01 03 <ch:1>` select, `31 B9 01 03 <val:2>` test, `31 BA 01 03` read, `31 BB 01 03 <val:2> <WSC:6>` save, `32 B8 01 03` exit. vag-tool's reading is outvoted. | Medium (no TP2.0 capture) |
| TP2.0 logical addresses for 09/46/42/52 | One table (ESP32 converter) gives 09 → 0x20, 46 → 0x21, 42 → 0x22, 52 → 0x23, 17 → 0x07, 08 → 0x2C. 09 → 0x20 is confirmed on two cars (Polo 6R capture, e-Up code); on the 2014 A7 (MLB) unit 0x20 answered `22 F1 87` with a frame holding ASCII "0907063" (the 09 BCM part family 4H0 907 063). | High for 09 → 0x20 (PQ25/NSF); Medium on MLB; Medium for 46/42/52 |

---

## Sources

New in this note (W) and reused from earlier notes (keys as there).

| Key | Source | URL | What it is |
|---|---|---|---|
| W1 | victorwitkamp/PoloCornering, live logs from a VW Polo 6R (PQ25) J519 6R0937087K "BCM PQ25 H+4", SW 0254, TP2.0 unit 0x20, "Carista ELM327 on COM10 at 38400 baud", 1 to 8 May 2026. No licence stated; last push 14 May 2026 | https://github.com/victorwitkamp/PoloCornering/blob/HEAD/docs/OBD_DIAGNOSTICS/session_artifacts/pq25_cornering_diag_test_20260501_144642_write_carista_uds_coding.txt , https://github.com/victorwitkamp/PoloCornering/blob/HEAD/docs/OBD_DIAGNOSTICS/session_artifacts/rewrite_backup_byte13_bit6_off_20260503_write_carista_uds_coding.txt , https://github.com/victorwitkamp/PoloCornering/blob/HEAD/docs/OBD_DIAGNOSTICS/session_artifacts/bcm_all_safe_reads_20260508_083940.json , https://github.com/victorwitkamp/PoloCornering/blob/HEAD/docs/OBD_DIAGNOSTICS/session_artifacts/carista_1a_after_1089_setup_20260508_084538.json , https://github.com/victorwitkamp/PoloCornering/blob/HEAD/docs/OBD_DIAGNOSTICS/pq25_live_history.md | **Real capture**: every ELM command, every CAN frame, the write and the read-back |
| W2 | PoloCornering Ghidra exports of `libCarista.so` (the Carista Android app's native library): `WriteVagCodingCommand` constructor and `getRequest`, `WriteVagCanAdaptationDataCommand`, `WriteVagCanTemporaryAdaptationDataCommand`, `SetVagCanAdaptationChannelCommand`, `Read*AdaptationDataCommand::processPayload`, string literals | https://github.com/victorwitkamp/PoloCornering/blob/HEAD/carista_apk_analysis/ghidra_exports/WriteVagCodingCommand_getRequest_00D132BC.c , https://github.com/victorwitkamp/PoloCornering/blob/HEAD/carista_apk_analysis/ghidra_exports/WriteVagCodingCommand_ctor_00D13048.c , https://github.com/victorwitkamp/PoloCornering/tree/HEAD/carista_apk_analysis/ghidra_adaptation_probe | Decompiled commercial code. Used here only for request layouts; no Carista setting tables copied |
| W3 | PoloCornering Python reproduction of W2: `GetVagCanEcuInfoCommand.py`, `WriteVagCodingCommand.py`, `Constants.py`, `VagCanAdaptationCommands.py`, `VagOperationDelegate.py`, `carista_recovery_summary.md` | https://github.com/victorwitkamp/PoloCornering/tree/HEAD/CaristaReproduction , https://github.com/victorwitkamp/PoloCornering/blob/HEAD/docs/CARISTA_REVERSE/carista_recovery_summary.md | The author's reading of W2. The `3B 9A` path was never run on the car |
| W4 | domnulvlad/KWP1281-VWTP2.0_converter_ESP32 (GPL-3.0), `responses.h`, `vwtp.h`, `.ino`; makes a K-line module answer VCDS-style tools over TP2.0; "tested on an ESP32-C6"; last push 24 Feb 2025 | https://github.com/domnulvlad/KWP1281-VWTP2.0_converter_ESP32 | Module-side `5A 9B` layout, `31 B8 00 00` function list, VCDS address to TP2.0 address table. Coding, adaptation and login "not implemented" |
| W5 | OVMS v3 `xvu-ecu.js` (e-Up/Mii/Citigo), `putWorkShopCode`, `putCodingParts` | https://github.com/openvehicles/Open-Vehicle-Monitoring-System-3/blob/master/plugin/v-vweup/ecutoolkit/xvu-ecu.js | Coding write over TP2.0 to 09/08/61 (same file as `vcds-sources.md` D10; the write order is new here) |
| W6 | bbear3d/ovtsuite (MPL-2.0), `ovtsuite/diag/kwp2000.py` docstring and `data/help/diag/writing.md`, Blair Campbell 2026 | https://github.com/bbear3d/ovtsuite/blob/HEAD/ovtsuite/diag/kwp2000.py , https://github.com/bbear3d/ovtsuite/blob/HEAD/ovtsuite/data/help/diag/writing.md | States the kw1281test KWP forms come from "Bear's K-line captures of a workshop tool against an EDC16 (038997016T)". Same author as kw1281test's KWP2000 code, so not independent of it. Writing: "Not yet tested on a car." |
| W7 | Boromatic/SpeckMobil (GPL-3.0), `kwp2000.cpp` `longIdHandler`, `longCodingHandler`, ELM327 TP2.0 tool for PQ cars, 2014 | https://github.com/Boromatic/SpeckMobil/blob/master/kwp2000.cpp | `1A 9A` parser (same repo as `vag-sources.md` K2; exact offsets are new here) |
| W8 | michaeldove/vag-diag-sim (MIT), `vagvehicle.py`, canned `5A 9A` and `5A 9B` for "8P0907115AQ" (A3 8P 2.0 TFSI engine) | https://github.com/michaeldove/vag-diag-sim/blob/master/vagvehicle.py | Origin of the bytes not stated (same as `leon-sources.md` P8) |
| W9 | nefariousmotorsports, "KWP2000/TP2.0 module coding", topic 14547, Jul 2018 to Jan 2023 (read with curl and a browser user agent; WebFetch got HTTP 403) | http://nefariousmotorsports.com/forum/index.php?topic=14547.0 | Forum claim on `1A 9B` byte 17 |
| W10 | NefMoto `Communication/KWP2000Constants.cs` | https://github.com/NefMoto/NefMotoOpenSource/blob/master/Communication/KWP2000Constants.cs | ISO 14230-3 name of identifier 0x9A |
| W11 | OBDCracker issue #316, session 11, 2014 Audi A7 (C7, MLB), STN2232, 10 Nov 2026 | https://github.com/DaSonOfPoseidon/OBDCracker/issues/316 | TP2.0 unit 0x20 frame with "0907063"; `10 89` refused with NRC 22 |
| W12 | rNx1337k/RootsAutoDoctor, `rad/vagcan/kwp.py`, `rad/protocols/kwp2000.py`, Oct to Nov 2026 | https://github.com/rNx1337k/RootsAutoDoctor | Ports kw1281test's K-line forms to TP2.0 and says so ("documentadas a partir de capturas reais de uma EDC16 pelo projecto kw1281test"). **Not independent**; counted once with K1 |
| K1 | gmenounos/kw1281test (MIT), `Tester.Kwp2000Diag.cs` (EDC16, K-line) | https://github.com/gmenounos/kw1281test/blob/master/Tester.Kwp2000Diag.cs | As in `leon-sources.md` P2 and `vag-sources.md` K1 |
| K3 | TBK/vag-tool README, "Not yet tested against the car" | https://github.com/TBK/vag-tool | As in `leon-sources.md` P7 |

Searched with no usable result: GitHub code for `3B 9A`/`3B9A`/`0x3B, 0x9A`/`5A 9A`/`7B 9A`/`1A9A` in log, text and CSV files (no TP2.0 CAN dump with a `3B 9A` write found); "LangeCodierung", "lange Codierung", "long coding kwp2000"; drive2.ru and 4PDA (4PDA returned an empty page to curl); Ross-Tech forum (VCDS prints no frame bytes). A search snippet says Car Scanner has experimental long coding over VW TP2.0; the page was not readable, so it is not used.

---

## Findings

Offsets in `1A 9B` replies count the `9B` echo as offset 0, as in `leon-sources.md` 3.1.

| # | Fact | Bytes | Sources | Confidence |
|---|---|---|---|---|
| F1 | DID-style BCM accepts a full long-coding write over TP2.0 and stores it | `2E 06 00 <30 bytes>` → `6E 06 00`; `22 06 00` → `62 06 00 <same 30 bytes>` | W1 (three write logs, 1 to 3 May 2026; a later 8 May read still matched) | High (PQ25 BCM 6R0937087K) |
| F2 | Pre-writes before `2E 06 00`. Carista order: date, read WSC, WSC, coding. Date refused on this BCM, non-fatal | `2E F1 99 26 05 01` → `7F 2E 31`; `22 F1 A5` → `62 F1 A5 00 05 F3 C7 E7 19`; `2E F1 98 00 05 F3 C7 E7 19` → `6E F1 98` | W1 capture; W3 ("`7F2E31` is nonfatal under Carista's `isFatalFail` gate"); W5 sends `2ef199<YYMMDD>` then `2ef198<wsc>` and "we ignore all errors as either or both writes are optional (fail) on some ECUs" | High |
| F3 | No session request and no security access before those writes | Channel open, `A0`, then `2E F1 99`; no `10 89`, no `27` | W1 | High for that BCM; Unconfirmed for J519 PQ35, J393, C7 |
| F4 | The same BCM accepts `10 89` | `10 89` → `50 89` | W1 (`carista_1a_after_1089_setup`) | High |
| F5 | DID-style BCM refuses the KWP identification records | `1A 9B`, `1A 9A`, `1A 9F` → `7F 1A 11` | W1 (`bcm_all_safe_reads`) | High |
| F6 | DID-style coding length and identification | `22 06 01` → `62 06 01 1E` (30 bytes, matches `22 06 00`); `22 F1 87` → "6R0937087K "; `22 F1 89` → "0254"; `22 F1 97` → "BCM PQ25 H+4 " | W1 | High |
| F7 | The `F1 A5` record is not the KWP packed WSC: decoding `00 05 F3 C7 E7 19` with K1's bit split gives WSC 124697, more than 5 digits (arithmetic mine). Copy it unchanged into `F1 98` | | W1, K1 | Medium |
| F8 | Old-style long-coding read reply | `5A 9A <WSC 6> <SW 4> 10 <N+1> <coding N> FF`. Example: `5A 9A 01 DC 5A 10 00 BF 30 30 31 30 10 09 01 03 00 0C 18 0F 01 60 FF` (8 coding bytes, length byte 09) | W8 bytes; W7 parser (after removing `5A 9A`: byte 10 must be `10`, byte 11 = len, coding = bytes 12 to len+10, i.e. len-1 bytes); W3 lists `ReadVagCanLongCodingCommand` = `1A 9A` | Medium (two code sources plus simulator data; no car capture) |
| F9 | In `1A 9B` of a long-coded module the short-coding field is zero and the WSC still sits at 21 to 26 | W8: `... 30 30 31 30 10 00 00 00 01 DC 5A 10 00 BF "2.0l R4/4V TFSI" ...`; the same 6 WSC bytes open the `5A 9A` reply | W8 | Low (one simulator, origin not stated) |
| F10 | Long vs short marker at offset 17 of `1A 9B` | `03` short, `10` long, `00` none (W4 comment: "00 - no coding, 03 - short coding, 10 - long coding"); W7: `03` → short, `10` → send `1A 9A`; W3: `03` → short, `10` → long, `21` to `2F` → a third type with a 3-byte tail; K1 real EDC16: `03`; W9 (aef, 26 Aug 2020): "Byte 17 contains the number of coding table and the lenght of coding information" | W3, W4, W7, W8, K1, W9 | High for `03`; Medium for `10`; Low for `21` to `2F` |
| F11 | Carista's coding write builder (old-style modules) | `getRequest` = literal at 0x8d8d6e + workshop code + component ID, then: if type is SHORT (2): `<type byte> <value 3>`; else `<type byte> <len(value)+1> <value> FF`. Constructor throws unless "Workshop code must be exactly 6 bytes", "Component ID must be exactly 4 bytes", "Short coding value must be exactly 3 bytes". The type byte comes from a 6-entry table at 0x00c8dc75 (default `03`) whose contents the export does not show. W3 reads the literal as `3B9A` | W2 decompile, W3 | Low (decompile, not run) |
| F12 | Type byte table: sources disagree | W3 `CODING_TYPE_LOOKUP` = {0: `00`, 1: `10`, 2: `10`, 3: `03`, 4: `10`, 5: `10`}, which writes short coding with `10` and long with `03`. K1 (real EDC16) writes short with `03`; F8 and F10 put `10` with long. W3 never sent `3B 9A` to the car | W2, W3 vs K1, W4, W7, W8 | Use `10` for long, `03` for short (Medium); W3 table Low |
| F13 | The 4 "component ID" bytes in the write are the 4 bytes at `1A 9B` offsets 13 to 16 (K1 calls them the software version) | W3 `raw_address4 = payload[0x0C:0x10]` (after `5A 9B`) = offsets 13 to 16; K1 echoes the same 4 bytes | W2, W3, K1 | Medium |
| F14 | K3 (vag-tool) reads the first 6 bytes of the `3B 9A` record as "4 bytes" + 2-byte WSC. W2 (6-byte workshop code) and K1 (6-byte packed WSC) disagree with it | | W2, K1 vs K3 | K3 Low |
| F15 | Positive answer to `3B 9A` | `7B 9A` by the KWP rule (SID + 0x40). No capture shows it | | Unconfirmed |
| F16 | Adaptation request builders in Carista (VAG CAN = TP2.0 modules) | String literals `31B8`, `31B9`, `31BA`, `31BB`, `32B8`. Start `31 B8 <id:2>`; read `31 BA <id:2>`; select `31 B9 <id:2> <channel:1>`; temporary (test) write `31 B9 <id:2> <value>`; save `31 BB <id:2> <value> <workshop code>` with "Workshop code must be exactly 6 bytes, but was"; stop `32 B8 <id:2>`. `<id>` = `01 03` short adaptation, `01 0A` long adaptation | W2 decompile; W3 | Low alone; see F17 |
| F17 | kw1281test (from captures of a workshop tool on an EDC16, K-line) uses the same routines and sub-selector | `31 B8 00 00` (enumerate), `31 B8 01 03`, `31 B9 01 03 <chan>` ("Omitting it ... gives NRC 0x12 invalidFormat"), `31 B9 01 03 <val:2>`, `31 BA 01 03`, `31 BB 01 03 <val:2> <wsc:6>`, `32 B8 01 03` | K1, W6 | With F16: **Medium** for TP2.0 (two independent sources agree; no TP2.0 capture) |
| F18 | Carista reads before and after the channel select | `31 B8 01 03`; `31 BA 01 03` (parser expects `81`); `31 B9 01 03 <ch>`; `31 BA 01 03` (parser accepts first byte `82` or `05`, takes bytes 2 to 3 as the value); `32 B8 01 03`. K1 does not send the first `31 BA`. Whether Carista's parser sees the bytes after `71 BA 01 03` is not shown in the export | W2, W3 | Low |
| F19 | Adaptation read reply layout | `71 BA 01 03 <status> 03 <val hi> <val lo> [<cellType> a b c ...]`; cellType `04` = a measured value follows | K1 ("BA[0] 01[1] 03[2] status[3] 03[4] val_hi[5] val_lo[6] cellType[7] a[8] b[9] c[10]"); consistent with F18 offsets | Medium (EDC16 K-line) |
| F20 | Channel number is one byte; short adaptation value is two bytes big endian | | W2 (`SetVagCanAdaptationChannelCommand` appends one byte), K1 | Medium |
| F21 | Long adaptation (`01 0A`) reply: first byte L, value = L-1 bytes from offset 3 | | W2 `ReadVagCanLongAdaptationDataCommand::processPayload` | Low |
| F22 | Security access gates adaptation on some modules | K1: "This EDC16 denies the adaptation channel-select (31 B9 01 03 <chan>) with securityAccessDenied unless 0x27 security access is unlocked first". `27 03` → seed, `27 04 <seed + code>` (`leon-sources.md` 5.1). W5 sends `27 03` only when a code is supplied | K1, W5 | Medium (that a module may need it); which PQ35/C7 channels need it: Unconfirmed |
| F23 | `31 B8 00 00` answers with the module's supported-function list (2-byte codes) | W4: `71 B8 01 06`, with the list "0101 basic settings in KWP1281 mode, 0102 output tests with fixed sequence, 0104 20-bit coding possible, 0105 Coding-II possible, 0106 reading measuring blocks in KWP1281 mode, 0107 output tests with selective sequence, 0108 developer functions, 010D immobilizer Gen4, 0118 HEX-coded fault codes". W8 answer: `71 B8 01 01 01 03 01 02 01 06 01 07 01 08 01 0D 01 18`. K1 calls this step "enumerate channels" | W4, W8, K1 | Low (meaning of `01 03` in the list not stated) |
| F24 | ISO 14230-3 names identifier 0x9A "calibrationRepairShopCodeOrCalibrationEquipmentSerialNumber", which fits a record that starts with the workshop code | | W10 | Medium |
| F25 | VCDS address → TP2.0 logical address (W4 table): 01→01, 02→02, 03→03, 08→2C, **09→20**, 15→05, **17→07**, 19→1F, **42→22**, 44→09, **46→21**, **52→23**, 56→52 | 09 → 0x20 matches W1 (Polo PQ25) and W5 (e-Up: 09 = 0x20, 08 = 0x2C, 19 = 0x1F); 17 → 0x07 matches the C6 gateway list (`vag-sources.md` G8); 44 → 0x09 matches `tp20-sources.md` T8 | W4, W1, W5 | High for 09, 08, 19, 44; Medium for 17; Medium for 42, 46, 52 (one source) |
| F26 | On the 2014 A7 (MLB), TP2.0 unit 0x20 answered the identification step with a frame `23 30 39 30 37 30 36 33` (ASCII "0907063", the 09 J519 family 4H0 907 063 seen in `tp20-sources.md` V1); the channel then broke. `10 89` on 0x20 was refused with NRC `22` | W11 (`[23 30 39 30 37 30 36 33] on 20`, "`10 89` on 20 was refused with `22` (conditions not correct)") | W11, W4 | Medium that A7 unit 0x20 is the 09 BCM (inference from a fragment plus F25); OBDCracker had labelled it "20" |
| F27 | ELM327 clone mechanics proven in W1 (same adapter brand as the owner's, serial link): `ATSP6 ATCAF0 ATV1`, `ATSH200`, `ATST0A`, `20 C0 00 10 00 03 01` → `220: 00 D0 00 03 38 03 01` (send 0x338, listen 0x300); `A0 0F 8A FF 32 FF` → `A1 0F 8A FF 4F FF`. Multi-frame request: each `2n` frame sent with `ATST04` (reply NO DATA), last `1n` frame with `ATST20`; module ACKs `B<n+1>`; 130 ms between frames. On some re-opens `A0` got no answer and the writes still worked | Write frames: `25 00 21 2E 06 00 3A B8`, `26 2B 9F 08 A1 00 00 00`, `27 30 08 00 6C 68 0E D0`, `28 00 C8 41 0F 60 86 00`, `19 00 20 00 00 00 00 00` → `300: BA`, `300: 14 00 03 6E 06 00` | W1 | High for that adapter on a serial link; BLE timing Unconfirmed |
| F28 | Login form of the `9A` record | `3B 9A <WSC 6> <SW 4> 03 <0x800000 | code>` | K1, W6 (same author) | Low (unchanged) |

---

## What the app should send

All sequences assume an open TP2.0 channel (`<addr> C0 00 10 00 03 01`, then `A0 0F 8A FF 32 FF`) with sequence numbers and ACKs as in `tp20-sources.md` 2.3 and F27. Back up every read reply before any write. Close with `A8`.

Step 0 for every module: send `1A 9B`.

- `7F 1A 11` → DID-style module: use sequences A1, C1.
- `5A 9B` with offset 17 = `10` → old-style long coding: use sequences A2, C2.
- `5A 9B` with offset 17 = `03` → old-style short coding: use sequence A3, C3.
- Anything else: show raw bytes, offer no write.

### (a) Long coding write

**A1. DID-style module (PQ25-class BCM; likely the newer PQ35 5K0 937 087 and the C7 4H0 modules, unproven).** Confidence: **High** on a PQ25 BCM (F1 to F6), **Low** on the Leon's J519/J393 and the C7 modules until each answers `22 06 00`.

1. `22 06 01` → `62 06 01 <N>` (if refused, take N from step 2).
2. `22 06 00` → `62 06 00 <N bytes>`. Stop if the length is not N.
3. `22 F1 A5` → `62 F1 A5 <6 bytes>`.
4. `2E F1 99 <YY MM DD>` → `6E F1 99`, or `7F 2E 31`: continue either way (F2).
5. `2E F1 98 <the 6 bytes from step 3>` → `6E F1 98`. W5 continues on any error; W3 aborts only on a "fatal" result. Recommended: stop on `7F 2E 33` or `7F 2E 22` and go to step 5a; continue on `7F 2E 31`.
   - 5a (Unconfirmed on these modules): `10 89` → `50 89`; `27 03` → `67 03 <seed 4>`; `27 04 <seed + code, 4 bytes>` → `67 04`; repeat step 5. W1 needed neither.
6. `2E 06 00 <N bytes, only the intended bits changed>` → `6E 06 00`.
7. Read back with C1.

**A2. Old-style long-coded module (`1A 9B` offset 17 = `10`).** Confidence: **Low** (no capture of the write; layout from a decompile plus read-side agreement).

1. `10 89` → `50 89`.
2. From `5A 9B`: keep SW = offsets 13 to 16 (4 bytes), WSC = offsets 21 to 26 (6 bytes).
3. `1A 9A` → `5A 9A <WSC 6> <SW 4> 10 <N+1> <coding N> FF`. Check the WSC and SW match step 2 and the reply ends in `FF`.
4. `3B 9A <WSC 6> <SW 4> 10 <N+1> <new coding N> FF` → expect `7B 9A` (Unconfirmed).
5. Wait 3 s (K1 waits that long after a `3B 9A` on EDC16), then C2.

If step 4 returns `7F 3B 33`, a login or security access may be needed (F22, F28): Unconfirmed which.

**A3. Old-style short coding (cluster, offset 17 = `03`).** Confidence: **Low** on TP2.0 (Medium on EDC16 K-line).

1. `10 89` → `50 89`.
2. `3B 9A <WSC 6> <SW 4> 03 <coding 3>` → `7B 9A` (Unconfirmed response bytes).
3. Wait 3 s, then C3.

### (b) Adaptation read, test, save (old-style modules)

Confidence: **Medium** for the bytes (F16, F17 agree); **Low** for the exact order on a PQ35 body module; **Unconfirmed** for DID-style modules (their adaptation is `22`/`2E` on DIDs that are not public, `vcds-sources.md` section 2).

1. `10 89` → `50 89`.
2. Only if the module refuses step 5 with `7F 31 33`: `27 03` → `67 03 <seed 4>`, `27 04 <seed + code>` → `67 04`, then repeat from step 3.
3. `31 B8 01 03` → `71 B8 ...` (enter). Optional before it: `31 B8 00 00` (K1); the reply lists supported functions (F23).
4. Optional (Carista): `31 BA 01 03` → `71 BA 01 03 81 ...`.
5. `31 B9 01 03 <channel>` → `71 B9 ...` (select; one byte).
6. Read: `31 BA 01 03` → `71 BA 01 03 <status> 03 <val hi> <val lo> ...`.
7. Test: `31 B9 01 03 <val hi> <val lo>`, then `31 BA 01 03` to see the module use it.
8. Save: `31 BB 01 03 <val hi> <val lo> <WSC 6 from 1A 9B offsets 21 to 26>` → expect `71 BB ...` (Unconfirmed response bytes).
9. Read back: `31 BA 01 03`; compare the value.
10. Exit: `32 B8 01 03` → `72 B8 ...`. Send it on every exit path.

Long adaptation channels: same flow with `01 0A` in place of `01 03` (W2 only, Low).

### (c) Read-back verification

- **C1 (DID-style)**: `22 06 00` → compare all N bytes with what was written (W1 does exactly this). **High** on PQ25 BCM.
- **C2 (old-style long)**: `1A 9A` → compare the N coding bytes; check the length byte and `FF`. **Low** (F8 is Medium for the reply layout; no write capture).
- **C3 (short)**: `1A 9B` → offsets 18 to 20. **Medium** (K1 re-reads `1A 9B` after its write).
- **Adaptation**: `31 BA 01 03` inside the routine (step 9), then after `32 B8 01 03` re-enter and read once more. **Medium**.

In all three, a mismatch means: write the backup back with the same sequence and report the failure.

---

## Open items (do not code as fact)

1. Which class (DID-style or old-style) the Leon's 09 J519 (1K0 937 049 or 1K0/3C0 family), 46 J393 (1K0 959 433) and 17 cluster are: send `1A 9B` to each and log the raw reply.
2. Whether C7 09/46/42/52 accept `22 06 00` over TP2.0 at 0x20/0x21/0x22/0x23 (F25, F26). The A7 channel to 0x20 broke on reply framing (W11), so test with W1's ELM recipe (F27).
3. Positive response bytes of `3B 9A` and `31 BB`, and the contents of Carista's type-byte table (F11, F12).
4. Whether `10 89` or `27` is ever needed before `2E 06 00` on a body module (F3; A7 refused `10 89` on 0x20 with NRC 22, W11).
5. BLE round-trip on the owner's adapter against the 130 ms frame pacing that worked on a serial link (F27).
