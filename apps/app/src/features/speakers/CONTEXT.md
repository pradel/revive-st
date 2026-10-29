# Speakers Domain Model

- **BoseSpeaker**: The representation of a discovered speaker, including its state and available actions.
- **SpeakerManager**: The central orchestrator that manages speaker discovery, long-lived connections for state, and provides mutations for executing hardware commands.
- **Household account**: The Marge account a household's speakers are paired with, minted by our server. Its id is the secret that grants access to the household's presets, so only server-minted ids are shared between speakers.
