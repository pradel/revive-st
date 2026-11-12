# Stereo pairs: one speaker in the app, one stored pair on the server

Two SoundTouch 10s can play as one stereo pair: a firmware **group**, separate from multiroom zones, with a LEFT speaker that is the master and a RIGHT one. We measured it on two ST10s on firmware 27.0.6 before building it, since the reference projects (AfterTouch, streborn, soundcork) disagree on the order of requests:

- `POST /addGroup` to the master alone forms the pair; the partner joins by itself. The master's firmware then POSTs the pair to Marge and adopts the id Marge answers. `/updateGroup` to the master renames both (the firmware PUTs `/group/{id}`), and `/removeGroup` to either speaker clears both (that speaker DELETEs the pair on Marge).
- The Marge pair is authoritative. Each speaker asks `…/device/{id}/group` at every start, and the master again when its partner drops; answering `<group/>` while they're paired makes both drop the pair, without telling the server. Before this change our server always answered `<group/>`, so a pair broke at the next restart.
- While paired, volume, power and sources set on either speaker apply to both.

**Our server keeps one row per pair**, with a 7-digit id it generates, and answers every member's poll with it. The PUTs the firmware sends on rename, and on power or source changes, carry the sending speaker as master, so the server only takes the name from them. A new pair naming a speaker already in a stored pair replaces the stored one: the firmware only asks Marge to create a pair after checking that neither speaker is in one, so a stored pair it contradicts is stale (a pair dropped without telling the server, a factory reset). The account-wide `DELETE …/group`, which names no pair, is acknowledged without deleting anything.

**The app lists a pair as one speaker, keyed by the master.** The pair's card, the selected speaker, the presets shelf and Now Playing all go to the master; the partner is reached through the pair's settings. Known speakers remember the pair so it stays one card while connecting or offline.

## Considered options

- **Pair through both speakers** (AfterTouch posts `addGroup` to the master, then to the partner; soundcork to both at once): rejected. On hardware the master alone forms the pair, and a second `addGroup` answers `5510 GROUP_ALREADY_EXISTS_ERROR`.
- **Answer 409 to a pair naming a speaker already in a stored pair** (AfterTouch): rejected. A stale stored pair would make every new pair of that speaker fail on the speaker (`5580`), with nothing the app could do about it.
- **Adopt pairs the server doesn't know** (streborn, which can read the speakers): rejected. Our server can't see the speakers, and before this change pairs couldn't be stored on it at all.
- **Show both speakers of a pair as separate cards**: rejected. They play the same thing at the same volume, and two cards would invite opposite commands.
