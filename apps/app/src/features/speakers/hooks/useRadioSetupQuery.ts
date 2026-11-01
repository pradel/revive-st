import { useQuery } from "@tanstack/react-query";

import { useServerUrl } from "@/features/server/server";

import { isSetUpForRadio } from "../lib/radio-setup";

/** The query key of `useRadioSetupQuery`, to refetch it. */
export const RADIO_SETUP_QUERY_KEY = "radio-setup";

/**
 * Whether the speaker at `host` is set up for internet radio on our server;
 * re-checked when the server changes.
 */
export function useRadioSetupQuery(host: string) {
  const serverUrl = useServerUrl();
  return useQuery({
    queryKey: [RADIO_SETUP_QUERY_KEY, host, serverUrl],
    queryFn: async () => isSetUpForRadio(host),
    enabled: host.length > 0,
    retry: false,
    staleTime: 1000 * 60 * 5,
  });
}
