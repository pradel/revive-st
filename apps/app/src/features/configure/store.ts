import { useSyncExternalStore } from "react";

import { RADIO_SETUP_QUERY_KEY } from "@/features/speakers/hooks/useRadioSetupQuery";
import { queryClient } from "@/lib/query-client";

import { createConfigureDeps } from "./adapters";
import { createConfigureSession } from "./session/session";
import type { ScenarioName } from "./session/testing/scenarios";
import type {
  ConfigureSession,
  ConfigureTarget,
  ConfigureView,
} from "./session/types";
import { createSimulatedConfigure } from "./simulated";

export interface ConfigureRun {
  session: ConfigureSession;
  target: ConfigureTarget;
  /** Dev builds: the fake scenario the run plays. */
  scenario?: ScenarioName;
}

/**
 * Runs by device id. A run outlives the screen that started it: the speaker
 * may be restarting, and coming back shows where it got to.
 */
const runs = new Map<string, ConfigureRun>();
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
 * Starts setting up `target`, replacing a finished or failed run for it. A
 * run still working is kept.
 */
export function startConfigure(
  target: ConfigureTarget,
  scenario?: ScenarioName,
): void {
  const existing = runs.get(target.deviceID);
  if (existing?.session.getView().kind === "working") {
    return;
  }
  void existing?.session.cancel();
  const simulated =
    __DEV__ && scenario !== undefined
      ? createSimulatedConfigure(scenario)
      : undefined;
  const session = createConfigureSession(
    simulated?.deps ?? createConfigureDeps(),
    simulated?.target ?? target,
  );
  runs.set(target.deviceID, {
    session,
    target: simulated?.target ?? target,
    ...(simulated ? { scenario } : {}),
  });
  // The speaker's radio status changes once the run is done, whether or not
  // a screen is showing it.
  const unsubscribe = session.subscribe(() => {
    if (session.getView().kind === "done") {
      unsubscribe();
      void queryClient.invalidateQueries({ queryKey: [RADIO_SETUP_QUERY_KEY] });
    }
  });
  session.start();
  notify();
}

/** Stops and forgets the run for `deviceID`. Settings already sent to the speaker stay. */
export function endConfigure(deviceID: string): void {
  const run = runs.get(deviceID);
  if (!run) {
    return;
  }
  runs.delete(deviceID);
  void run.session.cancel();
  notify();
}

const subscribeNothing = () => () => undefined;
const noView = (): ConfigureView | undefined => undefined;

/** The run for `deviceID`, if any, and its current view. */
export function useConfigureRun(deviceID: string): {
  run: ConfigureRun | undefined;
  view: ConfigureView | undefined;
} {
  const run = useSyncExternalStore(subscribe, () => runs.get(deviceID));
  const view = useSyncExternalStore(
    run?.session.subscribe ?? subscribeNothing,
    run?.session.getView ?? noView,
  );
  return { run, view };
}
