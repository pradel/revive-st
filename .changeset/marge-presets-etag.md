---
"@revive-st/api": minor
"bose-api-speaker-client": minor
---

Speaker presets keep the source they play from instead of always being stored as local radio, along with their content type and artwork, and are served back in Marge's format; a preset from a source the account does not offer is rejected. Marge documents carry `ETag`s derived from their body, spelled the way SoundTouch firmware expects, and a matching `If-None-Match` gets a 304. Recents are acknowledged with the source they played from and no longer point at `localhost`. The speaker client reads a ContentItem's `type` and `containerArt`.
