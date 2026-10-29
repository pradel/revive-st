import { Schema } from "effect";
import { HttpApiEndpoint, HttpApiGroup } from "effect/http-api";

import { AccountId } from "../marge/account.ts";
import { DeviceId, Preset } from "../presets/preset.ts";

/** Endpoints the revive-st app calls directly. */
export class InternalApi extends HttpApiGroup.make("internal")
  .add(
    /**
     * A new household account id. Minted here because the app has no
     * cryptographic random source without a native module.
     */
    HttpApiEndpoint.post("createAccount", "/accounts", {
      success: Schema.Struct({ accountId: AccountId }),
    }),
    HttpApiEndpoint.post(
      "syncPresets",
      "/account/:accountId/device/:deviceId/presets",
      {
        params: { accountId: AccountId, deviceId: DeviceId },
        payload: Schema.Struct({ presets: Schema.Array(Preset) }),
        success: Schema.Struct({ success: Schema.Literal(true) }),
      },
    ),
  )
  .prefix("/api/internal") {}
