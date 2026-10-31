import { Schema } from "effect";

export const DeviceId = Schema.String.pipe(Schema.brand("DeviceId"));
export type DeviceId = typeof DeviceId.Type;

/**
 * A device id as speakers send it: a MAC address, 12 hex digits in either
 * case.
 */
export const SpeakerDeviceId = Schema.String.check(
  Schema.isPattern(/^[0-9a-f]{12}$/i),
).pipe(Schema.brand("DeviceId"));

/** SoundTouch speakers expose exactly six preset buttons. */
export const PresetId = Schema.Int.check(
  Schema.isBetween({ minimum: 1, maximum: 6 }),
).pipe(Schema.brand("PresetId"));
export type PresetId = typeof PresetId.Type;

export class ContentItem extends Schema.Class<ContentItem>("ContentItem")({
  source: Schema.String.annotate({
    description:
      "The source it plays from, e.g. `TUNEIN` or `RADIO_BROWSER`. Presets from other sources are dropped.",
  }),
  type: Schema.String.annotate({
    description: "`stationurl`, `tracklisturl`, …; Marge's `contentItemType`.",
  }),
  location: Schema.String.annotate({
    description:
      "Where the source finds it, e.g. `/stations/byuuid/<uuid>` for Radio Browser.",
  }),
  sourceAccount: Schema.String,
  isPresetable: Schema.Boolean,
  itemName: Schema.String.annotate({ description: "The name shown." }),
  containerArt: Schema.String.annotate({ description: "The artwork URL." }),
}) {}

export class Preset extends Schema.Class<Preset>("Preset")({
  id: PresetId.annotate({ description: "The preset button, 1 to 6." }),
  /** Epoch milliseconds. */
  createdOn: Schema.optional(Schema.Number),
  /** Epoch milliseconds. */
  updatedOn: Schema.optional(Schema.Number),
  contentItem: ContentItem,
}) {}
