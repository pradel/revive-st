import { useQuery } from "@tanstack/react-query";

import { useServerUrl } from "@/features/server/server";

import { identifyServer } from "../lib/server-profiles";

/**
 * Which server `speaker` uses (`identifyServer`), from the `margeURL` it
 * reports; checked again when it reports another one or our server changes.
 */
export function useSpeakerServerQuery(
  speaker: { host: string; margeURL?: string } | undefined,
) {
  const serverUrl = useServerUrl();
  const host = speaker?.host ?? "";
  const margeURL = speaker?.margeURL ?? "";
  return useQuery({
    queryKey: ["speaker-server", host, margeURL, serverUrl],
    queryFn: async ({ signal }) =>
      identifyServer({ host, margeURL, ourServer: serverUrl }, signal),
    enabled: host !== "" && margeURL !== "",
    retry: false,
    staleTime: 1000 * 60 * 5,
  });
}
