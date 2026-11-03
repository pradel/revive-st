---
"@revive-st/api": patch
---

Built-in SQLite, hourly backups, speaker contacts, input and rate limits, and a storage budget.

- The database runs on Node's built-in SQLite; `DATABASE_PATH` (default `/data/revivest.db` in the container) replaces `DATABASE_URL`.
- With `S3_BUCKET`, `S3_ENDPOINT`, `S3_ACCESS_KEY_ID` and `S3_SECRET_ACCESS_KEY` set, Litestream backs the database up to S3-compatible storage: its changes every hour, a full snapshot daily (kept 30 days), and a last sync when the server stops.
- Each speaker's last contact is recorded and served at `GET /api/internal/device/:deviceId/contact`.
- Speakers get a custom stations source (`LOCAL_INTERNET_RADIO`) for streams added by URL.
- The speaker's rename, recents, firmware update (kept on 27.0.6) and stats calls are answered.
- TuneIn and Radio Browser lookups are cached for five minutes.
- Device ids must be 12 hex digits, account ids at most 64 characters, preset fields are bounded, request bodies are capped at 32 KiB, and an account pairs at most 20 speakers.
- Writes are rate limited per client address (`X-Real-IP`): 60 a minute for a speaker's preset saves, removals, pairing and renames, 300 a minute for the app's preset syncs; past them, `429`. Speaker reads aren't limited. `RATE_LIMIT=false` turns the limits off.
- The database has a storage budget (`DATABASE_BUDGET_MB`, 2500 MB by default): past it, no new speaker is paired (`503` on a preset save or sync) nor its contact recorded, while paired speakers keep working; SQLite refuses to grow past 1.5 times it.
- `POST /api/internal/accounts` is removed; the app makes account ids.
- Request logs record the app version and platform from `X-Revive-App-Version` and `X-Revive-App-Platform`.
