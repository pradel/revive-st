import { useRouter } from "expo-router";
import { View, type ViewStyle } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  hasLoadedMedia,
  isStandby,
  speakerStateLabel,
  trackTitle,
} from "@/features/speakers/lib/playback";
import {
  selectSpeaker,
  useSelectedSpeaker,
} from "@/features/speakers/lib/selection";
import { isPartnerUnreachable } from "@/features/speakers/lib/stereo-pair";
import { useSpeakers } from "@/features/speakers/registry/store";
import type { BoseSpeaker } from "@/features/speakers/registry/types";
import { haptics } from "@/lib/haptics";
import { EmptyState } from "@/ui/ds/EmptyState";
import { icons } from "@/ui/ds/Icon";
import { ListRow } from "@/ui/ds/ListRow";
import { Text } from "@/ui/ds/Text";
import { space } from "@/ui/tokens";

/** What the speaker plays, in a few words, under its name. */
const speakerSummary = (speaker: BoseSpeaker) => {
  if (isStandby(speaker)) {
    return speakerStateLabel(speaker);
  }
  return hasLoadedMedia(speaker)
    ? `${trackTitle(speaker)} · ${speakerStateLabel(speaker)}`
    : "Nothing playing";
};

/**
 * Picks the speaker the mini player, the Home presets and Now Playing
 * control, among the reached ones.
 */
export default function SpeakerPicker() {
  const router = useRouter();
  const { online } = useSpeakers();
  const selected = useSelectedSpeaker();

  return (
    <SafeAreaView edges={["bottom"]} style={$sheet}>
      <View style={$header}>
        <Text variant="title" accessibilityRole="header">
          Choose a speaker
        </Text>
        <Text variant="body" color="textSecondary">
          The player and the presets on Home control this speaker.
        </Text>
      </View>
      {online.length === 0 ? (
        <EmptyState
          icon={icons.wifiOff}
          title="No speakers reached"
          description="Make sure your speakers are on and on the same Wi-Fi network as your phone."
        />
      ) : (
        <View>
          {online.map((speaker) => (
            <ListRow
              key={speaker.deviceID}
              title={speaker.name}
              subtitle={
                isPartnerUnreachable(speaker)
                  ? "Partner unreachable"
                  : speakerSummary(speaker)
              }
              artworkUri={hasLoadedMedia(speaker) ? speaker.artUrl : null}
              fallbackIcon={icons.speaker}
              selected={speaker.deviceID === selected?.deviceID}
              onPress={() => {
                haptics.tap();
                selectSpeaker(speaker.deviceID);
                router.back();
              }}
            />
          ))}
        </View>
      )}
    </SafeAreaView>
  );
}

const $sheet: ViewStyle = {
  paddingBottom: space.md,
};

const $header: ViewStyle = {
  paddingHorizontal: space.screen,
  paddingTop: space.xl,
  paddingBottom: space.sm,
  gap: space.xxs,
};
