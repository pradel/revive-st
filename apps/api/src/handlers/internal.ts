import { Effect } from "effect";
import { HttpApiBuilder } from "effect/http-api";

import { ReviveApi } from "../api/api.ts";
import { sourceNamed } from "../marge/sources.ts";
import { PresetsRepo } from "../presets/presets-repo.ts";

export const InternalHandlers = HttpApiBuilder.group(
  ReviveApi,
  "internal",
  Effect.fn(function* (handlers) {
    const presetsRepo = yield* PresetsRepo;

    return handlers.handle(
      "syncPresets",
      Effect.fn(function* ({ params, payload }) {
        // The app syncs every slot the speaker has, but only presets from a
        // source the account offers can be served back to it.
        yield* presetsRepo.upsert(
          params.deviceId,
          payload.presets.filter(
            (preset) => sourceNamed(preset.contentItem.source) !== undefined,
          ),
        );
        return { success: true } as const;
      }),
    );
  }),
);
