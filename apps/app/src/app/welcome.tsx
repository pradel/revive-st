import { View, type ViewStyle } from "react-native";

import { finishLocalNetworkIntro } from "@/features/speakers/lib/local-network";
import { Button } from "@/ui/ds/Button";
import { EmptyState } from "@/ui/ds/EmptyState";
import { icons } from "@/ui/ds/Icon";
import { Screen } from "@/ui/ds/Screen";

/**
 * First launch on iOS: says why the Local Network prompt that follows matters
 * before the first scan triggers it. Continuing starts the scan.
 */
export default function Welcome() {
  return (
    <Screen presentation="fullscreen">
      <View style={$centered}>
        <EmptyState
          icon={icons.speaker}
          title="Find your speakers"
          description="Revive ST talks to your SoundTouch speakers over your Wi-Fi. Your iPhone will now ask to let it find devices on your local network: tap Allow, or the app can't see your speakers."
          actions={
            <Button
              label="Continue"
              onPress={() => {
                void finishLocalNetworkIntro();
              }}
            />
          }
        />
      </View>
    </Screen>
  );
}

const $centered: ViewStyle = {
  flex: 1,
  justifyContent: "center",
};
