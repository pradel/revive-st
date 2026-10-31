---
"@revive-st/app": patch
"@revive-st/api": patch
---

App and API: the app names its version and platform in the `X-Revive-App-Version` and `X-Revive-App-Platform` headers of its requests to the server, which records them as `app.version` and `app.platform` on request logs and traces.
