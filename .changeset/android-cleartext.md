---
"@revive-st/app": patch
---

Android release builds can reach speakers: they allow cleartext HTTP, which the speakers' local API (`http://<speaker>:8090`) requires. Only debug builds allowed it before, so a release build found no speakers.
