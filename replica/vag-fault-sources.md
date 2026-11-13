# Caristini: VAG 5-digit fault number meanings, sources

Research note, 12 Nov 2026. Feeds `src/data/vagFaults.ts` (`VAG_FAULTS`, `vagFaultText()`). Scope: 5-digit decimal fault numbers reported by KW1281 and KWP2000 (TP2.0) modules, for example the 2007 SEAT Leon 1P and the 09/46/42/52 body modules of the 2012 Audi A6 C7.

## Result

- 2946 entries, keys are 5-digit strings.
- 850 in 00000 to 15999 (component, body, comfort, climate, CAN, gearbox, ABS): 00xxx 414, 01xxx 332, 02xxx 78, 03xxx 23, 04xxx 1.
- 2094 in 16384 to 19999 (engine, SAE P-code equivalents): 16xxx 383, 17xxx 747, 18xxx 553, 19xxx 413.
- 2 generic: 65280, 65535.
- 1301 entries are listed by 2 or more sources; 1645 by 1 source only.
- Meanings are our own short wording: British English, sentence case, at most 70 characters, no em dashes. A script rewrote each source label (for example "short to ground" to "short to earth", "Transmission" to "gearbox", "Sender" to "sensor", "Sensor for X" to "X sensor") and cut it at a clause boundary. Engine-range meanings start with the P-code.
- The table names the component or function. The fault type (open circuit, no signal, implausible signal) comes from the status byte and is shown separately.

## Sources

| Key | Source | URL | Codes listed | Used as primary |
|---|---|---|---|---|
| RT | Ross-Tech wiki, Category:Fault Codes, 1000 pages read through the MediaWiki API; page heading only (code and component), no label files | https://wiki.ross-tech.com/wiki/index.php/Category:Fault_Codes | 834 | 830 |
| VC | vag-coding.net, "Fault codes" (16xxx to 19xxx with P-codes; English is machine-translated, for example "Series 1" for bank 1) | https://www.vag-coding.net/tutorials-information/fault-codes | 2041 | 996 |
| TD | Bentley Publishers VW DTC table (PDF hosted by TDIClub) | https://pics.tdiclub.com/data/500/7938dtc.pdf | 774 | 516 |
| BA | Bentley Publishers Audi DTC table (PDF hosted by VAGLinks) | https://VAGLinks.com/Docs/Audi/BentleyPublishers.com_Audi_DTC_Table.pdf | 774 | 0 (same text as TD) |
| CA | Carnity forum, "Audi Fault Codes (VAG and SAE OBD II)", May 2012 | https://carnity.com/forums/topic/250-audi-fault-codes-vag-and-sae-obd-ii/ | 696 | 336 |
| ME | mechanicalee blog, "Volkswagen Audi Skoda VAG fault codes engine", Mar 2013 | https://mechanicalee.blogspot.com/2013/03/volkswagen-audi-skoda-vag-fault-codes-engine.html | 869 | 232 |
| VB | orviwan/vibesODB2 (MIT), `pwa/data/dtcs.json`, titles only | https://github.com/orviwan/vibesODB2 | 98 | 28 |
| UD | AristarhUcolov/universal-diagnostic-tool (AGPL-3.0), `internal/dtc/data/vag.dtc`, English column only | https://github.com/AristarhUcolov/universal-diagnostic-tool | 23 | 8 |

Source priority per code: 16384 to 19999: RT, TD, BA, CA, ME, VC. All others: RT, VB, UD, ME, CA. CA rows that carry a P-code in the 00xxx range (old gearbox variants, for example 4 rows for 00297) were skipped when another source had the code.

Checked and not used: Snap-on "VAG CodeCharts US" PDF (readiness charts, no fault list), brightcoding VAG page (P-codes only), mvwautotechniek.nl (no 5-digit list), akk.org "Fehlercodes VAG english" PDF (404), Scribd copies (not readable without login), lowdown1983/m2-oem-database `dtc-vw.md` (P-code focused, no licence).

## P-code rule

| Range | Rule seen in the sources | Pairs checked | Stated by a source? |
|---|---|---|---|
| P0000 to P0999 | VAG = 16384 + nnn (16684 = P0300) | 1000+ across RT, VC, TD, BA, CA | No, but the task brief gives it; used by `vagFaultText()` for 16384 to 17383 when not in the table, as "Engine: P0nnn" |
| P1nnn | VAG = 17408 + nnn (17978 = P1570, 18010 = P1602) | 2700+ | No. Not used to derive text |
| P2nnn | VAG = 18432 + nnn | 216 | No. Not used |
| P3nnn | VAG = 19456 + nnn | 355 | No. Not used |

My inference: all 4 rows are one rule, VAG = 16384 + 1024 x d + nnn for Pdnnn. No public page states it, so P1 to P3 codes appear only where a source lists them.

55 source rows gave a P-code that breaks the rule and were dropped for that code: VC 45, RT 3, TD 2, BA 2, ME 2, CA 1. Example: 16395 is P0011 in RT and VC, P0020 in TD and BA; the table uses P0011.

## Gaps

- 00471 and 02123 (named by the owner) are in none of the sources. `vagFaultText()` returns undefined for them; the app keeps "VW fault 00471".
- 00256 comes from VB only (A/C pressure/temperature sensor G395). An Audi TSB filed with NHTSA links 00256 to G395: https://static.nhtsa.gov/odi/tsbs/2024/MC-10254006-0001.pdf
- Coverage of the 00xxx to 03xxx body range is about 850 numbers; newer comfort, climate and CAN codes (02xxx, 03xxx) are thin. The Ross-Tech wiki is the only open source found with a wide body range.
- Some codes were reused for different parts across model years (for example 00297 in old gearbox lists). The table holds one meaning per number.
- VC-sourced meanings (996) keep some odd wording from machine translation.

## Rebuild

Scripts and downloads are in the session scratchpad, not in the repo: `collect.py` (parse all sources to one JSON), `build.py` (pick, rewrite, cut), `emit.py` (write the TS file). `npx tsc --noEmit -p .` passes.
