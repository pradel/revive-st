# Speaker Wi-Fi setup: observed behaviour

What a SoundTouch speaker and an Android phone actually do during Wi-Fi setup, measured on hardware. The onboarding flow (`apps/app/src/features/onboarding/session/`) is based on this page. Anything not marked as measured is labelled **untested**.

## Test setup (2026-10-26, run E 2026-10-27)

| Item         | Value                                                                                                       |
| ------------ | ----------------------------------------------------------------------------------------------------------- |
| Speaker      | SoundTouch 10, firmware `27.0.6.46330.5043500` (2022-08-04)                                                 |
| Phone        | Google Pixel 11 Pro, Android 17 (SDK 37), mobile data on (LTE)                                              |
| Home network | `HomeWiFi` (placeholder name), dual-band WPA2 (2.4 GHz channel 6 + 5 GHz 5200 MHz)                          |
| App          | Dev build of the previous onboarding flow (`useWifiProvisioning`, since replaced), Metro over `adb reverse` |

Runs:

| Run | Speaker state at start                                                                | What was done                                                 |
| --- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| A   | Already configured for `HomeWiFi`, then put in setup mode (hold **2** + **Volume −**) | Full onboarding, correct password                             |
| C   | Factory reset (hold **1** + **Volume −** 10 s)                                        | Cancelled the Android "connect to device" dialog              |
| B   | Factory reset, in setup mode                                                          | Wrong password                                                |
| A2  | Same speaker right after B, still in setup mode                                       | Correct password, then `POST /setup SETUP_LEAVE` from the Mac |
| D   | Configured, on the home network                                                       | mDNS browse started with phone Wi-Fi off                      |
| E   | Configured, put in setup mode (hold **2** + **Volume −**)                             | New onboarding flow end to end, correct password              |

## Identity and addresses

One speaker exposes three MAC addresses. They are not derived from each other by a simple rule, so only the ones below can be used for matching.

| Value                               | Where it appears                                                                                     | Example                                                 |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| `deviceID`                          | `/info` `deviceID` attribute; `/info` `networkInfo type="SCM"`; mDNS TXT `MAC`; WebSocket `deviceID` | `AABBCCDDEEFF`                                          |
| Wi-Fi module MAC (station, `wlan0`) | `/info` `networkInfo type="SMSC"`; `/networkInfo` `wlan0`; mDNS hostname                             | `001122334455`, hostname `Bose-SM2-001122334455.local.` |
| Setup network BSSID (`wlan1`)       | Wi-Fi scan; `/networkInfo` `wlan1`                                                                   | `00:11:22:33:44:56` (station MAC + 1)                   |

MAC addresses, SSIDs and home-network IP addresses on this page are placeholders. The relationships between them (suffix, +1) are as measured.

- **Setup network SSID** is `Bose ST 10 (DDEEFF)`: model + the **last 6 hex characters of `deviceID`**. This suffix is what links the setup network to the speaker found later on the home network.
- The setup network is **open** (`[ESS]` only), on 2.4 GHz channel 1 (2412 MHz).
- The speaker's address on the setup network is always `192.0.2.1`.
- **mDNS** (`_soundtouch._tcp`): TXT record `DESCRIPTION=SoundTouch MAC=<deviceID> MANUFACTURER=Bose Corporation MODEL=SoundTouch`. Instance name is the speaker name: `Bose SoundTouch 10` when configured, `Bose SoundTouch DDEEFF` after a factory reset.
- Port 8090 serves the HTTP API on both the setup network and the home network.

## Setup mode

- **Entering:** hold **2** + **Volume −** for ~5 s (configured speaker), or factory reset with **1** + **Volume −** for 10 s; both end with a solid amber Wi-Fi light.
- **`GET /setup`** during setup mode: `<setupStateResponse state="SETUP_AP_OOB" systemstate="SETUP_LANG_NOT_SET" />`. After leaving: `state="SETUP_INACTIVE"`.
- **`GET /soundTouchConfigurationStatus`** after a factory reset: `SOUNDTOUCH_NOT_CONFIGURED` (unchanged after Wi-Fi setup and `SETUP_LEAVE`).
- **The speaker keeps its station connection while in setup mode.** In run A, the already-configured speaker stayed reachable at its home-network address the whole time, and its mDNS announcement never went away. A speaker answering on the home network is therefore **not** proof that new credentials worked.
- **The setup network does not shut down on its own after credentials are accepted.**
  - Run A: still broadcasting 13.8 min after `addWirelessProfile` returned OK, then shut down by itself.
  - Run A2: still broadcasting 5 min after OK, until `SETUP_LEAVE` was sent.
  - This contradicts community docs (AfterTouch) that say the speaker leaves AP mode 15–30 s after `addWirelessProfile`.
- **`POST /setup` with `<setupState state="SETUP_LEAVE"/>` ends setup mode.** Sent from the home network in run A2:
  - The reply echoes `<setupState state="SETUP_LEAVE" />`.
  - The HTTP API stopped answering for a few seconds (a request 3 s later timed out).
  - Within 20 s, the setup network was gone from scans, `/setup` reported `SETUP_INACTIVE`, and `wlan0` reported `NETWORK_WIFI_CONNECTED`.
  - **Sent over the setup network** (run E, new flow): the reply came back OK in 0.4 s, before the setup network dropped. 50 s later `/setup` reported `SETUP_INACTIVE`, `wlan0` `NETWORK_WIFI_CONNECTED` in `STATION` mode, and the setup network was gone from scans.

LED states seen:

| LED            | State                                                                          |
| -------------- | ------------------------------------------------------------------------------ |
| Solid amber    | Setup mode, setup network broadcasting                                         |
| Blinking white | After a wrong password, still in setup mode (setup network still broadcasting) |
| Dim white      | Connected to the home network, setup network off                               |

## Joining the setup network from Android

The speaker's DHCP server is too slow for Android's DHCP client, so a normal connection fails at IP assignment. The app avoids that:

- It calls `ConnectivityManager.requestNetwork()` with `NET_CAPABILITY_INTERNET` removed and a `WifiNetworkSpecifier` (SSID + BSSID).
- `onAvailable()` fires at L2 association, before DHCP, and the app calls `bindProcessToNetwork()` so all of its traffic goes to the setup network.
- The speaker is then reached at the fixed address `192.0.2.1`; no DHCP-assigned address is needed.

Measured:

- **Request → `onAvailable`:** 6.9 s (run A, no dialog), 4.5 s (run B).
- **`onAvailable` → first `/info` answer:** ≤ 3.2 s. The app probes every 3 s and the first probe succeeded; every probe after that also succeeded.
- **Approval dialog:** Android shows the "connect to device" dialog the first time. A later request for the same app and network was approved **without a dialog** (run C, first attempt), and the next attempt showed it again. This Android build's `adb shell cmd wifi` has no command to clear the approval; uninstalling the app does.
- **Cancel in the dialog → `onUnavailable` immediately**, not at the 90 s timeout. Run C: 7.5 s from request to `onUnavailable`, which was the time taken to tap Cancel.
- **The phone stays on the home network.** The Pixel kept its primary connection to the home network (5 GHz) for the whole flow, with the setup network as a second, local-only connection. There was no "phone left home Wi-Fi" phase to recover from. **Untested:** phones without dual-connection support.

## Scanning for the setup network

- The app's scan (`react-native-wifi-reborn` `reScanAndLoadWifiList`) **missed the speaker twice in a row** (13 and 16 networks found, no Bose). A USB-shell scan seconds earlier saw it at −46 dBm, and the app's third scan found it. A single scan is not enough.
- A shell scan (`cmd wifi start-scan`) takes ~4–5 s before fresh results are listed.

## Sending credentials: `POST /addWirelessProfile`

Body sent by `bose-api-speaker-client`:

```xml
<AddWirelessProfile timeout="30"><profile ssid="…" password="…" securityType="wpa_or_wpa2"></profile></AddWirelessProfile>
```

**The request blocks while the speaker tries to join**, and the reply is the verdict:

| Run                      | Credentials    | Reply                                                                                        | Duration |
| ------------------------ | -------------- | -------------------------------------------------------------------------------------------- | -------- |
| A (configured speaker)   | Correct        | HTTP OK                                                                                      | 15.4 s   |
| A2 (after factory reset) | Correct        | HTTP OK                                                                                      | 6.8 s    |
| E (configured speaker)   | Correct        | HTTP OK                                                                                      | 9.0 s    |
| B (after factory reset)  | Wrong password | `ApiError`: name `WIFI_PROFILE_SETUP_FAILED`, value `1035`, message `NO_IP_ADDRESS_ASSIGNED` | 35.0 s   |

- `timeout="30"` appears to be the join timeout in seconds: the wrong-password reply arrived about 30 s plus overhead after the request.
- After a failure the speaker **stays in setup mode** and the setup network keeps broadcasting (scans 20–40 s after the error still saw it at −45 dBm). The phone's connection stays usable, so a corrected password can be sent right away without reconnecting (run A2 did exactly that).
- `NO_IP_ADDRESS_ASSIGNED` is what a wrong WPA2 password produces. It cannot be told apart from a router refusing DHCP.
- The connection to the setup network was **not** dropped during or after a successful `addWirelessProfile` in either run. **Untested:** whether a transport error can happen on other phones or speakers.

## Reading join status: `GET /networkInfo`

Example during setup mode, after the correct password (run A2):

```xml
<networkInfo wifiProfileCount="1"><interfaces>
  <interface type="WIFI_INTERFACE" name="wlan0" macAddress="001122334455" ipAddress="192.168.1.20" ssid="HomeWiFi" state="NETWORK_WIFI_DISCONNECTED" />
  <interface type="WIFI_INTERFACE" name="wlan1" macAddress="001122334456" ipAddress="192.0.2.1" ssid="Bose ST 10 (DDEEFF)" frequencyKHz="2412000" state="NETWORK_WIFI_CONNECTED" mode="ACCESS_POINT" />
  <interface name="wlan0:avahi" macAddress="001122334455" ipAddress="" />
</interfaces></networkInfo>
```

- **While in setup mode, `wlan0`'s `state` says `NETWORK_WIFI_DISCONNECTED` even when it is connected** (it answered on its home-network address and announced itself over mDNS). Don't use `state` before `SETUP_LEAVE`.
- `wlan0`'s `ipAddress` + `ssid` were present 4 s after the OK reply. Polled every 2 s for 90 s over the setup network, they never changed. That is the speaker's home-network address, available before the phone leaves the setup network.
- Caveat: on a speaker that was configured before (run A), these fields hold the **existing** connection's values, so they don't prove that newly sent credentials worked. Only the `addWirelessProfile` reply does.
- After setup mode ends (run A: on its own; run A2: via `SETUP_LEAVE`), `wlan0` reports `state="NETWORK_WIFI_CONNECTED"` and `wlan1` `state="NETWORK_WIFI_DISCONNECTED"`. Run A also showed `mode="STATION"` and `signal="GOOD_SIGNAL"`/`"MARGINAL_SIGNAL"` on `wlan0`.
- `wifiProfileCount`: 2 on the configured speaker after run A (both runs used the same home network), 1 after factory reset + run A2.
- 3 of 45 polls over the setup network failed with a 1.5 s client timeout and then recovered. Probes need retries.

## Wi-Fi bands

- **The SoundTouch 10 joined the 5 GHz band** (`frequencyKHz="5200000"`) of the dual-band home network after `SETUP_LEAVE`. The current network picker's "2.4 GHz only" filter and copy are wrong for this model.
- **Untested:** a 5 GHz-only network, and SoundTouch 20/30.

## Finding the speaker on the home network

- **Matching:** the mDNS TXT `MAC` equals `deviceID`, so a discovered service can be matched to the speaker without an extra `/info` request.
- **Discovery started while offline** (run D: phone Wi-Fi off, zeroconf scan started, Wi-Fi back on 15 s later):
  - Starting the browse offline raised no error.
  - The speaker was resolved ~2 s after the phone reconnected.
  - **Untested:** Android 11–13.
- **Run A2** (current flow, without `SETUP_LEAVE`): the speaker announced itself on the home network 1.2 s _before_ `addWirelessProfile` returned OK. The app's discovery, started 106 s later, resolved it after 22.5 s.
- `react-native-zeroconf` on Android 16+ puts the mDNS hostname in `host`; use `ipv4[0]`.

## Open questions

| Question                                                                                                                                                               | Why it matters                                                                                   |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Are `SETUP_START` / language / `SETUP_ENTER` required for anything (`systemstate` stays `SETUP_LANG_NOT_SET`, configuration status stays `SOUNDTOUCH_NOT_CONFIGURED`)? | Marge pairing and the speaker's "not configured" prompts; AfterTouch documents the full sequence |
| `POST /performWirelessSiteSurvey` (networks as seen by the speaker)                                                                                                    | Better network list than the phone's scan                                                        |
| 5 GHz-only home networks; WPA3; hidden SSIDs                                                                                                                           | Network picker filtering and security type                                                       |
| Manual static-IP fallback with mobile data on                                                                                                                          | Whether the manual path needs explicit binding                                                   |
| Android 11–13 and non-Pixel phones: approval dialog, dual connections, mDNS offline start                                                                              | Device matrix                                                                                    |
| SoundTouch 20/30                                                                                                                                                       | All of the above                                                                                 |

## Internet radio setup over port 17000: untested

The internet radio setup (`apps/app/src/features/configure/session/`) runs after Wi-Fi setup, on the home network. None of it is measured on our hardware yet. It relies on what the vendored repositories document: `repos/Bose-SoundTouch` (`docs/content/docs/analysis/TELNET-COMMAND-REFERENCE.md`, `pkg/service/setup/telnet_migration.go`) and `repos/soundcork` (`soundcork/devices.py`, `README.md`).

| Assumption (source)                                                                                                                                                                                 | What the app does with it                                                                  | Measure                                                              |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | -------------------------------------------------------------------- |
| `envswitch boseurls set` saves the whole running configuration; a `sys configuration` value set after it is lost at restart (Bose-SoundTouch, five firmware variants)                               | Writes bmx, stats, marge and software update addresses, then `envswitch`                   | `getpdo CurrentSystemConfiguration` after a restart                  |
| `sys configuration` answers `OK`; `envswitch` answers `Setting Bose Server URLs to <a> and <b> ->`; refusals contain "command not found", "unknown command", "not implemented" or "Invalid Command" | Fails only on a refusal or no reply; the read-back decides                                 | Exact replies and timings on firmware 27.0.6                         |
| `getpdo CurrentSystemConfiguration` answers in blocks (`margeServerUrl {` / `text: "…"` / `}`) and shows the running values, not the saved ones                                                     | Read back before the restart (stops on a mismatch) and after it                            | Reply format; whether the fields are named as above                  |
| Firmware 27.0.6 sometimes takes over 2 s to accept a console connection (Bose-SoundTouch)                                                                                                           | 5 s connection timeout, 3 attempts; replies end after 600 ms of silence, 7 s max           | Connection and reply latency                                         |
| `sys reboot` closes the connection without a reply                                                                                                                                                  | A closed connection or no reply counts as sent                                             | Reply, and how long the API keeps answering after it                 |
| The speaker sends `POST /streaming/support/power_on` to its marge server at every start (soundcork)                                                                                                 | Setup finishes once the server has a newer contact for the speaker than before the restart | Time from `sys reboot` to `power_on`, and to `/info` answering again |
| A restart takes the speaker off the network for tens of seconds                                                                                                                                     | Down after two missed `/info` polls (45 s budget), back within 180 s                       | Down time; whether the address changes                               |
| `/info` `margeURL` may change before the restart                                                                                                                                                    | Not relied on: the restart is detected by the speaker going down                           | `margeURL` right after `envswitch`                                   |

## How to measure

The Mac must stay on the home network: if it joins the speaker's setup network, it loses internet. The phone talks to the speaker; the Mac observes.

- **Build and run the dev app:**
  - `apps/app/android` is generated and git-ignored. If Gradle complains about its version or the Kotlin plugin, regenerate it: `npx expo prebuild -p android --clean --no-install` in `apps/app`.
  - Install with `ANDROID_HOME=~/Library/Android/sdk npx expo run:android --no-bundler --device <adb model name>`.
  - Start Metro with `env -u CI npx expo start --dev-client` (with `CI` set, reloads are disabled).
- **Keep Metro reachable while the app is bound to the setup network:** `adb reverse tcp:8081 tcp:8081`, then open `exp+revive-st://expo-development-client/?url=http%3A%2F%2Flocalhost%3A8081`.
- **Native unit tests:** `ANDROID_HOME=~/Library/Android/sdk ./gradlew :expo-bose-wifi:testDebugUnitTest`, run from `apps/app/android` (after `npx expo prebuild -p android --no-install` in `apps/app`). Runs `LinkControllerTest` (JUnit, no device).
- **Simulated setup (no hardware):** in a dev build, Settings → Developer → Simulate speaker setup runs the onboarding UI against the fake scenarios in `apps/app/src/features/onboarding/session/testing/scenarios.ts` in real time.
- **Logs:** `adb logcat -v epoch -s BoseWifi:D ReactNativeJS:V`. `BoseWifi` is the native module; `ReactNativeJS` carries the app's `logger` output.
- **Phone-side Wi-Fi:**
  - `adb shell cmd wifi start-scan`, wait ≥ 8 s, then `adb shell cmd wifi list-scan-results`. The table includes BSSID, frequency, RSSI, age and flags.
  - `adb shell cmd wifi status` shows the primary connection.
  - `adb shell svc wifi disable|enable` toggles Wi-Fi.
- **Home-network side (Mac):**
  - `dns-sd -B _soundtouch._tcp local.` to browse; `dns-sd -L "<instance>" _soundtouch._tcp local.` shows host and TXT; `dns-sd -G v4 <host>.local` resolves the IP. Wrap in `script -q /dev/null …` to get unbuffered output when piping.
  - `curl http://<ip>:8090/{info,networkInfo,setup,getActiveWirelessProfile,soundTouchConfigurationStatus}`. Use the IP; resolving `.local` names through curl timed out.
- **Clocks:** phone `logcat` epoch times ran ~1.3 s ahead of the Mac's.
