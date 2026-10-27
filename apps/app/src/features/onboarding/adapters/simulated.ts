import type { SetupDeps, WifiPort } from "../session/ports";
import type { FakeWorld, SchedulingClock } from "../session/testing/fakes";
import {
  createScenario,
  type ScenarioName,
  scenarios,
} from "../session/testing/scenarios";
import { appLog, realClock } from "./runtime";

/** Wi-Fi comes back this long after "Turn on Wi-Fi" in simulated mode. */
const SIMULATED_PANEL_MS = 1500;

/** The fakes' virtual time, run on real timers so scenarios play out on screen. */
const wallClock: SchedulingClock = {
  now: () => realClock.now(),
  sleep: async (ms, signal) => realClock.sleep(ms, signal),
  schedule(ms, fire) {
    const timer = setTimeout(fire, Math.max(0, ms));
    return () => {
      clearTimeout(timer);
    };
  },
};

export function isScenarioName(name: string): name is ScenarioName {
  return Object.hasOwn(scenarios, name);
}

/** Dev-only scenarios offered by the settings tab, in declaration order. */
export function simulatedScenarios(): {
  name: ScenarioName;
  description: string;
}[] {
  return (Object.keys(scenarios) as ScenarioName[]).map((name) => ({
    name,
    description: scenarios[name].description,
  }));
}

/**
 * The Wi-Fi port of `world`, where the system screens the user is sent to
 * "fix" the fake phone: the Wi-Fi panel turns Wi-Fi on; the Wi-Fi settings
 * reconnect home Wi-Fi if it is gone, else connect the phone to the setup
 * network (manual join).
 */
function simulatedWifi(world: FakeWorld): WifiPort {
  const fake = world.wifi;
  return {
    isEnabled: async () => fake.isEnabled(),
    scan: async (signal) => fake.scan(signal),
    currentNetwork: async () => fake.currentNetwork(),
    onNetworkChange: (cb) => fake.onNetworkChange(cb),
    join: async (target, signal) => fake.join(target, signal),
    bindToConnectedWifi: async () => fake.bindToConnectedWifi(),
    release: async () => fake.release(),
    async openWifiPanel() {
      await fake.openWifiPanel();
      world.clock.schedule(SIMULATED_PANEL_MS, () => {
        fake.setEnabled(true);
      });
    },
    async openWifiSettings() {
      await fake.openWifiSettings();
      if (fake.network.transport !== "wifi" && fake.boundTo === undefined) {
        const { phone, homeNetworks } = world.config;
        fake.setNetwork({
          transport: "wifi",
          ssid: phone?.ssid ?? homeNetworks[0]?.ssid ?? null,
        });
        return;
      }
      const joined = fake.joins.at(-1)?.bssid;
      const speaker = world.speakers.find((entry) =>
        joined === undefined ? entry.apUp : entry.config.bssid === joined,
      );
      if (speaker) {
        fake.connectManually(speaker);
      }
    },
  };
}

/**
 * `SetupDeps` backed by a fake scenario from `session/testing/scenarios.ts`,
 * for exercising every view on an emulator. Settings screens the user is sent
 * to resolve the problem they were opened for; the first permission request
 * keeps the scenario's answer, later ones grant precise location.
 */
export function createSimulatedDeps(name: ScenarioName): SetupDeps {
  if (!__DEV__) {
    throw new Error("Simulated speaker setup is only available in dev builds");
  }
  const world = createScenario(name, wallClock);
  const { permissions } = world;
  const granted = { granted: true, fine: true, canAskAgain: true };
  let requests = 0;
  return {
    wifi: simulatedWifi(world),
    speaker: world.http,
    discovery: world.discovery,
    clock: wallClock,
    log: appLog,
    permissions: {
      async location(request) {
        if (request && requests++ > 0) {
          permissions.state = { ...granted };
        }
        return permissions.location(request);
      },
      locationServicesEnabled: async () =>
        permissions.locationServicesEnabled(),
      async openAppSettings() {
        await permissions.openAppSettings();
        permissions.state = { ...granted };
      },
      async openLocationSettings() {
        await permissions.openLocationSettings();
        permissions.servicesEnabled = true;
      },
    },
  };
}
