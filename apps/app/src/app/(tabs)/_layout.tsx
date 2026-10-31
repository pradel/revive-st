import { NativeTabs } from "expo-router/native-tabs";
import { Platform } from "react-native";

import {
  NowPlayingAccessory,
  useNowPlaying,
  usesTabBarAccessory,
} from "@/features/speakers/components/NowPlayingBar";
import { color } from "@/ui/tokens";

const android = Platform.OS === "android";

/**
 * Android: the Material bar on a raised surface, with the mini player docked
 * on top of it (`NowPlayingBar`), a mint selection pill and grey unselected
 * tabs. iOS keeps the system bar.
 */
const androidBar = android
  ? {
      indicatorColor: color.accentMuted,
      rippleColor: color.accentMuted,
      iconColor: { default: color.textSecondary, selected: color.accent },
      labelStyle: {
        default: { color: color.textSecondary },
        selected: { color: color.accent, fontWeight: "600" as const },
      },
    }
  : {};

export default function TabLayout() {
  const nowPlaying = useNowPlaying();

  return (
    <NativeTabs
      backgroundColor={android ? color.surface1 : color.bg}
      tintColor={color.accent}
      minimizeBehavior="onScrollDown"
      {...androidBar}
    >
      {usesTabBarAccessory && nowPlaying ? (
        <NativeTabs.BottomAccessory>
          <NowPlayingAccessory {...nowPlaying} />
        </NativeTabs.BottomAccessory>
      ) : null}
      <NativeTabs.Trigger name="(home)">
        <NativeTabs.Trigger.Icon
          sf={{ default: "house", selected: "house.fill" }}
          md="home"
        />
        <NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="(radio)">
        <NativeTabs.Trigger.Icon
          sf={{ default: "radio", selected: "radio.fill" }}
          md="radio"
        />
        <NativeTabs.Trigger.Label>Radio</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="(settings)">
        <NativeTabs.Trigger.Icon sf="gearshape.fill" md="settings" />
        <NativeTabs.Trigger.Label>Settings</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
