import { useQueries } from "@tanstack/react-query";
import { BoseHttpAdapter } from "bose-api-speaker-client";

import { isInZone } from "@/features/speakers/lib/stereo-pair";
import type { BoseSpeaker } from "@/features/speakers/registry/types";

const ZONE_TIMEOUT_MS = 4000;
/** How soon a speaker whose `/getZone` failed is asked again. */
const ZONE_RETRY_MS = 5000;

/**
 * Whether each reached speaker plays in a multiroom zone, by device id,
 * read from its `/getZone` while the screen shows; absent until it answers.
 * A speaker that doesn't answer is `null`, so it can't pair, and is asked
 * again every few seconds until it does.
 */
export function useZones(
  speakers: readonly BoseSpeaker[],
): ReadonlyMap<string, boolean | null> {
  const reached = speakers.filter((speaker) => speaker.status === "online");
  const results = useQueries({
    queries: reached.map((speaker) => ({
      queryKey: ["zone", speaker.deviceID, speaker.host, speaker.port],
      queryFn: async () => {
        const controller = new AbortController();
        const timer = setTimeout(() => {
          controller.abort();
        }, ZONE_TIMEOUT_MS);
        try {
          const zone = await new BoseHttpAdapter({
            ip: speaker.host,
            port: speaker.port,
          }).getZone({ signal: controller.signal });
          return zone.isOk() ? isInZone(zone.value) : null;
        } finally {
          clearTimeout(timer);
        }
      },
      staleTime: 0,
      retry: false,
      refetchInterval: (query: { state: { data?: boolean | null } }) =>
        query.state.data === null ? ZONE_RETRY_MS : false,
    })),
  });
  const zones = new Map<string, boolean | null>();
  results.forEach((result, index) => {
    const speaker = reached[index];
    if (speaker && result.data !== undefined) {
      zones.set(speaker.deviceID, result.data);
    }
  });
  return zones;
}
