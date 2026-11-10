# @revive-st/api

## 0.0.5

### Patch Changes

- Requests are rate limited per client IP address (read from the header named by `CLIENT_IP_HEADER` when set), and a request over a limit gets an empty `429` with `Retry-After`. ([#129](https://github.com/pradel/revive-st/pull/129))

## 0.0.4

### Patch Changes

- e5a325b: Built-in SQLite, continuous backups, speaker contacts and input limits.
  
  - The database runs on Node's built-in SQLite; `DATABASE_PATH` (default `/data/revivest.db` in the container) replaces `DATABASE_URL`.
  - With `S3_BUCKET`, `S3_ENDPOINT`, `S3_ACCESS_KEY_ID` and `S3_SECRET_ACCESS_KEY` set, Litestream backs the database up to S3-compatible storage beside the server: its changes about every minute, a full snapshot daily (kept 30 days), and a last sync when the server stops.
  - Each speaker's last contact is recorded and served at `GET /api/internal/device/:deviceId/contact`.
  - Speakers get a custom stations source (`LOCAL_INTERNET_RADIO`) for streams added by URL.
  - The speaker's rename, recents, firmware update (kept on 27.0.6) and stats calls are answered.
  - TuneIn and Radio Browser lookups are cached for five minutes.
  - Device ids must be 12 hex digits, account ids at most 64 characters, preset fields are bounded, request bodies are capped at 32 KiB, and an account pairs at most 50 speakers.
  - `POST /api/internal/accounts` is removed; the app makes account ids.
  - Request logs record the app version and platform from `X-Revive-App-Version` and `X-Revive-App-Platform`.

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
