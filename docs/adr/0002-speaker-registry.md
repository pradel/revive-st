# One speaker registry outside React

The app kept what it knew about speakers in three places: the client's `Speaker` objects, a flattened copy in a 1,000-line React hook (`useSpeakerManager`, shared through `BoseContext`) that also held discovery, connections, preset sync and thirteen near-identical mutations, and the remembered list in storage. None of it could be tested without React, and every command repeated the same lookup, error handling and re-read.

The app now has one **speaker registry** (`apps/app/src/features/speakers/registry/`): a plain module with ports (speaker, scanner, storage, our server, timers) like the setup sessions, tested with fakes, and read by screens through `useSyncExternalStore` (`useSpeakers()`, `useSpeaker(id)`). It holds one record per device id: who and where the speaker is and, once reached, its live state. It lists the remembered speakers at launch, reaches them and scans, reconnects when the app comes back to the foreground, syncs presets to our server for speakers on it, and remembers the list. Commands go through `useSpeakerCommands()`, which shares one helper for the client lookup, the error and the re-read after a command.

Behaviour is unchanged: the same speakers are listed in the same states, the same requests are made, and the radio setup query (`useRadioSetupQuery`) is untouched.

## Considered options

- **Split the hook into smaller hooks**: rejected. The state would still live in React, shared through context, and stay untestable without rendering.
- **React Query as the store**: rejected. Speaker state is pushed by each speaker's WebSocket, which fits an external store, not query invalidation.
