import { Schema } from "effect";
import {
  HttpApiEndpoint,
  HttpApiError,
  HttpApiGroup,
  OpenApi,
} from "effect/http-api";

import { MAX_DEVICES_PER_ACCOUNT } from "../devices/devices-repo.ts";
import { AccountId } from "../marge/account.ts";
import { DeviceId, Preset, SpeakerDeviceId } from "../presets/preset.ts";

/** A speaker's presets: at most one per button, so at most six. */
const DevicePresets = Schema.Array(Preset).check(
  Schema.isMaxLength(6),
  Schema.makeFilter(
    (presets: readonly Preset[]) =>
      new Set(presets.map(({ id }) => id)).size === presets.length,
    { expected: "at most one preset per button" },
  ),
);

/** Endpoints the revive-st app calls directly. */
export class InternalApi extends HttpApiGroup.make("internal")
  .add(
    HttpApiEndpoint.post("createAccount", "/accounts", {
      success: Schema.Struct({ accountId: AccountId }).annotate({
        description: "The new account id, a UUID.",
      }),
    }).annotateMerge(
      OpenApi.annotations({
        summary: "Create a household account",
        description:
          "A new, unguessable household account id. Minted here because the app has no cryptographic random source without a native module.",
      }),
    ),
    HttpApiEndpoint.post(
      "syncPresets",
      "/account/:accountId/device/:deviceId/presets",
      {
        params: { accountId: AccountId, deviceId: DeviceId },
        payload: Schema.Struct({ presets: DevicePresets }).annotate({
          description: "Every preset the speaker has.",
        }),
        success: Schema.Struct({ success: Schema.Literal(true) }).annotate({
          description: "The presets are stored.",
        }),
        error: HttpApiError.Conflict,
      },
    ).annotateMerge(
      OpenApi.annotations({
        summary: "Sync a speaker's presets",
        description: `Stores the presets the app read from the speaker, so the speaker gets them back from the Marge presets endpoint. Pairs the speaker with the account and replaces its stored presets: slots left out are deleted, and an empty list clears them all. Presets from a source the account doesn't offer are dropped. At most one preset per button. \`409\` when the account already has ${MAX_DEVICES_PER_ACCOUNT} other speakers; nothing is stored then.`,
      }),
    ),
    HttpApiEndpoint.get("deviceContact", "/device/:deviceId/contact", {
      params: { deviceId: SpeakerDeviceId },
      success: Schema.Struct({
        lastContactAt: Schema.NullOr(Schema.Number).annotate({
          description:
            "When the speaker last made a request to this server, in epoch milliseconds; `null` if it never did.",
        }),
      }),
    }).annotateMerge(
      OpenApi.annotations({
        summary: "Get a speaker's last contact",
        description:
          "When the speaker last called this server: at boot (`power_on`), a Marge endpoint naming its device id, or its stats. The app reads it after configuring and rebooting a speaker to confirm the speaker reached the server. Takes no account id: it only reveals that a speaker contacted this server, and when. A device id that isn't 12 hex digits gets `400`.",
      }),
    ),
  )
  .prefix("/api/internal")
  .annotateMerge(
    OpenApi.annotations({
      title: "App",
      description: "Endpoints the Revive ST app calls directly.",
    }),
  ) {}
