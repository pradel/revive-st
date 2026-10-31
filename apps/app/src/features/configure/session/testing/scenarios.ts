import type { Preset } from "bose-api-speaker-client";

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
export const MINTED_ACCOUNT = "4f0c6d1e-7c1a-4b8e-9f3a-2d5b6c7e8f90";
export const HOUSEHOLD_ACCOUNT = "9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d";

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
    mintedAccountId: MINTED_ACCOUNT,
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
  speakerOffline: {
    description: "Speaker never contacts the server after the restart",
    config: () => worldConfig({ speaker: { contactsServer: false } }),
  },
  presetsRejected: {
    description: "Server refuses the presets",
    config: () =>
      worldConfig({ server: { origin: SERVER_ORIGIN, rejectsPresets: true } }),
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
