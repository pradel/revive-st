---
"@revive-st/app": minor
---

Rewrite speaker setup as a single screen driven by a cancellable setup session. Setup now explains location access and setup mode first, keeps scanning until the speaker shows up, offers a chooser when several speakers are in setup mode, explains the Android connection dialog, lists 2.4 and 5 GHz home networks with their security, supports open networks and manual network names, reports a wrong password without reconnecting to the speaker, takes the speaker out of setup mode, confirms the speaker on the home network by its device ID and continues to its configuration. Every failure offers recovery actions, leaving setup releases the speaker's network, and the screen stays awake while setup runs.
