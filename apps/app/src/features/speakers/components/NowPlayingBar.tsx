import { useRouter } from "expo-router";
import { NativeTabs } from "expo-router/native-tabs";
import { Platform } from "react-native";

import { haptics } from "@/lib/haptics";
import { MiniPlayer, type MiniPlayerProps } from "@/ui/ds/MiniPlayer";

import { useSpeakerCommands } from "../hooks/useSpeakerCommands";
import { hasLoadedMedia, isSpeakerPlaying, trackTitle } from "../lib/playback";
import { useSelectedSpeaker } from "../lib/selection";
import { useSpeakers } from "../registry/store";

/**
 * iOS 26 hosts the mini player in the tab bar's bottom accessory, which
 * follows the tab bar as it minimizes; on Android it's docked on top of the
 * tab bar; on older iOS it floats above the tabs.
 */
export const usesTabBarAccessory =
  Platform.OS === "ios" && Number.parseInt(Platform.Version, 10) >= 26;

/**
 * Mini player props for the selected speaker: shown while it has something
 * loaded, or while another speaker plays (then it says the selected one
 * plays nothing, and its speaker button counts the others).
 */
export function useNowPlaying(): Omit<MiniPlayerProps, "variant"> | null {
  const router = useRouter();
  const { online } = useSpeakers();
  const { playPauseMutation } = useSpeakerCommands();
  const speaker = useSelectedSpeaker();
  const others = online.filter(
    (item) => item.deviceID !== speaker?.deviceID && isSpeakerPlaying(item),
  ).length;

  if (!speaker) {
    return null;
  }
  const reachable = speaker.status === "online";
  const hasMedia = reachable && hasLoadedMedia(speaker);
  if (!hasMedia && others === 0) {
    return null;
  }
  const canSwitch = online.some((item) => item.deviceID !== speaker.deviceID);
  return {
    title: hasMedia ? trackTitle(speaker) : "Nothing playing",
    subtitle: hasMedia
      ? [speaker.artist, speaker.name].filter(Boolean).join(" · ")
      : reachable
        ? speaker.name
        : `${speaker.name} · Offline`,
    artworkUri: hasMedia ? speaker.artUrl : null,
    isPlaying: isSpeakerPlaying(speaker),
    playerHref: "/now-playing",
    onPlayPause: hasMedia
      ? () => {
          haptics.tap();
          playPauseMutation.mutate({ deviceID: speaker.deviceID });
        }
      : undefined,
    onChooseSpeaker: canSwitch
      ? () => {
          router.push("/speaker-picker");
        }
      : undefined,
    othersPlaying: others,
  };
}

/** Mini player for tab screen footers; renders nothing on iOS 26+. */
export function NowPlayingBar() {
  const nowPlaying = useNowPlaying();
  if (!nowPlaying || usesTabBarAccessory) {
    return null;
  }
  return (
    <MiniPlayer
      {...nowPlaying}
      variant={Platform.OS === "android" ? "docked" : "floating"}
    />
  );
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
