---
"@revive-st/api": patch
---

Built-in SQLite, daily backups, speaker contacts and input limits.

- The database runs on Node's built-in SQLite; `DATABASE_PATH` (default `/data/revivest.db` in the container) replaces `DATABASE_URL`.
- With `S3_BUCKET`, `S3_ENDPOINT`, `S3_ACCESS_KEY_ID` and `S3_SECRET_ACCESS_KEY` set, a gzipped database snapshot goes to S3-compatible storage daily at 03:00 UTC.
- Each speaker's last contact is recorded and served at `GET /api/internal/device/:deviceId/contact`.
- Speakers get a custom stations source (`LOCAL_INTERNET_RADIO`) for streams added by URL.
- The speaker's rename, recents, firmware update (kept on 27.0.6) and stats calls are answered.
- TuneIn and Radio Browser lookups are cached for five minutes.
- Device ids must be 12 hex digits, account ids at most 64 characters, preset fields are bounded, request bodies are capped at 32 KiB, and an account pairs at most 50 speakers.
- `POST /api/internal/accounts` is removed; the app makes account ids.
- Request logs record the app version and platform from `X-Revive-App-Version` and `X-Revive-App-Platform`.
