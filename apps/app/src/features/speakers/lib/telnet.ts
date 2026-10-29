import { Err, Ok, type Result, TaggedError } from "better-result";
import {
  boseSpeakerClient as createClient,
  TelnetClient,
  type SocketModuleLike,
} from "bose-api-speaker-client";

import { getServerUrl } from "@/features/server/server";
import { isSafeServerUrl } from "@/features/server/server-url";

import { isSafeAccountId } from "./account-id";
import { usesOurServer } from "./marge-api";

export class MargeAPIConfigurationError extends TaggedError(
  "MargeAPIConfigurationError",
)<{
  host: string;
  message: string;
  step?: string;
  cause?: unknown;
}> {}

export async function checkMargeAPIStatus(host: string): Promise<boolean> {
  const client = createClient({ ip: host });
  const infoResult = await client.getInfo();
  if (infoResult.isOk()) {
    return usesOurServer(infoResult.value.margeURL);
  }
  throw infoResult.error;
}

export interface ConfigureMargeAPIOptions {
  onStepStart?: (stepId: string) => void;
  onStepSuccess?: (stepId: string, logMessage?: string) => void;
  onStepError?: (stepId: string, error: unknown) => void;
  onLog?: (text: string, type: "info" | "success" | "error" | "debug") => void;
}

/**
 * Points the speaker at our server and, unless it already has an account,
 * pairs it with `accountId`.
 */
export async function configureMargeAPI(
  host: string,
  socket: SocketModuleLike,
  accountId: string,
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

    // 2. Set bmxRegistryUrl. The server origin goes into this command and
    // the next one: read it once so both name the same server, and check it
    // again here, since `boseurls` runs through the speaker's shell.
    options?.onStepStart?.("set_registry");
    const serverUrl = getServerUrl();
    if (!isSafeServerUrl(serverUrl)) {
      const err = new MargeAPIConfigurationError({
        host,
        step: "set_registry",
        message: `Invalid server address: ${serverUrl}`,
      });
      options?.onStepError?.("set_registry", err);
      return new Err(err);
    }
    options?.onLog?.(
      `Executing: sys configuration bmxRegistryUrl ${serverUrl}/v2/registry.json`,
      "info",
    );
    const regResult = await telnet.executeCommand(
      `sys configuration bmxRegistryUrl ${serverUrl}/v2/registry.json`,
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
      `Executing: envswitch boseurls set ${serverUrl} https://worldwide.bose.com/updates/soundtouch`,
      "info",
    );
    const redirectResult = await telnet.executeCommand(
      `envswitch boseurls set ${serverUrl} https://worldwide.bose.com/updates/soundtouch`,
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

    // 4. Pair with the household account, unless the speaker already has
    // an account.
    options?.onStepStart?.("set_account");
    const client = createClient({ ip: host });
    const infoResult = await client.getInfo();
    const isAccountSet =
      infoResult.isOk() && infoResult.value.margeAccountUUID !== "";

    if (!isAccountSet) {
      if (!isSafeAccountId(accountId)) {
        const err = new MargeAPIConfigurationError({
          host,
          step: "set_account",
          message: `Invalid account id: ${accountId}`,
        });
        options?.onStepError?.("set_account", err);
        return new Err(err);
      }
      options?.onLog?.("Executing: envswitch accountid set <account>", "info");
      const accResult = await telnet.executeCommand(
        `envswitch accountid set ${accountId}`,
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
  <accountId>${accountId}</accountId>
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
