---
"@revive-st/api": minor
---

The API server now runs on Effect: `effect/http-api` replaces Hono and Zod, Drizzle runs on its Effect libSQL driver (`drizzle-orm` 1.0 RC with `@effect/sql-libsql`), and Node serves it directly instead of Nitro. Drizzle migrations run at startup, the server listens on `PORT` (default 3000), and synced presets must use ids 1 to 6.
