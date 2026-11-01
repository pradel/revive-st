---
"@revive-st/api": patch
---

API: writes are rate limited per client address (`X-Real-IP`): 60 a minute for a speaker's preset saves, removals, pairing and renames, 300 a minute for the app's preset syncs, 10 an hour for account creation; past them, `429`. Speaker reads aren't limited. `RATE_LIMIT=false` turns the limits off. The database has a storage budget (`DATABASE_BUDGET_MB`, 100 MB by default): past it, no new speaker is paired (`503` on a preset save or sync) nor its contact recorded, while paired speakers keep working; SQLite refuses to grow past 1.5 times it. An account pairs at most 20 speakers, down from 50.
