import { Stack } from "expo-router";
import { BoseProvider } from "@/features/speakers/contexts/BoseContext";

export default function RootLayout() {
  return (
    <BoseProvider>
      <Stack />
    </BoseProvider>
  );
}
