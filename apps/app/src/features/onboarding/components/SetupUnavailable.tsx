import { useRouter } from "expo-router";
import { Alert, Platform, View } from "react-native";

import { Button } from "@/ui/ds/Button";

import { $setupButtons, SetupHeader } from "./SetupLayout";

/** Setup needs Wi-Fi scanning, which only Android exposes to apps. */
export const SPEAKER_SETUP_SUPPORTED = Platform.OS === "android";

const UNAVAILABLE_TITLE = "Setup not available";
const UNAVAILABLE_MESSAGE =
  "Speaker setup is only available on Android for now. Set the speaker up from an Android phone, or the Bose app, then it will appear here.";

/** Opens speaker setup, or explains why it isn't available on this platform. */
export function useOpenSpeakerSetup(): () => void {
  const router = useRouter();
  return () => {
    if (SPEAKER_SETUP_SUPPORTED) {
      router.push("/onboarding");
    } else {
      Alert.alert(UNAVAILABLE_TITLE, UNAVAILABLE_MESSAGE);
    }
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
