import { Err, Ok, type Result, TaggedError } from "better-result";
import {
  boseSpeakerClient as createClient,
  TelnetClient,
  type SocketModuleLike,
} from "bose-api-speaker-client";

import { APP_CONFIG } from "@/config";

export class MargeAPIConfigurationError extends TaggedError(
  "MargeAPIConfigurationError",
)<{
  host: string;
  message: string;
  step?: string;
  cause?: unknown;
}>() {}

export async function checkMargeAPIStatus(host: string): Promise<boolean> {
  const client = createClient({ ip: host });
  const infoResult = await client.getInfo();
  if (infoResult.isOk()) {
    const isConfigured =
      infoResult.value.margeURL?.includes(APP_CONFIG.API_URL) ?? false;
    return isConfigured;
  }
  throw infoResult.error;
}

export interface ConfigureMargeAPIOptions {
  onStepStart?: (stepId: string) => void;
  onStepSuccess?: (stepId: string, logMessage?: string) => void;
  onStepError?: (stepId: string, error: unknown) => void;
  onLog?: (text: string, type: "info" | "success" | "error" | "debug") => void;
}

export async function configureMargeAPI(
  host: string,
  socket: SocketModuleLike,
  options?: ConfigureMargeAPIOptions,
): Promise<Result<void, MargeAPIConfigurationError>> {
  const telnet = new TelnetClient({ host, socket });

  const run = async (): Promise<Result<void, MargeAPIConfigurationError>> => {
    // 1. Connect
    options?.onStepStart?.("telnet_connect");
    options?.onLog?.("Opening Telnet connection...", "info");
    const connResult = await telnet.connect();
    if (!connResult.isOk()) {
      const err = new MargeAPIConfigurationError({
        host,
        step: "telnet_connect",
        message: "Failed to connect to speaker via Telnet",
        cause: connResult.error,
      });
      options?.onStepError?.("telnet_connect", err);
      return new Err(err);
    }
    options?.onStepSuccess?.("telnet_connect");
    options?.onLog?.("Successfully established Telnet connection.", "success");

    // 2. Set bmxRegistryUrl
    options?.onStepStart?.("set_registry");
    options?.onLog?.(
      `Executing: sys configuration bmxRegistryUrl ${APP_CONFIG.API_URL}/v2/registry.json`,
      "info",
    );
    const regResult = await telnet.executeCommand(
      `sys configuration bmxRegistryUrl ${APP_CONFIG.API_URL}/v2/registry.json`,
      1200,
    );
    if (!regResult.isOk()) {
      const err = new MargeAPIConfigurationError({
        host,
        step: "set_registry",
        message: "Failed to set BMX registry URL",
        cause: regResult.error,
      });
      options?.onStepError?.("set_registry", err);
      return new Err(err);
    }
    options?.onLog?.(`Response: ${regResult.value.trim()}`, "debug");
    options?.onStepSuccess?.("set_registry");
    options?.onLog?.("Registry URL set successfully.", "success");

    // 3. Set boseurls envswitch
    options?.onStepStart?.("set_redirect");
    options?.onLog?.(
      `Executing: envswitch boseurls set ${APP_CONFIG.API_URL} https://worldwide.bose.com/updates/soundtouch`,
      "info",
    );
    const redirectResult = await telnet.executeCommand(
      `envswitch boseurls set ${APP_CONFIG.API_URL} https://worldwide.bose.com/updates/soundtouch`,
      1200,
    );
    if (!redirectResult.isOk()) {
      const err = new MargeAPIConfigurationError({
        host,
        step: "set_redirect",
        message: "Failed to configure redirect paths",
        cause: redirectResult.error,
      });
      options?.onStepError?.("set_redirect", err);
      return new Err(err);
    }
    options?.onLog?.(`Response: ${redirectResult.value.trim()}`, "debug");
    options?.onStepSuccess?.("set_redirect");
    options?.onLog?.("Redirect paths configured successfully.", "success");

    // 4. Check if account is set
    options?.onStepStart?.("set_account");
    let isAccountSet = false;
    const client = createClient({ ip: host });
    const infoResult = await client.getInfo();
    if (infoResult.isOk() && infoResult.value.margeAccountUUID) {
      isAccountSet = true;
    }

    if (!isAccountSet) {
      // Set AccountId envswitch
      options?.onLog?.(
        "Executing: envswitch AccountId set revivest-user",
        "info",
      );
      const accResult = await telnet.executeCommand(
        "envswitch AccountId set revivest-user",
        1200,
      );
      if (!accResult.isOk()) {
        const err = new MargeAPIConfigurationError({
          host,
          step: "set_account",
          message: "Failed to set Account ID",
          cause: accResult.error,
        });
        options?.onStepError?.("set_account", err);
        return new Err(err);
      }
      options?.onLog?.(`Response: ${accResult.value.trim()}`, "debug");
      options?.onStepSuccess?.("set_account");
      options?.onLog?.("Account env identifier configured.", "success");

      // Pair via HTTP
      options?.onStepStart?.("pair_device");
      options?.onLog?.(
        "Triggering speaker HTTP account pairing (POST /setMargeAccount)...",
        "info",
      );
      const pairingPayload = `<PairDeviceWithAccount>
  <accountId>revivest-user</accountId>
  <userAuthToken>dontcare</userAuthToken>
</PairDeviceWithAccount>`;

      try {
        const response = await fetch(`http://${host}:8090/setMargeAccount`, {
          method: "POST",
          headers: { "Content-Type": "text/xml" },
          body: pairingPayload,
        });
        if (!response.ok) {
          throw new Error(
            `HTTP pairing failed with code ${response.status} ${response.statusText}`,
          );
        }
        options?.onStepSuccess?.("pair_device");
        options?.onLog?.("Account pairing verified by speaker.", "success");
      } catch (e) {
        const err = new MargeAPIConfigurationError({
          host,
          step: "pair_device",
          message: "Failed to pair device with account",
          cause: e,
        });
        options?.onStepError?.("pair_device", err);
        return new Err(err);
      }
    } else {
      options?.onLog?.(
        "Account pairing already configured on speaker, skipping environment set and pairing HTTP call.",
        "info",
      );
      options?.onStepSuccess?.("set_account");
      options?.onStepSuccess?.("pair_device");
    }

    // 5. Reboot
    options?.onStepStart?.("reboot");
    options?.onLog?.("Triggering hardware reboot via Telnet...", "info");
    const rebootResult = await telnet.executeCommand("sys reboot", 500);
    if (!rebootResult.isOk()) {
      const err = new MargeAPIConfigurationError({
        host,
        step: "reboot",
        message: "Failed to issue reboot command",
        cause: rebootResult.error,
      });
      options?.onStepError?.("reboot", err);
      return new Err(err);
    }
    options?.onStepSuccess?.("reboot");
    options?.onLog?.(
      "Reboot command accepted. Speaker is restarting.",
      "success",
    );

    return new Ok(undefined);
  };

  const result = await run();
  telnet.disconnect();
  return result;
}
