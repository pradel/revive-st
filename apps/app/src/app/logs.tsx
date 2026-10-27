import { useRouter } from "expo-router";
import {
  Alert,
  ScrollView,
  View,
  type TextStyle,
  type ViewStyle,
} from "react-native";

import { Card } from "@/components/ui/Card";
import { useLogger } from "@/lib/useLogger";
import { Button } from "@/ui/ds/Button";
import { EmptyState } from "@/ui/ds/EmptyState";
import { Screen } from "@/ui/ds/Screen";
import { Text } from "@/ui/ds/Text";
import { space, type ColorName } from "@/ui/tokens";

export default function LogsViewer() {
  const router = useRouter();
  const { logs, clearLogs, copyLogs } = useLogger();

  const handleClearLogs = () => {
    Alert.alert("Clear All Logs", "This cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Clear All",
        style: "destructive",
        onPress: () => {
          void clearLogs();
        },
      },
    ]);
  };

  return (
    <Screen
      title="Logs"
      onBack={() => {
        router.back();
      }}
      footer={
        <View style={$bottomBar}>
          <View style={$fill}>
            <Button
              label="Copy all"
              onPress={() => {
                void copyLogs();
              }}
            />
          </View>
          <Button label="Clear" variant="secondary" onPress={handleClearLogs} />
        </View>
      }
    >
      <ScrollView
        contentContainerStyle={$scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {logs.length === 0 ? (
          <EmptyState
            icon={{
              ios: "doc.text",
              android: "description",
              web: "description",
            }}
            title="No logs yet"
          />
        ) : (
          logs.map((entry) => (
            <Card key={entry.id} style={$logEntry}>
              <View style={$logMeta}>
                <Text variant="caption" color="textTertiary">
                  {new Date(entry.timestamp).toLocaleTimeString()}
                </Text>
                <Text variant="overline" color={levelColor(entry.level)}>
                  {entry.level}
                </Text>
              </View>
              <Text
                variant="subhead"
                color="textSecondary"
                style={$logMessage}
                selectable
              >
                {entry.message}
              </Text>
            </Card>
          ))
        )}
      </ScrollView>
    </Screen>
  );
}

function levelColor(level: string): ColorName {
  switch (level) {
    case "error":
      return "danger";
    case "warn":
      return "warning";
    default:
      return "textSecondary";
  }
}

const $scrollContent: ViewStyle = {
  paddingHorizontal: space.screen,
  paddingBottom: space.lg,
  gap: space.xs,
};

const $logEntry: ViewStyle = {
  gap: space.xs,
};

const $logMeta: ViewStyle = {
  flexDirection: "row",
  justifyContent: "space-between",
  alignItems: "center",
};

const $logMessage: TextStyle = {
  fontFamily: "monospace",
  fontWeight: "400",
};

const $bottomBar: ViewStyle = {
  flexDirection: "row",
  gap: space.xs,
  paddingHorizontal: space.screen,
  paddingVertical: space.sm,
};

const $fill: ViewStyle = {
  flex: 1,
};
