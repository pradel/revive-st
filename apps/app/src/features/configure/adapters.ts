import { Result } from "better-result";
import {
  BoseHttpAdapter,
  escapeXml,
  type SocketModuleLike,
  TelnetClient,
} from "bose-api-speaker-client";
import TcpSocket from "react-native-tcp-socket";

import { zeroconfDiscovery } from "@/features/onboarding/adapters/discovery";
import { realClock } from "@/features/onboarding/adapters/runtime";
import type { Log } from "@/features/onboarding/session/ports";
import { getServerUrl, serverFetch } from "@/features/server/server";
import { resolveHouseholdAccountId } from "@/features/speakers/lib/account";
import { syncPresetsToMarge } from "@/features/speakers/lib/marge-api";
import { logger } from "@/lib/logger";

import {
  type ConfigureDeps,
  type ConsolePort,
  PortFailure,
  type ServerPort,
  type SpeakerPort,
} from "./session/ports";

const failure = (error: unknown) =>
  new PortFailure({
    message: error instanceof Error ? error.message : String(error),
  });

/** A speaker POST whose body the HTTP client doesn't build. */
async function postToSpeaker(
  host: string,
  path: string,
  contentType: string,
  body: string,
  signal: AbortSignal,
): Promise<Result<void, PortFailure>> {
  try {
    const response = await fetch(`http://${host}:8090${path}`, {
      method: "POST",
      headers: { "Content-Type": contentType },
      body,
      signal,
    });
    return response.ok
      ? Result.ok(undefined)
      : Result.err(
          new PortFailure({
            message: `HTTP ${response.status} ${response.statusText}`,
          }),
        );
  } catch (error) {
    return Result.err(failure(error));
  }
}

const speaker: SpeakerPort = {
  info: async (host, signal) => {
    const info = await new BoseHttpAdapter({ ip: host }).getInfo({ signal });
    return info.isOk()
      ? Result.ok({
          deviceID: info.value.deviceID,
          name: info.value.name,
          margeURL: info.value.margeURL,
          margeAccountUUID: info.value.margeAccountUUID,
        })
      : Result.err(failure(info.error));
  },
  presets: async (host, signal) => {
    const presets = await new BoseHttpAdapter({ ip: host }).getPresets({
      signal,
    });
    return presets.isOk()
      ? Result.ok(presets.value.presets)
      : Result.err(failure(presets.error));
  },
  setMargeAccount: async (host, accountId, signal) =>
    postToSpeaker(
      host,
      "/setMargeAccount",
      "text/xml",
      `<PairDeviceWithAccount><accountId>${escapeXml(accountId)}</accountId><userAuthToken>dontcare</userAuthToken></PairDeviceWithAccount>`,
      signal,
    ),
  sourcesUpdated: async (host, deviceID, signal) =>
    postToSpeaker(
      host,
      "/notification",
      "application/xml",
      `<updates deviceID="${escapeXml(deviceID)}"><sourcesUpdated/></updates>`,
      signal,
    ),
};

const consolePort: ConsolePort = {
  open: async (host) => {
    const client = new TelnetClient({
      host,
      socket: TcpSocket as unknown as SocketModuleLike,
    });
    const connected = await client.connect();
    if (connected.isErr()) {
      return Result.err(failure(connected.error));
    }
    return Result.ok({
      run: async (command, options) => {
        const reply = await client.executeCommand(command, options);
        return reply.isOk()
          ? Result.ok(reply.value)
          : Result.err({
              reason: reply.error.reason,
              message: reply.error.message,
              ...(reply.error.reply === undefined
                ? {}
                : { reply: reply.error.reply }),
            });
      },
      close: () => {
        client.disconnect();
      },
    });
  },
};

const server: ServerPort = {
  origin: getServerUrl,
  householdAccount: async (speakerAccount, otherSpeakers) => {
    try {
      return Result.ok(
        await resolveHouseholdAccountId(speakerAccount, otherSpeakers),
      );
    } catch (error) {
      return Result.err(failure(error));
    }
  },
  savePresets: async (accountId, deviceID, presets) => {
    try {
      await syncPresetsToMarge(accountId, deviceID, presets);
      return Result.ok(undefined);
    } catch (error) {
      return Result.err(failure(error));
    }
  },
  lastContact: async (deviceID, signal) => {
    try {
      const response = await serverFetch(
        `${getServerUrl()}/api/internal/device/${encodeURIComponent(deviceID)}/contact`,
        { signal },
      );
      if (response.status === 404) {
        return Result.ok({ supported: false });
      }
      if (!response.ok) {
        return Result.err(
          new PortFailure({
            message: `HTTP ${response.status} ${response.statusText}`,
          }),
        );
      }
      const { lastContactAt } = (await response.json()) as {
        lastContactAt?: unknown;
      };
      if (lastContactAt !== null && typeof lastContactAt !== "number") {
        return Result.err(
          new PortFailure({ message: "The server sent an unexpected reply" }),
        );
      }
      return Result.ok({ supported: true, at: lastContactAt });
    } catch (error) {
      return Result.err(failure(error));
    }
  },
};

export const configureLog: Log = {
  event(name, data) {
    if (data === undefined) {
      logger.log(`[Configure] ${name}`);
    } else {
      logger.log(`[Configure] ${name}`, data);
    }
  },
};

export function createConfigureDeps(): ConfigureDeps {
  return {
    speaker,
    console: consolePort,
    server,
    discovery: zeroconfDiscovery,
    clock: realClock,
    log: configureLog,
  };
}
