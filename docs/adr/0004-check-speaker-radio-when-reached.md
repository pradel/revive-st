# Check each speaker's radio when it's reached, and remember it

The speaker registry (ADR 0002) already kept each speaker's server, checked when it's reached and remembered. Whether it could play radio was still only checked when a screen asked, through a React Query cache keyed by the speaker's address (`useRadioSetupQuery`): it read `/info` a second time, could stay five minutes stale, was lost when the speaker's address changed, and the home screen couldn't show it.

The registry's record now holds the speaker's radio in place of the server alone: what the speaker says (`SpeakerRadio`: its server, `margeURL`, whether it's paired, and its station sources), judged against our server only when it's shown (`RadioStatus`), so changing our server re-judges every listed speaker, offline ones too. Reaching a speaker checks its radio at the same time as it opens the live connection, from the `/info` it already read, so the home screen shows it ("Radio via soundcork", "Radio needs setup") without opening anything. The radio is remembered with the speaker and listed at the next launch before any speaker answers; a check that runs or fails keeps the last result. `useRadioSetupQuery` is gone.

The radio is checked again when the app comes back to the foreground, when the speaker reports `infoUpdated` or `sourcesUpdated` on its WebSocket or another `margeURL` in its state, when our server changes, after a setup, when the user scans again (pull to refresh), and when "Play on…" opens with a speaker whose check wasn't answered. The client parses `sourcesUpdated` and calls `onSettingsChange` for both events.

Presets are synced to our server only when they change, instead of on every state update the speaker sends.

## Considered options

- **Keep the query and run it for every speaker at launch**: rejected. It would still read `/info` twice, keep a second copy of each speaker keyed by address, and miss the speaker's own change events.
- **Skip the probe when the saved server matches the speaker's `margeURL`**: not done. Only STR (on Bose's address) and AfterTouch need a probe, and STR can be installed or removed without the address changing.
