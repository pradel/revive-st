---
"@revive-st/api": minor
---

Speakers play Radio Browser stations through a `RADIO_BROWSER` source (id `10005`, provider `39`) and a Radio Browser adapter at `/bmx/radiobrowser`, which looks a station up by its `stationuuid` every time it plays and returns its current stream, name and logo. A preset names the station, not its stream, and holds no server address. The `LOCAL_INTERNET_RADIO` source and the custom-stations (Orion) adapter are removed, and sources no longer carry the account id as their username.
