import {
  type FakeAccessPoint,
  type FakeSpeakerConfig,
  FakeWorld,
  type FakeWorldConfig,
  type SchedulingClock,
  setupScanResult,
} from "./fakes";

export const HOME_SSID = "HomeWiFi";
export const HOME_PASSWORD = "correct-horse-battery";
export const OFFICE_SSID = "Office5G";
export const OFFICE_PASSWORD = "office-password";
export const OPEN_SSID = "CafeOpen";

export const TARGET_ID = "AABBCCDDEEFF";
export const TARGET_HOME_IP = "192.168.1.20";
export const SECOND_ID = "A1B2C3112233";
export const OTHER_ID = "0A0B0C0D0E0F";

const WPA2 = "[WPA2-PSK-CCMP][RSN-PSK-CCMP][ESS]";

/** Dual-band WPA2 home network, a 5 GHz-only network and an open one. */
export function homeNetworks(): FakeAccessPoint[] {
  return [
    {
      ssid: HOME_SSID,
      bssid: "aa:00:00:00:00:01",
      frequencyMHz: 2437,
      level: -58,
      capabilities: WPA2,
      password: HOME_PASSWORD,
    },
    {
      ssid: HOME_SSID,
      bssid: "aa:00:00:00:00:02",
      frequencyMHz: 5200,
      level: -51,
      capabilities: WPA2,
      password: HOME_PASSWORD,
    },
    {
      ssid: OFFICE_SSID,
      bssid: "aa:00:00:00:00:03",
      frequencyMHz: 5180,
      level: -67,
      capabilities: "[RSN-PSK-CCMP][ESS]",
      password: OFFICE_PASSWORD,
    },
    {
      ssid: OPEN_SSID,
      bssid: "aa:00:00:00:00:04",
      frequencyMHz: 2462,
      level: -72,
      capabilities: "[ESS]",
      password: "",
    },
  ];
}

/** The SoundTouch 10 measured in docs/speaker-setup.md, factory reset, in setup mode. */
export function targetSpeaker(
  overrides: Partial<FakeSpeakerConfig> = {},
): FakeSpeakerConfig {
  return {
    deviceID: TARGET_ID,
    name: "Bose SoundTouch DDEEFF",
    type: "SoundTouch 10",
    model: "ST 10",
    bssid: "00:11:22:33:44:56",
    level: -46,
    homeIp: TARGET_HOME_IP,
    ...overrides,
  };
}

function world(overrides: Partial<FakeWorldConfig> = {}): FakeWorldConfig {
  return {
    homeNetworks: homeNetworks(),
    speakers: [targetSpeaker()],
    ...overrides,
  };
}

export interface Scenario {
  description: string;
  config: () => FakeWorldConfig;
}

export const scenarios = {
  happyPath: {
    description: "Factory-reset speaker, phone on dual-band WPA2 home Wi-Fi",
    config: () => world(),
  },
  twoSpeakers: {
    description: "Two speakers in setup mode",
    config: () =>
      world({
        speakers: [
          targetSpeaker(),
          targetSpeaker({
            deviceID: SECOND_ID,
            name: "Bose SoundTouch 112233",
            model: "ST 20",
            type: "SoundTouch 20",
            bssid: "00:11:22:aa:bb:cc",
            level: -60,
            homeIp: "192.168.1.21",
          }),
        ],
      }),
  },
  permissionDenied: {
    description: "Location denied; Android can ask again",
    config: () =>
      world({
        permissions: { granted: false, fine: false, canAskAgain: true },
      }),
  },
  permissionBlocked: {
    description: "Location permanently denied",
    config: () =>
      world({
        permissions: { granted: false, fine: false, canAskAgain: false },
      }),
  },
  coarseLocation: {
    description: "Approximate location only",
    config: () =>
      world({ permissions: { granted: true, fine: false, canAskAgain: true } }),
  },
  locationServicesOff: {
    description: "Location services off",
    config: () => world({ permissions: { servicesEnabled: false } }),
  },
  wifiOff: {
    description: "Phone Wi-Fi off",
    config: () => world({ phone: { wifiEnabled: false } }),
  },
  speakerOnThirdScan: {
    description: "The first two scans miss the speaker",
    config: () => world({ scan: { missSetupScans: 2 } }),
  },
  scanThrottled: {
    description:
      "Scans throttled: only stale results (which include the speaker)",
    config: () =>
      world({
        scan: { throttled: true, cached: [setupScanResult(targetSpeaker())] },
      }),
  },
  approvalCancelled: {
    description: "The Android approval dialog is cancelled once",
    config: () => world({ join: { outcomes: ["rejected", "ok"] } }),
  },
  joinHangs: {
    description: "Android never answers the network request",
    config: () => world({ join: { outcomes: ["hang"] } }),
  },
  slowSpeaker: {
    description: "/info silent for 5 s after joining",
    config: () =>
      world({ speakers: [targetSpeaker({ silentAfterLinkMs: 5000 })] }),
  },
  silentSpeaker: {
    description: "/info never answers over the setup network",
    config: () =>
      world({ speakers: [targetSpeaker({ silentAfterLinkMs: 3_600_000 })] }),
  },
  openHomeNetwork: {
    description: "Phone on an open home network",
    config: () => world({ phone: { ssid: OPEN_SSID } }),
  },
  profileNeverReplies: {
    description: "addWirelessProfile never replies (the speaker still joins)",
    config: () =>
      world({ speakers: [targetSpeaker({ addProfileReply: "never" })] }),
  },
  linkDropsOnSend: {
    description: "The setup network drops when the credentials are sent",
    config: () =>
      world({ speakers: [targetSpeaker({ addProfileReply: "dropLink" })] }),
  },
  otherApiError: {
    description: "addWirelessProfile replies with an unexpected ApiError",
    config: () =>
      world({
        speakers: [
          targetSpeaker({
            addProfileReply: {
              apiError: {
                errorName: "HTTP_STATUS_SERVER_ERROR",
                value: 1029,
                message: "internal",
              },
            },
          }),
        ],
      }),
  },
  httpError: {
    description: "addWirelessProfile replies HTTP 500 without <errors>",
    config: () =>
      world({
        speakers: [targetSpeaker({ addProfileReply: { httpStatus: 500 } })],
      }),
  },
  noWlan0Address: {
    description: "/networkInfo never shows wlan0's address",
    config: () =>
      world({ speakers: [targetSpeaker({ hideWlan0Address: true })] }),
  },
  leaveOverLinkFails: {
    description: "SETUP_LEAVE over the setup network fails",
    config: () =>
      world({ speakers: [targetSpeaker({ leaveOverLink: "fails" })] }),
  },
  phoneLosesHomeWifi: {
    description:
      "Phone off Wi-Fi after leaving the setup network; back after 20 s",
    config: () =>
      world({ phone: { losesHomeOnRelease: { restoreAfterMs: 20_000 } } }),
  },
  phoneStaysOffWifi: {
    description: "Phone off Wi-Fi after leaving the setup network, for good",
    config: () =>
      world({ phone: { losesHomeOnRelease: { restoreAfterMs: null } } }),
  },
  otherSpeakerAnnouncesFirst: {
    description: "A configured SoundTouch announces before the new one",
    config: () =>
      world({
        speakers: [
          targetSpeaker({
            deviceID: OTHER_ID,
            name: "Kitchen",
            bssid: "00:11:22:dd:ee:ff",
            homeIp: "192.168.1.30",
            setupMode: false,
            preconfigured: { ssid: HOME_SSID },
          }),
          targetSpeaker({ hideWlan0Address: true }),
        ],
      }),
  },
  homeSilentAfterLeave: {
    description: "The speaker's API is silent for 8 s after SETUP_LEAVE",
    config: () => world({ speakers: [targetSpeaker({ leavePauseMs: 8000 })] }),
  },
  speakerNeverShowsUp: {
    description: "The speaker joins but is never found on the home network",
    config: () =>
      world({
        speakers: [targetSpeaker({ hideWlan0Address: true, announces: false })],
      }),
  },
  speakerNeverScanned: {
    description:
      "Scans never show the speaker (manual join from the scanning view works)",
    config: () => world({ scan: { missSetupScans: Number.MAX_SAFE_INTEGER } }),
  },
  renameFails: {
    description: "Setup works but renaming the speaker fails",
    config: () => world({ speakers: [targetSpeaker({ renameFails: true })] }),
  },
  reconfiguredSpeaker: {
    description:
      "Configured speaker put back in setup mode (already on the home network)",
    config: () =>
      world({
        speakers: [targetSpeaker({ preconfigured: { ssid: HOME_SSID } })],
      }),
  },
} satisfies Record<string, Scenario>;

export type ScenarioName = keyof typeof scenarios;

export function createScenario(
  name: ScenarioName,
  clock?: SchedulingClock,
): FakeWorld {
  return new FakeWorld(scenarios[name].config(), clock);
}
