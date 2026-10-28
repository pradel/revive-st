import { SymbolView, type SymbolViewProps } from "expo-symbols";

import { color, type ColorName } from "@/ui/tokens";

/** Cross-platform symbol name: SF Symbol on iOS, Material Symbol elsewhere. */
export type IconName = SymbolViewProps["name"];

/** Shared icon vocabulary so screens don't repeat platform name triples. */
export const icons = {
  add: { ios: "plus", android: "add", web: "add" },
  back: { ios: "chevron.left", android: "arrow_back", web: "arrow_back" },
  chevronDown: {
    ios: "chevron.down",
    android: "keyboard_arrow_down",
    web: "keyboard_arrow_down",
  },
  chevronRight: {
    ios: "chevron.right",
    android: "chevron_right",
    web: "chevron_right",
  },
  close: { ios: "xmark", android: "close", web: "close" },
  lock: { ios: "lock", android: "lock", web: "lock" },
  music: { ios: "music.note", android: "music_note", web: "music_note" },
  next: { ios: "forward.fill", android: "skip_next", web: "skip_next" },
  pause: { ios: "pause.fill", android: "pause", web: "pause" },
  play: { ios: "play.fill", android: "play_arrow", web: "play_arrow" },
  previous: {
    ios: "backward.fill",
    android: "skip_previous",
    web: "skip_previous",
  },
  radio: { ios: "radio", android: "radio", web: "radio" },
  refresh: { ios: "arrow.clockwise", android: "refresh", web: "refresh" },
  search: { ios: "magnifyingglass", android: "search", web: "search" },
  settings: { ios: "gearshape", android: "settings", web: "settings" },
  speaker: {
    ios: "hifispeaker.fill",
    android: "speaker",
    web: "speaker",
  },
  star: { ios: "star", android: "star_outline", web: "star_outline" },
  starFilled: { ios: "star.fill", android: "star", web: "star" },
  volume: {
    ios: "speaker.wave.2.fill",
    android: "volume_up",
    web: "volume_up",
  },
  volumeMuted: {
    ios: "speaker.slash.fill",
    android: "volume_off",
    web: "volume_off",
  },
  warning: {
    ios: "exclamationmark.triangle.fill",
    android: "warning",
    web: "warning",
  },
  waveform: { ios: "waveform", android: "graphic_eq", web: "graphic_eq" },
  wifiOff: { ios: "wifi.slash", android: "wifi_off", web: "wifi_off" },
} as const satisfies Record<string, IconName>;

export interface IconProps {
  name: IconName;
  size?: number;
  color?: ColorName;
}

export function Icon({
  name,
  size = 20,
  color: colorName = "textSecondary",
}: IconProps) {
  return <SymbolView name={name} size={size} tintColor={color[colorName]} />;
}
