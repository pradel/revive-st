# Speakers Domain Model

- **BoseSpeaker**: The representation of a discovered speaker, including its state and available actions.
- **SpeakerManager**: The central orchestrator that manages speaker discovery, long-lived connections for state, and provides mutations for executing hardware commands.
- **Our server**: The Revive ST server picked in Settings (`https://api.revivest.app` by default, or a self-hosted one). The app talks to it and configures speakers for it; a speaker whose `margeURL` is another server shows as not configured.
- **Household account**: The Marge account a household's speakers are paired with, minted by our server. Its id is the secret that grants access to the household's presets, so only server-minted ids are shared between speakers. The phone remembers one per server.
