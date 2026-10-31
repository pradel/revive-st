import { useRouter } from "expo-router";
import { Platform, View } from "react-native";

import { Button } from "@/ui/ds/Button";

import { $setupButtons, SetupHeader } from "./SetupLayout";

/** Setup needs Wi-Fi scanning, which only Android exposes to apps. */
export const SPEAKER_SETUP_SUPPORTED = Platform.OS === "android";

const UNAVAILABLE_TITLE = "Coming soon";
const UNAVAILABLE_MESSAGE =
  "Speaker setup on iPhone is coming soon. For now, set the speaker up from an Android phone or the Bose app, then it will appear here.";

/**
 * Opens speaker setup. Where setup isn't supported, the setup route explains
 * why (`SetupUnavailableView`).
 */
export function useOpenSpeakerSetup(): () => void {
  const router = useRouter();
  return () => {
    router.push("/onboarding");
  };
}

/** Shown by the setup route on platforms that can't run setup. */
export function SetupUnavailableView({ onClose }: { onClose: () => void }) {
  return (
    <>
      <SetupHeader
        icon={{
          ios: "iphone.slash",
          android: "phonelink_off",
          web: "phonelink_off",
        }}
        title={UNAVAILABLE_TITLE}
        description={UNAVAILABLE_MESSAGE}
      />
      <View style={$setupButtons}>
        <Button
          label="Back to dashboard"
          icon={{ ios: "house", android: "home", web: "home" }}
          onPress={onClose}
        />
      </View>
    </>
  );
}
