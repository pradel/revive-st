import { Effect } from "effect";
import { HttpApiBuilder } from "effect/http-api";

import { ReviveApi } from "../api/api.ts";
import { DeviceContactsRepo } from "../devices/device-contacts-repo.ts";
import { SOFTWARE_UPDATE_INDEX_XML } from "../updates/software-update-index.ts";

export const UpdatesHandlers = HttpApiBuilder.group(
  ReviveApi,
  "updates",
  (handlers) =>
    handlers.handle("softwareUpdateIndex", () =>
      Effect.succeed(SOFTWARE_UPDATE_INDEX_XML),
    ),
);

export const StatsHandlers = HttpApiBuilder.group(
  ReviveApi,
  "stats",
  Effect.fn(function* (handlers) {
    const contactsRepo = yield* DeviceContactsRepo;
    return handlers
      .handle("appStats", ({ params }) => contactsRepo.record(params.deviceId))
      .handle("deviceStats", ({ params }) =>
        contactsRepo.record(params.deviceId),
      );
  }),
);
