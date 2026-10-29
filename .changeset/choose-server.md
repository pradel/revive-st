---
"@revive-st/app": minor
---

Settings has a Server screen to pick which Revive ST server the app and the speakers it configures use, such as one self-hosted on the home network; "Use the Revive ST server" goes back to `https://api.revivest.app`. Only a plain `http://` or `https://` address (host or IP, optional port, no loopback) is accepted, and saving first checks that a Revive ST server answers there. Speakers configured for another server show as not configured, and the phone remembers the household account separately for each server.
