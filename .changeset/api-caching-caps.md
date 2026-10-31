---
"@revive-st/api": patch
---

API: TuneIn and Radio Browser station lookups are cached for five minutes (a station they don't know for one minute; failures aren't cached), so speakers starting or retrying a station no longer reach those services each time. Request bodies over 64 KiB are refused. The app's preset sync accepts at most one preset per button, and an account pairs at most 50 speakers: syncing presets for another speaker gets `409` and a speaker's preset save gets `400`, with nothing stored.
