import { Stack } from "expo-router";
import { useEffect } from "react";

import { BoseProvider } from "@/features/speakers/contexts/BoseContext";
import { initLogger } from "@/lib/logger";
import { QueryProvider } from "@/providers/QueryProvider";

export default function RootLayout() {
  useEffect(() => {
    initLogger();
  }, []);

  return (
    <QueryProvider>
      <BoseProvider>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: "#09090b" },
          }}
        />
      </BoseProvider>
    </QueryProvider>
  );
}
