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

import { color } from "@/ui/tokens";

import type { PlayerBarProps } from "./PlayerBar.types";

/** Glass buttons on iOS 26, bordered ones before. */
const style = buttonStyle(isLiquidGlassAvailable() ? "glass" : "bordered");

/** The system's own buttons and menu, so they match the rest of iOS. */
export function PlayerBar({
  speakerName,
  onChooseSpeaker,
  onOpenSettings,
  sources,
  onSelectSource,
}: PlayerBarProps) {
  const round = [
    style,
    buttonBorderShape("circle"),
    labelStyle("iconOnly"),
    controlSize("large"),
    tint(color.textPrimary),
  ];
  return (
    <Host matchContents={{ vertical: true }} style={$host}>
      <HStack spacing={12}>
        <Menu
          label="Source"
          systemImage="rectangle.connected.to.line.below"
          modifiers={round}
        >
          {sources.map((source) => (
            <Toggle
              key={source.id}
              label={source.title}
              systemImage={
                typeof source.icon === "string" ? source.icon : undefined
              }
              isOn={source.selected}
              onIsOnChange={() => {
                onSelectSource(source.id);
              }}
            />
          ))}
        </Menu>
        <Spacer />
        <Button
          label={speakerName}
          systemImage="hifispeaker.fill"
          onPress={onChooseSpeaker}
          modifiers={[
            style,
            buttonBorderShape("capsule"),
            controlSize("large"),
            tint(color.textPrimary),
          ]}
        />
        <Spacer />
        <Button
          label="Speaker settings"
          systemImage="gearshape"
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
