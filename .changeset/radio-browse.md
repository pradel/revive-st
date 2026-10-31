---
"@revive-st/app": patch
---

App: the Radio tab is easier to browse and more reliable.

- Playing a station now waits until the speaker actually starts it. A station that won't play is reported as an error instead of closing the sheet as if it had worked.
- Stations speakers can't play (HLS-only streams) no longer show up.
- New country and language filters, remembered between launches. They combine with search and genres, and the list keeps loading as you scroll instead of stopping at 30 stations.
- Browsing opens on the stations popular near you and worldwide right now, rather than the most voted of all time.
- Searches go to any Radio Browser server instead of a single one. A server that doesn't answer is given up on and another one is tried. Every station you start now counts towards its popularity on Radio Browser.
