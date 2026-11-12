import { useSyncExternalStore } from "react";

import { speakerRegistry } from "@/features/speakers/registry/store";

import { createPairDeps } from "./adapters";
import {
  createPairSession,
  type PairSession,
  type PairTarget,
  type PairView,
} from "./session";

export interface PairRun {
  session: PairSession;
  target: PairTarget;
}

/**
 * Runs by the device id of the speaker whose screen started them. A run
 * outlives that screen: leaving it doesn't stop the pairing.
 */
const runs = new Map<string, PairRun>();
const listeners = new Set<() => void>();

function notify(): void {
  for (const listener of [...listeners]) {
    listener();
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Starts pairing `target` from `deviceID`'s screen, replacing a finished or
 * failed run there. A run still working is kept, and so is any other working
 * run either speaker is in: then nothing starts. Whether it started.
 */
export function startPairing(deviceID: string, target: PairTarget): boolean {
  const members = [target.left.deviceID, target.right.deviceID];
  const busy = [...runs.values()].some(
    (run) =>
      run.session.getView().kind === "working" &&
      [run.target.left.deviceID, run.target.right.deviceID].some((id) =>
        members.includes(id),
      ),
  );
  if (busy) {
    return false;
  }
  const existing = runs.get(deviceID);
  void existing?.session.cancel();
  const session = createPairSession(createPairDeps(), target);
  runs.set(deviceID, { session, target });
  // Both speakers show the pair once it formed, whether or not a screen is
  // showing the run.
  session.subscribe(() => {
    if (session.getView().kind === "done") {
      void speakerRegistry.refresh(target.left.deviceID);
      void speakerRegistry.refresh(target.right.deviceID);
    }
  });
  session.start();
  notify();
  return true;
}

/** Stops and forgets the run started from `deviceID`'s screen. */
export function endPairing(deviceID: string): void {
  const run = runs.get(deviceID);
  if (!run) {
    return;
  }
  runs.delete(deviceID);
  void run.session.cancel();
  notify();
}

const subscribeNothing = () => () => undefined;
const noView = (): PairView | undefined => undefined;

/** The run started from `deviceID`'s screen, if any, and its current view. */
export function usePairRun(deviceID: string): {
  run: PairRun | undefined;
  view: PairView | undefined;
} {
  const run = useSyncExternalStore(subscribe, () => runs.get(deviceID));
  const view = useSyncExternalStore(
    run?.session.subscribe ?? subscribeNothing,
    run?.session.getView ?? noView,
  );
  return { run, view };
}
