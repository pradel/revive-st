---
"@revive-st/api": patch
---

Requests are rate limited per client IP address (read from the header named by `CLIENT_IP_HEADER` when set), and a request over a limit gets an empty `429` with `Retry-After`.
