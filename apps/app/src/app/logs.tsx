import { Stack } from "expo-router";
import { useEffect, useState } from "react";
import {
  AccessibilityInfo,
  Alert,
  FlatList,
  ScrollView,
  View,
  type TextStyle,
  type ViewStyle,
} from "react-native";

import { Card } from "@/components/ui/Card";
import { haptics } from "@/lib/haptics";
import type { LogEntry, LogLevel } from "@/lib/logger";
import { useLogger } from "@/lib/useLogger";
import { Chip } from "@/ui/ds/Chip";
import { EmptyState } from "@/ui/ds/EmptyState";
import { Icon } from "@/ui/ds/Icon";
import { Screen } from "@/ui/ds/Screen";
import { Text } from "@/ui/ds/Text";
import { nativeIcons } from "@/ui/nativeIcons";
import { color, radius, space, type ColorName } from "@/ui/tokens";

type LevelFilter = "all" | LogLevel;

const LEVEL_FILTERS: readonly {
  value: LevelFilter;
  label: string;
  emptyTitle: string;
}[] = [
  { value: "all", label: "All", emptyTitle: "No logs yet" },
  { value: "error", label: "Errors", emptyTitle: "No errors" },
  { value: "warn", label: "Warnings", emptyTitle: "No warnings" },
  { value: "info", label: "Info", emptyTitle: "No info messages" },
  { value: "log", label: "Log", emptyTitle: "No log messages" },
  { value: "debug", label: "Debug", emptyTitle: "No debug messages" },
];

const logsIcon = {
  ios: "doc.text",
  android: "description",
  web: "description",
} as const;

export default function LogsViewer() {
  const { logs, clearLogs, copyLogs, shareLogs } = useLogger();
  const hasLogs = logs.length > 0;
  const [copiedCount, setCopiedCount] = useState<number | null>(null);
  const [levelFilter, setLevelFilter] = useState<LevelFilter>("all");
  const visibleLogs =
    levelFilter === "all"
      ? logs
      : logs.filter((entry) => entry.level === levelFilter);
  const emptyTitle =
    LEVEL_FILTERS.find((filter) => filter.value === levelFilter)?.emptyTitle ??
    "";

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
          icon={nativeIcons.more}
          accessibilityLabel="Log actions"
        >
          <Stack.Toolbar.MenuAction
            icon={nativeIcons.copy}
            disabled={!hasLogs}
            onPress={() => {
              void handleCopyLogs();
            }}
          >
            Copy all
          </Stack.Toolbar.MenuAction>
          <Stack.Toolbar.MenuAction
            icon={nativeIcons.share}
            disabled={!hasLogs}
            onPress={() => {
              void shareLogs();
            }}
          >
            Share
          </Stack.Toolbar.MenuAction>
          <Stack.Toolbar.MenuAction
            icon={nativeIcons.delete}
            destructive
            disabled={!hasLogs}
            onPress={handleClearLogs}
          >
            Clear all
          </Stack.Toolbar.MenuAction>
        </Stack.Toolbar.Menu>
      </Stack.Toolbar>
      <FlatList
        data={visibleLogs}
        keyExtractor={(entry) => entry.id}
        renderItem={({ item }) => <LogRow entry={item} />}
        ListHeaderComponent={
          hasLogs ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={$filters}
              contentContainerStyle={$filtersContent}
            >
              {LEVEL_FILTERS.map((filter) => (
                <Chip
                  key={filter.value}
                  label={filter.label}
                  selected={levelFilter === filter.value}
                  onPress={() => {
                    if (filter.value === levelFilter) {
                      return;
                    }
                    haptics.selection();
                    setLevelFilter(filter.value);
                  }}
                />
              ))}
            </ScrollView>
          ) : undefined
        }
        ListEmptyComponent={
          hasLogs ? (
            <EmptyState
              icon={logsIcon}
              title={emptyTitle}
              description="Try a different level filter."
            />
          ) : (
            <EmptyState icon={logsIcon} title="No logs yet" />
          )
        }
        contentContainerStyle={$listContent}
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
      />
    </Screen>
  );
}

function LogRow({ entry }: { entry: LogEntry }) {
  return (
    <Card style={$logEntry}>
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

const $listContent: ViewStyle = {
  paddingHorizontal: space.screen,
  paddingBottom: space.lg,
  gap: space.xs,
};

const $filters: ViewStyle = {
  marginHorizontal: -space.screen,
};

const $filtersContent: ViewStyle = {
  gap: space.xs,
  paddingHorizontal: space.screen,
  paddingBottom: space.xs,
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
