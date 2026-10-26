import { useEffect, useState, useSyncExternalStore } from "react";

import { createSetupDeps } from "./adapters";
import { createSimulatedDeps } from "./adapters/simulated";
import type { SetupDeps } from "./session/ports";
import { createSetupSession } from "./session/session";
import type { ScenarioName } from "./session/testing/scenarios";
import type { PromptAnswer, SetupSession, SetupView } from "./session/types";

interface ActiveSession {
  session: SetupSession;
  deps: SetupDeps;
}

export interface SetupSessionHandle {
  /** `undefined` until the session is created (first commit). */
  view: SetupView | undefined;
  respond: (answer: PromptAnswer) => void;
  /** Aborts the session and releases the speaker's network. */
  cancel: () => Promise<void>;
  /** Opens the system Wi-Fi settings (manual join prompt; not a session answer). */
  openWifiSettings: () => void;
}

const subscribeNothing = () => () => undefined;
const noView = (): SetupView | undefined => undefined;

/**
 * Runs one setup session for the lifetime of the calling screen: created and
 * started on mount, cancelled on unmount. `simulate` (dev builds only) runs
 * the session against a fake scenario instead of the real phone and speaker.
 */
export function useSetupSession(simulate?: ScenarioName): SetupSessionHandle {
  const [active, setActive] = useState<ActiveSession>();

  useEffect(() => {
    const deps =
      __DEV__ && simulate !== undefined
        ? createSimulatedDeps(simulate)
        : createSetupDeps();
    const session = createSetupSession(deps);
    setActive({ session, deps });
    session.start();
    return () => {
      void session.cancel();
    };
  }, [simulate]);

  const view = useSyncExternalStore(
    active?.session.subscribe ?? subscribeNothing,
    active?.session.getView ?? noView,
  );

  return {
    view,
    respond: (answer) => {
      active?.session.respond(answer);
    },
    cancel: async () => active?.session.cancel(),
    openWifiSettings: () => {
      active?.deps.wifi.openWifiSettings().catch(() => undefined);
    },
  };
}
