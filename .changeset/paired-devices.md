---
"@revive-st/api": minor
---

Speakers keep their account and presets across reboots. At boot a speaker mirrors the presets the account document stores for it, and drops its account when it isn't listed. The account document now lists every speaker paired with the account, with its presets. Speakers pair when they register, save or delete a preset, add a recent, look their group up at boot, or have their presets synced by the app; pairing never removes a speaker from another account, so naming its device id can't unpair it. The migration pairs speakers with every account that stores presets for them. Presets a speaker deletes are deleted, and an app sync replaces the device's stored presets. Registering a speaker returns `201 Created` with a `<device>` document, so the speaker accepts the pairing. Only device ids are stored about speakers.
