import { Platform } from "react-native";

import type { SetupDeps } from "../session/ports";
import { zeroconfDiscovery } from "./discovery";
import { expoPermissions } from "./permissions";
import { appLog, realClock } from "./runtime";
import { boseSpeakerHttp } from "./speakerHttp";
import { androidWifi } from "./wifi.android";
import { iosWifi } from "./wifi.ios";

export function createSetupDeps(): SetupDeps {
  return {
    wifi: Platform.OS === "android" ? androidWifi : iosWifi,
    speaker: boseSpeakerHttp,
    discovery: zeroconfDiscovery,
    permissions: expoPermissions,
    clock: realClock,
    log: appLog,
  };
}
