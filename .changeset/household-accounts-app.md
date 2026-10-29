---
"@revive-st/app": minor
"bose-api-speaker-client": minor
---

Configuring an unpaired speaker pairs it with the household's own account, shared with the household's other speakers, instead of the shared `revivest-user` one; only account ids our server minted are shared. Preset sync uses the speaker's account and only runs for speakers configured for our server; casting reads the speaker's account from it first. The speaker client exposes the speaker's `margeAccountUUID` and `margeURL` in its state.
