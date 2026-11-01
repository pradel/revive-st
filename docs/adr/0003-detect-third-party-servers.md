# Use speakers' third-party servers as they are, and read radio readiness from the speaker

Other open-source projects replace Bose's servers too: soundcork and AfterTouch run on a computer the user owns, STR runs on the speaker itself. A user who already runs one shouldn't have to move their speakers to ours to use the app. The app used to count a speaker as ready for internet radio only when its `margeURL` was our server, and offered to set every other speaker up.

The app now tells which server a speaker uses with **server profiles** (`apps/app/src/features/speakers/lib/server-profiles.ts`), and plays radio on it without setting it up. It still only sets speakers up for our server: the others each have their own setup, account and preset models, which the app would have to follow as they change. Setting up a speaker on another Revive ST server (recognised by the name its `GET /` answers), soundcork, AfterTouch or an unknown server takes a warning that it leaves that server; on STR it isn't offered, since STR puts its own settings back at every start.

Whether radio works comes from the speaker's `/sources`, not from the server's identity: a speaker lists the sources its server gave it and reports them `READY` only while it can use them (AfterTouch's troubleshooting guide: every cloud source turns `UNAVAILABLE` when the speaker can't authenticate with its server). A speaker counts as ready once it's paired with an account on its server and a station source is ready; one on Bose's servers never does, whatever it reports, since those are gone. A server no profile knows is judged on the same terms, an account and a ready station source: a station it can't play fails when it's started, which the app already checks. A Radio Browser station plays as a custom station (the `/station?data=` location every server here decodes) on a speaker without Radio Browser, such as one on STR, when its server offers custom stations and the station has a stream.

## Considered options

- **Set speakers up for third-party servers from the app**: rejected for now. Each server already ships its own migration, and their account and preset handling differ from ours (soundcork's numeric accounts under `/marge`, STR's own preset store).
- **Hard-code which station sources each server offers**: rejected. It would need a code change per server and per server version; the speaker already reports what its server gave it.
- **Save presets on STR through its own API (`PUT :8888/api/presets/<slot>`)** instead of the speaker's `/storePreset`: not done. The speaker sends a preset it stores to its server, which on STR is STR's own Marge stand-in, and STR keeps it in its store (`internal/marge/presetstore.go`). STR's API is the fallback if its store misses presets saved this way.

## Limits

A speaker pointed at AfterTouch through DNS keeps Bose's address and reads as Bose's, so it shows as needing setup.
