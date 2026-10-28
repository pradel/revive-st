import { Stack } from "expo-router";
import { useEffect, useState } from "react";
import {
  AccessibilityInfo,
  Alert,
  ScrollView,
  View,
  type TextStyle,
  type ViewStyle,
} from "react-native";

import { Card } from "@/components/ui/Card";
import { useLogger } from "@/lib/useLogger";
import { EmptyState } from "@/ui/ds/EmptyState";
import { Icon } from "@/ui/ds/Icon";
import { Screen } from "@/ui/ds/Screen";
import { Text } from "@/ui/ds/Text";
import { color, radius, space, type ColorName } from "@/ui/tokens";
import { toolbarIcons } from "@/ui/toolbarIcons";

export default function LogsViewer() {
  const { logs, clearLogs, copyLogs, shareLogs } = useLogger();
  const hasLogs = logs.length > 0;
  const [copiedCount, setCopiedCount] = useState<number | null>(null);

  useEffect(() => {
    if (copiedCount === null) {
      return;
    }
    const timer = setTimeout(() => {
      setCopiedCount(null);
    }, 2000);
    return () => {
      clearTimeout(timer);
    };
  }, [copiedCount]);

  const handleCopyLogs = async () => {
    const count = logs.length;
    if (await copyLogs()) {
      setCopiedCount(count);
      AccessibilityInfo.announceForAccessibility(`Copied ${count} log entries`);
    }
  };

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
      footer={
        copiedCount !== null ? (
          <View style={$copied}>
            <Icon
              name={{
                ios: "checkmark.circle.fill",
                android: "check_circle",
                web: "check_circle",
              }}
              color="accent"
            />
            <Text variant="subhead">{`Copied ${copiedCount} log entries`}</Text>
          </View>
        ) : undefined
      }
    >
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Menu
          icon={toolbarIcons.more}
          accessibilityLabel="Log actions"
        >
          <Stack.Toolbar.MenuAction
            icon={toolbarIcons.copy}
            disabled={!hasLogs}
            onPress={() => {
              void handleCopyLogs();
            }}
          >
            Copy all
          </Stack.Toolbar.MenuAction>
          <Stack.Toolbar.MenuAction
            icon={toolbarIcons.share}
            disabled={!hasLogs}
            onPress={() => {
              void shareLogs();
            }}
          >
            Share
          </Stack.Toolbar.MenuAction>
          <Stack.Toolbar.MenuAction
            icon={toolbarIcons.delete}
            destructive
            disabled={!hasLogs}
            onPress={handleClearLogs}
          >
            Clear all
          </Stack.Toolbar.MenuAction>
        </Stack.Toolbar.Menu>
      </Stack.Toolbar>
      <ScrollView
        contentContainerStyle={$scrollContent}
        contentInsetAdjustmentBehavior="automatic"
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

const $copied: ViewStyle = {
  flexDirection: "row",
  alignItems: "center",
  alignSelf: "center",
  gap: space.xs,
  marginBottom: space.sm,
  paddingHorizontal: space.md,
  paddingVertical: space.sm,
  borderRadius: radius.pill,
  backgroundColor: color.surface2,
};
