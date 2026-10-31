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

const boundedText = (maxLength: number) =>
  Schema.String.check(Schema.isMaxLength(maxLength));

/**
 * The text fields of a stored preset, each bounded so a preset is a few
 * kilobytes at most: account ids are anyone's to make up, so nothing they
 * store may be unbounded. `location` leaves room for a custom station, whose
 * location carries its stream URL, name and image URL in base64.
 */
export const PresetText = {
  source: boundedText(64),
  type: boundedText(64),
  location: boundedText(4096),
  sourceAccount: boundedText(256),
  itemName: boundedText(512),
  containerArt: boundedText(2048),
};

export class ContentItem extends Schema.Class<ContentItem>("ContentItem")({
  source: PresetText.source.annotate({
    description:
      "The source it plays from, e.g. `TUNEIN` or `RADIO_BROWSER`. Presets from other sources are dropped.",
  }),
  type: PresetText.type.annotate({
    description: "`stationurl`, `tracklisturl`, …; Marge's `contentItemType`.",
  }),
  location: PresetText.location.annotate({
    description:
      "Where the source finds it, e.g. `/stations/byuuid/<uuid>` for Radio Browser.",
  }),
  sourceAccount: PresetText.sourceAccount,
  isPresetable: Schema.Boolean,
  itemName: PresetText.itemName.annotate({ description: "The name shown." }),
  containerArt: PresetText.containerArt.annotate({
    description: "The artwork URL.",
  }),
}) {}

export class Preset extends Schema.Class<Preset>("Preset")({
  id: PresetId.annotate({ description: "The preset button, 1 to 6." }),
  /** Epoch milliseconds. */
  createdOn: Schema.optional(Schema.Number),
  /** Epoch milliseconds. */
  updatedOn: Schema.optional(Schema.Number),
  contentItem: ContentItem,
}) {}
