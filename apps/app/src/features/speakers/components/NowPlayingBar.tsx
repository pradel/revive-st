import { useRouter } from "expo-router";

import { useBose } from "@/features/speakers/contexts/BoseContext";
import { haptics } from "@/lib/haptics";
import { MiniPlayer } from "@/ui/ds/MiniPlayer";

import { findActiveSpeaker, isSpeakerPlaying } from "../lib/playback";

/** `MiniPlayer` for the playing (or paused) speaker; renders nothing otherwise. */
export function NowPlayingBar() {
  const router = useRouter();
  const { speakers, playPauseMutation } = useBose();
  const speaker = findActiveSpeaker(speakers);

  if (!speaker) {
    return null;
  }

  return (
    <MiniPlayer
      title={speaker.track ?? speaker.album ?? "Unknown Track"}
      subtitle={[speaker.artist, speaker.name].filter(Boolean).join(" · ")}
      artworkUri={speaker.artUrl}
      isPlaying={isSpeakerPlaying(speaker)}
      onPress={() => {
        router.push(
          `/speakers/${encodeURIComponent(speaker.deviceID)}/now-playing`,
        );
      }}
      onPlayPause={() => {
        haptics.tap();
        playPauseMutation.mutate({ deviceID: speaker.deviceID });
      }}
    />
  );
}
