import { randomUUID } from "node:crypto";

import { Effect } from "effect";
import { HttpApiBuilder, HttpApiError } from "effect/http-api";

import { ReviveApi } from "../api/api.ts";
import { DeviceContactsRepo } from "../devices/device-contacts-repo.ts";
import { DevicesRepo } from "../devices/devices-repo.ts";
import { AccountId } from "../marge/account.ts";
import { sourceNamed } from "../marge/sources.ts";
import { PresetsRepo } from "../presets/presets-repo.ts";

export const InternalHandlers = HttpApiBuilder.group(
  ReviveApi,
  "internal",
  Effect.fn(function* (handlers) {
    const presetsRepo = yield* PresetsRepo;
    const devicesRepo = yield* DevicesRepo;
    const contactsRepo = yield* DeviceContactsRepo;

    return handlers
      .handle("createAccount", () =>
        Effect.sync(() => ({ accountId: AccountId.make(randomUUID()) })),
      )
      .handle(
        "syncPresets",
        Effect.fn(function* ({ params, payload }) {
          // The app reads the account from the speaker itself.
          if (!(yield* devicesRepo.pair(params.accountId, params.deviceId))) {
            return yield* new HttpApiError.Conflict();
          }
          // The app syncs every slot the speaker has, and the speaker mirrors
          // the stored presets at boot, so they replace what was stored. Only
          // presets from a source the account offers can be served back.
          yield* presetsRepo.replace(
            params.accountId,
            params.deviceId,
            payload.presets.filter(
              (preset) => sourceNamed(preset.contentItem.source) !== undefined,
            ),
          );
          return { success: true } as const;
        }),
      )
      .handle(
        "deviceContact",
        Effect.fn(function* ({ params }) {
          const lastContactAt = yield* contactsRepo.lastContactAt(
            params.deviceId,
          );
          return { lastContactAt: lastContactAt ?? null };
        }),
      );
  }),
);
