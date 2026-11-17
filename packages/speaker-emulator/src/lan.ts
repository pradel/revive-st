/**
 * The network emulated speakers share: how a stereo pair's speakers reach
 * each other. A speaker started without one is alone on a network of its own.
 */
import { Context, Effect, Layer, Ref, type Scope } from "effect";

import type { Group } from "./state.ts";

/** What a speaker in a stereo pair asks of the other. */
export interface GroupPeer {
  readonly deviceId: string;
  /** Whether it answers: not while it restarts. */
  readonly reachable: Effect.Effect<boolean>;
  readonly group: Effect.Effect<Group | undefined>;
  /** Joins, renames or (`undefined`) leaves a pair, as its partner tells it. */
  readonly setGroup: (group: Group | undefined) => Effect.Effect<void>;
}

const make = Effect.gen(function* () {
  const peers = yield* Ref.make<ReadonlyMap<string, GroupPeer>>(new Map());
  return {
    /** Puts a speaker on the network until the scope closes. */
    register: (peer: GroupPeer): Effect.Effect<void, never, Scope.Scope> =>
      Effect.acquireRelease(
        Ref.update(peers, (current) =>
          new Map(current).set(peer.deviceId, peer),
        ),
        () =>
          Ref.update(peers, (current) => {
            if (current.get(peer.deviceId) !== peer) {
              return current;
            }
            const rest = new Map(current);
            rest.delete(peer.deviceId);
            return rest;
          }),
      ),
    /** The speaker with this id, if it is on the network and answers. */
    reach: Effect.fnUntraced(function* (deviceId: string) {
      const peer = (yield* Ref.get(peers)).get(deviceId);
      return peer !== undefined && (yield* peer.reachable) ? peer : undefined;
    }),
  };
});

/**
 * Emulated speakers built with this service in their context share it, so
 * a stereo pair's master reaches its partner by device id.
 */
export class EmulatedLan extends Context.Service<
  EmulatedLan,
  Effect.Success<typeof make>
>()("@revive-st/speaker-emulator/EmulatedLan") {
  static readonly make = make;
  static readonly layer = Layer.effect(EmulatedLan, make);
}
