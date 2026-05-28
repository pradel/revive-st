import { Err, Ok, type Result, TaggedError } from "better-result";
import {
  boseSpeakerClient as createClient,
  TelnetClient,
  type SocketModuleLike,
} from "bose-api-speaker-client";

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
      infoResult.value.margeURL?.includes("api.revivest.app") ?? false;
    return isConfigured;
  }
  return false;
}

export async function configureMargeAPI(
  host: string,
  socket: SocketModuleLike,
): Promise<Result<void, MargeAPIConfigurationError>> {
  const telnet = new TelnetClient({ host, socket });

  const run = async (): Promise<Result<void, MargeAPIConfigurationError>> => {
    // 1. Connect
    const connResult = await telnet.connect();
    if (!connResult.isOk()) {
      return new Err(
        new MargeAPIConfigurationError({
          host,
          step: "telnet_connect",
          message: "Failed to connect to speaker via Telnet",
          cause: connResult.error,
        }),
      );
    }

    // 2. Set bmxRegistryUrl
    const regResult = await telnet.executeCommand(
      "sys configuration bmxRegistryUrl https://api.revivest.app/v2/registry.json",
      1000,
    );
    if (!regResult.isOk()) {
      return new Err(
        new MargeAPIConfigurationError({
          host,
          step: "set_registry",
          message: "Failed to set BMX registry URL",
          cause: regResult.error,
        }),
      );
    }

    // 3. Set boseurls envswitch
    const redirectResult = await telnet.executeCommand(
      "envswitch boseurls set https://api.revivest.app https://worldwide.bose.com/updates/soundtouch",
      1000,
    );
    if (!redirectResult.isOk()) {
      return new Err(
        new MargeAPIConfigurationError({
          host,
          step: "set_redirect",
          message: "Failed to configure redirect paths",
          cause: redirectResult.error,
        }),
      );
    }

    // 4. Check if account is set
    let isAccountSet = false;
    const client = createClient({ ip: host });
    const infoResult = await client.getInfo();
    if (infoResult.isOk() && infoResult.value.margeAccountUUID) {
      isAccountSet = true;
    }

    if (!isAccountSet) {
      // Set AccountId envswitch
      const accResult = await telnet.executeCommand(
        "envswitch AccountId set revivest-user",
        1000,
      );
      if (!accResult.isOk()) {
        return new Err(
          new MargeAPIConfigurationError({
            host,
            step: "set_account",
            message: "Failed to set Account ID",
            cause: accResult.error,
          }),
        );
      }

      // Pair via HTTP
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
          // Warning logged if not ok
        }
      } catch {
        // Ignored in run configuration
      }
    }

    // 5. Reboot
    const rebootResult = await telnet.executeCommand("sys reboot", 500);
    if (!rebootResult.isOk()) {
      return new Err(
        new MargeAPIConfigurationError({
          host,
          step: "reboot",
          message: "Failed to issue reboot command",
          cause: rebootResult.error,
        }),
      );
    }

    return new Ok(undefined);
  };

  const result = await run();
  telnet.disconnect();
  return result;
}
