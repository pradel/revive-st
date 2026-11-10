export const MAX_LOGS = 200;

export type LogLevel = "log" | "warn" | "error" | "debug" | "info";

export interface LogEntry {
  id: string;
  timestamp: string;
  level: LogLevel;
  message: string;
}

/**
 * The log after launch: the stored history (as read from storage, possibly
 * unreadable) followed by the lines written while it loaded, newest
 * `MAX_LOGS` kept.
 */
export function restoredLog(
  stored: string | null,
  pending: readonly LogEntry[],
): LogEntry[] {
  let history: LogEntry[] = [];
  if (stored !== null) {
    try {
      const parsed = JSON.parse(stored) as unknown;
      if (Array.isArray(parsed)) {
        history = parsed as LogEntry[];
      }
    } catch {
      // An unreadable history counts as none.
    }
  }
  return [...history, ...pending].slice(-MAX_LOGS);
}
