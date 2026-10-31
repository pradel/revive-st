# Record each speaker's last contact, readable without an account

After the app configures a speaker over telnet and reboots it, it needs to confirm the speaker actually reached our server. The server therefore stores, per device id (upper-cased MAC address), the time of the speaker's last request: its boot report (`POST /streaming/support/power_on`), any Marge call naming its device id, and its stats (`POST /v1/stapp|scmudc/:deviceId`). `GET /api/internal/device/:deviceId/contact` returns it. Until now the server stored nothing about a speaker beyond the accounts it is paired with.

The endpoint takes no account id. A device id is the speaker's MAC address, visible to anyone on its network, and the endpoint only reveals that a speaker contacted this server, and when; recording never fails a speaker's request.

## Considered options

- **Gate the contact behind the household account** (`/account/:accountId/device/:deviceId/contact`): rejected. The boot report, the first request a reconfigured speaker makes, carries no account id, and a speaker still paired with a Bose account id never registers with ours, so the contacts that matter most could not be attributed to an account.
