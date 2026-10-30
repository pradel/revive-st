import { Schema } from "effect";
import { HttpApiEndpoint, HttpApiGroup, OpenApi } from "effect/http-api";

import { AccountId } from "../marge/account.ts";
import { DeviceId, Preset } from "../presets/preset.ts";

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
        payload: Schema.Struct({ presets: Schema.Array(Preset) }).annotate({
          description: "Every preset the speaker has.",
        }),
        success: Schema.Struct({ success: Schema.Literal(true) }).annotate({
          description: "The presets are stored.",
        }),
      },
    ).annotateMerge(
      OpenApi.annotations({
        summary: "Sync a speaker's presets",
        description:
          "Stores the presets the app read from the speaker, so the speaker gets them back from the Marge presets endpoint. Pairs the speaker with the account and replaces its stored presets: slots left out are deleted, and an empty list clears them all. Presets from a source the account doesn't offer are dropped.",
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
