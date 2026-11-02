import { NativeTabs } from "expo-router/native-tabs";
import { Platform } from "react-native";

import { haptics } from "@/lib/haptics";
import {
  MiniPlayer,
  type MiniPlayerPage,
  type MiniPlayerProps,
} from "@/ui/ds/MiniPlayer";

import { useSpeakerCommands } from "../hooks/useSpeakerCommands";
import {
  hasLoadedMedia,
  isSpeakerPlaying,
  isStandby,
  trackTitle,
} from "../lib/playback";
import { selectSpeaker, useSelectedSpeaker } from "../lib/selection";
import { useSpeakers } from "../registry/store";
import type { BoseSpeaker } from "../registry/types";

/**
 * iOS 26 hosts the mini player in the tab bar's bottom accessory, which
 * follows the tab bar as it minimizes; on Android it's docked on top of the
 * tab bar; on older iOS it floats above the tabs.
 */
export const usesTabBarAccessory =
  Platform.OS === "ios" && Number.parseInt(Platform.Version, 10) >= 26;

const toPage = (speaker: BoseSpeaker): MiniPlayerPage => {
  const reachable = speaker.status === "online";
  const hasMedia = reachable && hasLoadedMedia(speaker);
  const state = !reachable
    ? "Offline"
    : isStandby(speaker)
      ? "Standby"
      : undefined;
  return {
    key: speaker.deviceID,
    title: hasMedia ? trackTitle(speaker) : "Nothing playing",
    subtitle: hasMedia
      ? [speaker.artist, speaker.name].filter(Boolean).join(" · ")
      : [speaker.name, state].filter(Boolean).join(" · "),
    artworkUri: hasMedia ? speaker.artUrl : null,
    isPlaying: reachable && isSpeakerPlaying(speaker),
  };
};

/**
 * Mini player props: a page per reached speaker (and the selected one, even
 * offline), by name, showing the selected one; swiping to another page
 * selects it. With a single speaker it shows only while that speaker has
 * something loaded.
 */
export function useNowPlaying(): Omit<MiniPlayerProps, "variant"> | null {
  const { listed } = useSpeakers();
  const { playPauseMutation } = useSpeakerCommands();
  const selected = useSelectedSpeaker();

  if (!selected) {
    return null;
  }
  const speakers = listed.filter(
    (speaker) =>
      speaker.status === "online" || speaker.deviceID === selected.deviceID,
  );
  const hasMedia = selected.status === "online" && hasLoadedMedia(selected);
  if (speakers.length < 2 && !hasMedia) {
    return null;
  }
  return {
    pages: speakers.map(toPage),
    index: speakers.indexOf(selected),
    onIndexChange: (index) => {
      const next = speakers[index];
      if (next) {
        haptics.selection();
        selectSpeaker(next.deviceID);
      }
    },
    playerHref: "/now-playing",
    onPlayPause: hasMedia
      ? () => {
          haptics.tap();
          playPauseMutation.mutate({ deviceID: selected.deviceID });
        }
      : undefined,
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
