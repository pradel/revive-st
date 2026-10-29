import { Schema } from "effect";

export const DeviceId = Schema.String.pipe(Schema.brand("DeviceId"));
export type DeviceId = typeof DeviceId.Type;

/** SoundTouch speakers expose exactly six preset buttons. */
export const PresetId = Schema.Int.check(
  Schema.isBetween({ minimum: 1, maximum: 6 }),
).pipe(Schema.brand("PresetId"));
export type PresetId = typeof PresetId.Type;

export class ContentItem extends Schema.Class<ContentItem>("ContentItem")({
  source: Schema.String,
  /** `stationurl`, `tracklisturl`, …; Marge calls it `contentItemType`. */
  type: Schema.String,
  location: Schema.String,
  sourceAccount: Schema.String,
  isPresetable: Schema.Boolean,
  itemName: Schema.String,
  containerArt: Schema.String,
}) {}

export class Preset extends Schema.Class<Preset>("Preset")({
  id: PresetId,
  /** Epoch milliseconds. */
  createdOn: Schema.optional(Schema.Number),
  /** Epoch milliseconds. */
  updatedOn: Schema.optional(Schema.Number),
  contentItem: ContentItem,
}) {}
