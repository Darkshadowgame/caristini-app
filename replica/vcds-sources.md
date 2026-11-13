# Caristini: how VCDS, ODIS and open tools do login, coding, adaptation and basic settings

Research note, 11 Nov 2026. Scope: the protocol steps behind VCDS-level functions (security access, UDS adaptation, KWP2000 on TP2.0, basic settings, output tests) on VW group cars, so the app can copy them safely through an ELM327-type BLE adapter.

Companion to `vag-sources.md`, `coding-sources.md`, `leon-sources.md` (sections 5 and 6) and `tp20-sources.md`. Settled there and not repeated here: UDS long coding write sequence (`coding-sources.md` A6), KWP `27 03/04` key = seed + code at Medium and the `3B 9A` short-coding write at Low (`leon-sources.md` 5.1, 5.2), the KWP `31 B8/B9/BA/BB` adaptation family and the P2/P7 disagreement (`leon-sources.md` 5.4), TP2.0 framing (`tp20-sources.md`), gateway discovery (`vag-sources.md` 1).

Confidence key (same as the other notes):

- **High**: two or more independent public sources agree, or one primary source plus a real-car capture.
- **Medium**: one public source with real-car data, or two sources that agree only by my inference.
- **Low**: single community post, different platform or generation, untested code, or sources disagree.
- **Unconfirmed**: no public source found. Do not ship as fact.

"My inference" marks a step I made by combining sources; it is never a quote. Arithmetic examples marked "arithmetic" are mine.

---

## Answer in brief

1. **Login on UDS** is `27 03` / `27 04` with key = seed + login code (decimal), big-endian, wrapping at the seed's width. Three independent codebases agree, one of them built from ODIS MCD data and tested on MQB, with unit tests (High for MQB and e-Up; Medium for MLB, no MLB capture). `27 11/12` is the SA2 programming (flash) level: do not use it.
2. **UDS adaptation** is `2E <DID> <whole record>` in the extended session, after the same `F199`/`F198` writes as coding. The VCDS name (`IDEnnnnn`, `ENGnnnnnn`, `MASnnnnn`) is the ODX translation key of the record or of a parameter inside it, **not** the DID. The rule "IDE number in decimal = DID" is disproved by ODX extracts (IDE00003 = `0x0600`, IDE03875 = `0x02B9`). No public, verified DID exists for any of the channels the owner wants (service reset, comfort windows, coming home, mirror dip, belt warning, start-stop, DRL).
3. **KWP2000 on TP2.0**: long coding can be read with `22 0600` on some TP2.0 modules (Medium); writing it over KWP (`2E 0600` or `3B 9A`) has no public capture for a long-coded body module (Unconfirmed). KWP adaptation has public bytes only for a K-line EDC16 engine.
4. **Basic settings on UDS** are `31 01 <RID>`, polled with `22 0102` (Medium, ODIS-data tool). **Output tests** are `2F <DID> 03 ...` and stop `2F <DID> 00` (Medium). No routine ID or output-test DID for EPB, DPF or anything else is public.
5. Open tools that write: OVMS (e-Up), openpilot (MQB EPS coding), mcd-diag-rs (full adaptation, basic settings, output tests, but needs the user's own ODIS database), kw1281test (K-line KWP), vag-diag (SocketCAN, backup and restore of adaptation DIDs). None publishes a DID map for comfort features.
6. **Label-free discovery** works for reads: identify the dataset with `22 F19E` / `22 F1A2`, then sweep `22 0000` to `22 0FFF` in default and extended sessions (real A7 C7 capture). Finding which DID is which feature needs a diff after changing the setting in the car's own menu, or a capture of another tool.

---

## Sources

| Key | Source | URL | Notes |
|---|---|---|---|
| D1 | bri3d/mcd-diag-rs (BSD-3), `security.rs`, "Adaptation / Coding / Basic-Settings SecurityAccess login", with unit tests | https://github.com/bri3d/mcd-diag-rs/blob/HEAD/crates/mcd-diag-gui/src/security.rs | Built on ODIS MCD data; README: tested on "VW37/AU37 (8V / 5G MQB platform)" |
| D2 | mcd-diag-rs `tabs/records.rs`, `fingerprint.rs`, `transport.rs` | https://github.com/bri3d/mcd-diag-rs/blob/HEAD/crates/mcd-diag-gui/src/tabs/records.rs , https://github.com/bri3d/mcd-diag-rs/blob/HEAD/crates/mcd-diag-gui/src/fingerprint.rs , https://github.com/bri3d/mcd-diag-rs/blob/HEAD/crates/mcd-diag-gui/src/transport.rs | Adaptation and coding write path |
| D3 | mcd-diag-rs `tabs/basic_settings.rs`, `tabs/output_tests.rs` | https://github.com/bri3d/mcd-diag-rs/blob/HEAD/crates/mcd-diag-gui/src/tabs/basic_settings.rs , https://github.com/bri3d/mcd-diag-rs/blob/HEAD/crates/mcd-diag-gui/src/tabs/output_tests.rs | `31` and `2F` paths |
| D4 | mcd-diag-rs `crates/mcd-db/FORMATS.md` (format of an ODIS MCD dump) | https://github.com/bri3d/mcd-diag-rs/blob/HEAD/crates/mcd-db/FORMATS.md | Shows DID next to IDE name; `F19E`/`F1A2` variant match |
| D5 | bri3d/sa2_seed_key (MIT), README | https://github.com/bri3d/sa2_seed_key | SA2 bytecode, one example script and test vector |
| D6 | bri3d/VW_Flash `lib/flash_uds.py` | https://github.com/bri3d/VW_Flash/blob/master/lib/flash_uds.py | `unlock_security_access(17)` with SA2, flash routines |
| D7 | bri3d, "Secrets of Simos18", hardwear.io USA 2024 (search-result text only, PDF not read) | https://hardwear.io/usa-2024/presentation/secrets-of-simos18.pdf | SA2 "known from ODX", level 0x11 |
| D8 | kartoffelpflanze/ODIS-project-explorer (no licence stated) | https://github.com/kartoffelpflanze/ODIS-project-explorer | `dumpAdaptations.py`, `dumpCoding.py`, `dumpMWB.py`; "No projects/databases will ever be provided" |
| D9 | dspl1236/VAG-CP-Docs, `au57x-mwb-extraction-confirmed-dids.md` (AU57X = A6/A7 C7 ODIS project, DVR 72) | https://github.com/dspl1236/VAG-CP-Docs/blob/HEAD/technical/au57x-mwb-extraction-confirmed-dids.md | ODIS dump of C7 HVAC adaptations; component protection topic, used here only for the IDE-to-DID evidence |
| D10 | OVMS v3 `xvu-ecu.js` (e-Up / Mii / Citigo) | https://github.com/openvehicles/Open-Vehicle-Monitoring-System-3/blob/master/plugin/v-vweup/ecutoolkit/xvu-ecu.js | Same as `coding-sources.md` U1 |
| D11 | commaai/openpilot `tools/scripts/car/vw_mqb_config.py` | https://github.com/commaai/openpilot/blob/master/tools/scripts/car/vw_mqb_config.py | Same as `coding-sources.md` U3; adds the bonnet note |
| D12 | gmenounos/kw1281test (MIT) `Tester.Kwp2000Diag.cs` (KWP2000 on K-line, EDC16) | https://github.com/gmenounos/kw1281test/blob/master/Tester.Kwp2000Diag.cs | Adds output tests and basic settings to `leon-sources.md` P2 |
| D13 | kw1281test `BlockTitle.cs` (KW1281, K-line) | https://github.com/gmenounos/kw1281test/blob/master/BlockTitle.cs | KW1281 block titles |
| D14 | dflow81/vag-diag (MIT or Apache-2.0), README and `CREDITS.md` | https://github.com/dflow81/vag-diag , https://github.com/dflow81/vag-diag/blob/main/CREDITS.md | SocketCAN tool; adaptation DID ranges; "Am Golf 6 getestet ist nur das CAN-Interface" |
| D15 | OBDCracker issue #86, car session 4, 2014 Audi A7 3.0 TDI (C7, MLB), OBDLink EX | https://github.com/DaSonOfPoseidon/OBDCracker/issues/86 | Real DID sweep of the HUD, `0600` of 24 modules |
| D16 | OBDCracker issue #106, design doc for `2F` and `31` | https://github.com/DaSonOfPoseidon/OBDCracker/issues/106 | Routine allowlist idea; DPF out of scope |
| D17 | basilfx/project-egolf, VCDS adaptation maps of an e-Golf (MQB), May to Jul 2025 | https://github.com/basilfx/project-egolf/tree/master/assets/posts/2025-05-16/vcds | VCDS naming as printed from a real car; no DIDs |
| D18 | Ross-Tech VCDS tour, Adaptation screen | https://www.ross-tech.com/vcds/tour/adaptation_screen.php | UDS: "traditional Adaptation Channels do not apply" |
| D19 | Ross-Tech VCDS tour, Controller Channels Map | https://register.ross-tech.com/vcds/tour/controller-channels-map.php | UDS maps need a ROD file |
| D20 | Ross-Tech VCDS tour, Login screen | https://www.ross-tech.com/vcds/tour/login_screen.php | Login lost when the session drops |
| D21 | Ross-Tech wiki, SFD (oldid 9828) | https://wiki.ross-tech.com/wiki/index.php/SFD | SFD from MY 2020/2021 |
| D22 | Ross-Tech forum, "No long coding option" (search-result text only) | https://forums.ross-tech.com/index.php?threads/17334/ | Mk 7.5 BCMs: settings moved to adaptation |
| D23 | dspl1236/PCM-Forge service reset (already S2 in `vag-sources.md`) | https://github.com/dspl1236/PCM-Forge/blob/HEAD/tools/service-reset/README.md | Claims IDE decimal = DID; "EXPERIMENTAL" |
| D24 | dspl1236/CerberusCAN (MIT) | https://github.com/dspl1236/CerberusCAN | Generic UDS write tool; "bench/experimental"; C7 scan |
| D25 | hanibalnos-ship-it/codingeasy ("ScanVAG"), Android + ELM327 | https://github.com/hanibalnos-ship-it/codingeasy | `2E 0600` beta on 5F only; no `27` |
| D26 | OVMS ECU toolkit docs | https://docs.openvehicles.com/en/latest/plugin/v-vweup/ecutoolkit/README.html | Warnings |
| D27 | DSparks156x/PQ35-Flasher | https://github.com/DSparks156x/PQ35-Flasher | PQ35 BCM, EPS, Haldex on TP2.0: flash and readout only |

Blocked or not read: hardwear.io PDF (search text only), Ross-Tech forum 17334 (search text only). vag-coding.net still returns 404 to fetches.

---

## 1. UDS security access ("login" / "security access code")

### 1.1 Levels

| Level | Use | Algorithm | Sources | Confidence |
|---|---|---|---|---|
| `27 03` / `27 04` | Adaptation, coding, basic settings, output tests ("the numeric MCD-style login (a 5-digit code)") | key = seed + code | D1, D10, D11, D12 (same level on KWP) | **High** (MQB, e-Up); **Medium** for MLB (no MLB capture) |
| `27 11` / `27 12` (decimal 17) | Programming session (flash) | SA2 bytecode script from the FRF/ODX flash container | D5, D6 (`unlock_security_access(17)`), D7, D1 ("not the SA2 seed/key bytecode used for programming") | **High**. Not for coding or adaptation |
| `27 01` / `27 02` (KWP2000) | Flash level on KWP engines and PQ modules | Different algorithm (XOR table for MED9.1, per D14 CREDITS) | D14, `leon-sources.md` P9 | Medium. Not for this app |

**Disagreement.** D14 (vag-diag) says "Bei VAG wird der Key meist über SA2 berechnet" and offers `login --sa2 ... --level 3` with user-supplied bytecode. D1, D10 and D11 use plain seed + code at level 03. D14 states its KWP login is "am Auto ungeprüft"; it does not report a real UDS login with SA2 at level 03. My reading: seed + code is the evidenced route; SA2 at level 03 is untested. Show both.

### 1.2 Algorithm (public, with worked examples)

From D1 (comment, quoted in part): "the seed is read as a big-endian unsigned integer, the numeric login code is added", then wrapped to the seed's byte width. D10: `parseInt(seed,16) + parseInt(code,10)`. D11: `seed + 28183  # yeah, it's like that`.

Worked examples (D1 unit tests, verbatim values):

| Seed | Code | Key |
|---|---|---|
| `00 00 00 00` | 12345 | `00 00 30 39` |
| `00 00 FF FF` | 1 | `00 01 00 00` |
| `FF FF FF FF` | 1 | `00 00 00 00` (wraps) |
| `12 34` (2-byte seed) | `0x1111` | `23 45` |

Codes named in the brief, as hex (arithmetic): 20103 = `0x4E87`, 31347 = `0x7A73`, 13861 = `0x3625`, 25327 = `0x62EF`, 28183 = `0x6E17`. Example: seed `12 34 56 78` + 20103 → `12 34 A4 FF` (arithmetic).

The code itself is per module and function; it is not derivable from the seed. Codes come from repair manuals and forums (D20: "Valid Login codes can be found in the Factory Repair Manual"). Two MQB 09 guides give different codes for the same comfort item (20103 in `vag-sources.md` C1, 31347 in C3): sources disagree.

### 1.3 Session rules

- The unlock is session-scoped. D1 re-runs `27 03/04` inside every protected command, because the session may be re-opened. D20 (VCDS): after a dropped session "You will need to exit the Controller do another Login".
- D2 holds the extended session with `3E` and treats it as stale after 3 s idle (`SESSION_STALE`).
- A wrong key can block further tries (NRC `0x36`/`0x37`, `leon-sources.md` 5.1). One attempt per ignition cycle.
- Some reads also need security: the A7 C7 HUD answered `22 028D` with `7F 22 33` (D15).

### 1.4 SA2 (for the record only)

D5 gives one example script (31 bytes) and the test vector seed `0x1a1b1c1d` → key `0x6a37f02e`. Per-ECU scripts are inside VW flash containers and are not published. Not needed for coding or adaptation.

### 1.5 SFD (newer cars)

D21: coding, adaptation, basic settings and output tests "may be limited and require a SFD unlock", from MY 2020/2021; reading is not blocked. D11 prints "Open the hood and retry (disables the "diagnostic firewall" on newer vehicles)". Neither applies to the 2012 A6 C7 or a 2007 Leon. Treat any `7F 2E 33` on an MY 2020+ car as SFD and stop.

---

## 2. UDS adaptation

### 2.1 Mechanism

| Fact | Evidence | Confidence |
|---|---|---|
| Adaptations are written with `2E` (WriteDataByIdentifier) | D4 ("Calibration Data Writing ... service 0x2E" in D8), D2 ("written via UDS 0x2E"), mcd-diag-rs README ("WriteLocalIdentifier for Adaptations") | **High** |
| Each adaptation is a whole DID record; the VCDS line is one parameter inside it | D4: ADP files are "top-level map of DID-keyed entries, each containing a single STRUCTURE (parameters list)", parameters carry `byte_position`, `bit_position`, `bit_length`, TEXTTABLE values | **High** for the data model |
| VCDS names are ODX translation keys: record key, then parameter key | D4 shows `long_name_id` at DID level (`IDE00003`) and parameter level (`MAS01065`). D17 prints names such as `ENG141681-ENG116652-ZV Komfort-Funk Komfort oeffnen` and `IDE00345-MAS05463-...` | Medium (my inference joining D4 and D17) |
| Session: extended `10 03`, held with `3E` | D2 `SessionKeeper` opens `0x03` | **High** (also D10, D11 for coding) |
| Before the write: `2E F199` (BCD `YY MM DD`) then `2E F198` (workshop code) | D2: "Both writes are preceded by the programmingDate + repair-shop code", because "many ECUs reject the change otherwise" | **High** (same as the coding rule in D11) |
| Login only if needed | D10/D26: "Most codings don't need a security code"; D14 stops on NRC `0x33` | High |
| After the write: re-read the DID | D2 `handle_write_result` re-reads | High |
| UDS has no channel numbers | D18: "traditional Adaptation Channels do not apply"; naming "should coincide with factory identifiers ... like IDEnnnnn" | **High** |
| Mk 7.5 MQB BCMs moved settings from coding to adaptation | D22 (search text only); D17 e-Golf BCM 5Q0 937 084 CP shows coding all zeros (30 bytes) in VCDS | Medium |

My inference from D17: the last number on each VCDS map line (e.g. `,8` for every `ENG141681-...` line, `,18` for `ENG141656-...` coming-home lines, `,3` for `IDE00301-Distance`) looks like the record length in bytes. One source, not stated by Ross-Tech: **Low**.

### 2.2 IDE number vs DID: the decimal rule is wrong

| IDE / name | DID | Source | Note |
|---|---|---|---|
| IDE00003 "VW Coding Value" | `0x0600` (did: 1536) | D4 (ODIS dump example) | 3 ≠ 0x0600 |
| IDE03875 "Activating_start_stop_function" | `0x02B9` (did: 697) | D4 | 3875 decimal = 0x0F23 ≠ 0x02B9. Module not named in the excerpt |
| IDE02185, IDE02186 (C7 HVAC key records) | `0x00BE`, `0x00BD` | D9 (ODIS dump, AU57X) | Component protection; never write. Shows no decimal rule |
| IDE00342 "ESI: Resetting ESI" | claimed `0x0156` | D23 | Decimal rule; "EXPERIMENTAL"; not verified on a car |
| IDE00510 | claimed `0x01FE` | D23 | Same rule |

Conclusion: **High** that the DID must come from the module's ODX data or a capture; the decimal rule may hold for a few IDE numbers by chance but is not a mapping. `vag-sources.md` 4 (S2 "claim 1") should be read in this light.

### 2.3 DIDs for the owner's wanted channels

| Item | VCDS name (from public maps) | DID | Value / layout | Status |
|---|---|---|---|---|
| Service reset (MQB) | `IDE00342-ESI: Resetting ESI`; `IDE00510`, `IDE00511` inspection counters (D17) | Not public (D23 claim `0x0156`, Low) | Not public | **Unconfirmed** |
| Comfort windows by remote (MQB 09) | `ENG141681-ENG116652 ... Funk Komfort oeffnen`, `ENG141681-ENG116651 ... schliessen` (D17) | Not public | 8-byte record by my D17 inference; bit position not public | **Unconfirmed** |
| Coming home (MQB 09) | `ENG141656-ENG116603 ... Menueeinstellung Cominghome` and others (D17) | Not public | Not public | **Unconfirmed** |
| Start-stop default | `IDE03875 Activating_start_stop_function` = `0x02B9` in some module (D4) | `0x02B9`, module not stated | Not public | **Low**; do not write |
| Mirror dip, belt warning, DRL, needle sweep by adaptation | Names only in forum guides (`vag-sources.md` 3) | Not public | Not public | **Unconfirmed** |
| C7 HUD | 13 DIDs found by sweep (D15): `0100`, `0102` (extended only), `0103`, `0286`, `028D` (needs security), `0405`, `0407`, `0408`, `040F`, `0501`, `0502`, `0600`, `0902` | Values read, meaning not public | | Read only |

No public extracted ODX map (GitHub or other) lists these. D8 can produce one, but only from ODIS project files the user owns; D8 "No projects/databases will ever be provided". Publishing such a dump would copy VW data, so the app cannot ship one.

---

## 3. KWP2000 over TP2.0 (PQ35, and MLB 09/46/42/52)

| Function | Request | Evidence | Confidence |
|---|---|---|---|
| Session | `10 89` → `50 89` | `tp20-sources.md` 3 | High |
| Long coding read, newer TP2.0 modules | `22 0600` (length `22 0601` on C6) | `vag-sources.md` G8 (C6 capture); D10 (e-Up NSF modules on TP2.0, `get("220600")`); D14 ("die lange Codierung kommt über Kennung 0x0600") | **Medium** (C6, e-Up); Low for C7 09/46 |
| Long coding read, older | `1A 9A` / `1A 9B` | `vag-sources.md` K2, `leon-sources.md` 3 | Low; refused on C7 (`7F 1A 11`) |
| Short coding write (engines) | `3B 9A` + WSC(6) + SW(4) + `03` + coding(3) | `leon-sources.md` 5.2; D12 "variant coding is a read-modify-write of the writeDataByLocalIdentifier 0x9A record" | Medium for EDC16 K-line; Low on TP2.0 |
| Long coding write | `2E 0600` over TP2.0 in D10 code; D14: "Bei TP-2.0-Steuergeräten ist das Schreiben über 0x2E am Auto noch nicht geprüft" | No capture of a body module long-coding write over KWP | **Unconfirmed** |
| Login | `27 03` / `27 04`, key = seed + code | `leon-sources.md` 5.1; D12 ("the securityAccess 0x27 code (e.g. 12233), key = seed + code") | Medium |
| Login (VCDS function 11) | Code in the `3B 9A` record as `0x800000 | login` | D12 comment only; no implementation | Low |
| Adaptation | `31 B8 01 03` enter, `31 B9 01 03 <chan>` select, `31 BA 01 03` read, `31 BB 01 03 <val:2> <WSC:6>` save, `32 B8 01 03` exit | D12 (EDC16, K-line); "Omitting [01 03] gives NRC 0x12"; EDC16 refuses channel select without `27` first | Medium for EDC16 K-line; **Low** for TP2.0 modules |
| Adaptation, alternative | `22`/`2E` on adaptation DIDs for "newer" TP2.0 modules | D14 reads with `22`, write untested | Low |

Answer to the brief's question "KWP 21/22/2E or 10 89 + 2E channel?": no public capture shows VCDS adapting a TP2.0 body module. `21` is measuring blocks only (`tp20-sources.md` 3). The two public candidates are the `31 B8` family (K-line evidence) and `22`/`2E` DIDs (untested).

KW1281 (K-line only, not CAN; listed so the numbers in the brief are placed): block titles `0x04` ActuatorTest, `0x10` SoftwareCoding, `0x21`/`0x22`/`0x2A` adaptation read/test/save, `0x28` BasicSettingRead, `0x2B` Login (D13). Not usable on TP2.0.

---

## 4. Basic settings and output tests

### 4.1 UDS

| Step | Request | Evidence | Confidence |
|---|---|---|---|
| Prelude | `10 03`, login if any, `2E F199`, `2E F198` | D3: "MCD writes the programmingDate + repair-shop code before starting a basic-setting routine" | Medium (one ODIS-data tool) |
| Start | `31 01 <RID hi> <RID lo> [option record]` | D3 `RoutineControlType::Start`; option record encoded from ODX | Medium |
| Progress | `22 01 02` every 200 ms; `00` not started, `C0` running, `10` finished (bit 4) | D3: MCD "reads this (`22 01 02`) while a routine runs, not `31 03`". The A7 HUD has `0102` in the extended session only (D15), which fits | Medium |
| Stop | `31 02 <RID>` | D3 `RoutineControlType::Stop` | Medium |
| Output test run | `2F <DID hi> <DID lo> 03 [control state]` | D3: "otherwise we prepend `0x03` (shortTermAdjustment)" | Medium |
| Output test stop | `2F <DID hi> <DID lo> 00` (returnControlToECU) | D3 | Medium |

Routine IDs that must be blocked (flash): `FF00` erase, `FF01` check dependencies, `0202` checksum, `0203` check programming preconditions (D6). D16 makes the same point: `31` also carries erase and dependency routines, so only an allowlist is safe.

### 4.2 KWP2000 (EDC16 K-line, D12)

- Basic setting: `31 B8 00 00` enumerate once, `31 B8 00 <grp>` enter, `31 BA 00 <grp>` poll values, `32 B8 00 <grp>` exit. D12: "grp = 0x03 in the capture". Medium for EDC16; Low on TP2.0. `leon-sources.md` 5.4 shows P7 (vag-tool) uses a different order: sources disagree.
- Output test: `31 B8 01 02` enter, `31 B9 01 02` activate or advance to the next actuator, `31 BA 01 02` status, `32 B8 01 02` exit. One source: Medium for EDC16, Low elsewhere.
- D14: "Welche Anfragen VAG dafür über TP 2.0 schickt, ist nicht verlässlich veröffentlicht"; it learns the sequence from the user's own capture.

### 4.3 Captured examples for EPB service mode or DPF regeneration

**None public.** Ross-Tech, vis4vag and Carista describe the tool steps (`vag-sources.md` 5); no capture or ODX extract with the `31 01` routine ID or option record was found for EPB (53) or DPF (01) on MQB or MLB. D16 puts forced DPF regeneration out of scope.

Safety (from `vag-sources.md` 5 and D14): DPF regeneration can start a fire with an overloaded filter; EPB routines must not run with brakes apart; output tests only stationary, with return of control on exit, error and link loss (D16).

---

## 5. Open-source tools that write

| Tool | Transport | Writes | Login | Evidence of real use | Gap |
|---|---|---|---|---|---|
| OVMS `xvu-ecu.js` (D10) | ISO-TP and TP2.0 on e-Up | Coding incl. subsystem codings (`base + 0x600`, per-ECU `baselist`), `F199`/`F198` | `27 03/04`, seed + code | Shipped plugin; "only been used and tested on few vehicles" (D26) | No adaptation, no routines (only `31 B8 00 00` read) |
| openpilot `vw_mqb_config.py` (D11) | ISO-TP, 0x712 | EPS coding one bit, `F199`, `F198`, `0600` | `27 03/04`, + 28183 | Used by many MQB owners | One module |
| mcd-diag-rs (D1 to D4) | Panda, SocketCAN, J2534, DoIP | Coding, adaptation, basic settings, output tests, flash | `27 03/04` seed + code; SA2 at `27 11` for flash | Tested on MQB VW37/AU37 | Needs the user's own ODIS MCD data; no SFD |
| VW_Flash, sa2_seed_key (D5, D6) | ISO-TP | Flash only | SA2 `27 11` | Widely used for Simos18 | Not coding |
| kw1281test (D12) | K-line | KWP short coding, adaptation, basic settings, output tests (EDC16) | `27 03/04` | KWP2000 commit Sep 2026 | K-line only |
| vag-diag (D14) | SocketCAN | UDS coding, adaptation backup and restore (only changed, same length; mileage never written), `2F`/`31` from user captures | SA2 with user-supplied bytecode at level 3 (see 1.1 disagreement) | "nur das CAN-Interface" tested on a Golf 6 | TP2.0 writes untested |
| ScanVAG (D25) | ELM327 Classic BT | `2E 0600` beta, 5F only | None | No car results | No `F198`/`F199` |
| CerberusCAN (D24) | Teensy, two CAN | Generic UDS write with dry run | Not described | Scan on a 2013 A6 C7; writes "bench/experimental" | |
| PQ35-Flasher (D27) | TP2.0 | Flash and readout (BCM, EPS, Haldex) | Flash level | Bench | Not coding |

ESP32 / ESPHome VAG projects found (id3esp32obd2, ergissvag) are read-only. No public "OBDeleven-alike" with an adaptation map was found. No python-udsoncan VAG example beyond openpilot's own `uds.py`.

---

## 6. Label-free discovery

What VCDS uses: D18 drop-down lists from label or dataset files; D19 says UDS channel maps need "the module's ROD file". So VCDS does not discover UDS adaptations from the module alone (Medium, my reading of D18 and D19). UDS has no service that lists a module's DIDs.

What the app can do without label files (reads only):

1. Identify the dataset: `22 F19E` (ASAM/ODX file identifier) and `22 F1A2` (version). D4 uses this pair to choose the ODX variant. Real C7 values: `EV_HUDContiC7` (D15), `EV_RBD4K` cluster and others (D24). **High** for the read.
2. Sweep `22 0000` to `22 0FFF` in the default session, then in `10 03`, holding with `3E`. D15 did this on the A7 C7 HUD: 4096 reads in about 4 min on an OBDLink EX, 11 DIDs in default and 13 in extended, `7F 22 31` for unused DIDs. **High** as a method (real MLB car). Expect it to be slower on a BLE ELM327.
3. Narrower ranges from D14: adaptations `0x0100` to `0x04FF` and `0x2000` to `0x24FF`; measurements `0x0200` to `0x02FF`, `0x1000` to `0x10FF`, `0x2200` to `0x22FF`. D14 skips values that change between two reads (measurements). Medium.
4. Find which DID is which feature (my proposal): read the candidate DIDs, change the setting in the car's own menu (MMI or cluster), read again, and diff. A DID and bit that flips with the menu setting is the adaptation. This needs no label file and writes nothing.
5. Or capture a known tool on the owner's car (VCDS, OBDeleven or Carista): D14 suggests a Y-cable CAN log; `leon-sources.md` suggests an iOS PacketLogger capture of Carista.

Never sweep `2E`, `2F` or `31`. Return to `10 01` after a sweep.

---

## 7. Implementable sequences (High / Medium only)

A. UDS login (High MQB/e-Up, Medium MLB):

```
10 03                    → 50 03 ...
27 03                    → 67 03 <seed, 2 or 4 bytes>
27 04 <key>              key = (seed + code) mod 2^(8 × seed length), big-endian
                         → 67 04 ; any 7F 27 xx (ISO 14229: 35 invalidKey, 36, 37) = stop for this ignition cycle
```

B. UDS adaptation write, once a DID is known from 6.4 or a capture (sequence High on MQB; Medium MLB):

```
10 03 ; 3E 00 every ≤ 2 s
[27 03 / 27 04 only after 7F 2E 33]
22 <DID>                 backup the whole record
2E F1 99 <YY MM DD BCD>  ignore 7F 2E 31 (engine ECUs)
2E F1 98 <6 bytes>       workshop code copied from 22 F1A5 or 22 F19A
2E <DID> <record>        same length, only the target bits changed
22 <DID>                 compare; on mismatch write the backup back
10 01
```

C. Label-free read sweep (High as method):

```
22 F1 9E ; 22 F1 A2
for did in 0000..0FFF: 22 <did>      (default session)
10 03, then the same loop with 3E 00 keep-alive ; 10 01
```

D. UDS basic setting / output test, only with a RID or DID from a capture (Medium mechanism):

```
10 03 ; [login] ; 2E F1 99 ... ; 2E F1 98 ...
31 01 <RID> [options] ; poll 22 01 02 every 200 ms until 10 ; 31 02 <RID> to abort
2F <DID> 03 [state] ; 2F <DID> 00 on exit, error or link loss
```

E. KWP on TP2.0, read only (Medium for C6/e-Up type modules): `10 89`, `22 0601`, `22 0600`.

---

## 8. What is not public

1. Any verified UDS DID, record layout or value for the requested channels: service reset, comfort windows by remote, coming home, mirror dip, belt warning, start-stop default, needle sweep by adaptation, DRL. Only names are public (D17).
2. A published IDE/ENG/MAS-to-DID map. It exists only inside ODIS project data (D8, D9).
3. Routine IDs and option records for EPB service mode, DPF regeneration, battery registration or any other basic setting; output-test DIDs.
4. Which modules on the A6 C7 need a login, and the right code per function (codes are forum-sourced; sources disagree).
5. KWP2000 long-coding write and adaptation bytes for TP2.0 body modules (MLB 09/46/42/52, PQ35 09/46). No capture.
6. Per-ECU SA2 scripts (inside flash containers) and SFD tokens (VW backend).

---

## 9. Red flags

1. Do not trust "IDE decimal = DID" (section 2.2). A guessed `2E` to a wrong DID can change an unrelated setting or a component protection record (`0x00BD`/`0x00BE` on the C7 HVAC, D9).
2. An adaptation DID is a whole record; writing one parameter means writing all bytes. Write only a record read in the same session, same length (D14 rule), and re-read.
3. Never send `27 11` or routines `FF00`, `FF01`, `0202`, `0203` (flash, D6).
4. D24 says `0x700` to `0x70F` are functional broadcast IDs on its C7 scan; `coding-sources.md` lists 09 at 70E and 46 at 70D (Medium, MQB). On the C7 these are TP2.0 anyway; do not send writes to 0x70x IDs on MLB.
5. Login is lost with the session (D1, D20): re-run before each protected write, one wrong-key attempt per ignition cycle.
6. Modules log every write with the workshop code and date (D26).

---

## 10. Open items, cheapest first

1. Run sweep C on the owner's C7 cluster (714/77E), HUD and gateway, default and extended; save the results as the baseline.
2. Change one cluster menu setting (for example service display units or a comfort item in the MMI), repeat the sweep on that module, diff (section 6.4).
3. Read `22 0156`, `22 0D17`, `22 0D18` and `22 01FE` on 714 in `10 03` to test D23 (reads only).
4. Capture Carista or OBDeleven doing an oil service reset on the owner's car: gives the DID, value and whether a login is used.
5. On TP2.0 modules (once addresses are known, `tp20-sources.md` 8): `10 89`, `22 0601`, `22 0600`.
