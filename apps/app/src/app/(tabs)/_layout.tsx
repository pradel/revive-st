import { NativeTabs } from "expo-router/native-tabs";

import {
  NowPlayingAccessory,
  useNowPlaying,
  usesTabBarAccessory,
} from "@/features/speakers/components/NowPlayingBar";
import { color } from "@/ui/tokens";

export default function TabLayout() {
  const nowPlaying = useNowPlaying();

  return (
    <NativeTabs
      backgroundColor={color.bg}
      tintColor={color.accent}
      minimizeBehavior="onScrollDown"
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
