# Caristini: Ford Focus ST Mk3 and Mazda6 GJ customisation catalogue

Research note, 11 Nov 2026. Cars: UK Ford Focus ST-3 Mk3 (about 2015, VIN WF05XXGCC5FM00000) and UK Mazda6 GJ 2016 2.2 Skyactiv-D. Public sources only. Facts as stated by each source; "my inference" marks a conclusion I drew.

Read with `focus-st-sources.md` (keys FS*) and `mazda6-sources.md` (keys Z*). Facts already settled there are not repeated: Focus BCM 726 on HS-CAN, IPC 720 on MS-CAN; Ford as-built block N = DID DE00 + N - 1 on 2019+ Fords; FORScan line checksum rule; EU Focus Mk3 Central Configuration needs a Ford SBL; Mazda FBCM 726, SSU 731, IC 720 on HS-CAN on the GJ.

Confidence: **High** = 2 or more independent sources agree; **Medium** = 1 detailed source (or several that copy one origin); **Low** = single brief post, other model, search-engine extract only, or sources disagree; **Unconfirmed** = no source gives the value.

Pages that refused automated reading on 11 Nov 2026 (used only through search-engine extracts, so Low at most): focusst.org, focusrs.org, focusfanatics.com, focusstoc.com, mazda3revolution.com (all paywall redirect), ffclub.ru (bot challenge), talkford.com, forum.miata.net. The SergSlim "Mazda SkyActiv OBD-II Calc" spreadsheet (linked from T28) sits on OneDrive behind a script page and was not read.

Not copied: the FoCCCus option database (zip files at ford.xtlt.ru/FoCCCus) and the Cyanlabs as-built database. Only values stated in individual posts are listed.

---

## Sources

| Key | Source | URL | Notes |
|---|---|---|---|
| T1 | FoCCCus wiki, "Central configuration" page (author xGloooM, ffclub.ru), last modified 7 May 2014 | http://focccus.ru/wiki/%D0%A6%D0%B5%D0%BD%D1%82%D1%80%D0%B0%D0%BB%D1%8C%D0%BD%D0%B0%D1%8F_%D0%BA%D0%BE%D0%BD%D1%84%D0%B8%D0%B3%D1%83%D1%80%D0%B0%D1%86%D0%B8%D1%8F | CC = 512 bytes, 256 configurable, one parameter per byte, BCM main, IPC read-only backup |
| T2 | James Simpson, "FoCCCus Central ECU Config Edit - ELM327 - Focus MK3" (Mar 2014, comments to Sep 2017) | https://www.jamessimpson.co.uk/focccus-central-ecu-config-edit-elm327/ | Screenshots of FoCCCus parameter names #1 to #132; comments on #147, #224, #239 |
| T3 | drive2.ru, "Активация дополнительных функций" (Focus III wagon 2014 1.6, Russia) | https://www.drive2.ru/l/7311962/ | CC parameter numbers with values |
| T4 | Ford Owners Club 80753 "Focccus guide required" (UK, 2012 Focus and others) | https://www.fordownersclub.com/forums/topic/80753-focccus-guide-required/ | #32 auto lock steps; #236 ST menu; HID options |
| T5 | Ford Owners Club 125779 "Forscan Focus MK3" (UK 2016 Mk3.5 ST-1, Apr 2021) | https://www.fordownersclub.com/forums/topic/125779-forscan-focus-mk3/ | Auto lock, global opening/closing, fogs as DRL via FORScan configuration (not as-built) |
| T6 | Ford Owners Club 93639 "Mk3 focus: what not to do with FoCCCus" | https://www.fordownersclub.com/forums/topic/93639-mk3-focus-what-not-to-do-with-focccus/ | Auto lock enabled; crash flag after reading with engine running |
| T7 | Ford Owners Club 111755 "Focus static corner light?" | https://www.fordownersclub.com/forums/topic/111755-focus-static-corner-light/ | Fog cornering not possible by configuration |
| T8 | Ford Owners Club 131031 "Mk3.5 read from BCM write to IPC" | https://www.fordownersclub.com/forums/topic/131031-mk35-read-from-bcm-write-to-ipc/ | Cruise retrofit: option changed in BCM and IPC; FORScan CC version bug |
| T9 | Ford Owners Club 147594 "FORScan updated with how to disable trailer module" | https://www.fordownersclub.com/forums/topic/147594-forscan-updated-with-how-to-disable-trailer-module/ | Focus CC asks for SBL `DV6T-14C097-AB` |
| T10 | FORScan forum t=1943 "Как программировать центральную конфигурацию в FORScan" (Russian version of FS2) | https://forum.forscan.org/viewtopic.php?t=1943 | SBL for all CC cars except Fiesta family; normal/engineering modes; ABS, RCM, SASM, EPB need initialisation after related changes (U2100) |
| T11 | FORScan forum p=55830 "FORScan taillights and drl" (2019-2021) | https://forum.forscan.org/viewtopic.php?p=55830 | "DRL with park lights" option; dimming reports |
| T12 | Google Sheet "Fiesta ST Forscan Settings" (US 2016 Fiesta ST, several testers) | https://docs.google.com/spreadsheets/d/16AV73FgxPnA15FdD30WQj-2NpqInSXTlRvccwJIKZTk/edit | B299 Fiesta, NA. CC names and values; APIM as-built |
| T13 | Andy Gill, "Focus RS 2016 - Some Light Aesthetic Car Hacking" (UK author; table copied from a US focusrs.org post) | https://blog.zsec.uk/focusrs-hacks/ | APIM 7D0 nibbles; IPC 720-06-01 RS drive mode |
| T14 | drive2.ru, Focus III 2016 1.5 (Russia), CC via FORScan, 15 Mar 2017 | https://www.drive2.ru/l/468476891779564356/ | FoCCCus cannot reach CC on Focus III from Oct 2016; FORScan uses calibration file `GV6T-14C097-AA` |
| T15 | FORScan forum t=4292 "MK3 Focus: Should data in IPC and BCM match?" (US 2012 Focus, May 2017) | https://forum.forscan.org/viewtopic.php?t=4292 | US Mk3 BCM blocks 1-10 equal the IPC "main backup", so the US Mk3 is also a CC car |
| T16 | Search-engine extracts only (pages refused): talkford.com topic 227178 "Autolock Focus Mk3"; focusfanatics.com thread 402666 "FoCCCus Central ECU Config Edit"; ffclub.ru topic 294958 page jump_6600 | https://talkford.com/community/topic/227178-autolock-focus-mk3/page-4 , https://www.focusfanatics.com/threads/focccus-central-ecu-config-edit.402666/page-69 , https://ffclub.ru/topic/294958/jump_6600/ | Low at most |
| T17 | Cyanlabs community t=4889 "2013 C-Max IPC AsBuilt configuration" (US C-Max, Mk3 Focus platform) | https://community.cyanlabs.net/t/2013-c-max-ipc-asbuilt-configuration/4889 | 720-01-02 cruise set-speed bit |
| T20 | miatafy.com "Mazda6 FORScan Coding" | https://miatafy.com/mazda6/forscan/ | Model notes; says recipes not validated on the Mazda6 |
| T21 | miatafy.com "FORScan Coding Guide for the ND MX-5" | https://miatafy.com/nd-miata/forscan/ | Bit table (mostly restates Z10) |
| T22 | FORScan forum t=2369 "Mazda CX-5 Auto Door Lock" | https://forum.forscan.org/viewtopic.php?t=2369 | "editing raw data (4 bytes) in R_BCM"; "tested it on Mazda 3 and Mazda 6"; RBCM needs an MS/HS switch adapter |
| T23 | Lowyat forum 4633466 "Enabling Mazda Skyactiv Auto Door Lock" (2016 Mazda6, Malaysia) | https://forum.lowyat.net/topic/4633466/all | Auto lock enabled; "need odb reader that support MS-CAN bus" |
| T24 | mazdas247 "Auto Headlight and Wiper Retrofit" (2017 CX-5 Touring) | https://mazdas247.com/forum/threads/auto-headlight-and-wiper-retrofit.123871940/ | 7B7-01-03 change shows auto light and wiper settings |
| T25 | Mazda6 owner's manual, "Personalisation Features" (edition 8fk7ee16f; market list not UK-specific) | https://owners-manual.mazda.com/gen/en/mazda6/mazda6_8fk7ee16f/contents/10030100.html | Owner or dealer settings, no coding |
| T26 | drive2.ru, CX-5 2016 2.0 (Germany), SSU lock beep | https://www.drive2.ru/l/715714175912921736/ | Question only; commenter: no buzzer without keyless |
| T27 | mazdas247 "2nd Gen Mazda5 AsBuilt data questions" (EU 2011 Mazda5) | https://mazdas247.com/forum/threads/2nd-gen-mazda5-asbuilt-data-questions.123878539/ | Non-Skyactiv; IC has driver/passenger belt reminder options |
| T28 | OHP Tools, "A Video Guide on How to Use the Mazda SkyActiv OBD-II Calc Spreadsheet" | https://ohptools.com/blogs/news/a-video-guide-on-how-to-use-the-mazda-skyactiv-obd-ii-calc-spreadsheet-for-forscan | Points to SergSlim's spreadsheet (checksums) |
| T29 | FORScan forum t=18925 "Needle sweep" (same as FS26, now readable) | https://forum.forscan.org/viewtopic.php?t=18925 | 2015 Fiesta EU and 2015 Focus ST1 owners: not in IPC configuration |

---

## 1. Ford Focus ST Mk3 (UK, about 2015)

### 1.1 How configuration is stored (read first)

- The Focus Mk3 keeps almost all options in **Central Car Configuration (CCC)**: "512 байт ... из них 256 байт отвечают за настраиваемые параметры. Каждый из 256 байт отвечает за свой параметр" (T1: 512 bytes, 256 configurable, one parameter per byte, value 00-FF). It lives in the BCM and is broadcast to other modules; the IPC holds a backup copy that only tools read or write (T1). **High** (T1 plus FS2, FS3, T10).
- **Parameter #N = CC byte N.** FoCCCus numbers parameters #1 to about #239 (T2 screenshots, T3, T4). FS27 gives "byte 24" = rain sensor; T2 lists "#24 Rain Sensor". My inference: the FoCCCus number is the byte position. **Medium.**
- The US Mk3 Focus is also CC: its BCM blocks 726-01 to 726-10 match the IPC "main backup" (T15). So US Focus "as-built" lines 726-xx-xx from Super Duty sheets (FS25) do not apply to any Mk3 Focus. **Medium.**
- Writing CC needs the Ford SBL (FS2, T10); FORScan downloads it or the user places it in `Documents\CalibrationFiles`. File names seen on Focus Mk3: `DV6T-14C097-AB` (T9), `GV6T-14C097-AA` (2016 car, T14). FoCCCus cannot reach CC on Focus III built from October 2016 (T14). FORScan needs the extended licence and, for some options, an engineering mode (T5 thread, T8, T10). After changes touching ABS, RCM, SASM or EPB, run the module initialisation or DTC U2100 sets (T10). **High** for SBL; **Medium** for file names.
- Method code used in the tables: **CC-SBL** = CC byte write through FORScan or FoCCCus with the SBL loaded in a programming session on the BCM (IPC backup optional). Not a plain `2E DExx` write. **AB-2E** = per-module as-built block, presumed `2E DE00+N-1` (FS12 rule, not confirmed on Mk3 modules). **Owner** = no tool needed.

### 1.2 Customisation table

| id | title | module | block | byte | bits_or_value | value_on | value_off | method | confidence | sources | notes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| F01 | Auto lock when driving off (automatic locking by speed) | BCM 726 (CC) | CC | #32 | whole byte | 02 (auto locking) | 01 (off) | CC-SBL | High | T3, T4, T5, T6, T16 talkford | EU and UK cars. T6: doors locked at 3 mph. T4: "click write to BCM", then cycle ignition, clear DTCs. Risks: T6 crash flag set after reading with engine running; T2 comment: 2016 Grand C-Max BCM write failed at 99 % ("insufficient ccc data") and car went dead |
| F02 | Global opening and closing (windows by key fob) | BCM 726 (CC) | CC | Unconfirmed | FORScan options "Global opening", "Global closing" | Enabled | Disabled | CC-SBL | Medium | T5, FS20, T16 focusfanatics | Byte number not found. T5 (UK 2016 ST-1): "you should be able to turn on Global opening and Global closing"; ST-1 owner already had it. Needs one-touch on all windows (extract). FS20 owner procedure: hold unlock or lock 3 s |
| F03 | Cruise control enable (with switch retrofit) | BCM 726 and IPC 720 (CC) | CC | #23 | whole byte | 02 (cruise), 03 (adaptive) | 01 (none) | CC-SBL | High | T3, T8, T2 comment | T8: set "with cruise control" in BCM and in IPC. Hardware needed. ST-3 already has cruise (FS20) |
| F04 | Adjustable speed limiter (ASL) | BCM 726 (CC) | CC | #224 | whole byte | 02 | 01 | CC-SBL | Medium | T3, T2 comment | T2 commenter: turning on ASL fixed a cruise fault |
| F05 | Tyre pressure monitoring / DDS | BCM 726 (CC) | CC | #101 | whole byte | 44 (monitoring on, T3) | 01 (none, T3, T12) | CC-SBL | Low | T3, T12, T16 talkford | **Disagree on codes:** T12 (US Fiesta) went 05 to 01 "Without Monitoring System". Talkford extract: set #101 to deflation detection, then re-initialise ABS. Value differs by car |
| F06 | Hill launch assist | BCM 726 (CC) | CC | #218 | whole byte | 02 | 01 | CC-SBL | High | T3, T16 talkford | ABS initialisation required after change (T10 rule) |
| F07 | DRL mode | BCM 726 (CC) | CC | #16 | whole byte | 01 = on except in P (T3); 05 = dedicated LED DRL (T3) | 02 = normal lights, no DRL (T3) | CC-SBL | Low | T3, T12, T16 focusfanatics | **Disagree:** T12 (US Fiesta) says 03 = "always dipped lights except in position P". Extract: LED DRL in #16 needs #17 = "without dipped headlight" (Europe) |
| F08 | Dimmed dipped beam / Scandinavian light | BCM 726 (CC) | CC | #17 | whole byte | 02 | Unconfirmed | CC-SBL | Medium | T3, T1 main page, T16 focusfanatics | Pair with #16. FoCCCus wiki lists "Скандинавский свет" (Scandinavian light) as a standard-fit change |
| F09 | Tail lights on with DRL | BCM 726 (CC) | CC | Unconfirmed | FORScan DRL dropdown option "DRL with park lights" | option selected | standard DRL | CC-SBL | Low | T11 | Worked on "Focus 18 (LED headlights)" (generation unclear) and others; front DRL dims on some halogen cars |
| F10 | Fog lights with high beam (fog function) | BCM 726 (CC) | CC | #18 | whole byte | 02 = fogs fitted (stay on) | 03 = off when high beam on; 01 = no fogs | CC-SBL | Medium | T3, T12 | T12 (US Fiesta) "Without Restriction" did **not** work there |
| F11 | Front fogs as DRL | BCM 726 (CC) | CC | Unconfirmed | Unconfirmed | | | CC-SBL | Low | T5, T16 focusfanatics | **Disagree:** T5 "Maybe you can turn on Fogs as DRLs"; extract: "doesn't seem to be a way to use the fogs as DRLs" |
| F12 | Static cornering lights from front fogs | BCM 726 | n/a | n/a | not available | | | none | Medium | T7 (two posters) | T7: front fogs share one BCM feed, so left and right cannot switch separately; static cornering only with HID and headlamp control module (Mk3.5) |
| F13 | Headlamp type (halogen, HID, alternative HID) | BCM 726 (CC) | CC | #14 | whole byte | 03 = xenon with auto levelling (non-standard), 05 = standard Focus III xenon | 02 = halogen with levelling | CC-SBL | Medium | T3, T4 | T4: "HID" needs original HCM, else DTCs; "Alternative HID" removes bulb check and gives steady 12 V. Hardware setting, not a tweak |
| F14 | Rain sensor fitted | BCM 726 (CC) | CC | #24 | whole byte | 02 (with rain sensor) | 01 (without) | CC-SBL | Medium | FS27, T2 (name) | FS27 is a 2018 Focus Titanium, market not stated; needs sensor and screen |
| F15 | Parking aid type | BCM 726 (CC) | CC | #59 | whole byte | 02 = rear, 05 = front and rear with auto park | 01 = none | CC-SBL | Medium | T3 | Hardware |
| F16 | Lock confirmation horn (audible mislock / double honk) | BCM 726 (CC) | CC | #147 | whole byte | 04 = horn on lock (T2 comment) | Unconfirmed | CC-SBL | Low | T2 comment (Jan 2017), T16 ffclub | **Disagree:** ffclub extract: after changing #147 "нету звука никакого на запирание" (no sound on locking) |
| F17 | Indicator flash on arming (acknowledge signal lock/alarm) | BCM 726 (CC) | CC | #31 | Unconfirmed | | | CC-SBL | Low | T2 (name), T16 ffclub | Name only |
| F18 | Seat belt reminder (driver, front passenger) | BCM 726 / IPC 720 (CC) | CC | #61 (belt reminder), #131 (front passenger belt reminder), #136 (seat belt warning, extract) | Unconfirmed | | ffclub question: #131 = 2 driver and passenger, 3 driver only (unanswered) | CC-SBL | Low | T2, T16 ffclub | T2 claims FoCCCus can "turn off passenger seatbelt warning chime"; no value given. FS20: MyKey belt minder cannot be disabled |
| F19 | Automatic lights type | BCM 726 (CC) | CC | #88 | Unconfirmed (options include auto high beam, extract) | | | CC-SBL | Low | T2 (name), T16 ffclub | |
| F20 | Two-stage unlocking | BCM 726 (CC) | CC | #30 (Unlocking settings) | Unconfirmed | | | CC-SBL or Owner | Low | T2 (name and comment) | T2 commenter: toggled by pressing lock and unlock on the fob together (not verified here) |
| F21 | Display, ICP and steering-wheel audio buttons | BCM 726 (CC) | CC | #172, #214, #187 | #172: 03 Mono MFD3, 04 colour TFT MFD4, 05 Starburst MFD2, 09 DM8 with Navi; #214: 01 none, 02 standard, 05 Nav ICP, 08 branded ICP; #187: 01 none, 02 OK-M, 03 OK-OK with MFD control | per fitted hardware | | CC-SBL | Medium | T3 | Hardware descriptors. ffclub extract: set DM8 for cluster navigation display |
| F22 | Tail lamp type | BCM 726 (CC) | CC | #196 | 02 = level 1 standard, 03 = level 2 LED | | | CC-SBL | Medium | T3 | Hardware |
| F23 | ST menu and ST logo on cluster | BCM 726 (CC) plus IPC 720 | CC | #236 | Unconfirmed | | | CC-SBL plus IPC engineering configuration | Low | T4 | T4 reply: #236 alone "is not enough"; IPC parameters must change and ABS firmware must be new enough. The owner's car is an ST, so likely already set (my inference) |
| F24 | MyKey | BCM 726 (CC) | CC | #239 | 02 (status shown "unknown" in FoCCCus) | | | CC-SBL | Low | T2 comment | |
| F25 | Needle sweep at ignition on | IPC 720 | n/a | n/a | not offered | | | none | Medium | T29, T2 comment (Dec 2016, unanswered) | T29 2015 Focus ST1 owner: "from what i've read online it isn't possible". Sweep exists only as a PID output test (T29 Fiesta owner) |
| F26 | Other CC parameters, names only (values not published) | BCM 726 (CC) | CC | #12 Alarm, #19 Rear foglight tow function, #20 Trailer module, #21 Keyless entry and start, #28 Private locking trunk, #43 Speed limitation, #44 Speed warning device, #45 Instrument cluster calibration, #51 Tire circumference, #57 Parking brake, #60 Hill descent control, #63 Frequency remote controls, #85 Rear view mirrors, #87 Puddle lamp, #96 Collision mitigation by braking, #97 Forward collision warning, #98 Lane departure warning, #99 Park assist camera, #117 Speedometer | Unconfirmed | | | CC-SBL | Medium (names) | T2 screenshots | Use to label a CC dump. Values need a capture from the owner's car |
| F27 | SYNC boot screen | APIM 7D0 | 7D0-02-01 | byte 3 (nibble 6 of `xxxx xXxx xxxx`) | B = ST Ford Performance, C = RS, D = GT, 1 = Ford, 5 = Raptor, 6 = Mustang, 7 or 9 = GT350 | B | 1 | AB-2E | High | T13, T12, FS25 | SYNC 3 (some values also SYNC 2.2). A 2015 UK ST-3 most likely has SYNC 2 or a Sony unit (Unconfirmed). APIM bus on the Focus Unconfirmed |
| F28 | SYNC theme | APIM 7D0 | 7D0-03-01 | byte 3 (`xxxx XXxx xxxx`) | 00 Ford Classic, 01 Ford Timeless, 02 Lincoln Timeless, 03 Lincoln Next, 04 Ford GT | 04 | 01 | AB-2E | High | T13, T12 | SYNC 3 only. Lincoln themes also need 7D0-01-02 first nibble 8 (T13) |
| F29 | Bluetooth pairing name | APIM 7D0 | 7D0-04-01 | byte 5 (`xxxx xxxx XXxx`) | 02 = Focus, 20 = Fiesta, 06 = Mustang, others in T13 | 02 | | AB-2E | Low | T13, T12 | T12 tester: setting 20 on a Fiesta ST "No" (did not work) |
| F30 | Radio stays on after ignition off (extended play) | APIM 7D0 | 7D0-01-06 | nibble 3 | A = off, 2 = 20 min, 3 = 30, 4 = 40, 5 = 50, 6 = 60 min | 6 | A | AB-2E | Medium | T13 | "Sync 2 & Sync 3" per T13 |
| F31 | Custom (fifth) drive mode | IPC 720 | 720-06-01 | bytes 1-2 | E407 to E47F | E47F | E407 | AB-2E (IPC on MS-CAN) | Medium | T13 | **Focus RS only** (2016-2019). Not applicable to the ST |
| F32 | Cruise set-speed display | IPC 720 | 720-01-02 | bit 10 (`7830` to `7C30`) | 1 | 0 | | AB-2E | Low | T17 | **US 2013 C-Max IPC**, not a Focus; EU Focus IPC uses CC |
| F33 | Super Duty rows copied into the "2017 Focus ST" sheet (726-17-01 global windows, 726-41-02 and 726-38-02 honk, 720-01-01 belt chime, 726-26-02 parking lamps with DRL) | BCM 726, IPC 720 | various | various | as FS25 | | | none | Low | FS25, T15 | Do not use: the sheet says it was copied from a Super Duty list; T15 shows the Mk3 BCM is CC |
| F34 | US Fiesta ST as-built rows (726-17-01 / 726-17-02 global windows, 726-41-02 and 726-16-01 double honk, 724-01-01 turn-signal flash count) | BCM 726, SCCM 724 | as listed | as listed | 724-01-01 nibble 6: 0 = 1 flash, 4 = 2, 6 = 3, 8 = 4, A = 5 | | | none | Low | T12 | B299 Fiesta (NA), "Works?" left blank for these rows. Not for a UK Focus |
| F35 | Oil temperature and boost gauges | IPC 720 | n/a | n/a | physical gauges fitted on the ST (FS20) | | | none | Medium | FS20 | Nothing to enable. Live values: `focus-st-sources.md` section 5 |
| F36 | Odometer, cluster replacement only | IPC 720 | DID 61BB (FoCCCus "Tools") | n/a | km in hex, increase only, "1 shot" | | | `2E 61BB` via FoCCCus (my inference: a DID write) | Low | T2 comment (Dec 2016) | Listed only because it is a direct DID write. Not a customisation; do not implement |

### 1.3 Focus: what a pins 6/14 adapter can reach

- CC lives in BCM 726, which answers on HS-CAN (FS8, FS11), so the bytes are physically on pins 6/14. Every CC write (F01 to F26) still needs the Ford SBL and a programming session (FS2, T10). **No Focus CC item is a plain `2E` write.** Whether `22 DE00` returns the CC image without the SBL: Unconfirmed.
- IPC 720 items (F25, F31, IPC side of F03 and F23, CC backup) need MS-CAN (pins 3/11).
- APIM 7D0 items (F27 to F30): bus on the Focus Unconfirmed; and only with SYNC 2/3.

---

## 2. Mazda6 GJ 2016 2.2 Skyactiv-D (UK)

### 2.1 How configuration is stored

- Per-module as-built lines `MMM-BB-LL`, last byte a line checksum (Z10, Z11; rule in `mazda6-sources.md` 5.1).
- IC block 4 has an extra block checksum in `720-04-01` B0:B1; change any block-4 line and update it (Z10, Z12, T28). Z12: "Block 3 is read only". **High.** Derived from Z10's Mazda2 example: `720-04-23` B4 went 11 to 21 (+0x10) and `720-04-01` B1 went E7 to F7 (+0x10), so the block checksum looks like a 16-bit sum of block-4 data (my inference, **Low**).
- Mazda's own as-built XML (Z10) labels IC, FBCM, SSU, RCM and RBCM lines under `<BCE_MODULE>` and names `<CCC_NODE1>720</CCC_NODE1>`, so Mazda also uses a "CCC" node in the IC (my inference that IC block 4 is that CCC: **Low**).
- No source gives the UDS wire commands FORScan uses for Mazda as-built writes (`mazda6-sources.md` 5.1). Method code **AB-M** = FORScan as-built line write, wire protocol not public. **Owner** = owner menu or switch, no tool.
- Bus: Z1 (Mazda manual) puts IC, FBCM and SSU on HS-CAN and RBCM on MS-CAN. T22 and T23 confirm RBCM edits need an MS-CAN-capable adapter. T20 and T21 say all four modules are on MS-CAN (**disagree** with Z1; Z1 is the primary source).
- T20: recipes "are validated against the MX-5, CX-5, and Mazda3, not the Mazda6". Every row below is from other SkyActiv models unless the notes say Mazda6.

### 2.2 Customisation table

| id | title | module | block | byte | bits_or_value | value_on | value_off | method | confidence | sources | notes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| M01 | i-Stop disabled at start | SSU 731 | 731-01-01 | B1 | bit 4 | 1 (stock) | 0 | AB-M | High | Z10 (CX-5 test), Z12 (Feb 2026, success, `B814 C684 E131` to `B804 C684 E121`), Z10 reply for a 2013/2014 Mazda6 2.2D (`1014 E024 2082` to `1004 E024 2072`, untested), Z11 | **Behaviour disagrees:** Z11 says i-Stop defaults off and the button still turns it on; Z12 says afterwards i-Stop "no longer engages" and the button "has no effect". T20: GJ in Europe has i-Stop |
| M02 | i-Stop flag, second location | SSU 731 | 731-01-02 | B0 | bit 4 | 1 | 0 | AB-M | Medium | Z10 | Z10 lists the same meaning as M01; role unclear |
| M03 | i-Stop button and logo on cluster | IC 720 | 720-01-01 | B2 | bit 4 | 1 | 0 | AB-M | Medium | Z10 | Hides the switch and lamp; not needed for M01 |
| M04 | i-ELOOP display (fuel economy monitor animation) | IC 720 | 720-04-25, plus checksum 720-04-01 | not given | not given | enabled | disabled | AB-M | Medium | Z12 | 2017 Mazda6 2.5 (Malaysia): write refused until 720-04-01 updated, then animation returned |
| M05 | Advanced keyless entry flag | SSU 731 | 731-01-01 | B2 | bit 7 | 1 | 0 | AB-M | Medium | Z10 | Hardware flag |
| M06 | Two-step unlock available | SSU 731 | 731-01-01 | B2 | bits 4 and 2 | 1 | 0 | AB-M | Medium | Z10 | |
| M07 | Lock menu items shown on Mazda Connect | SSU 731 | 731-01-03 | B0 | bit 6 = 1 hides "Lock when leaving car"; bits 4 and 2 = 1 show "Unlock mode" | | | AB-M | Medium | Z10 | |
| M08 | Lock beep volume (keyless) | SSU 731 | not given | | FORScan item "lock beep: volume" shown as "not entered" | | | AB-M | Low | T26 | CX-5 2016: commenter says no buzzer without advanced keyless. Owner setting exists: M27 |
| M09 | Auto door lock (master) | RBCM 7B7 | 7B7-01-01 | B1 | bit 7 | 1 | 0 | AB-M (MS-CAN) | Medium | Z10, Z11, T21, T22, T23 | T22: "tested it on Mazda 3 and Mazda 6" (4 bytes in R_BCM). T23: enabled on a 2016 Mazda6. Bits from Z10 only; Z11/T21 restate. Z10 reply: 2017 Mazda6 2.2G got DTCs after this and M11 |
| M10 | Auto lock: lock with ignition on / with doors open | RBCM 7B7 | 7B7-01-01 | B4 | bit 6 (ignition on), bit 3 (doors open) | 1 | 0 | AB-M (MS-CAN) | Medium | Z10, T21 | "tested on CX5" |
| M11 | Auto lock menu on Mazda Connect | RBCM 7B7 | 7B7-01-02 | B4 | bit 5 = 1 visible; bit 3 = 0 show | | | AB-M (MS-CAN) | Medium | Z10, T21 | After this, options appear under Settings > Vehicle > Door locks (T21) |
| M12 | Find My Car (horn on double lock press) | RBCM 7B7 | 7B7-01-02 | B0 | bit 6 | 1 | 0 | AB-M (MS-CAN) | Medium | Z10, Z11, T21 | "tested on CX5". This is the nearest Mazda equivalent of a lock honk |
| M13 | Boot opens in D | RBCM 7B7 | 7B7-01-02 | B0 | bit 5 | 1 | 0 | AB-M (MS-CAN) | Medium | Z10 | Automatic cars; "tested on CX5" |
| M14 | Boot button works with engine running | RBCM 7B7 | 7B7-01-01 | B4 | bit 1 | 1 | 0 | AB-M (MS-CAN) | Medium | Z10 | |
| M15 | Indicator flash on remote lock | RBCM 7B7 | 7B7-01-01 | B1 | bit 3 (inverted) | 0 = one flash | 1 = no flash | AB-M (MS-CAN) | Medium | Z10 | |
| M16 | Three indicator flashes on remote unlock | RBCM 7B7 | 7B7-01-01 | B1 | bit 1 | 1 | 0 | AB-M (MS-CAN) | Medium | Z10, T21 | Z10: with alarm system |
| M17 | Coming home light menu | RBCM 7B7 | 7B7-01-03 | B1 | Z10: bit 5 = "ON", bit 4 = "OFF"; T21: bit 4 = 1 shows the timer menu | | | AB-M (MS-CAN) | Low | Z10, T21 | **Disagree** on which bit. Owner timer: M27 |
| M18 | Auto headlights and rain wipers settings shown | RBCM 7B7 | 7B7-01-03 | whole line | `0018 5400 2E` | `0018 9000 6A` | `0018 5400 2E` | AB-M (MS-CAN) | Medium | Z10, T24 | Needs light/rain sensor. T24 (2017 CX-5): settings appeared but lamps and wipers stayed off; also changed 726-01-01 (values not posted) |
| M19 | Cruise type on cluster (none, standard, LIM, MRCC) | IC 720 | 720-04-23, plus 720-04-01 | B4 | bit 6 = with limiter (LIM); bit 5 = standard or MRCC; bit 4 = none | | | AB-M | Medium | Z10 (definition and Mazda2 2019 real change), Z11, T21 | Mazda2 example: `720-04-01 2CE7 0100 FF3F` to `2CF7 0100 FF4F`; `720-04-23 7700 BF09 119E` to `7700 BF09 21AE`. GJ cars normally have cruise; useful for adding LIM (Unconfirmed on GJ) |
| M20 | Digital cruise set speed on cluster | IC 720 | 720-01-02 | B1 | bit 7 | Z10: 0 = shown; Z11/T21: 1 = shown | | AB-M | Low | Z10, Z11, T21 | **Disagree on polarity** |
| M21 | Headlight levelling / AFS flags | IC 720 | 720-04-14, plus 720-04-01 | B1 | bit 5 = ALS fitted; bit 4 with bit 5 selects AFS | | | AB-M | Medium | Z10 | Hardware flags; wrong values set DTCs (my inference) |
| M22 | Dynamic reverse camera guide lines | IC 720 | 720-04-27, plus 720-04-01 | B2 | bit 3 | 1 | 0 | AB-M | Medium | Z10, T21 | CAN camera only |
| M23 | DRL source | FBCM 726 | 726-50-01 | B0 | 01 = parking lights, 02 = parking plus low beam, 08 = turn-signal lamps | | | AB-M | Low | Z11, T21 | miatafy only; T20: "EU models often ship with DRL mandatory and different baseline values". UK DRL is a legal requirement (my note) |
| M24 | DRL master enable | FBCM 726 | 726-01-01 | B0 | bit 2 (inverted) | 0 | 1 | AB-M | Low | Z11, T21 | miatafy only |
| M25 | Emergency Stop Signal (hazards flash under hard braking) | FBCM 726 | 726-01-02 | B0, B1, B3 | B0 bit 1, B1 bit 0, B3 bit 1, all three | 1 | 0 | AB-M | Low | Z11, T21 | miatafy only; it says ESS is standard on many European cars, so a UK GJ may already have it (Unconfirmed) |
| M26 | Fog lights stay on with high beam | FBCM 726 | 726-01-01 | B0, B3 | T21: B0 bit 1, B3 bit 1, B0 bit 7, B3 bit 6 "combined, shared with auto headlights and wipers"; Z11: "exact bit positions vary by vehicle" | | | AB-M | Low | Z11, T21 | Inconsistent; T27 (EU Mazda5) saw no fog change from 726-01-01 |
| M27 | Owner settings, no coding (auto lock mode, auto lock delay, lock/unlock beep volume High/Medium/Low/Off, interior light timers, auto light sensitivity 5 steps, headlights-off timer 120/90/60/30 s/Off, auto wipers on/off, rear demister continuous, ambient light brightness) | Mazda Connect / switches | n/a | n/a | as listed | | | Owner (or dealer) | Medium | T25 | Mazda: "Personalisation features and settings which can be changed differ depending on the market". Some need the M11 or M17 menu bits on cars where hidden |
| M28 | One-touch windows (all), one-touch indicators, auto-fold mirrors, Auto Hold default on (EPB) | RBCM 7B7, EPB | not given | | | | | AB-M | Unconfirmed | Z11, T20 | No byte published. Folding needs power-fold mirrors; T20: rare outside JDM/Australia. T20: 2016-2017 GJ facelift has EPB |
| M29 | Seat belt chime off | IC 720 | not given | | | | | AB-M or dealer | Unconfirmed | T27 | T27 (2011 Mazda5, not SkyActiv): FORScan IC shows driver and passenger belt reminder options. No GJ bit found |
| M30 | Needle sweep | IC 720 | n/a | n/a | not found | | | none | Unconfirmed | none | Only the M-MDS cluster self-test is documented (Mazda manual mirror, `mazda6-sources.md` Z1 site) |
| M31 | "Scandinavian" all-lights-on mode | FBCM 726 | 726-01-01 | 4th hex digit | "Fourth digit makes a difference": all lights on in OFF/AUTO vs off in OFF | | | AB-M | Low | T27, Z10 reply (Fin.Maikel) | EU 2011 Mazda5 (CR, not SkyActiv). Do not assume for the GJ |

Do not change PCM, ABS/DSC, airbag (737) or EPS lines (Z11, T20).

### 2.3 Mazda: what a pins 6/14 adapter can reach

- Reachable (HS-CAN per Z1): SSU 731 (M01 to M08), IC 720 (M03, M04, M19 to M22, M29), FBCM 726 (M23 to M26, M31). **Reachable is not implementable:** the Mazda as-built write commands are not public.
- Not reachable: RBCM 7B7 (M09 to M18, most of M28). T22 and T23 confirm RBCM needs MS-CAN.
- No coding at all: M27.

---

## 3. Counts

| Car | Rows | High | Medium | Low | Unconfirmed |
|---|---|---|---|---|---|
| Focus ST Mk3 | 36 (F01-F36) | 5 (F01, F03, F06, F27, F28) | 15 | 16 | 0 (F26 lists 19 named parameters with values Unconfirmed) |
| Mazda6 GJ | 31 (M01-M31) | 1 (M01) | 19 | 8 | 3 (M28, M29, M30) |

## 4. Gaps

1. No public byte numbers for Focus global opening/closing, belt minder values, lock-honk value that works, auto-lights options, mirror fold, puddle lamp. They exist as CC bytes (F26); a CC dump from the owner's car before and after a FORScan change would fill them.
2. No needle sweep on either car.
3. Focus CC writes need the Ford SBL; Mazda as-built write commands are unpublished. Neither car has a public, plain `2E` customisation path.
4. Mazda rows come from CX-5, Mazda3, Mazda2 and MX-5; only M01 (unconfirmed reply), M04 (2017 Mazda6 2.5) and M09 (feasibility) touch a Mazda6.
5. Mazda seat belt chime, one-touch windows, mirror fold, Auto Hold: no bits.
6. SergSlim's Mazda spreadsheet (T28) and the mazda3revolution 300-page thread were not readable; they are the most likely sources for more Mazda bits.
