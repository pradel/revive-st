import * as Clipboard from "expo-clipboard";
import { useCallback, useSyncExternalStore } from "react";
import { Share } from "react-native";

import { clearLogs, getLogs, subscribe, type LogEntry } from "./logger";

function formatLogs(logs: LogEntry[]): string {
  return logs
    .map(
      (entry) =>
        `[${entry.timestamp}] [${entry.level.toUpperCase()}] ${entry.message}`,
    )
    .join("\n");
}

export function useLogger(): {
  logs: LogEntry[];
  clearLogs: () => Promise<void>;
  copyLogs: () => Promise<void>;
  shareLogs: () => Promise<void>;
} {
  const logs = useSyncExternalStore(subscribe, getLogs, getLogs);

  const handleClearLogs = useCallback(async () => {
    await clearLogs();
  }, []);

  const handleCopyLogs = useCallback(async () => {
    await Clipboard.setStringAsync(formatLogs(logs));
  }, [logs]);

  const handleShareLogs = useCallback(async () => {
    await Share.share({ message: formatLogs(logs) });
  }, [logs]);

  return {
    logs,
    clearLogs: handleClearLogs,
    copyLogs: handleCopyLogs,
    shareLogs: handleShareLogs,
  };
}
