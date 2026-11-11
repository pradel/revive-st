# @revive-st/app

## 0.0.7

### Patch Changes

- Settings links to the terms of service. ([`3fce6d7`](https://github.com/pradel/revive-st/commit/3fce6d785313f20d3657684867c1f375b27ce0b5))

- Internet radio setup stops waiting on a server that doesn't answer, and stays on the server it started with when you pick another one meanwhile. ([#133](https://github.com/pradel/revive-st/pull/133))

- The app's logs keep problems that happen right at launch. ([#135](https://github.com/pradel/revive-st/pull/135))

- Starring stations quickly keeps every favorite, and never lists a station twice. ([#137](https://github.com/pradel/revive-st/pull/137))

- A speaker that drops off the network shows as offline, and online again when it's back. ([#134](https://github.com/pradel/revive-st/pull/134))

## 0.0.6

### Patch Changes

- The Android APK from GitHub tells you in Settings when a newer version is available, and opens its GitHub release page to download it. ([#131](https://github.com/pradel/revive-st/pull/131))

- Settings links to what's new in each release of the app. ([#129](https://github.com/pradel/revive-st/pull/129))

## 0.0.5

### Patch Changes

- a900473: The Android app is much smaller: release builds drop unused code, and the APK on GitHub only carries what 64-bit phones run.

## 0.0.4

### Patch Changes

- e5a325b: Several speakers, radio through other servers, and a redesigned setup.
  
  - Speakers you've used before show at launch, marked "Connecting…" or "Offline", and reconnect when you return to the app.
  - The mini player, Home presets and Now Playing control one selected speaker; swipe the mini player or tap "Change" to pick another.
  - Home and speaker settings show each speaker's server (Revive ST, Bose, soundcork, AfterTouch, STR) and whether its radio is ready.
  - Speakers on soundcork, AfterTouch or STR play internet radio through their own server, with a warning before moving them to Revive ST.
  - After Wi-Fi setup, the app asks where the speaker gets radio: the hosted server, your own, or the one it already uses.
  - Internet radio setup asks before changing anything, shows four plain steps, explains failures, and finishes once the speaker reaches the server.
  - Your household account id is made on your phone, and a self-hosted server too old for the app is reported.
  - Radio: playback is confirmed, "Save to preset…", country and language filters, endless list, any stream by URL; HLS-only stations are hidden.
  - Redesigned speaker settings with the model's drawing, preset artwork tiles and an "About this speaker" screen; Home presets show artwork.
  - New app icon and splash screen; on Android the now-playing bar docks on the tab bar.
  - On iPhone, the first launch explains Local Network access, and adding a speaker says setup is coming soon.
  - Settings has "Send feedback" and "Privacy policy" links and says Revive ST isn't affiliated with Bose, and renaming a speaker gives up after 15 seconds.
  - The iPhone app no longer declares location or Wi-Fi hotspot access it never uses, and the Android app drops unused permissions.
  - Crashes and errors are reported to PostHog, without account ids, device ids or addresses, and a screen that fails to render offers "Try again" instead of a blank app.

## 0.0.3

### Patch Changes

- 188f94a: First public preview of Revive ST.

  - App: a new design with a speaker-first home, a mini player, native controls and navigation, and long-press menus for presets, sources and power.
  - App: speaker setup on Android is a single guided screen that reports a wrong Wi-Fi password, lets you name the speaker and offers a manual connection when it isn't found.
  - App: iOS finds speakers on the local network, and Android release builds can reach them; speaker setup stays Android-only for now.
  - App: each household gets its own account, and configuring a speaker saves its presets to the server before pairing it so the preset buttons keep working.
  - App: Settings can switch the app and its speakers to a self-hosted Revive ST server.
  - App: Radio stations play on speakers as Radio Browser stations, so presets keep working when a station changes its stream URL.
  - App: controls, menus and setup progress work with VoiceOver and TalkBack.
  - App and API: titles with special characters such as "&" are no longer shown or saved escaped.
  - API: speakers keep their account and presets across reboots, with each preset's source and artwork stored per household account.
  - API: TuneIn and Radio Browser stations play on speakers through their own adapters.
  - API: the speaker's boot request for its provider settings is answered instead of failing.
  - API: the server is published as the `ghcr.io/pradel/revive-st-api` container image, with a Docker Compose file, for self-hosting.
  - API: `GET /` reports the server's version, and the endpoints are documented at `/docs` and `/openapi.json`.
  - API: request logs mask household account ids.

## 0.0.2

### Patch Changes

- e3b39de: Fix release process.

## 0.0.1

### Patch Changes

- 550656c: First release.
