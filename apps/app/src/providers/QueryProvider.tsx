import {
  onlineManager,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import * as Network from "expo-network";
import { useState, type PropsWithChildren } from "react";

// Online status management
// https://tanstack.com/query/latest/docs/framework/react/react-native
onlineManager.setEventListener((setOnline) => {
  let initialised = false;

  const eventSubscription = Network.addNetworkStateListener((state) => {
    initialised = true;
    setOnline(Boolean(state.isConnected));
  });

  Network.getNetworkStateAsync()
    .then((state) => {
      if (!initialised) {
        setOnline(Boolean(state.isConnected));
      }
    })
    .catch(() => {
      // getNetworkStateAsync can reject on some platforms/SDK versions
    });

  // oxlint-disable-next-line typescript/unbound-method
  return eventSubscription.remove;
});

export function QueryProvider({ children }: PropsWithChildren) {
  // oxlint-disable-next-line react/hook-use-state
  const [queryClient] = useState(() => new QueryClient({}));

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
