---
"@revive-st/api": patch
---

API: bounds what a made-up account id can store. Device ids in Marge and preset sync paths, and in a speaker's pairing document, must be 12 hex digits (a MAC address); account ids are at most 64 characters; others get `400`. Preset fields have maximum lengths (name 512 characters, location 4096, artwork 2048, source account 256, source and content type 64), and request bodies over 32 KiB are refused. Railway restarts the server whenever it stops, instead of giving up after ten restarts on failure.
