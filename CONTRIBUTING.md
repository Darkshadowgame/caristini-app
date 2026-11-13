# Contributing to Caristini

Caristini is a hobby project. Help is welcome, in small pieces.

## What helps most

- **A car's findings.** Which modules answer, which sensors a car reports, and settings whose coding bit you have confirmed on your own car.
- **Sources.** A public page that states a coding byte and bit, a part number or a service figure. Every fact in the app carries its source.
- **Fixes.** Bugs, wording, and support for another adapter or protocol.

## Rules

- **Public sources only.** Cite the page. Do not paste maker files, Ross-Tech label files or anything from a paid tool.
- **No personal data.** Never include a full VIN, a registration, a name, a module serial number or a raw adapter log. Mask the last 5 characters of a VIN as `00000`.
- **A wrong coding bit can stop a module working.** A setting goes in as "unconfirmed" until 2 independent sources agree or it is confirmed on a real car. The app always backs up, reads back and restores.
- **Never the safety systems.** No settings for airbags, seat belts, brakes, steering or emissions.
- British English, digits for numbers, short and direct.

## How

1. Open an issue describing the car (make, model, year, platform, engine code) and what you found, or a pull request.
2. Pull requests are type-checked and tested automatically (`npm test`, `npx tsc --noEmit`).
3. Settings live in `src/coding/`, research notes with sources in `replica/`, and generated data comes from the scripts in `scripts/`.

## What the app sends, and where

Nothing leaves the phone unless the owner pastes their own upload token in Settings. With a token, findings and adapter logs go to that owner's own private store. No key or token is built into the app.
