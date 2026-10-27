import { useRouter } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useState } from "react";
import {
  Text,
  TouchableOpacity,
  View,
  type TextStyle,
  type ViewStyle,
} from "react-native";

import { Card } from "@/components/ui/Card";
import { COLORS } from "@/ui/theme";

import { simulatedScenarios } from "../adapters/simulated";
import { HOME_PASSWORD, HOME_SSID } from "../session/testing/scenarios";

/** Dev builds only: runs speaker setup against a fake scenario. */
export function SimulateSetupCard() {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  return (
    <Card style={$card}>
      <TouchableOpacity
        style={$row}
        activeOpacity={0.7}
        onPress={() => {
          setOpen((value) => !value);
        }}
      >
        <View style={$iconContainer}>
          <SymbolView
            name={{ ios: "testtube.2", android: "science", web: "science" }}
            tintColor={COLORS.primary}
            size={20}
          />
        </View>
        <View style={$flex}>
          <Text style={$title}>Simulate speaker setup</Text>
          <Text style={$subtitle}>
            Fake speaker and phone; {HOME_SSID} password: {HOME_PASSWORD}
          </Text>
        </View>
        <SymbolView
          name={{
            ios: open ? "chevron.up" : "chevron.down",
            android: open ? "expand_less" : "expand_more",
            web: open ? "expand_less" : "expand_more",
          }}
          tintColor={COLORS.textMuted}
          size={20}
        />
      </TouchableOpacity>
      {open &&
        simulatedScenarios().map(({ name, description }) => (
          <TouchableOpacity
            key={name}
            style={$scenario}
            activeOpacity={0.7}
            onPress={() => {
              router.push({
                pathname: "/onboarding",
                params: { simulate: name },
              });
            }}
          >
            <Text style={$scenarioName}>{name}</Text>
            <Text style={$subtitle}>{description}</Text>
          </TouchableOpacity>
        ))}
    </Card>
  );
}

const $card: ViewStyle = {
  paddingVertical: 4,
  marginTop: 12,
};

const $row: ViewStyle = {
  flexDirection: "row",
  alignItems: "center",
  paddingVertical: 12,
};

const $iconContainer: ViewStyle = {
  width: 36,
  height: 36,
  borderRadius: 8,
  backgroundColor: "rgba(255, 255, 255, 0.05)",
  justifyContent: "center",
  alignItems: "center",
  marginRight: 16,
};

const $flex: ViewStyle = {
  flex: 1,
};

const $title: TextStyle = {
  fontSize: 15,
  color: COLORS.text,
  fontWeight: "500",
};

const $subtitle: TextStyle = {
  fontSize: 12,
  color: COLORS.textMuted,
  marginTop: 2,
};

const $scenario: ViewStyle = {
  paddingVertical: 10,
  paddingLeft: 52,
  borderTopWidth: 1,
  borderTopColor: COLORS.border,
};

const $scenarioName: TextStyle = {
  fontSize: 14,
  color: COLORS.text,
  fontWeight: "600",
};
