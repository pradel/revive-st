# @revive-st/app

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
