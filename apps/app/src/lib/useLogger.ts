import { useCallback, useSyncExternalStore } from "react";
import { Share } from "react-native";

import { copyText } from "./clipboard";
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
  /** Resolves `true` when the caller should confirm the copy (see `copyText`). */
  copyLogs: () => Promise<boolean>;
  shareLogs: () => Promise<void>;
} {
  const logs = useSyncExternalStore(subscribe, getLogs, getLogs);

  const handleClearLogs = useCallback(async () => {
    await clearLogs();
  }, []);

  const handleCopyLogs = useCallback(
    async () => copyText(formatLogs(logs), `Copied ${logs.length} log entries`),
    [logs],
  );

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
