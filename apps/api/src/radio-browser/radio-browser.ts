import {
  Cache,
  Context,
  type Duration,
  Effect,
  Exit,
  Layer,
  Option,
  Schema,
} from "effect";
import {
  FetchHttpClient,
  HttpClient,
  HttpClientRequest,
  HttpIncomingMessage,
} from "effect/http";

/** A Radio Browser station's `stationuuid`. */
export const StationUuid = Schema.String.check(
  Schema.isPattern(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
  ),
);

export interface RadioBrowserStation {
  readonly streamUrls: readonly string[];
  readonly name: string;
  readonly imageUrl: string;
}

/** Radio Browser knows no station by that id, or none a speaker can play. */
export class RadioBrowserStationNotFound extends Schema.TaggedError<RadioBrowserStationNotFound>()(
  "RadioBrowserStationNotFound",
  { stationUuid: Schema.String },
) {}

/** Radio Browser could not be reached, or answered with an error. */
export class RadioBrowserUnavailable extends Schema.TaggedError<RadioBrowserUnavailable>()(
  "RadioBrowserUnavailable",
  { reason: Schema.Unknown },
) {}

/**
 * Radio Browser's API. The name resolves to one of its servers at random, so
 * a failed lookup is tried once more, likely on another server.
 */
const API_URL = "https://all.api.radio-browser.info";

/** Radio Browser asks clients to identify themselves. */
const USER_AGENT = "ReviveST/1.0 (+https://www.revivest.app)";

const ApiStation = Schema.Struct({
  name: Schema.String,
  url: Schema.String,
  url_resolved: Schema.String,
  favicon: Schema.String,
  hls: Schema.Number,
});

const decodeStations = HttpIncomingMessage.schemaBodyJson(
  Schema.Array(ApiStation),
);

/** How many stations the cache holds; the least recently used goes first. */
const CACHE_CAPACITY = 1000;

/**
 * How long a lookup is kept, as for TuneIn: a station for a few minutes, one
 * Radio Browser doesn't know (or that a speaker can't play) for one, and an
 * outage not at all.
 */
const cacheTimeToLive = (
  exit: Exit.Exit<
    RadioBrowserStation,
    RadioBrowserStationNotFound | RadioBrowserUnavailable
  >,
): Duration.Input =>
  Exit.isSuccess(exit)
    ? "5 minutes"
    : Option.match(Exit.findErrorOption(exit), {
        onNone: () => 0,
        onSome: (error) =>
          error instanceof RadioBrowserStationNotFound ? "1 minute" : 0,
      });

/**
 * Resolves Radio Browser stations to their current stream, so a preset keeps
 * playing when a station moves its stream.
 */
export class RadioBrowser extends Context.Service<
  RadioBrowser,
  {
    readonly station: (
      stationUuid: string,
    ) => Effect.Effect<
      RadioBrowserStation,
      RadioBrowserStationNotFound | RadioBrowserUnavailable
    >;
  }
>()("@revive-st/api/radio-browser/RadioBrowser") {
  static readonly layerNoDeps = Layer.effect(
    RadioBrowser,
    Effect.gen(function* () {
      const client = (yield* HttpClient.HttpClient).pipe(
        HttpClient.filterStatusOk,
        HttpClient.mapRequest(
          HttpClientRequest.setHeader("user-agent", USER_AGENT),
        ),
      );

      const resolve = Effect.fn("RadioBrowser.resolve")(function* (
        stationUuid: string,
      ): Effect.fn.Return<
        RadioBrowserStation,
        RadioBrowserStationNotFound | RadioBrowserUnavailable
      > {
        const [found] = yield* client
          .get(`${API_URL}/json/stations/byuuid/${stationUuid}`)
          .pipe(
            Effect.flatMap(decodeStations),
            Effect.timeout("4 seconds"),
            Effect.retry({ times: 1 }),
            Effect.mapError(
              (reason) => new RadioBrowserUnavailable({ reason }),
            ),
          );
        const streamUrl = found?.url_resolved || found?.url;
        // SoundTouch speakers cannot play HLS.
        if (found === undefined || !streamUrl || found.hls !== 0) {
          return yield* new RadioBrowserStationNotFound({ stationUuid });
        }
        return {
          streamUrls: [streamUrl],
          name: found.name,
          imageUrl: found.favicon,
        } as const;
      });

      const cache = yield* Cache.makeWith(resolve, {
        capacity: CACHE_CAPACITY,
        timeToLive: cacheTimeToLive,
      });

      return RadioBrowser.of({
        station: (stationUuid) => Cache.get(cache, stationUuid),
      });
    }),
  );

  static readonly layer = this.layerNoDeps.pipe(
    Layer.provide(FetchHttpClient.layer),
  );
}
