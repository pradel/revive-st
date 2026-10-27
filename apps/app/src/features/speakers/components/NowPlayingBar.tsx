import { useRouter } from "expo-router";

import { useBose } from "@/features/speakers/contexts/BoseContext";
import { MiniPlayer } from "@/ui/ds/MiniPlayer";

import { findPlayingSpeaker } from "../lib/playback";

/** `MiniPlayer` for the first playing speaker; renders nothing otherwise. */
export function NowPlayingBar() {
  const router = useRouter();
  const { speakers, playPauseMutation } = useBose();
  const speaker = findPlayingSpeaker(speakers);

  if (!speaker) {
    return null;
  }

  return (
    <MiniPlayer
      title={speaker.track ?? speaker.album ?? "Unknown Track"}
      subtitle={[speaker.artist, speaker.name].filter(Boolean).join(" · ")}
      artworkUri={speaker.artUrl}
      isPlaying
      onPress={() => {
        router.push(
          `/speakers/${encodeURIComponent(speaker.deviceID)}/now-playing`,
        );
      }}
      onPlayPause={() => {
        playPauseMutation.mutate({ deviceID: speaker.deviceID });
      }}
    />
  );
}
