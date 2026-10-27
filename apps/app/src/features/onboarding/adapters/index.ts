import { Platform } from "react-native";

import type { SetupDeps } from "../session/ports";
import { zeroconfDiscovery } from "./discovery";
import { expoPermissions } from "./permissions";
import { appLog, realClock } from "./runtime";
import { boseSpeakerHttp } from "./speakerHttp";
import { androidWifi } from "./wifi.android";

/** Android only: iOS apps cannot scan for Wi-Fi networks, so setup is not offered there. */
export function createSetupDeps(): SetupDeps {
  if (Platform.OS !== "android") {
    throw new Error("Speaker setup is only available on Android");
  }
  return {
    wifi: androidWifi,
    speaker: boseSpeakerHttp,
    discovery: zeroconfDiscovery,
    permissions: expoPermissions,
    clock: realClock,
    log: appLog,
  };
}
