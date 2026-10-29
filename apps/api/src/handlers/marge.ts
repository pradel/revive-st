import { createHash } from "node:crypto";

import { DateTime, Effect, Schema } from "effect";
import { HttpApiBuilder, HttpApiError, HttpApiSchema } from "effect/http-api";

import { ReviveApi } from "../api/api.ts";
import { SpeakerPresetXml, SpeakerRecentXml } from "../api/marge.ts";
import { sourceWithId } from "../marge/sources.ts";
import { ContentItem, Preset } from "../presets/preset.ts";
import { PresetsRepo } from "../presets/presets-repo.ts";
import {
  createAccountFullXml,
  createPresetsXml,
  createPresetXml,
  createRecentXml,
  createSoftwareUpdateXml,
  createSourceProvidersXml,
  createStatusOkXml,
} from "../utils/marge-xml.ts";

const decodeSpeakerPreset = Schema.decodeEffect(SpeakerPresetXml);
const decodeSpeakerRecent = Schema.decodeEffect(SpeakerRecentXml);

/**
 * A body with an `ETag` derived from it, so a speaker that sends the tag back
 * in `If-None-Match` gets a 304 until the body changes.
 */
const withEtag = (body: string) =>
  HttpApiSchema.withHeaders({
    body,
    headers: {
      ETag: createHash("sha256").update(body).digest("hex").slice(0, 16),
    },
  });

export const MargeHandlers = HttpApiBuilder.group(
  ReviveApi,
  "marge",
  Effect.fn(function* (handlers) {
    const presetsRepo = yield* PresetsRepo;

    return (
      handlers
        .handle("sourceProviders", () =>
          Effect.succeed(withEtag(createSourceProvidersXml())),
        )
        .handle("account", ({ params }) =>
          Effect.succeed(withEtag(createAccountFullXml(params.accountId))),
        )
        .handle(
          "presets",
          Effect.fn(function* ({ params }) {
            const presets = yield* presetsRepo.findByDevice(params.deviceId);
            return withEtag(createPresetsXml(presets, params.accountId));
          }),
        )
        // Raw: speakers are not guaranteed to label the XML body with the
        // declared content type, so the body is decoded whatever its label.
        .handleRaw(
          "savePreset",
          Effect.fn(function* ({ params, request }) {
            const preset = yield* request.text.pipe(
              Effect.flatMap(decodeSpeakerPreset),
              Effect.tapError((error) =>
                Effect.logWarning("Rejected speaker preset", error),
              ),
              Effect.mapError(() => new HttpApiError.BadRequest()),
            );
            const location = preset.location ?? "";
            const source = sourceWithId(preset.sourceid ?? "");
            if (source === undefined) {
              // Storing it under a guessed source would hand the speaker back
              // a preset that plays from the wrong service.
              yield* Effect.logWarning(
                "Rejected preset from an unknown source",
                { sourceid: preset.sourceid },
              );
              return yield* new HttpApiError.BadRequest();
            }
            yield* presetsRepo.upsert(params.deviceId, [
              new Preset({
                id: params.presetId,
                contentItem: new ContentItem({
                  source: source.name,
                  type: preset.contentItemType ?? "stationurl",
                  location,
                  sourceAccount: source.username(params.accountId),
                  isPresetable: true,
                  itemName: preset.name ?? preset.username ?? "Unknown Preset",
                  containerArt: preset.containerArt ?? "",
                }),
              }),
            ]);
            const presets = yield* presetsRepo.findByDevice(params.deviceId);
            const saved = presets.find(({ id }) => id === params.presetId);
            if (saved === undefined) {
              return yield* Effect.die(
                "A stored preset could not be read back",
              );
            }
            return createPresetXml(saved, params.accountId);
          }),
        )
        .handle("softwareUpdate", () =>
          Effect.succeed(createSoftwareUpdateXml()),
        )
        // Raw for the same reason as `savePreset`. Recents are acknowledged,
        // not stored.
        .handleRaw(
          "addRecent",
          Effect.fn(function* ({ params, request }) {
            const recent = yield* request.text.pipe(
              Effect.flatMap(decodeSpeakerRecent),
              Effect.tapError((error) =>
                Effect.logWarning("Rejected speaker recent", error),
              ),
              Effect.mapError(() => new HttpApiError.BadRequest()),
            );
            const location = recent.location ?? "";
            const source = sourceWithId(recent.sourceid ?? "");
            if (source === undefined) {
              yield* Effect.logWarning(
                "Rejected recent from an unknown source",
                { sourceid: recent.sourceid },
              );
              return yield* new HttpApiError.BadRequest();
            }
            const now = DateTime.toEpochMillis(yield* DateTime.now);
            const lastPlayedAt = Date.parse(recent.lastplayedat ?? "");
            return createRecentXml(
              {
                // Seconds fit the int32 speakers store recent ids in.
                id: Math.floor(now / 1000),
                source,
                name: recent.name ?? "",
                location,
                contentItemType: recent.contentItemType ?? "stationurl",
                lastPlayedAt: Number.isNaN(lastPlayedAt) ? now : lastPlayedAt,
                createdOn: now,
              },
              params.accountId,
            );
          }),
        )
        .handle("powerOn", () => Effect.succeed(createStatusOkXml()))
        .handle("registerDevice", () => Effect.succeed(createStatusOkXml()))
    );
  }),
);
