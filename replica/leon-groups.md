# Caristini: Leon 1P1 measuring block field names

Research note, 11 Nov 2026. Car: 2007 SEAT Leon Cupra 1P1, 2.0 TFSI 240 PS, 6-speed manual, PQ35. Companion to `leon-sources.md` (protocol, addresses, formula table). This note gives a plain-English name for each field of the measuring block groups that public sources document, so the app can label the values it already decodes from `21 <group>`.

Confidence key (same as the other notes):

- **High**: two or more independent public sources agree, and at least one is specific to the 2.0 TFSI MED9 (a real log from a 2.0 TFSI, APR's MED9 list or the Ross-Tech 2.0 TFSI wiki page).
- **Medium**: one 2.0 TFSI-specific source, or the generic VW standard layout confirmed in part by a 2.0 TFSI source, or the generic standard published in two copies that agree.
- **Low**: one source only, a different car or module generation, the generic standard with no 2.0 TFSI confirmation, or sources disagree on a field.
- **Conflict / Not found**: left out of the JSON.

Rules applied: field names are in our own words. No Ross-Tech label file (.lbl/.clb) content is used. One source (AW1) embeds a Ross-Tech label file in its appendix: that appendix was not used, only the guide's own text. Where a field is not documented it is shown as "not documented" and `null` in the JSON. Field meaning depends on ECU software; the formula byte still gives the true unit, so the app should show the unit from the formula and treat the name as a hint.

---

## Answer in brief

| Question | Answer | Confidence | Sources |
|---|---|---|---|
| Engine code of a 2007 Leon Cupra 1P1 | **BWJ**, 2.0 TFSI (EA113), 240 to 241 PS, 177 kW, 300 Nm. Used on the Cupra 1P1 from about Nov 2006 to May 2009. Not BWA (200 PS Leon FR) and not BYD (230 PS Golf GTI Edition 30 / Pirelli). The later 1P1 Cupra (2009 on) has CDLD; the Cupra R facelift has CDLA. | High | BT1, SC2, SC3, GA1 |
| Engine ECU | Bosch MED9.1, part family 1P0 907 115 (a real Leon log shows 1P0 907 115 C, component text "2.0l R4/4V TFSI"; Bosch lists 1P0 907 115 D as MED9.1). | Medium | SC1, BO1 |
| Gearbox | 6-speed manual **02Q**, codes KDU (2007 to 2008) and KPA (2008 to 2009), part 02Q 300 042D, listed as type M (manual). | Medium (forum posts, two posters agree) | SC2 |
| Gearbox control module on this car | **None.** Address 02 exists on the Leon 1P only with the DSG (02E) or the 09G automatic. A manual Leon has no gearbox module to talk to. | High | RT5, SC2 |
| Gearbox oil temperature sensor | **None found, and none expected.** No public source shows a temperature sensor on the 02Q or any VW manual gearbox of this generation; the only gearbox electrical part in the VW manual-gearbox procedures found is the reversing light switch F4. With no gearbox module there is also no ECU that could report a gearbox oil temperature. The "gearbox" field in the engine's and gateway's CAN status groups is for automatic gearboxes and reads 0 or blank on a manual. | Medium (absence of evidence; no positive source either way) | RT5, RT1 (group 125 footnote), WM2, WM3 |

Practical result for the app: do not offer a gearbox page or a gearbox temperature for this car.

---

## Engine 01 (MED9.1, BWJ)

Units: rpm = 1/min; °CA = degrees crank angle (VCDS shows "°KW"); load and duty cycles in %; pressures in mbar absolute unless noted. "Std" = the generic VW standard layout for petrol engines (RT1, AZ1).

### 001 to 020

| Group | Field 1 | Field 2 | Field 3 | Field 4 | Sources | Confidence |
|---|---|---|---|---|---|---|
| 001 | Engine speed (rpm) | Coolant temperature (°C) | Lambda control value (%) | Basic setting conditions, 8 binary digits (coolant above 80 °C, rpm below 2000, throttle closed, lambda control OK, idle switch, A/C off, catalyst warm, no fault stored) | RT1, AZ1, AP1 (field 1) | High |
| 002 | Engine speed (rpm) | Engine load (%) | Mean injection time (ms) | Intake air mass (g/s) | SC1 (Leon log), RT1, AZ1, AW1 (air mass in 002) | High |
| 003 | Engine speed (rpm) | Intake air mass (g/s) | Throttle valve angle (%) | Ignition timing (°CA; before or after TDC shown by the value text) | SC1 (Leon log), AP1, RT1, AZ1 | High |
| 004 | Engine speed (rpm) | Supply voltage (V) | Coolant temperature (°C) | Intake air temperature (°C) | RT1, AZ1, AW1 (coolant and voltage in 004) | High |
| 005 | Engine speed (rpm) | Engine load (%) | Vehicle speed (km/h) | Operating state, text (idle, part load, full load, overrun, acceleration enrichment) | RT1, AZ1, AW1 (speed in 005) | High |
| 006 | Engine speed (rpm) | Engine load (%) | Intake air temperature (°C) | Altitude correction (%) | RT1, AZ1 | Medium |
| 007 | Engine speed (rpm) | Engine load (%) | **Disagree**: coolant temperature (AZ1) or intake manifold pressure / air mass (RT1) | **Disagree**: direct-injection operating mode bits, homogeneous / stratified (AZ1) or brake booster pressure (RT1) | AZ1, RT1 | Low (fields 1, 2); fields 3, 4 Conflict |
| 008 | AZ1 (2.0 T-FSI list): vacant. RT1: brake vacuum pump group | | | | AZ1, RT1 | Conflict |
| 009 | Oil level (mm) | Oil level warning threshold (mm) | Fuel consumption signal (l) | Consumption equivalent | AZ1 only (extended service interval cars; needs an oil level sensor, see 134) | Low |
| 010 | Engine speed (rpm) | Engine load (%) | Throttle valve angle (%) | Ignition timing (°CA) | RT1, AZ1 | Medium |
| 011 | Engine speed (rpm) | Coolant temperature (°C) | Intake air temperature (°C) | Ignition timing (°CA) | RT1, AZ1, AW1 ("timing: MB 011"), AP1 (011-3 intake air temperature on non-turbo MED9) | High |
| 012 | AZ1 (2.0 T-FSI list): vacant. RT1: distributor / cam tooth position | | | | AZ1, RT1 | Conflict |
| 013 | Vacant in both | | | | RT1, AZ1 | Not found |
| 014 | Engine speed (rpm) | Engine load (%) | Misfire total (count) | Misfire detection status, text (active / disabled) | AP1 (014-3), RT1, AZ1 | High |
| 015 | Misfires cylinder 1 (count) | Misfires cylinder 2 (count) | Misfires cylinder 3 (count) | Misfire detection status, text | AP1 (015-1 to 015-3), RT1, AZ1, AW1 | High |
| 016 | Misfires cylinder 4 (count) | Cylinder 5 in the standard: not present on a 4-cylinder | Cylinder 6 in the standard: not present | Misfire detection status, text | AP1 (016-1), RT1, AZ1, AW1 | High (fields 1, 4) |
| 017 | Vacant (AZ1); cylinders 7 to 9 (RT1) | | | | AZ1, RT1 | Not found |
| 018 | Misfire window: lower rpm limit | Upper rpm limit | Lower load limit (%) | Upper load limit (%). All 0 if no misfire seen | AZ1, RT1 (RT1 repeats the rpm labels in fields 3, 4 but gives % units) | Medium |
| 019 | Vacant (AZ1) | | | | AZ1 | Not found |
| 020 | Knock retard cylinder 1 (°CA) | Knock retard cylinder 2 (°CA) | Knock retard cylinder 3 (°CA) | Knock retard cylinder 4 (°CA) | SC1 (Leon log), AP1, RT1, AZ1, AW1 | High |

### 031 to 034 (lambda)

| Group | Field 1 | Field 2 | Field 3 | Field 4 | Sources | Confidence |
|---|---|---|---|---|---|---|
| 031 | Lambda actual, wideband sensor bank 1 (no unit, 1.00 = stoichiometric; AFR = lambda × 14.7 per AW1) | Lambda specified, bank 1 | Not used | Not used | SC1 (Leon log), AP1, RT1, AZ1, AW1 | High |
| 032 | Lambda learned value at idle (%) | Lambda learned value at part load (%) | Not used | Not used | SC1 (Leon log), RT1, AZ1, AW1 ("fuel trims: MB 032") | High |
| 033 | Lambda control value (%) | Lambda sensor voltage (V) | Not used | Not used | RT1, AZ1 | Medium |
| 034 | Engine speed (rpm) | Exhaust / catalyst temperature (°C) | Sensor dynamic factor | Sensor ageing test result, text (basic setting only) | RT1, AZ1 | Medium |

### 090 to 099 (camshaft)

| Group | Field 1 | Field 2 | Field 3 | Field 4 | Sources | Confidence |
|---|---|---|---|---|---|---|
| 090 | RT1 gives 3 different layouts (intake on/off, exhaust on/off, exhaust continuous). Which applies to the BWJ: not documented | | | | RT1 | Not found |
| 091 | Engine speed (rpm) | Intake cam adjuster duty cycle (%) | Intake cam adjustment specified (°CA) | Intake cam adjustment actual (°CA) | RT1 (continuous intake bank 1 layout), AW2 (same layout on a MED9.1 3.2 V6 log), BR1 (BWA owner: specified about 28 °CA equals actual at idle; search excerpt only) | Medium |
| 092 | Same as 091 for bank 2. An inline 4 has one bank | | | | RT1, AW2 | Not applicable |
| 093 | Intake cam phase position, adaptation (°CA) | Bank 2 intake phase (not applicable) | Exhaust phase bank 1 (no exhaust cam adjuster documented for this engine) | Exhaust phase bank 2 (not applicable) | RT1 (continuous layout), AW2 (V6 log), BR1 (BWA: 093 showed a static phase value) | Medium (field 1) |
| 094 | Engine speed (rpm) | Intake cam phase position (°CA) | Cam adjustment test result bank 1, text | Test result bank 2, text (basic setting only) | RT1 only | Low |
| 095 to 098 | Intake manifold change-over, exhaust cam, snow flap, exhaust cam bank 2 in the standard. Not documented for the BWJ | | | | RT1 | Not found |
| 099 | Engine speed (rpm) | Coolant temperature (°C) | Lambda regulation (%) | Lambda regulation on / off, text | RT1 only (compatibility group) | Low |

### 101 to 106 (fuel)

The generic standard (RT1) and the 2.0 TFSI-specific sources disagree for 103 and 106. The TFSI sources win for the BWJ; the generic text is shown for reference.

| Group | Field 1 | Field 2 | Field 3 | Field 4 | Sources | Confidence |
|---|---|---|---|---|---|---|
| 101 | Engine speed (rpm) | Engine load (%) | Mean injection time (ms) | Intake air mass (g/s) | AP1 (101-3 "injection timing, median"), RT1 | Medium |
| 103 | Low-side fuel pressure, actual (mbar; spec 2800 to 7200 at idle) | In-tank fuel pump adaptation (%; spec -1000 to +1000) | Not documented | Not documented | RT2 (fields 1, 2), AP1 (103-1), VV1 (same structure, numbers masked). RT1 generic 103 (air-shrouded injectors) does not apply | High (field 1); Medium (field 2) |
| 104 | Engine temperature at start (°C) | Start adaptation factor 1 (%) | Start adaptation factor 2 (%) | Start adaptation factor 3 (%) | RT1 only | Low |
| 105 | Engine speed (rpm) | Engine load (%) | Coolant temperature (°C) | Cylinder shut-off on / off, text | RT1 only; not documented for this engine | Low |
| 106 | Not documented | **Disagree**: RT2 calls it actual fuel rail pressure but quotes a % range (35 to 55 % normal at idle, swings to 95 % suggest a failing in-tank pump); Audizine posters call 106-2 the in-tank (lift) pump duty cycle, below 70 % when healthy (AZ2, search excerpts only); AW1 lists "fuel rail pressure: MB 106" without a field | Not documented | Not documented | RT2, AZ2, AW1 | Low (field 2) |

### 110 to 120 (load and boost)

| Group | Field 1 | Field 2 | Field 3 | Field 4 | Sources | Confidence |
|---|---|---|---|---|---|---|
| 110 | Engine speed (rpm) | Coolant temperature (°C) | Mean injection time (ms) | Throttle valve angle (%) | RT1 only | Low |
| 111 | Boost control adaptation, rpm range 1 (%) | Range 2 (%) | Range 3 (%) | Range 4 (%) | RT1 only | Low |
| 112 | Exhaust gas temperature bank 1 (°C) | Enrichment factor for exhaust temperature protection, bank 1 (%) | Bank 2 temperature (not applicable) | Bank 2 enrichment (not applicable) | RT1. AW1 says 112 shows "the temperature at the front O2 sensor as well as projected EGT", which is not the same split | Low |
| 113 | Engine speed (rpm) | Engine load (%) | Throttle valve angle (%) | Air pressure (mbar; which pressure is not stated) | RT1 only | Low |
| 114 | Specified load, uncorrected (%) | Specified load, corrected (%) | Actual load (%) | Wastegate valve N75 duty cycle (%) | SC1 (Leon log), AP1 (114-1, 114-3, 114-4), RT1 | High |
| 115 | Engine speed (rpm) | Engine load (%) | Boost pressure specified (mbar absolute) | Boost pressure actual (mbar absolute; gauge boost = actual minus the engine-off reading, about 1000 mbar near sea level per AW1) | SC1 (Leon log), AP1, RT1, AW1 | High |
| 116 | Engine speed (rpm) | Boost correction factor, fuel (%) | Boost correction factor, coolant temperature (%) | Boost correction factor, intake air temperature (%) | RT1 only | Low |
| 117 | Engine speed (rpm) | Accelerator pedal position (%) | Throttle valve angle (%) | Boost pressure specified (mbar) | RT1 only | Low |
| 118 | Engine speed (rpm) | Intake air temperature (°C) | Wastegate valve N75 duty cycle (%) | Boost pressure actual, before the throttle (mbar) | SC1 (Leon log), RT1, AW1 (IAT and N75 duty in 118) | High |
| 119 | Engine speed (rpm) | Boost valve adaptation value (%) | Wastegate valve duty cycle (%) | Boost pressure before the throttle (mbar) | RT1 only | Low |
| 120 | Engine speed (rpm) | Torque requested by traction control (Nm) | Engine torque (Nm; calculated, not measured, per AW1) | Traction control intervention, text (active / not active) | RT1, AW1 ("torque: MB 120") | Medium |

### 130 to 140 (cooling and direct injection)

| Group | Field 1 | Field 2 | Field 3 | Field 4 | Sources | Confidence |
|---|---|---|---|---|---|---|
| 130 | Engine outlet coolant temperature (°C) | Radiator outlet coolant temperature (°C) | Thermostat duty cycle (%) | Test result, text (short trip) | RT1 only, for map-controlled cooling; not documented for the BWJ | Low |
| 131 | Engine outlet temperature (°C) | Engine outlet temperature specified (°C) | Radiator outlet temperature (°C) | Thermostat duty cycle (%) | RT1 only | Low |
| 132 | Radiator outlet temperature specified (°C) | Engine to radiator temperature difference (°C) | Heater pre-run potentiometer (%) | Cooling status, 8 binary digits | RT1 only | Low |
| 133 | Not documented | | | | RT1 | Not found |
| 134 | Oil temperature (°C) | Ambient temperature (°C) | Intake air temperature (°C) | Engine outlet coolant temperature (°C) | RT1, AW1 ("oil temperature: MB 134"), OB1 (one poster cites "channel 134 value 1"). **Caveat**: a Mk5 GTI (BWA) owner found no oil temperature sensor (OB1), and a forum reading of -60 °C means no sensor is fitted (search excerpt). Expect field 1 to be missing or a fixed default on this car until proven | Medium (fields); sensor presence Unconfirmed |
| 135 | Radiator outlet temperature specified (°C) | Coolant fan 1 duty cycle (%) | Coolant fan 2 duty cycle (%) | Fan test result, text | RT1 only | Low |
| 136 | Fan relay 1 on / off | Fan relay 2 on / off | Fan relay 3 on / off | Fan relay 4 on / off | RT1 only | Low |
| 137 | A/C on request, on / off | A/C compressor on / off | A/C high-pressure switch on / off, or refrigerant pressure (bar) | Fan request from A/C (%) | RT1 only | Low |
| 140 | Fuel pressure control valve duty cycle (%) | Rail pressure specified (bar) | Rail pressure actual, high side (bar; spec 25 to 110, rises with rpm) | Pressure control valve test result, text | RT2 (field 3), RT1 (all four), VV1 (masked) | High (field 3); Low (fields 1, 2, 4) |

### 200 to 240

| Group | Field 1 | Field 2 | Field 3 | Field 4 | Sources | Confidence |
|---|---|---|---|---|---|---|
| 230 | Rail pressure specified, high side (bar) | Rail pressure actual, high side (bar; spec 25 to 110) | Rail pressure deviation, specified minus actual (bar; max 5.0) | Not documented | RT2, SC1 (Leon log, same three labels), AP1 (230-1, 230-2), VV1 (masked) | High |
| 231 | A pressure (bar; which one is not stated in the log header) | A second pressure (bar; not stated) | Engine load (%) | Not documented | SC1 only (Leon log column headers) | Low |
| 200 to 229, 232 to 240 | No public source found | | | | | Not found |

Not in the requested ranges but documented in RT1: engine group 125 to 127 are CAN participant lists (gearbox field "automatic only").

---

## ABS 03 (MK60, 1K0 907 379)

| Group | Field 1 | Field 2 | Field 3 | Field 4 | Sources | Confidence |
|---|---|---|---|---|---|---|
| 001 | Wheel speed sensors (a forum poster graphs group 1 to check wheel speed sensors). Which wheel is in which field: not documented | | | | MK2 | Low (field order Unconfirmed; not in JSON) |
| 004 | Steering angle sensor G85 (°; -1.5 to +1.5 when straight after basic setting) | Lateral acceleration sensor G200 (m/s²; -1.5 to +1.5 at rest) | Not documented | Not documented | RT3, MK1 (G85 check in 03 group 004 field 1), MK2 (steering angle in ABS group 4) | High (field 1); Medium (field 2) |
| 005 | Brake pressure sensor 1 G201 (bar; -3.8 to +3.8 after basic setting) | Not documented | Not documented | Not documented | RT3 | Medium |
| 006 | Longitudinal acceleration sensor G251 (m/s²). Fitted only to four-wheel-drive or hill-hold cars, so probably absent on this Cupra | Not documented | Not documented | Not documented | RT3 | Medium |

Basic settings (not measuring blocks): 060 G85, 063 G200, 066 G201, 069 G251, 042 TPMS reset (RT3).

## Instrument cluster 17 (1P0 920 xxx)

No public source documents measuring blocks for a PQ35 (1K / 1P) cluster. RT6 lists adaptation channels only (009 odometer adaptation, 030 fuel gauge, 040 to 049 service). The only cluster group table found is for the Audi A2 (8Z) cluster, a different generation. Use it as a hint and check by unit: formula 36 (`0x24`) = km, 5 or 26 = °C.

| Group | Field 1 | Field 2 | Field 3 | Field 4 | Sources | Confidence |
|---|---|---|---|---|---|---|
| 001 | Vehicle speed (km/h) | Engine speed (rpm) | Oil pressure switch status, text | Time (h) | WM1 (A2 cluster) | Low |
| 002 | Odometer (km) | Fuel level (l) | Fuel sender resistance (ohm) | Outside temperature (°C) | WM1 (A2 cluster); `leon-sources.md` 4.3 notes a Golf IV cluster search snippet with odometer in 002-1 | Low |
| 003 | Coolant temperature (°C) | A2 1.2 TDI only items | | | WM1 | Low (field 1) |
| 050 | Odometer (km) | Engine speed (rpm) | Oil temperature (°C) | Coolant temperature (°C) | WM1 (A2 cluster) | Low |

## Climate control 08 (1K0 907 044)

Not found. RT7 (Golf 1K Climatronic, redirected from Leon 1P) lists only basic setting group 001 (flap calibration, about 40 s). Measuring block tables found were for Audi A4 Cabriolet and Audi forum cars, a different module family. No rows.

## Central electronics 09 (1K0 937 049)

Not found. RT9 (redirected from Leon 1P) lists adaptation channels 000 to 008 only. No public measuring block table found for 1K0 937 049. No rows.

## Airbag 15

No Leon or Golf 1K source found. One real readout from a Passat B6 (PQ46) airbag module 3C0 909 605 J gives igniter resistances in ohms; field order is taken from the order the poster listed them. The poster expected below about 3 ohms but 3.6 ohms set no fault.

| Group | Field 1 | Field 2 | Field 3 | Field 4 | Sources | Confidence |
|---|---|---|---|---|---|---|
| 021 | Driver front airbag stage 1 igniter resistance (ohm) | Passenger front airbag stage 1 igniter resistance (ohm) | Driver belt tensioner igniter resistance (ohm) | Passenger belt tensioner igniter resistance (ohm) | DS1 | Low |
| 022 | Rear belt tensioner igniters (poster had none fitted; layout not clear) | | | | DS1 | Not found |
| 027 | Driver head airbag igniter resistance (ohm) | Passenger head airbag igniter resistance (ohm) | Not documented | Not documented | DS1 | Low |
| 031 | Driver front airbag stage 2 igniter resistance (ohm) | Passenger front airbag stage 2 igniter resistance (ohm) | Not documented | Not documented | DS1 | Low |

## Steering assist 44 (1K0 909 144)

| Group | Field 1 | Field 2 | Field 3 | Field 4 | Sources | Confidence |
|---|---|---|---|---|---|---|
| 001 | Not documented | Steering torque sensor G269 (changes when the wheel is turned to each lock) | Not documented | Not documented | RT4 | Medium |
| 004 | Not documented | Terminal 15 (ignition) supply status, text ("Term. 15 ON") | Not documented | Not documented | RT4 | Medium |
| 007 | Steering angle (°; -1.5 to +1.5 when straight) | Not documented | Not documented | Not documented | RT4, MK1 (same wording, likely copied from RT4) | Medium |

Basic setting 060 is for G85 only on MK70 ABS cars; with MK60 (this car) G85 is set in 03 (RT4, MK1).

## Gateway 19 (1K0 907 530)

RT8 (Golf 1K gateway) documents coding only. The only gateway group table found is for the Skoda Fabia Mk1 gateway (PQ24, a different module). Each field is a text status: "1" = data bus connection OK, "0" = not OK; units not fitted are not shown (WM2).

| Group | Field 1 | Field 2 | Field 3 | Field 4 | Sources | Confidence |
|---|---|---|---|---|---|---|
| 125 | Engine on drive bus | Gearbox on drive bus (manual car: 0 or blank) | ABS on drive bus | Instrument cluster on drive bus | WM2 | Low |
| 126 | Steering angle sensor on bus | Airbag on bus | Power steering on bus | "D pump" on bus (abbreviation not explained) | WM2 | Low |
| 127 | "El. CU" on bus (not explained) | Four-wheel drive on bus | Distance control on bus | Climate control on bus | WM2 | Low |
| 130 | Comfort bus wiring mode, text (two-wire OK / single-wire fault) | Comfort central unit on bus | Driver door on bus | Passenger door on bus | WM2 | Low |
| 131 | Rear left door on bus | Rear right door on bus | Memory unit on bus | Not assigned | WM2 | Low |
| 132 | Instrument cluster on bus | Steering wheel module on bus | Climate control on bus | Tyre pressure unit on bus | WM2 | Low |
| 140 | Radio on bus | Navigation on bus | Telephone on bus | Not assigned | WM2 | Low |

---

## Sources

| ID | Source | URL | Notes |
|---|---|---|---|
| RT1 | Ross-Tech, "Volkswagen/Audi 'Standardized' Measuring Block Groups for Gasoline Engines" (pages 001-009 to 160-169) | https://www.ross-tech.com/vag-com/m_blocks/ | Public reference pages, not label files. Ross-Tech: use "as a general guide for engines starting about 1999-2000" where specific data is missing. Read 11 Nov 2026 |
| RT2 | Ross-Tech wiki, "2.0l TFSI (AXX/BGB/BPJ/BPY/BWA)" | https://wiki.ross-tech.com/wiki/index.php/2.0l_TFSI_(AXX/BGB/BPJ/BPY/BWA) | Groups 103, 106, 140, 230 with specs. BWJ not named (same EA113 TFSI family) |
| RT3 | Ross-Tech wiki, "Seat Leon (1P) Brake Electronics (MK60)" (same text on "VW Golf (1K) Brake Electronics (MK60)") | https://wiki.ross-tech.com/wiki/index.php/Seat_Leon_(1P)_Brake_Electronics_(MK60) | Groups 004, 005, 006; basic settings 042, 060, 063, 066, 069 |
| RT4 | Ross-Tech wiki, "VW Golf (1K) Steering Assist" (linked from the Leon 1P page for address 44) | https://wiki.ross-tech.com/wiki/index.php/VW_Golf_(1K)_Steering_Assist | Groups 001, 004, 007 |
| RT5 | Ross-Tech wiki, "Seat Leon (1P)" module list | https://wiki.ross-tech.com/wiki/index.php/Seat_Leon_(1P) | 02 listed only as DSG 02E and 09G automatic |
| RT6 | Ross-Tech wiki, "VW Golf (1K) Instrument Cluster" (Leon 1P cluster redirects here) | https://wiki.ross-tech.com/wiki/index.php/VW_Golf_(1K)_Instrument_Cluster | Adaptation and coding only; no measuring blocks |
| RT7 | Ross-Tech wiki, "VW Golf (1K) Climatronic" (redirect from Seat Leon (1P) Climatronic) | https://wiki.ross-tech.com/wiki/index.php/Seat_Leon_(1P)_Climatronic | Basic setting 001 only |
| RT8 | Ross-Tech wiki, "VW Golf (1K) CAN-Gateway" | https://wiki.ross-tech.com/wiki/index.php/VW_Golf_(1K)_CAN-Gateway | Coding only |
| RT9 | Ross-Tech wiki, Seat Leon (1P) Central Electronics (redirect) | https://wiki.ross-tech.com/wiki/index.php/Seat_Leon_(1P)_Central_Electronics | Adaptation 000 to 008 only |
| AP1 | APR, "VAG-COM/VCDS Logging", section "an MED 9 ECU found in the 2.0 TFSI" | https://www.goapr.com/support/vcds_logging/ | Live site behind Cloudflare and HTTP 403; read from the Wayback Machine copy of 6 Aug 2021 (`web.archive.org/web/20210806000833/...`). Group-field list only, no units |
| SC1 | SeatCupra.net, "N75 logs , any good?", robdf2, 3 to 9 Mar 2010 | https://www.seatcupra.net/forums/threads/n75-logs-any-good.257702/ | Real VCDS log headers from ECU 1P0 907 115 C, "2.0l R4/4V TFSI" (a Leon 1P ECU): groups 002, 003, 020, 031, 032, 114, 115, 118, 230, 231 |
| SC2 | SeatCupra.net, "Cupra gearbox code anyone?", Invisible (23 Mar 2010), Tiburon (23 Sep 2013), Tomaso (6 Aug 2017) | https://www.seatcupra.net/forums/threads/cupra-gearbox-code-anyone.260839/ | BWJ with 02Q KDU / KPA, "Type - M"; CDLD KZW; CDLA LMN |
| SC3 | SeatCupra.net, "Differences between the 2.0tfsi engines BWA, BWJ and BHZ", Dec 2008 to Jan 2009 | https://www.seatcupra.net/forums/goto/post?id=2190004 | iSot quotes the SEAT press pack: the Cupra's 240 PS engine is based on the FR's 200 PS engine |
| AZ1 | Audizine, "VCDS Vag-Com Measuring Blocks Map, with greater detail" (2013), reposting a vwaudiforum.co.uk B7 thread: "Unified measured value blocks - petrol engines, 2.0L T-FSI version 1.24" | https://audizine.com/forum/showthread.php/589172-VCDS-Vag-Com-Measuring-Blocks-Map-with-greater-detail | Live site behind Cloudflare; read from the Wayback copy of 16 Dec 2014. Groups 001 to 088; the post is cut off at 088. Same VW standard as RT1, so not counted as independent of RT1 |
| AZ2 | Audizine threads on in-tank pump duty in 106-2 (e.g. "LPFP (in-tank fuel pump) failure info", "P0088 error") | https://audizine.com/forum/showthread.php/518972-LPFP-(in-tank-fuel-pump)-failure-info | Seen as search-result excerpts only (site and archive blocked). Low |
| AW1 | "Instructions for Logging Using the Vag-Com", PDF attached on AudiWorld, 26 Jul 2010, author not stated, for the 2.0T FSI (MED9.1) | https://www.audiworld.com/forums/attachment.php?attachmentid=10990&d=1280163892&download=1 | Only the guide's own text was used. Its Appendix C reproduces a Ross-Tech label file: **not used** |
| AW2 | AudiWorld, "question about value meas block group 91 92 93", life4sk8, 16 Sep 2013, Audi A6 3.2 (4F2 910 559 B) | https://www.audiworld.com/forums/a6-s6-c6-platform-discussion-58/question-about-value-meas-block-group-91-92-93-a-2853943/ | Real readout of 091, 092, 093 on a MED9.1 V6: different engine, same ECU family |
| BR1 | Briskoda, linksrechts6062, Octavia vRS (BWA) cam adjustment posts | https://www.briskoda.net/forums/profile/237054-linksrechts6062/content/ | HTTP 403; search-result excerpt only. Low |
| OB1 | OBDeleven forum, "Oil temperature", thread 3518, Apr 2018 to Mar 2020 | https://forum.obdeleven.com/thread/3518/oil-temperature | As `leon-sources.md` O1 |
| VV1 | vis4vag, "2.0 TFSI AXX BGB BPJ BWA / Test of fuel pressure" | https://diagnostics.vis4vag.com/en/engines/petrol/2-0-tfsi-axx-bgb-bpj-bwa/test-of-fuel-pressure | Demo mode: group and field numbers masked. Confirms only the field structure of 103 / 140 / 230 |
| MK1 | mk5golfgti.co.uk, "Problem with G85 / clock spring after MFSW retrofit", r5gtt and v4rley, 8 Jun 2016 | https://www.mk5golfgti.co.uk/forum/index.php/topic,107308.0/wap2.html | 03 group 004 field 1 and 44 group 007 field 1 |
| MK2 | mk5golfgti.co.uk, "Unable to complete Steering Limit Stop Adaption", jason_rmh, 23 Feb 2017 | https://www.mk5golfgti.co.uk/forum/index.php/topic,111188.0/wap2.html | ABS group 4 steering angle; "log group 1" for wheel speed sensors |
| WM1 | workshop-manuals.com, Audi A2, dash panel insert self-diagnosis, "Reading measured value block" | https://workshop-manuals.com/audi/a2/vehicle_electrics/electrical_system_self-diagnosis/self_diagnosis_v.a.g_inspection_service/dash_panel_insert_self-diagnosis/reading_measured_value_block/ | Cluster groups 001 to 004, 010 to 016, 050, 125, 126, 130, 140. Different cluster generation |
| WM2 | workshop-manuals.com, Skoda Fabia Mk1, self-diagnosis of the gateway, "List of display groups" | https://workshop-manuals.com/skoda/fabia-mk1/vehicle_electrics/electrical_system/instruments_gci/self-diagnosis_of_the_gateway/reading_measured_value_block/list_of_display_groups/ | Gateway groups 125 to 132, 140. Different gateway |
| WM3 | workshop-manuals.com, Seat Leon Mk1 6-speed manual gearbox 01X, "Reversing light switch -F4-, installing and removing" | https://workshop-manuals.com/seat/leon-mk1/6-speed_manual_gearbox_01x/gearbox_mechanicsoperation_constructiondiff./selector_unit/reversing_light_switchf4__installing_and_removing/ | Seen as a search result: F4 is the gearbox electrical item in VW manual gearbox procedures. No 02Q page found |
| DS1 | Dieselschrauber community, Phaidros, 26 Jan 2018, Passat B6 airbag 3C0 909 605 J | https://community.dieselschrauber.org/en/viewtopic.php?p=240213 | Real readout of airbag groups 021, 022, 025, 027, 031 |
| BT1 | Bar-Tek, "2.0l TFSI engine codes" | https://bar-tek.com/2.0l-tfsi-engine-codes | BWJ 241 PS León Cupra; BWA León 1P; BYD Golf GTI Edition 30 / Pirelli |
| GA1 | Gerrits Automotive, Seat Leon engine management computer listing | https://gerritsautomotive.nl/en/part/seat/leon/engine+management+computer/20356294 | Search excerpt only: BWJ, 2.0 TFSI Cupra, 177 kW, 1P1, 2006-11 to 2009-05 |
| BO1 | Bosch Electronic Service, MED9.1 0261S02289 | https://www.bosch-repair-service.com/en/engine-control-unit/bosch/med9-1-0261s02289001/ | Search excerpt only: vehicle number 1P0 907 115 D, MED9.1 |

Not usable on 11 Nov 2026: goapr.com and audizine.com live (Cloudflare), briskoda.net (403), manuals.autorepairshq.com (connection refused), archive.org (rate-limited after a few reads), scribd.com (document body not served).

---

## Open items

1. Read groups 001 to 255 on the car with a unit-only scan and compare with the names above. Anything that disagrees: trust the car.
2. 106 field 2: duty cycle or pressure. Check on the car: a value in % between 35 and 70 at warm idle fits the pump duty reading.
3. 134 field 1: does the BWJ have an oil temperature sensor? A constant or -40 to -60 °C value means no.
4. Cluster 17 groups for odometer and fuel level on the 1P0 920 cluster: confirm by formula 36 (km).
5. ABS 001 field order for the four wheel speeds: drive and compare left and right in a turn.
6. 08, 09: no public field names. Leave unlabelled; show unit only.

---

## JSON (Low confidence or better; `null` = not documented)

```json
{
  "01": {
    "001": ["Engine speed", "Coolant temperature", "Lambda control value", "Basic setting conditions"],
    "002": ["Engine speed", "Engine load", "Mean injection time", "Intake air mass"],
    "003": ["Engine speed", "Intake air mass", "Throttle valve angle", "Ignition timing"],
    "004": ["Engine speed", "Supply voltage", "Coolant temperature", "Intake air temperature"],
    "005": ["Engine speed", "Engine load", "Vehicle speed", "Operating state"],
    "006": ["Engine speed", "Engine load", "Intake air temperature", "Altitude correction"],
    "007": ["Engine speed", "Engine load", null, null],
    "009": ["Oil level", "Oil level warning threshold", "Fuel consumption signal", "Consumption equivalent"],
    "010": ["Engine speed", "Engine load", "Throttle valve angle", "Ignition timing"],
    "011": ["Engine speed", "Coolant temperature", "Intake air temperature", "Ignition timing"],
    "014": ["Engine speed", "Engine load", "Misfire total", "Misfire detection status"],
    "015": ["Misfires cylinder 1", "Misfires cylinder 2", "Misfires cylinder 3", "Misfire detection status"],
    "016": ["Misfires cylinder 4", null, null, "Misfire detection status"],
    "018": ["Misfire window lower rpm", "Misfire window upper rpm", "Misfire window lower load", "Misfire window upper load"],
    "020": ["Knock retard cylinder 1", "Knock retard cylinder 2", "Knock retard cylinder 3", "Knock retard cylinder 4"],
    "031": ["Lambda actual", "Lambda specified", null, null],
    "032": ["Lambda learned value idle", "Lambda learned value part load", null, null],
    "033": ["Lambda control value", "Lambda sensor voltage", null, null],
    "034": ["Engine speed", "Exhaust or catalyst temperature", "Lambda sensor dynamic factor", "Lambda ageing test result"],
    "091": ["Engine speed", "Intake cam adjuster duty cycle", "Intake cam adjustment specified", "Intake cam adjustment actual"],
    "093": ["Intake cam phase position", null, null, null],
    "094": ["Engine speed", "Intake cam phase position", "Cam test result bank 1", "Cam test result bank 2"],
    "099": ["Engine speed", "Coolant temperature", "Lambda regulation", "Lambda regulation on/off"],
    "101": ["Engine speed", "Engine load", "Mean injection time", "Intake air mass"],
    "103": ["Low-side fuel pressure", "In-tank fuel pump adaptation", null, null],
    "104": ["Engine temperature at start", "Start adaptation factor 1", "Start adaptation factor 2", "Start adaptation factor 3"],
    "105": ["Engine speed", "Engine load", "Coolant temperature", "Cylinder shut-off"],
    "106": [null, "Fuel pump demand or rail pressure (sources differ)", null, null],
    "110": ["Engine speed", "Coolant temperature", "Mean injection time", "Throttle valve angle"],
    "111": ["Boost adaptation rpm range 1", "Boost adaptation rpm range 2", "Boost adaptation rpm range 3", "Boost adaptation rpm range 4"],
    "112": ["Exhaust gas temperature", "Exhaust temperature enrichment factor", null, null],
    "113": ["Engine speed", "Engine load", "Throttle valve angle", "Air pressure"],
    "114": ["Specified load", "Specified load corrected", "Actual load", "Wastegate N75 duty cycle"],
    "115": ["Engine speed", "Engine load", "Boost requested", "Boost actual"],
    "116": ["Engine speed", "Boost correction fuel", "Boost correction coolant temperature", "Boost correction intake air temperature"],
    "117": ["Engine speed", "Accelerator pedal position", "Throttle valve angle", "Boost requested"],
    "118": ["Engine speed", "Intake air temperature", "Wastegate N75 duty cycle", "Boost actual"],
    "119": ["Engine speed", "Boost valve adaptation", "Wastegate duty cycle", "Boost actual"],
    "120": ["Engine speed", "Traction control torque request", "Engine torque", "Traction control status"],
    "130": ["Engine outlet coolant temperature", "Radiator outlet coolant temperature", "Thermostat duty cycle", "Cooling test result"],
    "131": ["Engine outlet coolant temperature", "Engine outlet temperature specified", "Radiator outlet coolant temperature", "Thermostat duty cycle"],
    "132": ["Radiator outlet temperature specified", "Engine to radiator temperature difference", "Heater pre-run potentiometer", "Cooling status bits"],
    "134": ["Oil temperature", "Ambient temperature", "Intake air temperature", "Engine outlet coolant temperature"],
    "135": ["Radiator outlet temperature specified", "Coolant fan 1 duty cycle", "Coolant fan 2 duty cycle", "Fan test result"],
    "136": ["Fan relay 1", "Fan relay 2", "Fan relay 3", "Fan relay 4"],
    "137": ["A/C on request", "A/C compressor", "A/C pressure or high-pressure switch", "Fan request from A/C"],
    "140": ["Fuel pressure control valve duty cycle", "Rail pressure specified", "Rail pressure actual", "Pressure control test result"],
    "230": ["Rail pressure specified", "Rail pressure actual", "Rail pressure deviation", null],
    "231": ["Pressure (not specified)", "Pressure (not specified)", "Engine load", null]
  },
  "03": {
    "004": ["Steering angle G85", "Lateral acceleration G200", null, null],
    "005": ["Brake pressure G201", null, null, null],
    "006": ["Longitudinal acceleration G251", null, null, null]
  },
  "15": {
    "021": ["Driver airbag stage 1 resistance", "Passenger airbag stage 1 resistance", "Driver belt tensioner resistance", "Passenger belt tensioner resistance"],
    "027": ["Driver head airbag resistance", "Passenger head airbag resistance", null, null],
    "031": ["Driver airbag stage 2 resistance", "Passenger airbag stage 2 resistance", null, null]
  },
  "17": {
    "001": ["Vehicle speed", "Engine speed", "Oil pressure switch", "Time"],
    "002": ["Odometer", "Fuel level", "Fuel sender resistance", "Outside temperature"],
    "003": ["Coolant temperature", null, null, null],
    "050": ["Odometer", "Engine speed", "Oil temperature", "Coolant temperature"]
  },
  "19": {
    "125": ["Engine on bus", "Gearbox on bus", "ABS on bus", "Instrument cluster on bus"],
    "126": ["Steering angle sensor on bus", "Airbag on bus", "Power steering on bus", "D pump on bus"],
    "127": ["El. CU on bus", "Four-wheel drive on bus", "Distance control on bus", "Climate control on bus"],
    "130": ["Comfort bus wiring mode", "Comfort unit on bus", "Driver door on bus", "Passenger door on bus"],
    "131": ["Rear left door on bus", "Rear right door on bus", "Memory unit on bus", null],
    "132": ["Instrument cluster on bus", "Steering wheel module on bus", "Climate control on bus", "Tyre pressure unit on bus"],
    "140": ["Radio on bus", "Navigation on bus", "Telephone on bus", null]
  },
  "44": {
    "001": [null, "Steering torque G269", null, null],
    "004": [null, "Terminal 15 supply", null, null],
    "007": ["Steering angle", null, null, null]
  }
}
```

Modules 08 and 09: no documented groups, so no entries.
