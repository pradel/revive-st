/**
 * Two emulated SoundTouch 10s making a stereo pair against an in-test Marge,
 * over raw HTTP and WebSocket. Requests, replies and notifications are the
 * ones two real SoundTouch 10s (firmware 27.0.6) exchanged.
 */
import { once } from "node:events";
import { createServer } from "node:http";

import { Effect, Exit, Scope } from "effect";
import { assert, describe, it } from "vite-plus/test";

import type { SpeakerConfig } from "./config.ts";
import { SpeakerEmulator } from "./emulator.ts";
import { EmulatedLan } from "./lan.ts";
import { eventually } from "./testing.ts";

type Speaker = SpeakerEmulator["Service"];

const DECLARATION = '<?xml version="1.0" encoding="UTF-8" ?>';
const BOSE_XML = "application/vnd.bose.streaming-v1.2+xml";
const ACCOUNT = "household-1";
const GROUP_ID = "3271058";
const LEFT = { deviceId: "0CAE7D6298E9", ipAddress: "192.168.1.195" };
const RIGHT = { deviceId: "EC1127C25A50", ipAddress: "192.168.1.189" };

const ADD_GROUP = `<group><name>Living room + Office</name><masterDeviceId>${LEFT.deviceId}</masterDeviceId><roles><groupRole><deviceId>${LEFT.deviceId}</deviceId><role>LEFT</role><ipAddress>${LEFT.ipAddress}</ipAddress></groupRole><groupRole><deviceId>${RIGHT.deviceId}</deviceId><role>RIGHT</role><ipAddress>${RIGHT.ipAddress}</ipAddress></groupRole></roles></group>`;

const ROLES = `<roles><groupRole><deviceId>${LEFT.deviceId}</deviceId><role>LEFT</role><ipAddress>${LEFT.ipAddress}</ipAddress></groupRole><groupRole><deviceId>${RIGHT.deviceId}</deviceId><role>RIGHT</role><ipAddress>${RIGHT.ipAddress}</ipAddress></groupRole></roles>`;

/** The pair as both speakers report it. */
const pairBody = (name: string) =>
  `<group id="${GROUP_ID}"><name>${name}</name><masterDeviceId>${LEFT.deviceId}</masterDeviceId>${ROLES}<senderIPAddress>${LEFT.ipAddress}</senderIPAddress><status>GROUP_OK</status></group>`;

const UNPAIRED = `${DECLARATION}<group />`;

const groupUpdated = (deviceId: string, group: string) =>
  `<updates deviceID='${deviceId}'><groupUpdated>${group}</groupUpdated></updates>`;

interface MargeRequest {
  readonly method: string;
  readonly path: string;
  readonly contentType: string | undefined;
  readonly body: string;
}

/**
 * Marge's group endpoints: it gives a new pair `GROUP_ID` and answers the
 * speakers' polls with the pair it keeps, `<group/>` once it has none.
 */
const fakeMarge = Effect.gen(function* () {
  const marge = {
    url: "",
    requests: [] as MargeRequest[],
    group: undefined as string | undefined,
    refusesGroups: false,
  };
  const server = createServer((request, response) => {
    let body = "";
    request.setEncoding("utf8");
    request.on("data", (chunk: string) => {
      body += chunk;
    });
    request.on("end", () => {
      const method = request.method ?? "";
      const path = request.url ?? "";
      marge.requests.push({
        method,
        path,
        contentType: request.headers["content-type"],
        body,
      });
      const reply = (status: number, xml = "") => {
        response.writeHead(status, { "Content-Type": BOSE_XML });
        response.end(xml);
      };
      if (
        method === "POST" &&
        path === `/streaming/account/${ACCOUNT}/group/`
      ) {
        if (marge.refusesGroups) {
          reply(500);
          return;
        }
        marge.group = body.replace("<group>", `<group id="${GROUP_ID}">`);
        reply(201, marge.group);
      } else if (path === `/streaming/account/${ACCOUNT}/group/${GROUP_ID}`) {
        if (method === "DELETE") {
          marge.group = undefined;
        } else if (method === "PUT") {
          // A rename: only the name is taken from the speaker's body.
          const name = /<name>[^<]*<\/name>/.exec(body)?.[0];
          if (name !== undefined) {
            marge.group = marge.group?.replace(/<name>[^<]*<\/name>/, name);
          }
        }
        reply(200, marge.group);
      } else if (
        /^\/streaming\/account\/[^/]+\/device\/[^/]+\/group\/$/.test(path)
      ) {
        reply(200, marge.group ?? "<group/>");
      } else {
        reply(404);
      }
    });
  });
  yield* Effect.acquireRelease(
    Effect.promise(async () => {
      server.listen(0, "127.0.0.1");
      await once(server, "listening");
    }),
    () =>
      Effect.promise(async () => {
        server.close();
        server.closeAllConnections();
        await once(server, "close");
      }),
  );
  const address = server.address();
  marge.url =
    typeof address === "object" && address !== null
      ? `http://127.0.0.1:${address.port}`
      : "";
  return marge;
});

type Marge = Effect.Success<typeof fakeMarge>;

const speakerConfig = (
  speaker: typeof LEFT,
  name: string,
  marge: Marge,
): SpeakerConfig => ({
  ...speaker,
  name,
  margeAccountUUID: ACCOUNT,
  urls: {
    bmxRegistryUrl: "http://127.0.0.1:9/v2/registry.json",
    statsServerUrl: "http://127.0.0.1:9",
    margeServerUrl: marge.url,
    swUpdateUrl: "http://127.0.0.1:9/updates/soundtouch",
  },
});

/** The speaker's reply to a GET, or to a POST of `body`. */
const call = (speaker: Speaker, path: string, body?: string) =>
  Effect.promise(async () => {
    const response = await fetch(
      `http://${speaker.host}:${speaker.ports.http}${path}`,
      body === undefined ? {} : { method: "POST", body },
    );
    return { status: response.status, body: await response.text() };
  });

/** The notifications the speaker sends from now on, until the scope closes. */
const listen = (speaker: Speaker) =>
  Effect.gen(function* () {
    const messages: string[] = [];
    yield* Effect.acquireRelease(
      Effect.sync(() => {
        const socket = new WebSocket(
          `ws://${speaker.host}:${speaker.ports.notifications}`,
          "gabbo",
        );
        socket.addEventListener("message", ({ data }) => {
          messages.push(String(data));
        });
        return socket;
      }),
      (socket) =>
        Effect.sync(() => {
          socket.close();
        }),
    );
    yield* eventually(
      Effect.map(speaker.listeners, (count) => (count > 0 ? count : undefined)),
    );
    return {
      /** Resolves once the speaker has sent `xml`. */
      received: (xml: string) =>
        eventually(
          Effect.sync(() => (messages.includes(xml) ? xml : undefined)),
        ),
    };
  });

interface Pair {
  readonly marge: Marge;
  readonly left: Speaker;
  readonly right: Speaker;
  /** Takes the RIGHT speaker off the network for good. */
  readonly unplugRight: Effect.Effect<void>;
}

/** Runs `test` against two unpaired SoundTouch 10s on one network and account. */
const withSpeakers = async <Value, Failure>(
  test: (pair: Pair) => Effect.Effect<Value, Failure, Scope.Scope>,
) =>
  Effect.runPromise(
    Effect.gen(function* () {
      const marge = yield* fakeMarge;
      const left = yield* SpeakerEmulator.make(
        speakerConfig(LEFT, "Living room", marge),
      );
      const rightScope = yield* Scope.fork(yield* Effect.scope);
      const right = yield* SpeakerEmulator.make(
        speakerConfig(RIGHT, "Office", marge),
      ).pipe(Scope.provide(rightScope));
      return yield* test({
        marge,
        left,
        right,
        unplugRight: Scope.close(rightScope, Exit.void),
      });
    }).pipe(Effect.scoped, Effect.provide(EmulatedLan.layer)),
  );

/** Pairs the speakers through the master. */
const pair = (left: Speaker) =>
  Effect.gen(function* () {
    const reply = yield* call(left, "/addGroup", ADD_GROUP);
    assert.strictEqual(reply.status, 200);
  });

describe("a stereo pair", () => {
  it("is made by the master alone, which creates it on Marge and takes Marge's id", async () =>
    withSpeakers(({ marge, left, right }) =>
      Effect.gen(function* () {
        assert.deepStrictEqual(yield* call(left, "/getGroup"), {
          status: 200,
          body: UNPAIRED,
        });
        const leftUpdates = yield* listen(left);
        const rightUpdates = yield* listen(right);

        const reply = yield* call(left, "/addGroup", ADD_GROUP);
        const paired = `${DECLARATION}${pairBody("Living room + Office")}`;
        assert.deepStrictEqual(reply, { status: 200, body: paired });
        assert.deepStrictEqual(yield* call(right, "/getGroup"), {
          status: 200,
          body: paired,
        });
        yield* leftUpdates.received(
          groupUpdated(LEFT.deviceId, pairBody("Living room + Office")),
        );
        yield* rightUpdates.received(
          groupUpdated(RIGHT.deviceId, pairBody("Living room + Office")),
        );

        assert.deepStrictEqual(
          marge.requests.filter(({ path }) => path.includes("/group")),
          [
            {
              method: "POST",
              path: `/streaming/account/${ACCOUNT}/group/`,
              contentType: BOSE_XML,
              body: `${DECLARATION}<group><masterDeviceId>${LEFT.deviceId}</masterDeviceId><name>Living room + Office</name><roles><groupRole><deviceId>${LEFT.deviceId}</deviceId><role>LEFT</role></groupRole><groupRole><deviceId>${RIGHT.deviceId}</deviceId><role>RIGHT</role></groupRole></roles></group>`,
            },
          ],
        );
        assert.deepStrictEqual(
          (yield* left.exchanges).filter(({ url }) => url.includes("/group")),
          [
            {
              method: "POST",
              url: `${marge.url}/streaming/account/${ACCOUNT}/group/`,
              status: 201,
            },
          ],
        );
        assert.deepStrictEqual(yield* right.exchanges, []);
      }),
    ));

  it("can't be made again while either speaker is in one", async () =>
    withSpeakers(({ left, right }) =>
      Effect.gen(function* () {
        yield* pair(left);
        for (const speaker of [left, right]) {
          assert.deepStrictEqual(yield* call(speaker, "/addGroup", ADD_GROUP), {
            status: 500,
            body: `${DECLARATION}<errors deviceID="${speaker.deviceId}"><error value="5510" name="GROUP_ALREADY_EXISTS_ERROR" severity="Unknown"> </error></errors>`,
          });
        }
      }),
    ));

  it("isn't made when Marge refuses it", async () =>
    withSpeakers(({ marge, left, right }) =>
      Effect.gen(function* () {
        marge.refusesGroups = true;
        assert.deepStrictEqual(yield* call(left, "/addGroup", ADD_GROUP), {
          status: 500,
          body: `${DECLARATION}<errors deviceID="${LEFT.deviceId}"><error value="5580" name="GROUP_CREATE_GROUP_ON_MARGE_ERROR" severity="Unknown"> </error></errors>`,
        });
        assert.strictEqual((yield* call(left, "/getGroup")).body, UNPAIRED);
        assert.strictEqual((yield* call(right, "/getGroup")).body, UNPAIRED);
      }),
    ));

  it("is renamed through the master, on both speakers and on Marge", async () =>
    withSpeakers(({ marge, left, right }) =>
      Effect.gen(function* () {
        yield* pair(left);
        const rightUpdates = yield* listen(right);
        const from = marge.requests.length;

        const reply = yield* call(
          left,
          "/updateGroup",
          ADD_GROUP.replace("<group>", `<group id="${GROUP_ID}">`).replace(
            "Living room + Office",
            "Office & co",
          ),
        );
        const renamed = `${DECLARATION}${pairBody("Office &amp; co")}`;
        assert.deepStrictEqual(reply, { status: 200, body: renamed });
        assert.strictEqual((yield* call(right, "/getGroup")).body, renamed);
        yield* rightUpdates.received(
          groupUpdated(RIGHT.deviceId, pairBody("Office &amp; co")),
        );
        assert.deepStrictEqual(marge.requests.slice(from), [
          {
            method: "PUT",
            path: `/streaming/account/${ACCOUNT}/group/${GROUP_ID}`,
            contentType: BOSE_XML,
            body: `${DECLARATION}<group><masterDeviceId>${LEFT.deviceId}</masterDeviceId><name>Office &amp; co</name></group>`,
          },
        ]);
        // Marge keeps the new name: the speakers' next polls get it.
        assert.include(marge.group, "<name>Office &amp; co</name>");
      }),
    ));

  for (const side of ["master", "partner"] as const) {
    it(`is undone on both speakers through the ${side}, which deletes it on Marge`, async () =>
      withSpeakers(({ marge, left, right }) =>
        Effect.gen(function* () {
          yield* pair(left);
          const leftUpdates = yield* listen(left);
          const rightUpdates = yield* listen(right);
          const speaker = side === "master" ? left : right;
          const from = marge.requests.length;

          assert.deepStrictEqual(yield* call(speaker, "/removeGroup"), {
            status: 200,
            body: UNPAIRED,
          });
          assert.strictEqual((yield* call(left, "/getGroup")).body, UNPAIRED);
          assert.strictEqual((yield* call(right, "/getGroup")).body, UNPAIRED);
          yield* leftUpdates.received(groupUpdated(LEFT.deviceId, "<group />"));
          yield* rightUpdates.received(
            groupUpdated(RIGHT.deviceId, "<group />"),
          );
          assert.deepStrictEqual(
            marge.requests
              .slice(from)
              .map(({ method, path, body }) => ({ method, path, body })),
            [
              {
                method: "DELETE",
                path: `/streaming/account/${ACCOUNT}/group/${GROUP_ID}`,
                body: "",
              },
            ],
          );
          assert.deepStrictEqual(
            (yield* speaker.exchanges)
              .filter(({ method }) => method === "DELETE")
              .map(({ url, status }) => ({ url, status })),
            [
              {
                url: `${marge.url}/streaming/account/${ACCOUNT}/group/${GROUP_ID}`,
                status: 200,
              },
            ],
          );

          // Nothing is left to refuse a new pair.
          yield* pair(left);
        }),
      ));
  }

  it("is left by the master alone when its partner is down", async () =>
    withSpeakers(({ marge, left, unplugRight }) =>
      Effect.gen(function* () {
        yield* pair(left);
        yield* unplugRight;

        assert.deepStrictEqual(yield* call(left, "/removeGroup"), {
          status: 200,
          body: `${DECLARATION}<group><status>GROUP_PEER_REQUEST_FAILED</status></group>`,
        });
        assert.strictEqual((yield* call(left, "/getGroup")).body, UNPAIRED);
        assert.strictEqual(marge.requests.at(-1)?.method, "DELETE");
      }),
    ));

  it("survives a restart while Marge keeps it, and is dropped at boot once Marge answers <group/>", async () =>
    withSpeakers(({ marge, left, right }) =>
      Effect.gen(function* () {
        yield* pair(left);
        const paired = `${DECLARATION}${pairBody("Living room + Office")}`;

        yield* right.reboot;
        assert.strictEqual((yield* call(right, "/getGroup")).body, paired);

        // A server that forgot the pair, as the hosted one always did.
        marge.group = undefined;
        yield* right.reboot;
        assert.strictEqual((yield* call(right, "/getGroup")).body, UNPAIRED);
        assert.strictEqual((yield* call(left, "/getGroup")).body, paired);
        const polls = (yield* right.exchanges).filter(({ url }) =>
          url.endsWith(`/device/${RIGHT.deviceId}/group/`),
        );
        assert.deepStrictEqual(
          polls.map(({ status }) => status),
          [200, 200],
        );

        yield* left.reboot;
        assert.strictEqual((yield* call(left, "/getGroup")).body, UNPAIRED);
        assert.isFalse(
          marge.requests.some(({ method }) => method === "DELETE"),
        );
      }),
    ));
});

describe("/getGroup", () => {
  it("never answers on other models", async () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const speaker = yield* SpeakerEmulator;
        const reply = yield* Effect.promise(async () =>
          fetch(`http://${speaker.host}:${speaker.ports.http}/getGroup`, {
            signal: AbortSignal.timeout(300),
          }).then(
            () => "answered",
            (error: unknown) =>
              error instanceof Error ? error.name : String(error),
          ),
        );
        assert.strictEqual(reply, "TimeoutError");
      }).pipe(
        Effect.scoped,
        Effect.provide(
          SpeakerEmulator.layer({
            deviceId: "B0D5CC1A2B3C",
            type: "SoundTouch 20",
          }),
        ),
      ),
    ));
});
