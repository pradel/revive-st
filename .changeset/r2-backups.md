---
"@revive-st/api": patch
---

API: with `R2_BUCKET`, `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID` and `R2_SECRET_ACCESS_KEY` set, the server stores a gzipped snapshot of its database in that R2 bucket every day at 03:00 UTC, and at start when the newest snapshot is more than a day old. `BACKUP_HEARTBEAT_URL`, optional, is called after each stored snapshot for a heartbeat monitor. The Railway service no longer sleeps, so the schedule always runs.
