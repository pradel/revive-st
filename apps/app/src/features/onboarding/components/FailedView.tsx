import { useState } from "react";
import { View, type TextStyle, type ViewStyle } from "react-native";

import { Button } from "@/ui/ds/Button";
import type { IconName } from "@/ui/ds/Icon";
import { Text } from "@/ui/ds/Text";
import { TextField } from "@/ui/ds/TextField";
import { space } from "@/ui/tokens";

import { describeError, type SetupError } from "../session/errors";
import type { RecoveryAction } from "../session/types";
import { $setupButtons, $setupCard, SetupHeader } from "./SetupLayout";

const ACTIONS: Record<
  Exclude<RecoveryAction, "enterIp">,
  { label: string; icon: IconName }
> = {
  retry: {
    label: "Try again",
    icon: { ios: "arrow.clockwise", android: "refresh", web: "refresh" },
  },
  requestPermission: {
    label: "Allow location access",
    icon: { ios: "location", android: "location_on", web: "location_on" },
  },
  openAppSettings: {
    label: "Open app settings",
    icon: { ios: "gearshape", android: "settings", web: "settings" },
  },
  openLocationSettings: {
    label: "Open location settings",
    icon: { ios: "location", android: "location_on", web: "location_on" },
  },
  openWifiPanel: {
    label: "Turn on Wi-Fi",
    icon: { ios: "wifi", android: "wifi", web: "wifi" },
  },
  openWifiSettings: {
    label: "Open Wi-Fi settings",
    icon: { ios: "gearshape", android: "settings", web: "settings" },
  },
  manualJoin: {
    label: "Connect manually",
    icon: { ios: "hand.tap", android: "touch_app", web: "touch_app" },
  },
  editCredentials: {
    label: "Edit Wi-Fi details",
    icon: { ios: "pencil", android: "edit", web: "edit" },
  },
  continueAnyway: {
    label: "Continue anyway",
    icon: {
      ios: "arrow.right",
      android: "arrow_forward",
      web: "arrow_forward",
    },
  },
  startOver: {
    label: "Start over",
    icon: {
      ios: "arrow.uturn.backward",
      android: "restart_alt",
      web: "restart_alt",
    },
  },
};

interface FailedViewProps {
  error: SetupError;
  actions: RecoveryAction[];
  onAction: (action: RecoveryAction) => void;
  onEnterIp: (ip: string) => void;
}

export function FailedView({
  error,
  actions,
  onAction,
  onEnterIp,
}: FailedViewProps) {
  const copy = describeError(error);
  const [ip, setIp] = useState("");
  const buttons = actions.filter(
    (action): action is Exclude<RecoveryAction, "enterIp"> =>
      action !== "enterIp",
  );

  return (
    <>
      <SetupHeader
        icon={{
          ios: "exclamationmark.triangle",
          android: "warning",
          web: "warning",
        }}
        tone="error"
        title={copy.title}
        description={copy.body}
      />

      {actions.includes("enterIp") && (
        <View style={$setupCard}>
          <Text variant="body" color="textSecondary" style={$ipLabel}>
            Know the speaker's address? Find it in your router's device list.
          </Text>
          <View style={$ipField}>
            <TextField
              icon={{ ios: "network", android: "lan", web: "lan" }}
              placeholder="192.168.1.20"
              value={ip}
              onChangeText={setIp}
              keyboardType="decimal-pad"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="done"
              onSubmitEditing={() => {
                onEnterIp(ip);
              }}
            />
          </View>
          <Button
            label="Check this address"
            variant="secondary"
            icon={{
              ios: "magnifyingglass",
              android: "search",
              web: "search",
            }}
            disabled={ip.trim() === ""}
            onPress={() => {
              onEnterIp(ip);
            }}
          />
        </View>
      )}

      <View style={$setupButtons}>
        {buttons.map((action, index) => (
          <Button
            key={action}
            label={ACTIONS[action].label}
            icon={ACTIONS[action].icon}
            variant={index === 0 ? "primary" : "secondary"}
            onPress={() => {
              onAction(action);
            }}
          />
        ))}
      </View>
    </>
  );
}

const $ipLabel: TextStyle = {
  marginBottom: space.sm,
};

const $ipField: ViewStyle = {
  marginBottom: space.sm,
};
