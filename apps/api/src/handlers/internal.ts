import { Effect } from "effect";
import { HttpApiBuilder } from "effect/http-api";

import { ReviveApi } from "../api/api.ts";
import { PresetsRepo } from "../presets/presets-repo.ts";

export const InternalHandlers = HttpApiBuilder.group(
  ReviveApi,
  "internal",
  Effect.fn(function* (handlers) {
    const presetsRepo = yield* PresetsRepo;

    return handlers.handle(
      "syncPresets",
      Effect.fn(function* ({ params, payload }) {
        yield* presetsRepo.upsert(params.deviceId, payload.presets);
        return { success: true } as const;
      }),
    );
  }),
);
