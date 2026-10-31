# @revive-st/app

## 0.0.4

### Patch Changes

- 1c9fb8a: App: on Android the tab bar sits on a raised surface with a mint selection pill, and the now-playing bar is docked on top of it instead of floating above it as a separate card.
- d7ecae2: App and API: the app names its version and platform in the `X-Revive-App-Version` and `X-Revive-App-Platform` headers of its requests to the server, which records them as `app.version` and `app.platform` on request logs and traces.
- 5713e3c: App: on Android the now-playing bar sits right above the tab bar, and the speaker card's volume number lines up under its settings button.
- 962d0ff: App: setting up a speaker for internet radio is redesigned. A first screen explains what happens and asks before anything changes; progress shows four plain steps instead of a telnet log, and a failure says what went wrong with a way out (try again, or check again after a slow restart). Setup now writes all four server addresses before saving them, reads them back before and after the restart, finds the speaker again if it comes back on another address, and finishes only once the speaker has contacted the server. A setup keeps running when you leave the screen, and the speaker's settings show its progress. The speaker's status reads "Ready" only when it uses the server and is paired with an account.
- 4ac7178: App: on iPhone the home screen shows the add speaker button too; it opens a screen saying speaker setup on iPhone is coming soon.
- 7a7fa1c: App: new flat logo for the app icon, Android adaptive icon and splash screen, on the app's background colour.
- 2d490f0: App: the presets on the home screen show their station's artwork, and empty presets read "Empty" above their preset number, like the others.
- 7a3fd6b: App: Radio tab improvements.
  
  - Playing a station confirms the speaker started it, and reports it when it didn't.
  - "Save to preset…" stores a station on a speaker preset without playing it.
  - Country and language filters, popular stations near you, and a list that loads more as you scroll.
  - Stations speakers can't play (HLS-only) are hidden.
  - Play or save any stream by URL, playlists included. Speakers get custom stations once configured again.
- d65c428: App: renaming a speaker gives up after 15 seconds with "Couldn't rename the speaker" instead of staying on "Saving…" when the speaker doesn't answer.
- 3d2f7ba: App: Settings has a "Send feedback" link to the project's GitHub Discussions.
- 1c9fb8a: App: the Settings tab opens on the settings list (version, website, feedback, server, logs) again instead of the Server screen.
- e7232f4: App: while a speaker plays nothing (in standby, for instance), its card shows a drawing of its model instead of a generic speaker icon.
- 7a7fa1c: App: speaker settings show each preset's name with an icon for its source, use the app's slider on Android, and wrap long software versions; the speaker card drops its arrow, and Radio Browser presets get the radio icon.
- 1c9fb8a: App: a speaker's settings open on a card with its drawing, model, address and status. The name is edited on its own screen, bass and EQ sliders label the ends of their range and say "Max" or "Min" there, and the presets show as six artwork tiles that play on tap. Internet radio setup moves to an "Advanced" group, next to a new "About this speaker" screen with the speaker's IDs and software versions. Form section titles are small capitals, as elsewhere in the app.

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
