import { useRouter } from "expo-router";
import {
  Alert,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
  type TextStyle,
  type ViewStyle,
} from "react-native";

import { useLogger } from "@/lib/useLogger";

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
          clearLogs();
        },
      },
    ]);
  };

  return (
    <View style={$container}>
      <View style={$header}>
        <Text style={$headerTitle}>Logs</Text>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
          <Text style={$headerDone}>Done</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={$scrollView}
        contentContainerStyle={$scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {logs.length === 0 ? (
          <Text style={$emptyText}>No logs yet</Text>
        ) : (
          logs.map((entry) => (
            <View key={entry.id} style={$logEntry}>
              <View style={$logMeta}>
                <Text style={$logTimestamp}>
                  {new Date(entry.timestamp).toLocaleTimeString()}
                </Text>
                <View style={[$levelBadge, getLevelStyle(entry.level)]}>
                  <Text style={$levelText}>{entry.level.toUpperCase()}</Text>
                </View>
              </View>
              <Text style={$logMessage} selectable>
                {entry.message}
              </Text>
            </View>
          ))
        )}
      </ScrollView>

      <View style={$bottomBar}>
        <TouchableOpacity
          style={$bottomButton}
          onPress={copyLogs}
          activeOpacity={0.7}
        >
          <Text style={$bottomButtonText}>Copy All</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={$clearButton}
          onPress={handleClearLogs}
          activeOpacity={0.7}
        >
          <Text style={$clearButtonText}>Clear</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function getLevelStyle(level: string): ViewStyle {
  switch (level) {
    case "error":
      return $levelError;
    case "warn":
      return $levelWarn;
    default:
      return $levelInfo;
  }
}

const $container: ViewStyle = {
  flex: 1,
  backgroundColor: "#09090b",
};

const $header: ViewStyle = {
  flexDirection: "row",
  justifyContent: "space-between",
  alignItems: "center",
  paddingHorizontal: 20,
  paddingTop: 60,
  paddingBottom: 16,
};

const $headerTitle: TextStyle = {
  fontSize: 28,
  fontWeight: "800",
  color: "#fafafa",
  letterSpacing: -0.5,
};

const $headerDone: TextStyle = {
  fontSize: 15,
  color: "#a1a1aa",
  fontWeight: "600",
};

const $scrollView: ViewStyle = {
  flex: 1,
};

const $scrollContent: ViewStyle = {
  paddingHorizontal: 20,
  paddingBottom: 20,
};

const $emptyText: TextStyle = {
  fontSize: 14,
  color: "#71717a",
  textAlign: "center",
  marginTop: 40,
};

const $logEntry: ViewStyle = {
  backgroundColor: "#18181b",
  borderRadius: 12,
  padding: 12,
  borderWidth: 1,
  borderColor: "#27272a",
  marginBottom: 8,
};

const $logMeta: ViewStyle = {
  flexDirection: "row",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: 6,
};

const $logTimestamp: TextStyle = {
  fontSize: 11,
  color: "#52525b",
  fontWeight: "500",
};

const $levelBadge: ViewStyle = {
  paddingHorizontal: 6,
  paddingVertical: 2,
  borderRadius: 4,
};

const $levelText: TextStyle = {
  fontSize: 10,
  fontWeight: "700",
  color: "#fafafa",
};

const $levelError: ViewStyle = {
  backgroundColor: "#7f1d1d",
};

const $levelWarn: ViewStyle = {
  backgroundColor: "#78350f",
};

const $levelInfo: ViewStyle = {
  backgroundColor: "#1e3a5f",
};

const $logMessage: TextStyle = {
  fontSize: 13,
  color: "#a1a1aa",
  fontFamily: "monospace",
};

const $bottomBar: ViewStyle = {
  flexDirection: "row",
  gap: 10,
  paddingHorizontal: 20,
  paddingVertical: 12,
  borderTopWidth: 1,
  borderTopColor: "#27272a",
  backgroundColor: "#09090b",
};

const $bottomButton: ViewStyle = {
  flex: 1,
  alignItems: "center",
  justifyContent: "center",
  height: 44,
  borderRadius: 12,
  backgroundColor: "#fafafa",
};

const $bottomButtonText: TextStyle = {
  fontSize: 15,
  fontWeight: "600",
  color: "#09090b",
};

const $clearButton: ViewStyle = {
  paddingHorizontal: 20,
  alignItems: "center",
  justifyContent: "center",
  height: 44,
  borderRadius: 12,
  backgroundColor: "#450a0a",
};

const $clearButtonText: TextStyle = {
  fontSize: 15,
  fontWeight: "600",
  color: "#fca5a5",
};
