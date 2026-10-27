import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, View, type ViewStyle } from "react-native";

import { Card } from "@/components/ui/Card";
import { Icon, icons } from "@/ui/ds/Icon";
import { Text } from "@/ui/ds/Text";
import { color, radius, space } from "@/ui/tokens";

import { simulatedScenarios } from "../adapters/simulated";
import { HOME_PASSWORD, HOME_SSID } from "../session/testing/scenarios";

/** Dev builds only: runs speaker setup against a fake scenario. */
export function SimulateSetupCard() {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  return (
    <Card style={$card}>
      <Pressable
        style={({ pressed }) => [$row, pressed && $pressed]}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={() => {
          setOpen((value) => !value);
        }}
      >
        <View style={$iconWell}>
          <Icon
            name={{ ios: "testtube.2", android: "science", web: "science" }}
          />
        </View>
        <View style={$flex}>
          <Text variant="body">Simulate speaker setup</Text>
          <Text variant="caption" color="textSecondary">
            Fake speaker and phone; {HOME_SSID} password: {HOME_PASSWORD}
          </Text>
        </View>
        <Icon
          name={
            open
              ? {
                  ios: "chevron.up",
                  android: "expand_less",
                  web: "expand_less",
                }
              : icons.chevronDown
          }
          color="textTertiary"
        />
      </Pressable>
      {open &&
        simulatedScenarios().map(({ name, description }) => (
          <Pressable
            key={name}
            style={({ pressed }) => [$scenario, pressed && $pressed]}
            accessibilityRole="button"
            onPress={() => {
              router.push({
                pathname: "/onboarding",
                params: { simulate: name },
              });
            }}
          >
            <Text variant="subhead">{name}</Text>
            <Text variant="caption" color="textSecondary">
              {description}
            </Text>
          </Pressable>
        ))}
    </Card>
  );
}

const $card: ViewStyle = {
  padding: 0,
  paddingVertical: space.xxs,
  marginTop: space.sm,
  overflow: "hidden",
};

const $row: ViewStyle = {
  flexDirection: "row",
  alignItems: "center",
  gap: space.md,
  paddingHorizontal: space.md,
  paddingVertical: space.sm,
};

const $pressed: ViewStyle = {
  backgroundColor: color.surface2,
};

const $iconWell: ViewStyle = {
  width: 36,
  height: 36,
  borderRadius: radius.sm,
  backgroundColor: color.surface2,
  justifyContent: "center",
  alignItems: "center",
};

const $flex: ViewStyle = {
  flex: 1,
  gap: 2,
};

const $scenario: ViewStyle = {
  gap: 2,
  paddingVertical: space.sm,
  paddingLeft: 68,
  paddingRight: space.md,
};
