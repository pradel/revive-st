---
"@revive-st/api": patch
---

Rate limits per client IP address: 600 requests a minute (`GET /` aside), of which 60 station lookups and 60 `POST`, `PUT` or `DELETE` requests, and 20 requests an hour naming an account no speaker is paired with, after which every request naming an account is refused. A request over a limit gets an empty `429` with `Retry-After`, and isn't logged. `CLIENT_IP_HEADER` names the header a trusted proxy puts the client's address in, like `cf-connecting-ip`.
