# Proposal: bounding the API's stored data

## Summary

The API stores presets, pairings and speaker contacts for any account id a client makes up, deletes none of them, and has no total cap. Per client IP, the current limits let one client add about **86 MB of presets an hour (about 2.1 GB a day)**, 0.19 MB of pairings and 1.8 MB of contacts. Measured on the real schema, that is about twice the advisor's estimate, because the field caps count characters, not bytes. Retention alone cannot bound this: an active client keeps its accounts alive with one request per account per retention period. The only option that bounds total storage without user accounts is a **global storage budget that refuses new pairings once the database passes a threshold**, while existing households keep working. I recommend that budget (effort M), field caps counted in UTF-8 bytes (S, a further ~2.5× worst-case cut), and volume alerts now (no code). Retention can wait until the production queries below show abandoned data worth reclaiming. If it comes, it must delete only `presets` rows, never `devices` rows.

## Growth bound

All figures are per client IP, at the limits in commit `d37beef` (unchanged at the time of writing). They are worst cases for a scripted client, not real traffic.

### What a row costs on disk

Measured by inserting rows into a fresh database built from `apps/api/drizzle/20261031162005_init/migration.sql` with `node:sqlite` (WAL, 4096-byte pages, as `Database.layer` opens it). The script was a throwaway in `/tmp`, outside the repo. Sizes include the primary-key indexes SQLite adds (`sqlite_autoindex_*`).

| Row                                                     | Text stored                    | Bytes on disk per row |
| ------------------------------------------------------- | ------------------------------ | --------------------- |
| Preset, every field at its cap, ASCII                   | 7,040 characters, 7,040 bytes  | **8,301**             |
| Preset, every field at its cap, 3-byte characters (`€`) | 7,040 characters, 20,864 bytes | **21,166**            |
| Preset, typical Radio Browser station                   | 123 characters                 | 270                   |
| `devices`, 64-character account id (36 for a UUID: 129) | –                              | 191                   |
| `device_contacts`, random device ids                    | –                              | 49                    |

The field caps (`apps/api/src/presets/preset.ts:29-36`) use `Schema.isMaxLength`, which counts UTF-16 code units. SQLite stores text as UTF-8, so a character in the Basic Multilingual Plane outside ASCII takes 3 bytes for one unit. That makes a maximal preset 2.5 times bigger than its character count suggests. The advisor's ~7.1 KB per row assumed one byte per character and no overhead.

### The limits that apply

- `ALL`: 600 requests a minute, 36,000 an hour (`apps/api/src/rate-limit.ts:22`).
- `WRITES`: 60 `POST`/`PUT`/`DELETE` a minute, 3,600 an hour (`rate-limit.ts:28`).
- `ACCOUNT_MISSES`: 20 an hour, spent only by requests naming an account with no paired speaker (`rate-limit.ts:35-39`, `154-159`). Every account starts this way, so it bounds new accounts to **20 an hour**. A client with no token left is refused known accounts too (`rate-limit.ts:155-159`), so it spends a miss only when it has at least 2 left. That costs it nothing in steady state.
- 50 speakers per account (`apps/api/src/devices/devices-repo.ts:16`, enforced in one statement at `devices-repo.ts:52-58`), 6 presets per speaker (`PresetId` 1–6, `preset.ts:15-17`; `DevicePresets`, `apps/api/src/api/internal.ts:13-15`).
- Request bodies of at most 32 KiB (`apps/api/src/http.ts:241`). This limit was not in the advisor's estimate. The app's `POST …/presets` replaces all of a speaker's presets in one body (`apps/api/src/handlers/internal.ts:26-35`). So one request stores at most 4 maximal ASCII presets (4 × ~7.1 KB), or 1 maximal 3-byte one (~20.9 KB; two exceed 32 KiB). The speaker's `PUT …/preset/:presetId` stores one preset and leaves the other slots alone (`apps/api/src/handlers/marge.ts:131-144`).
- The token buckets are in memory and start full, so a restart, or the first hour, adds one more bucket's worth (`rate-limit.ts:50-53`). The figures below are the steady state.

### (a) Preset bytes an hour

New accounts give a client 20 × 50 speakers × 6 slots = **6,000 preset slots an hour**. Filling them takes write requests, of which it has **3,600 an hour**. Two kinds of write pay best:

- `POST /api/internal/…/presets` with 4 maximal ASCII presets: 4 slots, 4 × 8,301 ≈ 33.2 KB.
- `PUT …/preset/:presetId` with 1 maximal 3-byte preset: 1 slot, 21.2 KB.

Maximize `33.2a + 21.2b` subject to `4a + b ≤ 6,000` (slots) and `a + b ≤ 3,600` (writes). The optimum is at `a = 800`, `b = 2,800`. That gives 26.6 MB + 59.3 MB ≈ **86 MB an hour, about 2.1 GB a day**, and uses all 20 new accounts (1,000 speakers). **Both limits bind together**: the new-account limit and the write limit.

With ASCII only, slots bind first: 6,000 × 8.3 KB ≈ 50 MB an hour, about 1.2 GB a day, using 1,500 writes. This is the advisor's case, at the measured row size.

In the first hour, or after a restart, the full miss bucket doubles the slots to 12,000 (40 accounts, 2,000 speakers). A four-preset post replaces a speaker's presets, so each one needs its own speaker. The best mix is then 2,000 four-preset posts plus 1,600 single 3-byte puts: 66.4 + 33.9 ≈ **100 MB in that hour**.

### (b) `devices` rows an hour

Every pairing of a new account spends a miss, and each account takes 50 speakers. That is **20 × 50 = 1,000 rows an hour** (≈ 0.19 MB), bound by `ACCOUNT_MISSES`. Pairing doesn't need a write: `GET …/device/:deviceId/group` pairs too (`marge.ts:277-283`), and it spends only `ALL`.

### (c) `device_contacts` rows an hour

Any route naming a 12-hex device id records a contact for it (`marge.ts:95, 108, 161, 179, 213, 227, 243, 254, 280`; `apps/api/src/handlers/speaker-services.ts:23-25`). That holds whether or not the device is paired with the account named in the URL. So `GET /streaming/account/<own paired account>/device/<made-up MAC>/recents` adds a row for 1 token of `ALL`, and nothing from the misses. That is **36,000 rows an hour** (≈ 1.8 MB, about 42 MB a day), bound by `ALL`. The key space is 2^48, so nothing else stops it. Without an account, `POST /streaming/support/power_on` and the stats posts give 3,600 an hour (`WRITES`).

### Many clients

Every figure scales linearly with client addresses. `clientOf` keys buckets by the whole address string (`rate-limit.ts:74-82`). If the hosted ingress accepts IPv6, one /64 gives a client 2^64 keys, and per-IP limits stop bounding anything (see open questions). At 86 MB an hour, a 10 GB volume fills in about 5 days from one address, or about 12 hours from ten.

## Production queries

Read-only SQL to run on a **copy** of the production database (for example one restored with `litestream restore`). Each query was checked against a database built from the migration and seeded with known households: one seen today, one seen 100 days ago, one seen 200 days ago with a lower-case paired id, and a made-up 50-speaker account. Each returned the expected counts. They were not run on real data.

Contacts are stored upper-case (`apps/api/src/devices/device-contacts-repo.ts:44`), while pairings keep the device id as the request spelled it. The joins use `upper()` for that reason.

```sql
-- Q1: rows per table.
SELECT 'presets' AS table_name, count(*) AS row_count FROM presets
UNION ALL SELECT 'devices', count(*) FROM devices
UNION ALL SELECT 'device_contacts', count(*) FROM device_contacts;
```

```sql
-- Q2: accounts with a paired speaker, and with stored presets.
SELECT
  (SELECT count(DISTINCT account_id) FROM devices) AS accounts_with_devices,
  (SELECT count(DISTINCT account_id) FROM presets) AS accounts_with_presets;
```

```sql
-- Q3: accounts by the last contact of their most recently seen speaker.
WITH account_last AS (
  SELECT d.account_id, max(c.last_contact_at) AS last_contact_at
  FROM devices AS d
  LEFT JOIN device_contacts AS c ON c.device_id = upper(d.device_id)
  GROUP BY d.account_id
),
now AS (SELECT CAST(strftime('%s', 'now') AS INTEGER) * 1000 AS ms)
SELECT
  count(*) AS accounts,
  sum(last_contact_at IS NULL) AS never_contacted,
  sum(last_contact_at < now.ms - 30 * 86400000) AS silent_over_30_days,
  sum(last_contact_at < now.ms - 90 * 86400000) AS silent_over_90_days,
  sum(last_contact_at < now.ms - 180 * 86400000) AS silent_over_180_days
FROM account_last, now;
```

```sql
-- Q4: what a retention rule would delete: accounts, presets and preset text
-- bytes by when the account was last seen.
WITH account_last AS (
  SELECT d.account_id, max(c.last_contact_at) AS last_contact_at
  FROM devices AS d
  LEFT JOIN device_contacts AS c ON c.device_id = upper(d.device_id)
  GROUP BY d.account_id
),
now AS (SELECT CAST(strftime('%s', 'now') AS INTEGER) * 1000 AS ms),
bucketed AS (
  SELECT
    a.account_id,
    CASE
      WHEN a.last_contact_at IS NULL THEN 'never'
      WHEN a.last_contact_at < now.ms - 180 * 86400000 THEN 'over 180 days'
      WHEN a.last_contact_at < now.ms - 90 * 86400000 THEN '90-180 days'
      WHEN a.last_contact_at < now.ms - 30 * 86400000 THEN '30-90 days'
      ELSE 'within 30 days'
    END AS last_seen
  FROM account_last AS a, now
)
SELECT
  b.last_seen,
  count(DISTINCT b.account_id) AS accounts,
  count(p.account_id) AS presets,
  coalesce(sum(
    length(CAST(p.location AS BLOB)) + length(CAST(p.item_name AS BLOB))
    + length(CAST(p.container_art AS BLOB)) + length(CAST(p.source_account AS BLOB))
  ), 0) AS preset_text_bytes
FROM bucketed AS b
LEFT JOIN presets AS p ON p.account_id = b.account_id
GROUP BY b.last_seen
ORDER BY b.last_seen;
```

```sql
-- Q5: presets of a speaker not paired with their account. Expected 0, as
-- every write pairs first.
SELECT count(*) AS orphan_presets
FROM presets AS p
WHERE NOT EXISTS (
  SELECT 1 FROM devices AS d
  WHERE d.account_id = p.account_id AND d.device_id = p.device_id
);
```

```sql
-- Q6: speakers per account. Households have a handful; accounts at or near
-- the 50 cap point at abuse.
SELECT speakers, count(*) AS accounts
FROM (SELECT count(*) AS speakers FROM devices GROUP BY account_id)
GROUP BY speakers
ORDER BY speakers DESC;
```

```sql
-- Q7: preset sizes. Real presets are a few hundred bytes; rows near the cap
-- point at abuse, and the distribution tells how low byte caps can go.
SELECT
  count(*) AS presets,
  avg(row_bytes) AS avg_bytes,
  max(row_bytes) AS max_bytes,
  sum(row_bytes > 2048) AS over_2_kib
FROM (
  SELECT
    length(CAST(location AS BLOB)) + length(CAST(item_name AS BLOB))
    + length(CAST(container_art AS BLOB)) + length(CAST(source_account AS BLOB))
    + length(CAST(source AS BLOB)) + length(CAST(content_item_type AS BLOB))
    AS row_bytes
  FROM presets
);
```

```sql
-- Q8: pairings and pairing accounts per day over the last 60 days: the real
-- growth rate, and bursts.
SELECT
  date(paired_on / 1000, 'unixepoch') AS day,
  count(*) AS pairings,
  count(DISTINCT account_id) AS accounts_pairing
FROM devices
WHERE paired_on >= (CAST(strftime('%s', 'now') AS INTEGER) - 60 * 86400) * 1000
GROUP BY day
ORDER BY day DESC;
```

```sql
-- Q9: contacts from speakers paired with no account here: Bose-paired
-- speakers pointed at this server, or made-up ids.
SELECT count(*) AS unpaired_contacts
FROM device_contacts AS c
WHERE NOT EXISTS (
  SELECT 1 FROM devices AS d WHERE upper(d.device_id) = c.device_id
);
```

```sql
-- Q10: database size, and the free pages a VACUUM would return.
SELECT
  page_count * page_size AS bytes,
  freelist_count * page_size AS free_bytes
FROM pragma_page_count(), pragma_page_size(), pragma_freelist_count();
```

```sql
-- Q11: bytes per table and index. Needs SQLite built with the dbstat table,
-- as node:sqlite and the sqlite3 shell are.
SELECT name, sum(pgsize) AS bytes FROM dbstat GROUP BY name ORDER BY bytes DESC;
```

## Options

Two facts decide what each option risks for real households:

- **A speaker missing from its account's `<devices>` in `/full` drops its account and presets at boot** (`apps/website/content/docs/developers/api.mdx:42`; `devices-repo.ts:18-23`). Deleting a live household's `devices` row wipes its preset buttons at the next boot.
- **A listed speaker with no stored presets keeps its own.** `/full` then leaves out its `<presets>` element (`apps/api/src/utils/marge-xml.ts:76-93`). Deleting only `presets` rows loses the server's copy, not the speaker's buttons. The app sends the copy again the next time it sees the speaker on this server (`apps/app/src/features/speakers/registry/registry.ts:183-204`, once per app launch, as `syncedPresets` is in memory).

### 1. Retention by inactivity

**Change.** A scheduled Effect job in the server process. It deletes the `presets` rows of accounts where none of their speakers has contacted the server in N days. Accounts never contacted and paired over N days ago also lose their `devices` rows. Contacts older than N days are deleted from `device_contacts` once the account check no longer needs them.

**Contacts.** Contacts are recorded by the presets read, preset save and delete, recents, power-on, register, rename and group routes, and by the stats posts (references above). The `account` (`/full`) handler records nothing (`marge.ts:78-91`). That doesn't matter: a speaker that boots also calls `power_on`, its presets or group, and `/full` alone is never the only request it makes. Whether a running speaker contacts the server between boots, through the stats posts its configured statistics address sends, is not established here [INFERENCE: probably, as the setup points the speaker's statistics address at this server, `self-hosting.mdx:102`]. Q3 on production measures it.

**Effect on the bound.** None against an active client. One request per account per N days keeps an account alive, for example `GET …/presets`, which records a contact (`marge.ts:95`). It reclaims junk from one-off abuse and abandoned households, and it makes a budget (option 2) renewable.

**Households.** Deleting `presets` rows only is safe for speakers, which keep their own presets (above). Deleting `devices` rows is safe only for accounts no speaker ever contacted. One edge remains: an app pre-paired the speaker (`internal.ts:23` pairs without recording a contact), setup failed before it reached the server, and it reaches the server more than N days later. Its first boot would then drop the account. Litestream replicates deletes within about 2 minutes (`apps/api/litestream.yml`, `sync-interval: 1m`), and the 30-day snapshots are the only way back. A wrong rule is costly.

**ADR 0001 and docs.** ADR 0001 needs contacts readable per device id, and "recording never fails a speaker's request". Deleting old contacts is compatible, since the app only compares contacts minutes apart during a setup. `api.mdx` "Accounts"/"Limits" would need a sentence on retention, and the Privacy Policy on how long data is kept.

**Effort** M. **Tests**: repo tests with a fixed clock for the boundary days, the upper-case join and the never-contacted case, and a test that a deleted account's speaker gets `/full` without `<presets>`, not without its `<device>`.

### 2. Global storage budget

**Change.** Above a configured database size, the server refuses to **insert a new `devices` row**. That covers a new account's first speaker and an existing account's new speaker. Writes for speakers already paired keep working. Used size is `(page_count - freelist_count) * page_size`, read at most once a minute. Each refusal logs a warning, and so does crossing the threshold.

The advisor scoped this to "an account's first device". That leaves a gap: accounts made earlier with one speaker can each still grow to 50 × 6 × 21 KB ≈ 6.3 MB. Refusing every new pairing closes it. After the threshold, growth is bounded by the speakers already paired: at most 6 slots × 21 KB each, and in practice their real presets, a few hundred bytes (Q7).

**Effect on the bound.** The only option here that bounds total storage against an active client: the threshold, plus the headroom of existing speakers. A client can still exhaust it, but the cost moves from an outage for every household to new pairings being refused.

**Households.** Existing households keep playing, reading and saving presets. A new household, or a new speaker in one, can't be set up until space is freed. The app's setup today reports a refused preset save as `ServerUnreachable` with `need: "presets"` (`apps/app/src/features/configure/session/steps.ts`). A distinct status would let it say why.

**ADR 0001 and docs.** No conflict: contacts don't pair. The public docs sentence "The server takes any account id within the limits below" (`api.mdx:18`) stays true. "Limits" gains the budget, and `self-hosting.mdx` gains the setting.

**Effort** M. **Tests**: `DevicesRepo` with a stubbed size refuses a new pairing over budget and still accepts an existing one; handler tests for the status of `syncPresets` and `savePreset` over budget.

### 3. Proof of a real speaker before storing

**Change.** Pair a device only if it contacted the server recently.

**Effect on the bound.** None. `POST /streaming/support/power_on` records a contact for any MAC-shaped id in its body (`marge.ts:218-231`), for one write token. The stats posts do the same without a body (`speaker-services.ts:23-25`).

**Households.** It breaks setup. The app stores a speaker's presets, which pairs it (`internal.ts:23`), **before** pointing the speaker at this server. It has to, because the speaker mirrors stored presets at its first boot paired (`apps/app/src/features/configure/session/steps.ts`, `prepare`). A speaker coming from Bose's servers has never contacted ours at that point.

**Effort** S. **Not recommended.**

### 4. Tighter per-account caps

**4a. 50 → 10 speakers per account.** Slots fall to 20 × 10 × 6 = 1,200 an hour. Writes no longer bind: 1,200 × 21.2 KB ≈ **25 MB an hour**, a 3.4× cut. Households with more than 10 speakers would see the extra ones refused ("Account full", `devices-repo.ts:68-73`). Q6 shows whether any exist. Effort S.

**4b. Field caps in UTF-8 bytes.** Same numbers, counted in bytes (`preset.ts:20-21`). A maximal preset falls from 21.2 KB to 8.3 KB on disk. The mixed worst case becomes 3,600 writes doing what they can with 6,000 slots of 8.3 KB: ≈ **50 MB an hour**, slot-bound. Real presets are ASCII URLs and short names (Q7), so households are unaffected. A station name in CJK script is the exception: it would be cut at 512 bytes, about 170 characters, still well above real names. The `location` cap must stay at least what a custom station needs (its base64 data, `preset.ts:23-28`). Effort S.

**4c. Lower the field caps** to what Q7 shows real presets use. This only shrinks the per-row constant, by up to the ratio of old to new caps.

All three are linear cuts: they slow growth but don't bound it.

### 5. Monitor only

**Change.** An alert on the volume's usage (Railway metrics), plus the queries above run on a schedule against a backup. No code.

**Effect on the bound.** None. It turns an outage into a page, at a time that depends on the threshold: at 86 MB an hour, 80% of a 10 GB volume leaves about 23 hours from one client.

**Households.** No risk. **Effort** S (configuration). Worth doing whatever else is chosen.

### 6. (Found in the code) Record contacts on account routes only for the account's speakers

**Change.** On routes naming an account, `contactsRepo.record` runs only when the device is paired with that account, or is being paired by the request. `power_on` and the stats posts keep recording any id.

**Effect on the bound.** `device_contacts` growth through account routes then costs a pairing, bound by misses: about 1,000 rows an hour. The remaining unbounded path is the account-less posts, at 3,600 an hour. Overall that is 36,000 → ~4,600 rows an hour, about an 8× cut. The table is 49 bytes a row, so this matters only for the long term.

**Households and ADR 0001.** A configured speaker's account routes name its own account, where it is paired. The boot report, the contact ADR 0001 relies on, still records any id. Recording still never fails a request: it is skipped, not refused. **Effort** S.

## Recommendation

1. **Now, no code: option 5.** Alert on volume usage, and run Q1–Q11 on a restored copy. The numbers decide the rest: Q4 and Q7 show whether junk exists today, Q6 whether 4a is possible.
2. **Build: option 2 (global budget on new pairings) with 4b (byte caps).** The budget is the only bound on total storage that needs no user accounts. It keeps every existing household working when it trips, and refuses only new pairings. Byte caps cut the worst-case rate 1.7×, which buys time before the budget trips, at no cost to real presets. Option 6 is a cheap addition in the same build if the maintainer wants it.
3. **Defer option 1 (retention)** until Q4 shows data worth reclaiming, or until the budget is reached once. If it is built, it deletes `presets` rows of long-silent accounts and `devices` rows only of never-contacted ones, with N of at least 180 days.
4. **Reject option 3**: spoofable for one request, and it breaks the app's setup order. **Reject 4a** unless Q6 shows no account above 10 speakers. Even then it is linear.

What would change the call:

- If the hosted ingress accepts IPv6, per-IP limits are bypassed by any /64. Keying the buckets by /64 becomes as urgent as the budget.
- If Q3 shows real speakers going months without a contact while still in use, retention needs a longer N or a different liveness signal.
- If the database is already large with junk (Q4, Q6, Q7), retention moves up to step 2, with a one-off cleanup.

## Draft ADR

```markdown
# Bound the API's stored data with a budget on new pairings

The server has no user accounts: an account id is any string of up to 64 characters, and knowing it grants access to a household's presets (`apps/website/content/docs/developers/api.mdx`). The server bounds what one account stores (50 speakers, 6 presets each, capped fields) and rate-limits each client address, but never deletes anything. One client can add about 86 MB of presets an hour at those limits, and every client address adds as much. Unbounded growth ends in a full volume, an outage for every household, and a backup that grows with it.

The server therefore refuses to pair a speaker it hasn't paired yet, with any account, once the database's used size passes a configured budget. Speakers already paired keep reading and saving their presets, so no household loses anything. New households and new speakers get a refusal until space is freed. Preset field caps count UTF-8 bytes rather than characters, so a stored preset is at most about 8 KB on disk. The budget is logged when it is reached, and the volume is alerted on before it.

## Considered options

- **Delete accounts whose speakers haven't contacted the server in N days**: not done yet. A client keeps its accounts alive with one request each per N days, so retention doesn't bound an active client. It reclaims abandoned data, and can be added later. If it is, it deletes only the `presets` rows of silent accounts (their speakers keep their own presets, as `/full` lists them without `<presets>`), never the `devices` row of an account a speaker has contacted: a speaker missing from `/full` drops its account and presets at boot.
- **Pair only speakers that contacted the server recently**: rejected. `power_on` records a contact for any MAC-shaped id, and the app stores a speaker's presets, which pairs it, before the speaker is pointed at this server.
- **Budget only on an account's first speaker**: rejected. Accounts made before the budget is reached could each still grow by 50 speakers' presets.
- **Fewer speakers per account (50 → 10)**: not done. It cuts growth by about 3.4× without bounding it, and could refuse large households.
- **User accounts**: not done. They would bound storage per user, but the speakers authenticate with nothing but the account id in the URL, so they don't fit the protocol the server emulates.
```

## Follow-up build plan outline

Files to touch:

- `apps/api/src/config.ts`: a `StorageBudget` setting from an environment variable such as `MAX_DATABASE_SIZE` (bytes or a size like `5GB`). Off when unset, so self-hosted servers keep today's behavior; the hosted deployment sets it.
- `apps/api/src/db/` (new `storage-budget.ts`): a service answering "over budget?" from `(page_count - freelist_count) * page_size`, cached for a minute. It logs once each time the budget is crossed.
- `apps/api/src/devices/devices-repo.ts`: `pair` refuses inserting a new row when over budget, and says why: a result such as `"paired" | "accountFull" | "serverFull"` instead of `boolean`. The single statement at `devices-repo.ts:52-58` keeps concurrent pairings from overfilling an account. The budget check sits before it, as it can't be exact anyway.
- `apps/api/src/handlers/internal.ts:23`: `serverFull` gets its own status, for example `507 Insufficient Storage`, distinct from the `409` of a full account. `apps/api/src/api/internal.ts` declares it.
- `apps/api/src/handlers/marge.ts:116-119` (`savePreset`): keeps `400` as today for a refused pairing. Speakers only need to be refused. The other routes that pair (`162`, `187`, `244`, `269`, `281`) already ignore the result and stay as they are.
- `apps/api/src/presets/preset.ts:20-21`: `boundedText` checks UTF-8 byte length (`new TextEncoder().encode(value).length`, or `Buffer.byteLength`) instead of `isMaxLength`. The descriptions and the docs say "bytes".
- Optional (option 6): `apps/api/src/handlers/marge.ts`, so account routes record a contact only for a device paired with the account or being paired by the request.
- App, optional: `apps/app/src/features/configure/adapters.ts` and `session/errors.ts` map the new status to "The server is full", instead of `ServerUnreachable`.

Tests:

- `devices-repo` with a stubbed budget: a new pairing is refused over budget, a pairing that already exists still succeeds, and under budget nothing changes.
- An HTTP test (`apps/api/src/http.test.ts` pattern): `POST …/presets` over budget returns the new status for a new speaker and `200` for a paired one.
- Preset schema: a value at the byte cap passes, one byte over fails, and the same number of 3-byte characters fails.

Docs:

- `apps/website/content/docs/developers/api.mdx`, "Limits": caps in bytes; the budget, what it refuses and what keeps working; the new status.
- `apps/website/content/docs/self-hosting.mdx`: a row for the setting in the settings table, saying it is off by default.
- `docs/adr/`: the ADR above, numbered after 0005.
- A changeset for `@revive-st/api`, and for `@revive-st/app` if its error message changes.

## Open questions for the maintainer

1. **IPv6.** Does the hosted ingress (Railway, through `CLIENT_IP_HEADER`) accept IPv6 clients? If it does, every bucket is per /128 (`rate-limit.ts:74-82`), and keying by /64 matters more than anything here.
2. **Budget size.** What volume does the hosted server have, and what should the budget be? For example half the volume, leaving room for the copy Litestream keeps when it starts a new backup (`self-hosting.mdx:48`). Should self-hosted servers get a default, or stay unbounded?
3. **Liveness.** Do configured speakers contact the server while running (stats posts), or only at boot? This sets the shortest safe N for retention. Q3 on production answers part of it.
4. **The server's copy of presets.** Is losing the server's copy of a long-silent household's presets acceptable? The speaker keeps its own, and the app resends them, but a speaker reset in that window would come back without presets.
5. **Scope of the refusal.** Refuse every new pairing (recommended), or only an account's first speaker (the advisor's version, which leaves the 6.3 MB-per-account gap)?
6. **Error surface.** Should the app tell users the server is full, or is the current "server unreachable" acceptable for a rare event?
