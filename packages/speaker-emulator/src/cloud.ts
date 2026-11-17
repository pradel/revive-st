/**
 * The requests the speaker makes to the servers its configuration names:
 * Marge (`margeServerUrl`), stats, software updates and the BMX registry and
 * adapters. Order and bodies follow a recorded firmware 27 session
 * (repos/Bose-SoundTouch/tests/interactions_20260328-103522-477978.md).
 */
import type { ContentItem, Preset } from "bose-api-speaker-client";
import { DateTime, Effect, Option, Ref, Schema } from "effect";
import { HttpClient, HttpClientRequest } from "effect/http";

import { USER_AGENT } from "./config.ts";
import type { Group, NowPlaying, SpeakerState } from "./state.ts";
import {
  type AccountSync,
  deviceXml,
  type Identity,
  groupUpdated,
  infoUpdated,
  margeGroupTouchXml,
  margeGroupXml,
  nameUpdated,
  nowPlayingUpdated,
  powerOnXml,
  presetPutXml,
  presetsUpdated,
  readAccount,
  readMargeGroupId,
  readSourceProviders,
  recentXml,
  serialNumber,
  sourcesUpdated,
  statsEventJson,
} from "./xml.ts";

const BOSE_XML = "application/vnd.bose.streaming-v1.2+xml";

/** A request the speaker made; `status` is unset when it got no reply. */
export interface Exchange {
  readonly method: string;
  readonly url: string;
  readonly status: number | undefined;
}

const BmxRegistry = Schema.fromJsonString(
  Schema.Struct({
    bmx_services: Schema.Array(
      Schema.Struct({
        baseUrl: Schema.String,
        id: Schema.Struct({ name: Schema.String }),
      }),
    ),
  }),
);

const BmxPlayback = Schema.fromJsonString(
  Schema.Struct({
    audio: Schema.Struct({ streamUrl: Schema.NonEmptyString }),
    imageUrl: Schema.String,
    name: Schema.String,
  }),
);

export interface CloudContext {
  readonly identity: Identity;
  readonly state: Ref.Ref<SpeakerState>;
  readonly exchanges: Ref.Ref<readonly Exchange[]>;
  readonly notify: (xml: string) => Effect.Effect<void>;
}

export const makeCloud = Effect.fnUntraced(function* (context: CloudContext) {
  const client = yield* HttpClient.HttpClient;
  const { identity, state, notify } = context;
  const { deviceId } = identity;

  /** The status and body of a 2xx reply; `None` for any other outcome. */
  const send = Effect.fnUntraced(function* (
    request: HttpClientRequest.HttpClientRequest,
  ) {
    const reply = yield* client
      .execute(
        HttpClientRequest.setHeaders(request, {
          "User-Agent": USER_AGENT,
          Accept: BOSE_XML,
        }),
      )
      .pipe(
        Effect.flatMap((response) =>
          Effect.map(response.text, (body) => ({
            status: response.status,
            body,
          })),
        ),
        Effect.timeout("10 seconds"),
        Effect.option,
      );
    yield* Ref.update(context.exchanges, (exchanges) => [
      ...exchanges,
      {
        method: request.method,
        url: request.url,
        status: Option.getOrUndefined(
          Option.map(reply, ({ status }) => status),
        ),
      },
    ]);
    return Option.filter(reply, ({ status }) => status >= 200 && status < 300);
  });

  const xmlBody = (request: HttpClientRequest.HttpClientRequest, xml: string) =>
    HttpClientRequest.bodyText(request, xml, BOSE_XML);

  const margeUrl = Effect.map(
    Ref.get(state),
    ({ running }) => `${running.margeServerUrl}/streaming`,
  );

  /** `/sourceproviders`: source type by provider id; empty when unreachable. */
  const sourceProviders = Effect.gen(function* () {
    const reply = yield* send(
      HttpClientRequest.get(`${yield* margeUrl}/sourceproviders`),
    );
    return Option.match(reply, {
      onNone: () => new Map<string, string>(),
      onSome: ({ body }) => readSourceProviders(body),
    });
  });

  /**
   * Copies the account's sources and the speaker's presets from `/full`. A
   * speaker the account doesn't list drops the account and its presets.
   * Source types it learns only activate at its next start.
   */
  const syncAccount = Effect.fnUntraced(function* (
    accountId: string,
    providers: ReadonlyMap<string, string>,
  ) {
    const reply = yield* send(
      HttpClientRequest.get(`${yield* margeUrl}/account/${accountId}/full`),
    );
    const sync: AccountSync | undefined = Option.getOrUndefined(
      Option.map(reply, ({ body }) => readAccount(body, deviceId, providers)),
    );
    if (sync === undefined) {
      return;
    }
    const before = yield* Ref.get(state);
    const presets: readonly Preset[] =
      sync.presets === "absent"
        ? []
        : sync.presets === "keep"
          ? before.presets
          : sync.presets;
    const after: SpeakerState = {
      ...before,
      margeAccountUUID:
        sync.presets === "absent" ? "" : before.margeAccountUUID,
      presets,
      accountSources: sync.sources,
      savedSourceTypes: new Set([
        ...before.savedSourceTypes,
        ...sync.sources.map(({ source }) => source),
      ]),
    };
    yield* Ref.set(state, after);
    if (after.presets !== before.presets) {
      yield* notify(presetsUpdated(deviceId, after.presets));
    }
    if (
      JSON.stringify(after.accountSources) !==
      JSON.stringify(before.accountSources)
    ) {
      yield* notify(sourcesUpdated(deviceId));
    }
    if (after.margeAccountUUID !== before.margeAccountUUID) {
      yield* notify(infoUpdated(deviceId));
    }
  });

  /** Joins, renames or (`undefined`) leaves a stereo pair. */
  const setGroup = Effect.fnUntraced(function* (group: Group | undefined) {
    yield* Ref.update(state, (current) => ({ ...current, group }));
    yield* notify(groupUpdated(deviceId, group));
  });

  /**
   * Syncs the account, then reads its provider settings and the speaker's
   * group, as a speaker does at boot and right after it pairs. Marge decides
   * the group: `<group/>`, or any reply but a group, drops the speaker's
   * pair (its partner drops its own half when it asks); no reply keeps it.
   */
  const fetchAccount = Effect.fnUntraced(function* (
    accountId: string,
    providers: ReadonlyMap<string, string>,
  ) {
    const marge = yield* margeUrl;
    yield* syncAccount(accountId, providers);
    yield* send(
      HttpClientRequest.get(`${marge}/account/${accountId}/provider_settings`),
    );
    const group = yield* send(
      HttpClientRequest.get(
        `${marge}/account/${accountId}/device/${deviceId}/group/`,
      ),
    );
    if (
      Option.isSome(group) &&
      readMargeGroupId(group.value.body) === undefined &&
      (yield* Ref.get(state)).group !== undefined
    ) {
      yield* setGroup(undefined);
    }
  });

  /** What a speaker calls while it starts, in the order firmware 27 does. */
  const boot = Effect.gen(function* () {
    const { running, margeAccountUUID: accountId } = yield* Ref.get(state);
    const marge = yield* margeUrl;
    yield* send(
      HttpClientRequest.post(
        `${running.statsServerUrl}/v1/scmudc/${deviceId}`,
      ).pipe(
        HttpClientRequest.bodyText(
          statsEventJson(
            identity,
            accountId,
            new Date(DateTime.toEpochMillis(yield* DateTime.now)),
          ),
          "text/json; charset=utf-8",
        ),
      ),
    );
    const registry = yield* send(HttpClientRequest.get(running.bmxRegistryUrl));
    const services = Option.flatMap(registry, ({ body }) =>
      Schema.decodeUnknownOption(BmxRegistry)(body),
    );
    yield* Ref.update(state, (current) => ({
      ...current,
      bmxServices: Option.match(services, {
        onNone: () => [],
        onSome: ({ bmx_services }) =>
          bmx_services.map(({ baseUrl, id }) => ({ source: id.name, baseUrl })),
      }),
    }));
    yield* send(
      xmlBody(
        HttpClientRequest.post(`${marge}/support/power_on`),
        powerOnXml(identity),
      ),
    );
    const providers = yield* sourceProviders;
    if (accountId !== "") {
      yield* fetchAccount(accountId, providers);
    }
    yield* send(
      HttpClientRequest.get(`${marge}/device/${deviceId}/streaming_token`),
    );
    if (accountId !== "") {
      yield* send(
        HttpClientRequest.get(`${marge}/software/update/account/${accountId}`),
      );
    }
    yield* send(
      HttpClientRequest.get(running.swUpdateUrl, {
        urlParams: { serialnumber: serialNumber(deviceId) },
      }),
    );
  });

  /** `/notification` `<sourcesUpdated/>`: fetch and save the account's sources now. */
  const refreshSources = Effect.gen(function* () {
    const { margeAccountUUID } = yield* Ref.get(state);
    if (margeAccountUUID !== "") {
      yield* syncAccount(margeAccountUUID, yield* sourceProviders);
    }
  });

  /**
   * `/setMargeAccount`: registers with the account, paired only once Marge
   * accepts, then syncs the account at once (recorded session, 0054-0059).
   */
  const pair = Effect.fnUntraced(function* (accountId: string) {
    const { name } = yield* Ref.get(state);
    const reply = yield* send(
      xmlBody(
        HttpClientRequest.post(
          `${yield* margeUrl}/account/${accountId}/device/`,
        ),
        deviceXml(deviceId, name),
      ),
    );
    if (Option.isNone(reply)) {
      return false;
    }
    yield* Ref.update(state, (current) => ({
      ...current,
      margeAccountUUID: accountId,
    }));
    yield* notify(infoUpdated(deviceId));
    yield* fetchAccount(accountId, yield* sourceProviders);
    return true;
  });

  /** `/name`: a paired speaker keeps its old name unless Marge takes the new one. */
  const rename = Effect.fnUntraced(function* (name: string) {
    const { margeAccountUUID } = yield* Ref.get(state);
    if (margeAccountUUID !== "") {
      const reply = yield* send(
        xmlBody(
          HttpClientRequest.put(
            `${yield* margeUrl}/account/${margeAccountUUID}/device/${deviceId}`,
          ),
          deviceXml(deviceId, name),
        ),
      );
      if (Option.isNone(reply)) {
        return;
      }
    }
    yield* Ref.update(state, (current) => ({ ...current, name }));
    // A SoundTouch 10 on firmware 27.0.6 sends both, in this order.
    yield* notify(infoUpdated(deviceId));
    yield* notify(nameUpdated(deviceId, name));
  });

  /** The account source a content item plays from, if the speaker has it. */
  const accountSourceOf = (current: SpeakerState, contentItem: ContentItem) =>
    current.margeAccountUUID === ""
      ? undefined
      : current.accountSources.find(
          ({ source }) => source === contentItem.source,
        );

  /** Stores a preset, then reports it to Marge when it plays from an account source. */
  const storePreset = Effect.fnUntraced(function* (
    presetId: number,
    contentItem: ContentItem,
  ) {
    // Presets are stamped in seconds, as `/presets` reports them.
    const now = Math.floor(DateTime.toEpochMillis(yield* DateTime.now) / 1000);
    const current = yield* Ref.updateAndGet(state, (before) => {
      const existing = before.presets.find(({ id }) => id === presetId);
      const preset: Preset = {
        id: presetId,
        createdOn: existing?.createdOn ?? now,
        updatedOn: now,
        contentItem,
      };
      return {
        ...before,
        presets: [
          ...before.presets.filter(({ id }) => id !== presetId),
          preset,
        ].toSorted((a, b) => a.id - b.id),
      };
    });
    yield* notify(presetsUpdated(deviceId, current.presets));
    const source = accountSourceOf(current, contentItem);
    if (source !== undefined) {
      yield* send(
        xmlBody(
          HttpClientRequest.put(
            `${yield* margeUrl}/account/${current.margeAccountUUID}/device/${deviceId}/preset/${presetId}`,
          ),
          presetPutXml(presetId, source.id, contentItem),
        ),
      );
    }
  });

  const setNowPlaying = Effect.fnUntraced(function* (nowPlaying: NowPlaying) {
    yield* Ref.update(state, (current) => ({ ...current, nowPlaying }));
    yield* notify(nowPlayingUpdated(deviceId, nowPlaying));
  });

  /** `/addGroup` on the master: the id Marge gives the pair, if it takes it. */
  const createGroup = Effect.fnUntraced(function* (group: Omit<Group, "id">) {
    const { margeAccountUUID } = yield* Ref.get(state);
    const reply = yield* send(
      xmlBody(
        HttpClientRequest.post(
          `${yield* margeUrl}/account/${margeAccountUUID}/group/`,
        ),
        margeGroupXml(group),
      ),
    );
    return Option.isSome(reply)
      ? readMargeGroupId(reply.value.body)
      : undefined;
  });

  /** `/updateGroup`: tells Marge the pair's new name; the speaker renames it whatever the reply. */
  const renameGroup = Effect.fnUntraced(function* (group: Group) {
    const { margeAccountUUID } = yield* Ref.get(state);
    yield* send(
      xmlBody(
        HttpClientRequest.put(
          `${yield* margeUrl}/account/${margeAccountUUID}/group/${group.id}`,
        ),
        margeGroupTouchXml(deviceId, group.name),
      ),
    );
  });

  /** `/removeGroup`: deletes the pair on Marge; the speaker leaves it whatever the reply. */
  const deleteGroup = Effect.fnUntraced(function* (group: Group) {
    const { margeAccountUUID } = yield* Ref.get(state);
    yield* send(
      HttpClientRequest.delete(
        `${yield* margeUrl}/account/${margeAccountUUID}/group/${group.id}`,
      ),
    );
  });

  /**
   * Resolves a station through its source's BMX adapter, then plays it and
   * reports it to Marge as a recent. A station the adapter can't resolve, or
   * of a source that isn't active, leaves the speaker on `INVALID_SOURCE`.
   */
  const resolveStation = Effect.fnUntraced(function* (
    contentItem: ContentItem,
  ) {
    const current = yield* Ref.get(state);
    const service = current.activeSourceTypes.has(contentItem.source)
      ? current.bmxServices.find(({ source }) => source === contentItem.source)
      : undefined;
    const reply =
      service === undefined
        ? Option.none()
        : yield* send(
            HttpClientRequest.get(`${service.baseUrl}${contentItem.location}`),
          );
    const playback = Option.flatMap(reply, ({ body }) =>
      Schema.decodeUnknownOption(BmxPlayback)(body),
    );
    if (Option.isNone(playback)) {
      yield* setNowPlaying({ kind: "invalid" });
      return;
    }
    const { audio, name, imageUrl } = playback.value;
    yield* setNowPlaying({
      kind: "playing",
      contentItem,
      playStatus: "PLAY_STATE",
      stationName: name,
      art: imageUrl,
      streamUrl: audio.streamUrl,
    });
    const source = accountSourceOf(current, contentItem);
    if (source !== undefined) {
      yield* send(
        xmlBody(
          HttpClientRequest.post(
            `${yield* margeUrl}/account/${current.margeAccountUUID}/device/${deviceId}/recent`,
          ),
          recentXml(
            source.id,
            contentItem,
            new Date(DateTime.toEpochMillis(yield* DateTime.now)),
          ),
        ),
      );
    }
  });

  return {
    boot,
    refreshSources,
    pair,
    rename,
    storePreset,
    setNowPlaying,
    setGroup,
    createGroup,
    renameGroup,
    deleteGroup,
    resolveStation,
  };
});
