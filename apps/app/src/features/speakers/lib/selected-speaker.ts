import type { BoseSpeaker } from "../registry/types";
import { hasLoadedMedia, isSpeakerPlaying } from "./playback";
import { pairLedBy } from "./stereo-pair";

/**
 * The speaker the mini player, the Home presets shelf and Now Playing
 * control: the one the user picked (`selectedID`) while it's listed, even
 * offline, so the app never moves to another speaker on its own; a pair's
 * partner stands for its pair's master. Before the user picks one, or once
 * it's forgotten: the first one playing, else the first one paused with
 * something loaded, else the first one reached.
 */
export function resolveSelectedSpeaker(
  listed: readonly BoseSpeaker[],
  selectedID: string | null,
): BoseSpeaker | undefined {
  const picked =
    selectedID === null
      ? undefined
      : (listed.find((speaker) => speaker.deviceID === selectedID) ??
        listed.find((speaker) =>
          pairLedBy(speaker)?.roles.some(
            (role) => role.deviceID === selectedID,
          ),
        ));
  if (picked) {
    return picked;
  }
  const online = listed.filter((speaker) => speaker.status === "online");
  return (
    online.find((speaker) => isSpeakerPlaying(speaker)) ??
    online.find(
      (speaker) =>
        speaker.playStatus === "PAUSE_STATE" && hasLoadedMedia(speaker),
    ) ??
    online[0]
  );
}
