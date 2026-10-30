---
"@revive-st/api": minor
---

`GET /` answers with the server's name, version and the paths of its documentation (`/docs`, `/openapi.json`) instead of `404`, so a self-hosted server shows which release it runs. Railway uses it as the deployment health check.
