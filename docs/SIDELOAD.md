# Put Caristini on your phone without a Mac

GitHub Actions builds both apps on every push to `main`. You get 2 files from each run:

- `Caristini-unsigned.ipa` for iPhone. Sideloadly on Windows signs it with your Apple ID and installs it.
- `app-release.apk` for Android. Open it on the phone to install.

Both are Release builds with the JavaScript inside, so they run without `npx expo start` on the PC.

The workflow is `.github/workflows/build-sideload.yml`. You can also start it by hand from the Actions tab (Run workflow).

## Route A: free Apple ID (try this first)

### 1. Commit and push (PC, once)

Wait until any other changes to `package.json` are finished. If `package.json` changed, run `npm install` so `package-lock.json` matches, otherwise `npm ci` fails in the build.

```bash
git status
git add -A
git commit -m "Add sideload build pipeline"
```

`git add -A` also adds `.claude/` (local Claude Code settings). Leave it out with `git restore --staged .claude` before committing if you want.

Optional: the local branch is called `master`. The workflow builds `main` and `master`, so this is only for tidiness:

```bash
git branch -m master main
```

The code is at https://github.com/Darkshadowgame/caristini-app. The iPhone app is built there on request (Actions > Build sideload apps > Run workflow) and attached to a release. A push runs the checks:

```bash
git push
```

### 2. Watch the build

```bash
gh run watch
```

Or open the repo on github.com > Actions > "Build sideload apps". The iOS job takes the longest.

### 3. Download the IPA

Open the finished run on github.com. Under **Artifacts**, download `Caristini-unsigned.ipa`. The workflow uploads it unzipped and keeps it for 7 days.

### 4. Install with Sideloadly (Windows)

1. Install Sideloadly from https://sideloadly.io/.
2. Sideloadly needs the web (non-Microsoft Store) versions of iTunes and iCloud. Uninstall the Microsoft Store versions first. Links are on the same page. Source: https://sideloadly.io/
3. Connect the iPhone by USB, unlock it and tap Trust if asked.
4. Open Sideloadly, drag in `Caristini-unsigned.ipa`, and type your Apple ID into Sideloadly yourself. Do not put your Apple ID password in this repo, a script or a chat.
5. Click Start.

### 4b. Install with Impactor (Bazzite or other Linux)

This is the route that worked on the owner's Bazzite PC on 11 Nov 2026.

1. Plug in the iPhone, unlock it and tap Trust.
2. Check usbmuxd sees it: `idevice_id -l` prints the phone's ID.
3. Open Impactor (Flatpak) after that, drop in `Caristini-unsigned.ipa`, and sign in with your Apple ID in Impactor yourself.
4. If Impactor does not list the phone: close Impactor, replug the phone, run `idevice_id -l` again, then reopen Impactor.
5. First launch on iOS 16 or later asks for Developer Mode: Settings > Privacy & Security > Developer Mode, turn on, restart, confirm.

### 5. Trust the app on the iPhone

1. Settings > General > VPN & Device Management. Tap the entry with your Apple ID and tap Trust. Source for the menu path: https://support.apple.com/en-us/118254
2. If iOS asks for Developer Mode: Settings > Privacy & Security > Developer Mode, turn it on, tap Restart, then confirm after the restart. Source: https://developer.apple.com/documentation/xcode/enabling-developer-mode-on-a-device

### Free Apple ID limits

From Apple (https://developer.apple.com/support/compare-memberships/), for a free account (Personal Team):

- Provisioning profiles expire 7 days after issue. After that the app will not open until you install it again.
- Up to 3 apps per device.
- Up to 3 devices and 10 App IDs, each expiring after 7 days.

Sideloadly says sideloaded apps from a free account are valid for 7 days, and its auto-refresh daemon can re-sign them before they expire. Source: https://sideloadly.io/

To refresh by hand: run Sideloadly again with the same IPA every 7 days.

### GitHub cost for private repos

From https://docs.github.com/en/billing/concepts/product-billing/github-actions (checked 10 Nov 2026):

- The Free plan includes USD 12 a month of Actions compute, expressed as money, not minutes.
- macOS 3-core or 4-core runner: USD 0.062 a minute. Linux 2-core: USD 0.006 a minute.
- Artifact storage on Free: 500 MB.
- Standard GitHub-hosted runners are free on public repos.

My arithmetic, not a GitHub figure: USD 12 / 0.062 is about 190 macOS minutes a month if nothing else uses the allowance. How long one iOS build takes on this project is not confirmed until the first run. To save minutes, pushes that only change `.md` files, `docs/` or `replica/` do not start a build, and a new push cancels a build still running.

## Route B: paid Apple Developer account (EAS)

Use this if the 7-day expiry gets in the way. It needs the Apple Developer Program (USD 99 a year per https://sideloadly.io/; Apple's own price page was not checked) and a free Expo account.

`eas.json` has 3 profiles:

| Profile | Use |
|---|---|
| `development` | Dev client. Needs `npx expo start --dev-client` on the PC |
| `preview` | Internal install, JS bundled. Android gives an APK |
| `production` | Store builds |

Steps:

```bash
npx eas-cli@latest login
npx eas-cli@latest device:create
npx eas-cli@latest build --platform ios --profile preview
```

- `device:create` gives a link. Open it on the iPhone to register it.
- On the first build, EAS asks to link the project (it adds a project ID to `app.json`) and asks you to sign in to your Apple account so it can create the ad hoc profile. Type these in yourself.
- When the build finishes, open the link or QR code on the iPhone to install.

Internal distribution on iOS uses ad hoc provisioning. Apple allows at most 100 iPhones a year per account, and a phone added later needs a new build. Source: https://docs.expo.dev/build/internal-distribution/

The Expo free plan's build allowance was not checked.

## Android

1. Open the finished run on github.com and download `app-release.apk` under **Artifacts**. Do this in the phone's browser, or download on the PC and copy it across by USB.
2. Open the file on the phone.
3. Android asks you to allow "Install unknown apps" for the browser or file manager you used. Allow it, go back and install. Source: https://developer.android.com/distribute/marketing-tools/alternative-distribution#unknown-sources

The APK is signed with the debug keystore from the Expo template (`signingConfig signingConfigs.debug` in `android/app/build.gradle`). That is fine for your own phone. It cannot go on the Play Store. Source: https://developer.android.com/studio/publish/app-signing

Android only installs an update over an existing app if both are signed with the same certificate (same source). If you switch between this APK and an EAS build, uninstall Caristini first.

The workflow builds for 64-bit ARM phones only (`arm64-v8a`). For an old 32-bit phone, remove `-PreactNativeArchitectures=arm64-v8a` from the workflow.

## Troubleshooting

**No Bluetooth prompt, or scan finds nothing (iPhone).** The first scan should show "Caristini uses Bluetooth to talk to your OBD2 adapter." If you tapped Don't Allow, go to Settings > Privacy & Security > Bluetooth and turn Caristini on. Source: https://support.apple.com/102267

**No Bluetooth prompt, or scan finds nothing (Android 12 or later).** Android asks for "Nearby devices". If you denied it, allow it in the app's permissions in Settings. Source: https://developer.android.com/develop/connectivity/bluetooth/bt-permissions

**The adapter must be Bluetooth LE.** Caristini talks to the adapter through `react-native-ble-plx`, a Bluetooth Low Energy library (its own package description). An adapter that only does classic Bluetooth (often sold as "SPP") will not appear in the scan, on iPhone or Android. On iPhone, apps reach other Bluetooth accessories through Apple's External Accessory framework, which is for MFi accessories. Source: https://developer.apple.com/documentation/externalaccessory

**App will not open after a week (iPhone, Route A).** The free profile has expired. Install the IPA again with Sideloadly.

**Sideloadly does not see the phone.** Check that the web versions of iTunes and iCloud are installed (not the Microsoft Store ones). Source: https://sideloadly.io/

**Build fails at `npm ci`.** `package.json` and `package-lock.json` do not match. Run `npm install` on the PC, commit both files, push.

**Build fails at "Check Xcode".** Expo SDK 58 needs Xcode 26.4 or later (https://docs.expo.dev/versions/v58.0.0/). The `macos-26` image had Xcode 26.6 as default on 2 Nov 2026 (https://github.com/actions/runner-images/blob/main/images/macos/macos-26-arm64-Readme.md). If the image changes, add a step that selects a newer Xcode.
