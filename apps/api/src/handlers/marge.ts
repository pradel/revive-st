import { createHash } from "node:crypto";

import { parseXml } from "bose-api-speaker-client";
import { DateTime, Effect, Schema } from "effect";
import { HttpApiBuilder, HttpApiError, HttpApiSchema } from "effect/http-api";

import { ReviveApi } from "../api/api.ts";
import {
  SpeakerDeviceXml,
  SpeakerPresetXml,
  SpeakerRecentXml,
} from "../api/marge.ts";
import { DeviceContactsRepo } from "../devices/device-contacts-repo.ts";
import { DevicesRepo } from "../devices/devices-repo.ts";
import { sourceWithId } from "../marge/sources.ts";
import { ContentItem, Preset, SpeakerDeviceId } from "../presets/preset.ts";
import { PresetsRepo } from "../presets/presets-repo.ts";
import {
  createAccountFullXml,
  createDeviceXml,
  createPresetsXml,
  createPresetXml,
  createProviderSettingsXml,
  createRecentsXml,
  createRecentXml,
  createSoftwareUpdateXml,
  createSourceProvidersXml,
  createStatusOkXml,
  XML_HEADER,
} from "../utils/marge-xml.ts";

const decodeSpeakerDevice = Schema.decodeEffect(SpeakerDeviceXml);

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

const isSpeakerDeviceId = Schema.is(SpeakerDeviceId);

/**
 * The device id in the `<device-data><device id="…">` report a speaker posts
 * when it boots, if the body is one.
 */
const powerOnDeviceId = (xml: string) => {
  try {
    const id = parseXml(xml).children.find((child) => child.name === "device")
      ?.attributes.id;
    return isSpeakerDeviceId(id) ? id : undefined;
  } catch {
    return undefined;
  }
};

export const MargeHandlers = HttpApiBuilder.group(
  ReviveApi,
  "marge",
  Effect.fn(function* (handlers) {
    const presetsRepo = yield* PresetsRepo;
    const devicesRepo = yield* DevicesRepo;
    const contactsRepo = yield* DeviceContactsRepo;

    return (
      handlers
        .handle("sourceProviders", () =>
          Effect.succeed(withEtag(createSourceProvidersXml())),
        )
        .handle(
          "account",
          Effect.fn(function* ({ params }) {
            const deviceIds = yield* devicesRepo.findByAccount(
              params.accountId,
            );
            const devices = yield* Effect.forEach(deviceIds, (deviceId) =>
              presetsRepo
                .findByDevice(params.accountId, deviceId)
                .pipe(Effect.map((presets) => ({ deviceId, presets }))),
            );
            return withEtag(createAccountFullXml(params.accountId, devices));
          }),
        )
        .handle(
          "presets",
          Effect.fn(function* ({ params }) {
            yield* contactsRepo.record(params.deviceId);
            const presets = yield* presetsRepo.findByDevice(
              params.accountId,
              params.deviceId,
            );
            return withEtag(createPresetsXml(presets));
          }),
        )
        // Raw: speakers are not guaranteed to label the XML body with the
        // declared content type, so the body is decoded whatever its label.
        .handleRaw(
          "savePreset",
          Effect.fn(function* ({ params, request }) {
            yield* contactsRepo.record(params.deviceId);
            const preset = yield* request.text.pipe(
              Effect.flatMap(decodeSpeakerPreset),
              Effect.tapError((error) =>
                Effect.logWarning("Rejected speaker preset", error),
              ),
              Effect.mapError(() => new HttpApiError.BadRequest()),
            );
            const pairing = yield* devicesRepo.pair(
              params.accountId,
              params.deviceId,
            );
            if (pairing === "accountFull") {
              // The preset could never be served back.
              return yield* new HttpApiError.BadRequest();
            }
            if (pairing === "storageFull") {
              return yield* new HttpApiError.ServiceUnavailable();
            }
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
            yield* presetsRepo.upsert(params.accountId, params.deviceId, [
              new Preset({
                id: params.presetId,
                contentItem: new ContentItem({
                  source: source.name,
                  type: preset.contentItemType ?? "stationurl",
                  location,
                  sourceAccount: "",
                  isPresetable: true,
                  itemName: preset.name ?? preset.username ?? "Unknown Preset",
                  containerArt: preset.containerArt ?? "",
                }),
              }),
            ]);
            const presets = yield* presetsRepo.findByDevice(
              params.accountId,
              params.deviceId,
            );
            const saved = presets.find(({ id }) => id === params.presetId);
            if (saved === undefined) {
              return yield* Effect.die(
                "A stored preset could not be read back",
              );
            }
            return createPresetXml(saved);
          }),
        )
        .handle(
          "removePreset",
          Effect.fn(function* ({ params }) {
            yield* contactsRepo.record(params.deviceId);
            yield* devicesRepo.pair(params.accountId, params.deviceId);
            yield* presetsRepo.remove(
              params.accountId,
              params.deviceId,
              params.presetId,
            );
            return createStatusOkXml();
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
            yield* contactsRepo.record(params.deviceId);
            const recent = yield* request.text.pipe(
              Effect.flatMap(decodeSpeakerRecent),
              Effect.tapError((error) =>
                Effect.logWarning("Rejected speaker recent", error),
              ),
              Effect.mapError(() => new HttpApiError.BadRequest()),
            );
            yield* devicesRepo.pair(params.accountId, params.deviceId);
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
            return createRecentXml({
              // Seconds fit the int32 speakers store recent ids in.
              id: Math.floor(now / 1000),
              source,
              name: recent.name ?? "",
              location,
              contentItemType: recent.contentItemType ?? "stationurl",
              lastPlayedAt: Number.isNaN(lastPlayedAt) ? now : lastPlayedAt,
              createdOn: now,
            });
          }),
        )
        .handle("recents", ({ params }) =>
          contactsRepo
            .record(params.deviceId)
            .pipe(Effect.as(createRecentsXml())),
        )
        // Raw: the body only names the speaker, so one that can't be read
        // still gets the reply that completes its boot.
        .handleRaw(
          "powerOn",
          Effect.fn(function* ({ request }) {
            const deviceId = powerOnDeviceId(
              yield* request.text.pipe(Effect.orElseSucceed(() => "")),
            );
            if (deviceId === undefined) {
              yield* Effect.logWarning("Power on report without a device id");
            } else {
              yield* contactsRepo.record(deviceId);
            }
            return createStatusOkXml();
          }),
        )
        // Raw for the same reason as `savePreset`.
        .handleRaw(
          "registerDevice",
          Effect.fn(function* ({ params, request }) {
            const device = yield* request.text.pipe(
              Effect.flatMap(decodeSpeakerDevice),
              Effect.tapError((error) =>
                Effect.logWarning("Rejected speaker device", error),
              ),
              Effect.mapError(() => new HttpApiError.BadRequest()),
            );
            yield* contactsRepo.record(device.deviceId);
            yield* devicesRepo.pair(params.accountId, device.deviceId);
            const now = DateTime.toEpochMillis(yield* DateTime.now);
            return createDeviceXml(device.deviceId, device.name, now);
          }),
        )
        // Raw for the same reason as `savePreset`. Speakers call this when
        // renamed and keep their old name unless it succeeds.
        .handleRaw(
          "updateDevice",
          Effect.fn(function* ({ params, request }) {
            yield* contactsRepo.record(params.deviceId);
            const device = yield* request.text.pipe(
              Effect.flatMap(decodeSpeakerDevice),
              Effect.tapError((error) =>
                Effect.logWarning("Rejected speaker device", error),
              ),
              Effect.mapError(() => new HttpApiError.BadRequest()),
            );
            if (device.deviceId !== params.deviceId) {
              yield* Effect.logWarning("Rejected rename of another speaker", {
                path: params.deviceId,
                body: device.deviceId,
              });
              return yield* new HttpApiError.BadRequest();
            }
            yield* devicesRepo.pair(params.accountId, params.deviceId);
            const now = DateTime.toEpochMillis(yield* DateTime.now);
            return createDeviceXml(params.deviceId, device.name, now);
          }),
        )
        // Speakers look their group up at every boot, so this also pairs
        // speakers that paired before devices were recorded. No stereo pairs
        // yet: every speaker stands alone.
        .handle(
          "deviceGroup",
          Effect.fn(function* ({ params }) {
            yield* contactsRepo.record(params.deviceId);
            yield* devicesRepo.pair(params.accountId, params.deviceId);
            return `${XML_HEADER}<group/>`;
          }),
        )
        .handle("providerSettings", ({ params }) =>
          Effect.succeed(createProviderSettingsXml(params.accountId)),
        )
    );
  }),
);
