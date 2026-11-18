import { Result } from "better-result";
import { BoseHttpAdapter } from "bose-api-speaker-client";

import { realClock } from "@/features/onboarding/adapters/runtime";
import { fetchServerCheck, getServerUrl } from "@/features/server/server";
import { logger } from "@/lib/logger";

import type { PairDeps, PairMember } from "./session";

const http = ({ host, port }: PairMember) =>
  new BoseHttpAdapter({ ip: host, port });

export function createPairDeps(): PairDeps {
  return {
    checkServer: async (signal) => {
      try {
        return Result.ok(await fetchServerCheck(getServerUrl(), signal));
      } catch (error) {
        return Result.err(
          error instanceof Error ? error : new Error(String(error)),
        );
      }
    },
    speaker: {
      getGroup: async (member, signal) => http(member).getGroup({ signal }),
      addGroup: async (member, group, signal) =>
        http(member).addGroup(group, { signal }),
      removeGroup: async (member, signal) =>
        http(member).removeGroup({ signal }),
    },
    clock: realClock,
    log: {
      event(name, data) {
        if (data === undefined) {
          logger.log(`[StereoPair] ${name}`);
        } else {
          logger.log(`[StereoPair] ${name}`, data);
        }
      },
    },
  };
}
