import type { BoseSpeaker } from "../hooks/useSpeakerManager";

/** Playing or buffering: the speaker is actively producing audio. */
export function isSpeakerPlaying(speaker: BoseSpeaker) {
  return (
    speaker.playStatus === "PLAY_STATE" ||
    speaker.playStatus === "BUFFERING_STATE"
  );
}

/** Something is loaded that transport controls can act on. */
export function hasLoadedMedia(speaker: BoseSpeaker) {
  return Boolean(
    speaker.track ??
    speaker.artUrl ??
    speaker.artist ??
    isSpeakerPlaying(speaker),
  );
}

/** First speaker that is playing, for the mini player. */
export function findPlayingSpeaker(speakers: BoseSpeaker[]) {
  return speakers.find((speaker) => isSpeakerPlaying(speaker));
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
