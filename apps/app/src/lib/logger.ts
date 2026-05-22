import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "app_logs";
const MAX_LOGS = 200;
const PERSIST_DEBOUNCE_MS = 1000;

export type LogLevel = "log" | "warn" | "error" | "debug" | "info";

export interface LogEntry {
  id: string;
  timestamp: string;
  level: LogLevel;
  message: string;
}

let buffer: LogEntry[] = [];
let cachedSnapshot: LogEntry[] = [];
let persistTimer: ReturnType<typeof setTimeout> | null = null;
const subscribers = new Set<(logs: LogEntry[]) => void>();

const originalConsole = {
  log: console.log,
  warn: console.warn,
  error: console.error,
  debug: console.debug,
  info: console.info,
};

function generateId(): string {
  return Math.random().toString(36).slice(2, 10);
}

function safeStringify(args: unknown[]): string {
  return args
    .map((arg) => {
      try {
        if (arg instanceof Error) {
          return `${arg.message}\n${arg.stack ?? ""}`;
        }
        if (typeof arg === "string") return arg;
        return JSON.stringify(arg);
      } catch {
        return String(arg);
      }
    })
    .join(" ");
}

function addToBuffer(level: LogLevel, message: string): void {
  const entry: LogEntry = {
    id: generateId(),
    timestamp: new Date().toISOString(),
    level,
    message,
  };
  buffer.push(entry);
  if (buffer.length > MAX_LOGS) {
    buffer = buffer.slice(-MAX_LOGS);
  }
  cachedSnapshot = [...buffer];
  schedulePersist();
  notifySubscribers();
}

function schedulePersist(): void {
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(persist, PERSIST_DEBOUNCE_MS);
}

async function persist(): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(buffer));
  } catch {
    // persistence is best-effort — never break the app
  }
}

function notifySubscribers(): void {
  for (const cb of subscribers) {
    cb(cachedSnapshot);
  }
}

function interceptConsole(): void {
  const levels: LogLevel[] = ["log", "warn", "error", "debug", "info"];
  for (const level of levels) {
    const original = originalConsole[level];
    console[level] = (...args: unknown[]) => {
      original(...args);
      addToBuffer(level, safeStringify(args));
    };
  }
}

export async function initLogger(): Promise<void> {
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as unknown;
      if (Array.isArray(parsed)) {
        buffer = (parsed as LogEntry[]).slice(-MAX_LOGS);
      }
    }
  } catch {
    buffer = [];
  }
  cachedSnapshot = [...buffer];
  notifySubscribers();
  interceptConsole();
}

export function getLogs(): LogEntry[] {
  return cachedSnapshot;
}

export async function clearLogs(): Promise<void> {
  buffer = [];
  cachedSnapshot = [];
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
  } catch {
    // best-effort
  }
  notifySubscribers();
}

export function subscribe(cb: (logs: LogEntry[]) => void): () => void {
  subscribers.add(cb);
  return () => {
    subscribers.delete(cb);
  };
}

export const logger = {
  log: (...args: unknown[]) => {
    originalConsole.log(...args);
    addToBuffer("log", safeStringify(args));
  },
  warn: (...args: unknown[]) => {
    originalConsole.warn(...args);
    addToBuffer("warn", safeStringify(args));
  },
  error: (...args: unknown[]) => {
    originalConsole.error(...args);
    addToBuffer("error", safeStringify(args));
  },
  debug: (...args: unknown[]) => {
    originalConsole.debug(...args);
    addToBuffer("debug", safeStringify(args));
  },
  info: (...args: unknown[]) => {
    originalConsole.info(...args);
    addToBuffer("info", safeStringify(args));
  },
};
