---
"@revive-st/api": minor
---

Presets are stored per account and device, and the app sync moves to `POST /api/internal/account/:accountId/device/:deviceId/presets`; `POST /api/internal/accounts` mints household account ids. Presets stored before accounts are dropped. Request logs mask account ids.
