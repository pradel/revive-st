# @revive-st/api

## 0.0.4

### Patch Changes

- 5cf113e: API: TuneIn and Radio Browser station lookups are cached for five minutes (a station they don't know for one minute; failures aren't cached), so speakers starting or retrying a station no longer reach those services each time. Request bodies over 64 KiB are refused. The app's preset sync accepts at most one preset per button, and an account pairs at most 50 speakers: syncing presets for another speaker gets `409` and a speaker's preset save gets `400`, with nothing stored.
- d7ecae2: App and API: the app names its version and platform in the `X-Revive-App-Version` and `X-Revive-App-Platform` headers of its requests to the server, which records them as `app.version` and `app.platform` on request logs and traces.
- 7a3fd6b: API: speakers get a custom stations source (`LOCAL_INTERNET_RADIO`) that plays streams added by URL.
- ed9dd66: Server: answer the speaker's recents request (`GET /streaming/account/:accountId/device/:deviceId/recents`) with an empty `<recents/>` instead of `404`.
- f4fdcee: API: the database runs on Node's built-in SQLite (`node:sqlite`) instead of libSQL, with write-ahead logging, from a single initial migration. Its file is set with `DATABASE_PATH` (default `/data/revivest.db` in the container), which replaces `DATABASE_URL`.
- f4fdcee: API: with `S3_BUCKET`, `S3_ENDPOINT`, `S3_ACCESS_KEY_ID` and `S3_SECRET_ACCESS_KEY` set, the server stores a gzipped snapshot of its database in that bucket, on any S3-compatible storage (Cloudflare R2, AWS S3, Backblaze B2, MinIO), every day at 03:00 UTC, and at start when the newest snapshot is more than a day old. `S3_REGION` defaults to `auto` (R2). Each run logs `Database snapshot stored` or `Database snapshot failed`.
- 962d0ff: API: the server records when each speaker last contacted it (at boot, on Marge calls naming its device id, and on its stats), and `GET /api/internal/device/:deviceId/contact` returns it as `{ "lastContactAt": number | null }` so the app can confirm a configured speaker reached the server. Speakers whose `swUpdateUrl` and `statsServerUrl` point at the server get a firmware index at `GET /updates/soundtouch` that keeps them on firmware 27.0.6, and an empty `200` from `POST /v1/stapp/:deviceId` and `POST /v1/scmudc/:deviceId`.
- 7a7fa1c: Server: answer the speaker's rename call (`PUT /streaming/account/:accountId/device/:deviceId`), so renaming a speaker from the app takes effect instead of the speaker keeping its old name.

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
