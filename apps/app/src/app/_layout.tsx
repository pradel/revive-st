import { Stack } from "expo-router";

import { BoseProvider } from "@/features/speakers/contexts/BoseContext";
import { QueryProvider } from "@/providers/QueryProvider";

export default function RootLayout() {
  return (
    <QueryProvider>
      <BoseProvider>
        <Stack />
      </BoseProvider>
    </QueryProvider>
  );
}
