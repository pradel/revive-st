import { Schema } from "effect";
import { HttpApiEndpoint, HttpApiGroup } from "effect/http-api";

import { DeviceId, Preset } from "../presets/preset.ts";

/** Endpoints the revive-st app calls directly. */
export class InternalApi extends HttpApiGroup.make("internal")
  .add(
    HttpApiEndpoint.post("syncPresets", "/device/:deviceId/presets", {
      params: { deviceId: DeviceId },
      payload: Schema.Struct({ presets: Schema.Array(Preset) }),
      success: Schema.Struct({ success: Schema.Literal(true) }),
    }),
  )
  .prefix("/api/internal") {}
