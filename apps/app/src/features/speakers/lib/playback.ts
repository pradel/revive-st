import type { BoseSpeaker } from "../hooks/useSpeakerManager";

/** Playing or buffering: the speaker is actively producing audio. */
export function isSpeakerPlaying(speaker: BoseSpeaker) {
  return (
    speaker.playStatus === "PLAY_STATE" ||
    speaker.playStatus === "BUFFERING_STATE"
  );
}

/** Something is loaded that transport controls can act on (empty strings count as nothing). */
export function hasLoadedMedia(speaker: BoseSpeaker) {
  return (
    Boolean(speaker.track) ||
    Boolean(speaker.artUrl) ||
    Boolean(speaker.artist) ||
    isSpeakerPlaying(speaker)
  );
}

/**
 * Speaker for the mini player and the Home presets shelf: the first one
 * playing, else the first one paused with something loaded (it stays
 * visible while paused, like Sonos).
 */
export function findActiveSpeaker(speakers: BoseSpeaker[]) {
  return (
    speakers.find((speaker) => isSpeakerPlaying(speaker)) ??
    speakers.find(
      (speaker) =>
        speaker.playStatus === "PAUSE_STATE" && hasLoadedMedia(speaker),
    )
  );
}

export function isStandby(speaker: BoseSpeaker) {
  return speaker.source === "STANDBY" || speaker.playStatus === "STANDBY";
}

/** A preset stores the current stream, so the speaker must be playing one. */
export function canSavePreset(speaker: BoseSpeaker) {
  return !isStandby(speaker) && Boolean(speaker.track);
}

export function playStatusLabel(speaker: BoseSpeaker) {
  switch (speaker.playStatus) {
    case undefined:
    case "":
    case "STANDBY":
      return "Standby";
    case "PLAY_STATE":
      return "Playing";
    case "PAUSE_STATE":
      return "Paused";
    case "STOP_STATE":
      return "Stopped";
    case "BUFFERING_STATE":
      return "Buffering";
    default:
      return speaker.playStatus;
  }
}

export function sourceLabel(source: string) {
  switch (source) {
    case "BLUETOOTH":
      return "Bluetooth";
    case "AUX":
      return "AUX";
    case "STANDBY":
      return "Standby";
    case "INTERNET_RADIO":
    case "LOCAL_INTERNET_RADIO":
    case "TUNEIN":
      return "Radio";
    case "PANDORA":
      return "Pandora";
    case "DEEZER":
      return "Deezer";
    case "SPOTIFY":
      return "Spotify";
    case "AIRPLAY":
      return "AirPlay";
    case "STORED_MUSIC":
      return "Music Library";
    default:
      return source;
  }
}

export function isRadioSource(source: string) {
  return sourceLabel(source) === "Radio";
}

/** Artist/album line under the track title, empty when unknown. */
export function trackDetail(speaker: BoseSpeaker) {
  return [speaker.artist, speaker.album].filter(Boolean).join(" · ");
}
