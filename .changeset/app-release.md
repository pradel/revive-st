---
"@revive-st/app": patch
---

Several speakers, radio through other servers, and a redesigned setup.

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
- Settings has a "Send feedback" link, and renaming a speaker gives up after 15 seconds.
- Crashes and errors are reported to PostHog's EU cloud, without account ids, device ids or addresses, and a screen that fails to render offers "Try again" instead of a blank app.
