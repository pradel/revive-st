import { parseXml, type XmlNode } from "bose-api-speaker-client";
import { Context, Effect, Layer, Schema } from "effect";
import { FetchHttpClient, HttpClient } from "effect/http";

/** A TuneIn guide id: `s` stations, `p` programs, `t` topics. */
export const StationId = Schema.String.check(Schema.isPattern(/^[a-z]\d+$/));

export interface TuneInStation {
  readonly streamUrls: readonly [string, ...string[]];
  readonly name: string;
  readonly imageUrl: string;
}

/** TuneIn knows no playable stream for the station. */
export class StationNotFound extends Schema.TaggedError<StationNotFound>()(
  "StationNotFound",
  { stationId: Schema.String },
) {}

/** TuneIn could not be reached, or answered with an error. */
export class TuneInUnavailable extends Schema.TaggedError<TuneInUnavailable>()(
  "TuneInUnavailable",
  { reason: Schema.Unknown },
) {}

const TUNE_URL = "https://opml.radiotime.com/Tune.ashx";
const DESCRIBE_URL = "https://opml.radiotime.com/describe.ashx";

/**
 * SoundTouch speakers cannot play HLS: asked for any format, TuneIn may hand
 * back an `.m3u8` and the speaker plays nothing.
 */
const STREAM_FORMATS = "mp3,aac,ogg";

/**
 * The stream URLs of a `Tune.ashx` answer: one per line. Lines starting with
 * `#` are comments or, for an unknown station, `#STATUS: 400`.
 */
export const parseTuneResponse = (body: string): string[] =>
  body
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => /^https?:\/\//.test(line));

const findElement = (node: XmlNode, name: string): XmlNode | undefined => {
  for (const child of node.children) {
    const found = child.name === name ? child : findElement(child, name);
    if (found !== undefined) {
      return found;
    }
  }
  return undefined;
};

/** The station name and logo of a `describe.ashx` OPML document. */
export const parseDescribeResponse = (
  xml: string,
): { name: string; imageUrl: string } => {
  const root = parseXml(xml);
  const outline = findElement(root, "outline");
  const station = outline && findElement(outline, "station");
  const childText = (name: string) =>
    station?.children.find((child) => child.name === name)?.text ?? "";
  return {
    name: childText("name") || (outline?.attributes.text ?? ""),
    imageUrl: childText("logo"),
  };
};

/** Resolves TuneIn stations to stream URLs, as Bose's TuneIn adapter did. */
export class TuneIn extends Context.Service<
  TuneIn,
  {
    readonly station: (
      stationId: string,
    ) => Effect.Effect<TuneInStation, StationNotFound | TuneInUnavailable>;
  }
>()("@revive-st/api/tunein/TuneIn") {
  static readonly layerNoDeps = Layer.effect(
    TuneIn,
    Effect.gen(function* () {
      const client = (yield* HttpClient.HttpClient).pipe(
        HttpClient.filterStatusOk,
      );
      const getText = (url: string, urlParams: Record<string, string>) =>
        client.get(url, { urlParams }).pipe(
          Effect.flatMap((response) => response.text),
          Effect.timeout("10 seconds"),
          Effect.mapError((reason) => new TuneInUnavailable({ reason })),
        );

      const station = Effect.fn("TuneIn.station")(function* (
        stationId: string,
      ): Effect.fn.Return<TuneInStation, StationNotFound | TuneInUnavailable> {
        const [tune, describe] = yield* Effect.all(
          [
            getText(TUNE_URL, { id: stationId, formats: STREAM_FORMATS }),
            // Name and logo are cosmetic: play the station without them, and
            // without waiting long for them.
            getText(DESCRIBE_URL, { id: stationId }).pipe(
              Effect.flatMap((xml) =>
                Effect.try(() => parseDescribeResponse(xml)),
              ),
              Effect.timeout("4 seconds"),
              Effect.orElseSucceed(() => ({ name: "", imageUrl: "" })),
            ),
          ],
          { concurrency: "unbounded" },
        );
        const [first, ...rest] = parseTuneResponse(tune);
        if (first === undefined) {
          return yield* new StationNotFound({ stationId });
        }
        return { streamUrls: [first, ...rest], ...describe } as const;
      });

      return TuneIn.of({ station });
    }),
  );

  static readonly layer = this.layerNoDeps.pipe(
    Layer.provide(FetchHttpClient.layer),
  );
}
