import type { Preset } from "bose-api-speaker-client";
import type { Duration } from "effect";

/** The four server addresses a speaker keeps in its system configuration. */
export interface ServerUrls {
  readonly bmxRegistryUrl: string;
  readonly statsServerUrl: string;
  readonly margeServerUrl: string;
  readonly swUpdateUrl: string;
}

export const SERVER_URL_FIELDS = [
  "bmxRegistryUrl",
  "statsServerUrl",
  "margeServerUrl",
  "swUpdateUrl",
] as const satisfies readonly (keyof ServerUrls)[];

/** Bose's addresses, which a speaker never pointed elsewhere still has. */
export const BOSE_URLS: ServerUrls = {
  bmxRegistryUrl: "https://content.api.bose.io/bmx/registry/v1/services",
  statsServerUrl: "https://events.api.bosecm.com",
  margeServerUrl: "https://streaming.bose.com",
  swUpdateUrl: "https://worldwide.bose.com/updates/soundtouch",
};

/** A music source the speaker copied from its account's `/full`. */
export interface AccountSource {
  /** The id `/full` gave it, which presets and recents name as `sourceid`. */
  readonly id: string;
  /** Its type, e.g. `RADIO_BROWSER`, named by its `sourceproviderid`. */
  readonly source: string;
  readonly sourceAccount: string;
}

/**
 * The speaker as it is when the emulator starts: on, done booting and calling
 * no server until it restarts.
 */
export interface SpeakerConfig {
  /** The MAC address, upper-case without separators, e.g. `A81B6A631A1E`. */
  readonly deviceId: string;
  /** Default `SoundTouch <last 4 of deviceId>`. */
  readonly name?: string;
  /** Default `SoundTouch 10`. */
  readonly type?: string;
  /** Default `BOSE_URLS`. */
  readonly urls?: ServerUrls;
  /** Default "": paired with no account. */
  readonly margeAccountUUID?: string;
  readonly presets?: readonly Preset[];
  /** Sources it copied from its account; all `READY`. */
  readonly accountSources?: readonly AccountSource[];
  /** Between `sys reboot` and going down. Default 50 ms. */
  readonly shutdownDelay?: Duration.Input;
  /** Down this long while restarting. Default 100 ms. */
  readonly restartDelay?: Duration.Input;
}

/** Firmware 27.0.6, the last SoundTouch release. */
export const FIRMWARE_VERSION =
  "27.0.6.46330.5043500 epdbuild.trunk.hepdswbld04.2022-08-04T11:20:29";

export const USER_AGENT = "Bose_Lisa/27.0.6";
