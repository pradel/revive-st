import { logger } from "@/lib/logger";

import type { Clock, Log } from "../session/ports";

export const realClock: Clock = {
  now: () => Date.now(),
  async sleep(ms, signal) {
    signal.throwIfAborted();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let onAbort: (() => void) | undefined;
    // Settles on the timer or on abort; an abort then rethrows its reason below.
    await new Promise<void>((resolve) => {
      timer = setTimeout(resolve, ms);
      onAbort = resolve;
      signal.addEventListener("abort", onAbort, { once: true });
    });
    clearTimeout(timer);
    if (onAbort) {
      signal.removeEventListener("abort", onAbort);
    }
    signal.throwIfAborted();
  },
};

export const appLog: Log = {
  event(name, data) {
    if (data === undefined) {
      logger.log(`[Setup] ${name}`);
    } else {
      logger.log(`[Setup] ${name}`, data);
    }
  },
};
