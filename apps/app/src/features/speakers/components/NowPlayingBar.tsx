import { useRouter } from "expo-router";
import { NativeTabs } from "expo-router/native-tabs";
import { Platform } from "react-native";

import { useBose } from "@/features/speakers/contexts/BoseContext";
import { haptics } from "@/lib/haptics";
import { MiniPlayer, type MiniPlayerProps } from "@/ui/ds/MiniPlayer";

import {
  findActiveSpeaker,
  isSpeakerPlaying,
  trackTitle,
} from "../lib/playback";

/**
 * iOS 26 hosts the mini player in the tab bar's bottom accessory, which
 * follows the tab bar as it minimizes; elsewhere it floats above the tabs.
 */
export const usesTabBarAccessory =
  Platform.OS === "ios" && Number.parseInt(Platform.Version, 10) >= 26;

/** Mini player props for the playing (or paused) speaker, if any. */
export function useNowPlaying(): Omit<MiniPlayerProps, "variant"> | null {
  const router = useRouter();
  const { speakers, playPauseMutation } = useBose();
  const speaker = findActiveSpeaker(speakers);

  if (!speaker) {
    return null;
  }
  return {
    title: trackTitle(speaker),
    subtitle: [speaker.artist, speaker.name].filter(Boolean).join(" · "),
    artworkUri: speaker.artUrl,
    isPlaying: isSpeakerPlaying(speaker),
    onPress: () => {
      router.push(
        `/speakers/${encodeURIComponent(speaker.deviceID)}/now-playing`,
      );
    },
    onPlayPause: () => {
      haptics.tap();
      playPauseMutation.mutate({ deviceID: speaker.deviceID });
    },
  };
}

/** Floating mini player for screen footers; renders nothing otherwise. */
export function NowPlayingBar() {
  const nowPlaying = useNowPlaying();
  if (!nowPlaying || usesTabBarAccessory) {
    return null;
  }
  return <MiniPlayer {...nowPlaying} />;
}

/**
 * Content of the tab bar accessory. It's rendered twice by the system, once
 * per placement, so it holds no state of its own.
 */
export function NowPlayingAccessory(
  nowPlaying: Omit<MiniPlayerProps, "variant">,
) {
  const placement = NativeTabs.BottomAccessory.usePlacement();
  return (
    <MiniPlayer
      {...nowPlaying}
      variant={placement === "inline" ? "inline" : "accessory"}
    />
  );
}
