# Speakers Domain Model

- **BoseSpeaker**: The representation of a discovered speaker, including its state and available actions.
- **SpeakerManager**: The central orchestrator that manages speaker discovery, long-lived connections for state, and provides mutations for executing hardware commands.
- **Our server**: The Revive ST server picked in Settings (`https://api.revivest.app` by default, or a self-hosted one). The app talks to it and sets speakers up for it; a speaker whose `margeURL` is another server shows as needing setup.
- **Internet radio setup** (code: `features/configure`): Points a speaker at our server over its TAP console (port 17000): the bmx registry, stats, marge and software update addresses, then `envswitch boseurls set`, which saves them; pairs it with the household account and restarts it. A speaker is **set up** (status "Ready") when its `margeURL` is our server and it has an account; setup only finishes once the speaker, back from the restart, has contacted our server (its **last contact**, recorded by the server per device id).
- **Household account**: The Marge account a household's speakers are paired with, minted by our server. Its id is the secret that grants access to the household's presets, so only server-minted ids are shared between speakers. The phone remembers one per server.
