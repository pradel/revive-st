---
"@revive-st/api": patch
---

API: the database runs on Node's built-in SQLite (`node:sqlite`) instead of libSQL, with write-ahead logging, from a single initial migration. Its file is set with `DATABASE_PATH` (default `/data/revivest.db` in the container), which replaces `DATABASE_URL`.
