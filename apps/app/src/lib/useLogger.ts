import * as Clipboard from "expo-clipboard";
import { useCallback, useSyncExternalStore } from "react";

import { clearLogs, getLogs, subscribe, type LogEntry } from "./logger";

export function useLogger(): {
  logs: LogEntry[];
  clearLogs: () => Promise<void>;
  copyLogs: () => Promise<void>;
} {
  const logs = useSyncExternalStore(subscribe, getLogs, getLogs);

  const handleClearLogs = useCallback(async () => {
    await clearLogs();
  }, []);

  const handleCopyLogs = useCallback(async () => {
    const text = logs
      .map((e) => `[${e.timestamp}] [${e.level.toUpperCase()}] ${e.message}`)
      .join("\n");
    await Clipboard.setStringAsync(text);
  }, [logs]);

  return { logs, clearLogs: handleClearLogs, copyLogs: handleCopyLogs };
}
