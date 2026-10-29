---
"@revive-st/app": patch
---

Configuring a speaker saves its presets to the server before pairing it and rebooting, so the speaker keeps them: at boot it restores exactly the presets the server stores for it. Configuring stops if they can't be saved. Preset sync errors now reach the caller instead of being swallowed.
