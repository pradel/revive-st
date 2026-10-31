import { wallClock } from "@/features/onboarding/adapters/simulated";

import { configureLog } from "./adapters";
import type { ConfigureDeps } from "./session/ports";
import {
  createScenario,
  type ScenarioName,
  scenarios,
  targetOf,
} from "./session/testing/scenarios";
import type { ConfigureTarget } from "./session/types";

export function isConfigureScenarioName(name: string): name is ScenarioName {
  return Object.hasOwn(scenarios, name);
}

/** Dev-only scenarios offered by the settings tab, in declaration order. */
export function simulatedConfigureScenarios(): {
  name: ScenarioName;
  description: string;
}[] {
  return (Object.keys(scenarios) as ScenarioName[]).map((name) => ({
    name,
    description: scenarios[name].description,
  }));
}

/** The fake speaker's name in scenario `name`. */
export function simulatedSpeakerName(name: ScenarioName): string {
  return scenarios[name].config().speaker.name;
}
/**
 * A fake speaker and server from `session/testing/scenarios.ts`, run on real
 * timers so the scenario plays out on screen. Dev builds only.
 */
export function createSimulatedConfigure(name: ScenarioName): {
  deps: ConfigureDeps;
  target: ConfigureTarget;
} {
  const world = createScenario(name, wallClock);
  return {
    deps: { ...world.deps(), log: configureLog },
    target: targetOf(world),
  };
}
