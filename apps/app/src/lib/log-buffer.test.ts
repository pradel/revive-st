import { describe, expect, it } from "vite-plus/test";

import { type LogEntry, MAX_LOGS, restoredLog } from "./log-buffer";

const entry = (id: string): LogEntry => ({
  id,
  timestamp: "2026-01-01T00:00:00.000Z",
  level: "warn",
  message: id,
});

describe("restoredLog", () => {
  it("puts the lines written while loading after the stored history", () => {
    const stored = JSON.stringify([entry("old-1"), entry("old-2")]);

    expect(restoredLog(stored, [entry("startup")])).toEqual([
      entry("old-1"),
      entry("old-2"),
      entry("startup"),
    ]);
  });

  it("keeps the lines written while loading when the stored history is unreadable", () => {
    expect(restoredLog("{not json", [entry("startup")])).toEqual([
      entry("startup"),
    ]);
    expect(restoredLog("{}", [entry("startup")])).toEqual([entry("startup")]);
  });

  it("keeps the newest MAX_LOGS", () => {
    const history = Array.from({ length: MAX_LOGS }, (_slot, index) =>
      entry(`old-${index}`),
    );
    const pending = [entry("new-1"), entry("new-2"), entry("new-3")];

    const log = restoredLog(JSON.stringify(history), pending);

    expect(log).toHaveLength(MAX_LOGS);
    expect(log.slice(-3)).toEqual(pending);
    expect(log).not.toContainEqual(entry("old-0"));
  });

  it("starts from the lines written while loading when nothing is stored", () => {
    expect(restoredLog(null, [entry("startup")])).toEqual([entry("startup")]);
  });
});
