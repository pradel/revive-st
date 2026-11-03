import type { SetupDeps } from "../session/ports";
import { zeroconfDiscovery } from "./discovery";
import { expoPermissions } from "./permissions";
import { appLog, realClock } from "./runtime";
import { boseSpeakerHttp } from "./speakerHttp";
import { androidWifi } from "./wifi.android";

/** Speaker setup's adapters. Android only: see `index.ts`. */
export function createSetupDeps(): SetupDeps {
  return {
    wifi: androidWifi,
    speaker: boseSpeakerHttp,
    discovery: zeroconfDiscovery,
    permissions: expoPermissions,
    clock: realClock,
    log: appLog,
  };
}
