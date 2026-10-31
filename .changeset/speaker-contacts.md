---
"@revive-st/api": patch
---

API: the server records when each speaker last contacted it (at boot, on Marge calls naming its device id, and on its stats), and `GET /api/internal/device/:deviceId/contact` returns it as `{ "lastContactAt": number | null }` so the app can confirm a configured speaker reached the server. Speakers whose `swUpdateUrl` and `statsServerUrl` point at the server get a firmware index at `GET /updates/soundtouch` that keeps them on firmware 27.0.6, and an empty `200` from `POST /v1/stapp/:deviceId` and `POST /v1/scmudc/:deviceId`.
