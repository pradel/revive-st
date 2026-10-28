import { Effect, Schema } from "effect";
import { HttpApiBuilder, HttpApiError, HttpApiSchema } from "effect/http-api";

import { ReviveApi } from "../api/api.ts";
import { SpeakerPresetXml } from "../api/marge.ts";
import { ContentItem, Preset } from "../presets/preset.ts";
import { PresetsRepo } from "../presets/presets-repo.ts";
import {
  createAccountFullXml,
  createPresetsXml,
  createRecentItemResponseXml,
  createSoftwareUpdateXml,
  createSourceProvidersXml,
  createStatusOkXml,
} from "../utils/marge-xml.ts";

const decodeSpeakerPreset = Schema.decodeEffect(SpeakerPresetXml);

export const MargeHandlers = HttpApiBuilder.group(
  ReviveApi,
  "marge",
  Effect.fn(function* (handlers) {
    const presetsRepo = yield* PresetsRepo;

    return (
      handlers
        .handle("sourceProviders", () =>
          Effect.succeed(
            HttpApiSchema.withHeaders({
              body: createSourceProvidersXml(),
              headers: { ETag: "1" },
            }),
          ),
        )
        .handle("account", ({ params }) =>
          Effect.succeed(createAccountFullXml(params.accountId)),
        )
        .handle(
          "presets",
          Effect.fn(function* ({ params }) {
            const presets = yield* presetsRepo.findByDevice(params.deviceId);
            return HttpApiSchema.withHeaders({
              body: createPresetsXml(presets),
              headers: { ETag: "1" },
            });
          }),
        )
        // Raw: speakers are not guaranteed to label the XML body with the
        // declared content type, so the body is decoded whatever its label.
        .handleRaw(
          "savePreset",
          Effect.fn(function* ({ params, request }) {
            const { name, location } = yield* request.text.pipe(
              Effect.flatMap(decodeSpeakerPreset),
              Effect.tapError((error) =>
                Effect.logWarning("Rejected speaker preset", error),
              ),
              Effect.mapError(() => new HttpApiError.BadRequest()),
            );
            yield* presetsRepo.upsert(params.deviceId, [
              new Preset({
                id: params.presetId,
                contentItem: new ContentItem({
                  source: "LOCAL_INTERNET_RADIO",
                  location,
                  sourceAccount: "revivest-user",
                  isPresetable: true,
                  itemName: name,
                }),
              }),
            ]);
            return createStatusOkXml();
          }),
        )
        .handle("softwareUpdate", () =>
          Effect.succeed(createSoftwareUpdateXml()),
        )
        .handle("addRecent", ({ params }) =>
          Effect.succeed(
            HttpApiSchema.withHeaders({
              body: createRecentItemResponseXml("1"),
              headers: {
                Location: `http://localhost:8000/account/${params.accountId}/device/${params.deviceId}/recent/1`,
              },
            }),
          ),
        )
        .handle("powerOn", () => Effect.succeed(createStatusOkXml()))
        .handle("registerDevice", () => Effect.succeed(createStatusOkXml()))
    );
  }),
);
