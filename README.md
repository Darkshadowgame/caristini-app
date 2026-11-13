# Caristini

A free DIY OBD2 car scanner and coding app for VW group cars (VW, Audi, SEAT, Cupra, Skoda), Ford and Mazda, inspired by Carista. Not affiliated with Carista. Built with Expo for iPhone (Android builds are possible too) and a Bluetooth LE ELM327-type adapter.

A hobby project for the owner's own cars, shared as it is. Use it at your own risk: coding changes can stop modules working. Caristini backs up a module's coding before every change, reads it back and puts the original back if anything fails, but test on your own car with care.

## What it does

- Reads the car's VIN (or asks the engine and dashboard for it on older cars) and shows only the tools that fit.
- Health check: fault codes from every module it can reach (UDS and the older VW TP2.0 protocol), with plain meanings, and clears them.
- Live data and maker sensors (lists from the OBDb project, CC BY-SA 4.0), with a quick scan that reuses what other cars of the same make found.
- Customise: coding settings documented in public sources, each with its sources and confidence, plus Try mode for unconfirmed ones.
- Discover and Learn my car: sweep a module for values no list knows, and (with your own Claude API key) have AI research what they are.
- Built-in reference for some cars: part numbers, fluids, service schedule, known faults, every line with its public source.
- Service reminders, history, diary, PDF health report.

## Run it on a PC

```bash
npm ci
```

```bash
npm run web
```

Open http://localhost:8081 and pick a demo car. Bluetooth does not work in a browser.

## Test

```bash
npm test
```

```bash
npx tsc --noEmit
```

## Phone

Over-the-air updates go out through EAS Update, published by the maintainer. The iPhone app (unsigned IPA, signed at install by a sideloading tool) is built on request from the "Build sideload apps" workflow; see [docs/SIDELOAD.md](docs/SIDELOAD.md).

## Layout

| Path | What |
|---|---|
| `src/app/` | Screens (Expo Router) |
| `src/obd/` | ELM327 client, UDS and TP2.0, module routes, sensors, demo cars |
| `src/coding/` | Coding settings and how they are written and checked |
| `src/data/` | Fault meanings, sensor lists, car packs |
| `src/vehicle/` | VIN decoding and the saved garage |
| `src/ai/` | Optional Claude research (owner's own API key) |
| `replica/` | Research notes with sources |
| `scripts/` | Generators for the built-in data |

## Sources and licences

Facts come from public pages, each cited where it is used. Sensor definitions: OBDb, CC BY-SA 4.0. No Carista, Ross-Tech or OEM files are included.
