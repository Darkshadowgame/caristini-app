# Product

<!-- impeccable:product-schema 1 -->

## Platform

ios

## Users

the owner, a car owner who maintains his own cars, and the family and friends whose cars he checks. He usually uses the app sat in the driver's seat with the ignition on, phone in hand, often in poor light or at night. He sometimes hands the phone to the car's owner to show them a result, so results must read clearly to someone who is not technical.

## Product Purpose

Caristini replaces a paid Carista Pro subscription for the jobs the owner does: reading and clearing fault codes across every control module, checking live data when problem solving, resetting service reminders, and (later) changing hidden settings. Success is that the owner reaches for Caristini first and never misses Carista.

## Positioning

A personal, subscription-free car scanner that shows only what fits the connected car, explains every fault in plain English with likely causes and fixes, and states where each piece of data comes from (maker standard, ISO, or community source).

## Operating Context

- Hardware: a Carista Bluetooth LE OBD2 adapter (reports ELM327 v1.5) plugged into the car's OBD port.
- Cars: Audi A6 C7 2.0 TDI 2012 (main), Seat Leon II 2007, Ford Focus, Mazda6 2.2 diesel 2016.
- Reads take time: a full module scan or ECU read runs from about 10 seconds to over a minute, so waiting states are a large share of the experience.
- Installed by sideloading an unsigned build (Impactor on Linux); free Apple ID, re-signed every 7 days.

## Capabilities and Constraints

- Built: Bluetooth connection, VIN-based car detection, health check across up to 34 modules (UDS 19 02), clear per module and all (UDS 14), engine OBD2 codes, freeze frame, emissions readiness, ECU info with coding backup, 47 standard live values, community-sourced maker data, battery voltage, code library of 345 codes, service reset guides, service reset over the port (learned on the car or from a public source, with old values kept and put back if a step is refused), car diary, Your cars.
- Not built: coding writes (customisations). These need verified commands per car and a backup before any write.
- Expo SDK 58, React Native 0.88, Expo Router; also builds an Android APK, but the design language is iOS.
- Uses Material Community Icons today; no custom fonts loaded.

## Brand Commitments

- Name: Caristini (a play on Carista; fine for personal use, rename before any public release).
- Must not copy Carista's logo, colours, wording or look. the owner confirmed nothing else in the current look is fixed: colour, layout and tab structure can all change.
- Standing preference (11 Nov 2026): the owner wants "a more Apple or Carista style": native iOS conventions executed at the craft level of Apple's own apps and Carista, in Caristini's own colours and words.

## Evidence on Hand

- Screen recording of the first car test (11 Nov 2026) and its review: `replica/review-2026-11-11.md`.
- Module and data sources: `replica/uds-sources.md`.
- No photos or artwork of the owner's cars exist in the project.

## Product Principles

1. Show only what fits the connected car; hide what does not apply.
2. Every result is readable by a non-technical person at a glance, with the detail one tap away.
3. Never present a guess as fact: label sources and confidence.
4. Anything that changes the car asks first, says what it will do, and logs it.
5. Long reads always show progress and partial results.

## Accessibility & Inclusion

Used in a dark car interior at night and handed to non-technical people: high contrast, large readable type, generous touch targets, and support for iOS Dynamic Type and Reduce Motion.
