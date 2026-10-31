---
"@revive-st/api": patch
---

API: with `S3_BUCKET`, `S3_ENDPOINT`, `S3_ACCESS_KEY_ID` and `S3_SECRET_ACCESS_KEY` set, the server stores a gzipped snapshot of its database in that bucket, on any S3-compatible storage (Cloudflare R2, AWS S3, Backblaze B2, MinIO), every day at 03:00 UTC, and at start when the newest snapshot is more than a day old. `S3_REGION` defaults to `auto` (R2). Each run logs `Database snapshot stored` or `Database snapshot failed`. The Railway service no longer sleeps, so the schedule always runs.
