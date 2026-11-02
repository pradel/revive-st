import { Button, HStack, Host, Menu, Spacer, Toggle } from "@expo/ui/swift-ui";
import {
  buttonBorderShape,
  buttonStyle,
  controlSize,
  labelStyle,
  tint,
} from "@expo/ui/swift-ui/modifiers";
import { isLiquidGlassAvailable } from "expo-glass-effect";
import type { ViewStyle } from "react-native";

import { icons } from "@/ui/ds/Icon";
import { color } from "@/ui/tokens";

import type { PlayerBarProps } from "./PlayerBar.types";
import { SWITCHABLE_SOURCES } from "./sources";

/** Glass buttons on iOS 26, bordered ones before. */
const style = buttonStyle(isLiquidGlassAvailable() ? "glass" : "bordered");
const white = tint(color.textPrimary);
const round = [
  style,
  buttonBorderShape("circle"),
  labelStyle("iconOnly"),
  controlSize("large"),
  white,
];
const pill = [style, buttonBorderShape("capsule"), controlSize("large"), white];

/** The system's own buttons and menu, so they match the rest of iOS. */
export function PlayerBar({
  speakerName,
  currentSource,
  onSelectSource,
  onChooseSpeaker,
  onOpenSettings,
}: PlayerBarProps) {
  return (
    <Host matchContents={{ vertical: true }} style={$host}>
      <HStack spacing={12}>
        <Menu label="Source" systemImage={icons.source.ios} modifiers={round}>
          {SWITCHABLE_SOURCES.map((source) => (
            <Toggle
              key={source.id}
              label={source.title}
              systemImage={
                typeof source.icon === "string" ? source.icon : undefined
              }
              isOn={source.id === currentSource}
              onIsOnChange={() => {
                onSelectSource(source);
              }}
            />
          ))}
        </Menu>
        <Spacer />
        <Button
          label={speakerName}
          systemImage={icons.speaker.ios}
          onPress={onChooseSpeaker}
          modifiers={pill}
        />
        <Spacer />
        <Button
          label="Speaker settings"
          systemImage={icons.settings.ios}
          onPress={onOpenSettings}
          modifiers={round}
        />
      </HStack>
    </Host>
  );
}

const $host: ViewStyle = {
  alignSelf: "stretch",
};
