import type { Preset, SpeakerGroup } from "bose-api-speaker-client";

import {
  ManualClock,
  type SchedulingClock,
} from "../../../onboarding/session/testing/fakes";
import { serverUrlsFor } from "../console";
import type { ConfigureTarget } from "../types";
import {
  FakeConfigureWorld,
  type FakeSpeakerConfig,
  type FakeWorldConfig,
} from "./fakes";

export const SERVER_ORIGIN = "https://api.revivest.app";
export const TARGET_ID = "AABBCCDDEEFF";
export const TARGET_HOST = "192.168.1.20";
export const NEW_HOST = "192.168.1.42";
export const NEW_ACCOUNT = "4f0c6d1e-7c1a-4b8e-9f3a-2d5b6c7e8f90";
export const HOUSEHOLD_ACCOUNT = "9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d";
/** An account id from Bose's cloud. */
export const BOSE_ACCOUNT = "3141592";
export const PARTNER_ID = "112233445566";

/** The target is the left speaker, `PARTNER_ID` the right one. */
export const STEREO_PAIR: SpeakerGroup = {
  id: "1115893",
  name: "Kitchen + Living room",
  masterDeviceId: TARGET_ID,
  roles: [
    { deviceId: TARGET_ID, role: "LEFT", ipAddress: TARGET_HOST },
    { deviceId: PARTNER_ID, role: "RIGHT", ipAddress: "192.168.1.21" },
  ],
  status: "GROUP_OK",
};

export const PRESETS: Preset[] = [
  {
    id: 1,
    contentItem: {
      source: "TUNEIN",
      type: "stationurl",
      location: "/v1/playback/station/s24861",
      sourceAccount: "",
      isPresetable: true,
      itemName: "FIP",
      containerArt: "",
    },
  },
];

function speakerConfig(
  overrides: Partial<FakeSpeakerConfig> = {},
): FakeSpeakerConfig {
  return {
    deviceID: TARGET_ID,
    name: "Kitchen",
    host: TARGET_HOST,
    presets: PRESETS,
    ...overrides,
  };
}

function worldConfig(
  overrides: Partial<Omit<FakeWorldConfig, "speaker">> & {
    speaker?: Partial<FakeSpeakerConfig>;
  } = {},
): FakeWorldConfig {
  const { speaker: speakerOverrides, ...rest } = overrides;
  return {
    server: { origin: SERVER_ORIGIN },
    newAccountId: NEW_ACCOUNT,
    ...rest,
    speaker: speakerConfig(speakerOverrides),
  };
}

export interface Scenario {
  description: string;
  config: () => FakeWorldConfig;
}

export const scenarios = {
  happyPath: {
    description: "Unpaired speaker on Bose's servers, first setup",
    config: () => worldConfig(),
  },
  reconfigure: {
    description:
      "Paired speaker already on this server, answering for a while after the restart command",
    config: () =>
      worldConfig({
        speaker: {
          urls: serverUrlsFor(SERVER_ORIGIN),
          margeAccountUUID: HOUSEHOLD_ACCOUNT,
          shutdownDelayMs: 8000,
        },
      }),
  },
  newAddress: {
    description: "Comes back from the restart on another IP address",
    config: () => worldConfig({ speaker: { hostAfterRestart: NEW_HOST } }),
  },
  slowRestart: {
    description: "Takes over 3 minutes to come back",
    config: () => worldConfig({ speaker: { restartMs: 200_000 } }),
  },
  consoleClosed: {
    description: "Nothing answers on port 17000",
    config: () => worldConfig({ speaker: { consoleClosed: true } }),
  },
  refusesEnvswitch: {
    description: "Firmware without envswitch",
    config: () => worldConfig({ speaker: { refuses: "envswitch" } }),
  },
  ignoresSettings: {
    description: "Accepts the addresses but keeps the old ones",
    config: () => worldConfig({ speaker: { ignoresSysConfiguration: true } }),
  },
  forgetsAtRestart: {
    description: "Restarts with its old addresses",
    config: () => worldConfig({ speaker: { forgetsAtRestart: true } }),
  },
  noHttpPairing: {
    description: "Firmware without POST /setMargeAccount",
    config: () => worldConfig({ speaker: { noHttpPairing: true } }),
  },
  oldServer: {
    description: "Self-hosted server that can't report speaker requests",
    config: () =>
      worldConfig({
        server: { origin: SERVER_ORIGIN, noContactEndpoint: true },
      }),
  },
  serverTooOld: {
    description: "Self-hosted server older than this app supports",
    config: () =>
      worldConfig({ server: { origin: SERVER_ORIGIN, version: "0.0.1" } }),
  },
  speakerOffline: {
    description: "Speaker never contacts the server after the restart",
    config: () => worldConfig({ speaker: { contactsServer: false } }),
  },
  presetsRejected: {
    description: "Server refuses the presets",
    config: () =>
      worldConfig({ server: { origin: SERVER_ORIGIN, rejectsPresets: true } }),
  },
  presetsHang: {
    description: "Server takes the presets request and never answers",
    config: () =>
      worldConfig({ server: { origin: SERVER_ORIGIN, presetsHang: true } }),
  },
  stereoPairMoving: {
    description:
      "SoundTouch 10 in a stereo pair on Bose's servers, moving to this server",
    config: () =>
      worldConfig({
        speaker: {
          type: "SoundTouch 10",
          margeAccountUUID: BOSE_ACCOUNT,
          group: STEREO_PAIR,
        },
        otherSpeakers: [{ deviceID: PARTNER_ID, speakerName: "Living room" }],
      }),
  },
  stereoPairAgain: {
    description: "SoundTouch 10 in a stereo pair, set up again for this server",
    config: () =>
      worldConfig({
        speaker: {
          type: "SoundTouch 10",
          urls: serverUrlsFor(SERVER_ORIGIN),
          margeAccountUUID: HOUSEHOLD_ACCOUNT,
          group: STEREO_PAIR,
        },
      }),
  },
  groupReadHangs: {
    description: "SoundTouch 10 that never says whether it's in a stereo pair",
    config: () =>
      worldConfig({
        speaker: {
          type: "SoundTouch 10",
          margeAccountUUID: BOSE_ACCOUNT,
          group: STEREO_PAIR,
          groupHangs: true,
        },
      }),
  },
} satisfies Record<string, Scenario>;

export type ScenarioName = keyof typeof scenarios;

export function createScenario(
  name: ScenarioName,
  clock: SchedulingClock = new ManualClock(),
): FakeConfigureWorld {
  return new FakeConfigureWorld(scenarios[name].config(), clock);
}

/** The target the speaker list would pass for `world`'s speaker. */
export function targetOf(world: FakeConfigureWorld): ConfigureTarget {
  const { speaker, otherSpeakers } = world.config;
  return {
    deviceID: speaker.deviceID,
    name: speaker.name,
    host: speaker.host,
    otherSpeakers: otherSpeakers ?? [],
  };
}
