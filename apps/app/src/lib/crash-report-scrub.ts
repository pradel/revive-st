/**
 * What an error message never carries in a crash report: household account
 * ids, which grant access to a household's presets, then speakers' device ids
 * and addresses.
 */
const REDACTIONS: readonly [RegExp, string][] = [
  [
    /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi,
    "<account>",
  ],
  // Device ids are MAC addresses, bare (`A81B6A6D8C2F`) or with colons.
  [/\b(?:[0-9a-f]{2}:){5}[0-9a-f]{2}\b/gi, "<device>"],
  [/\b[0-9a-f]{12}\b/gi, "<device>"],
  [/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, "<ip>"],
];

/**
 * PostHog's `before_send`: only errors are sent, with the messages in their
 * `$exception_list` redacted. The rest of each error stays as is: its stack
 * frames' `chunk_id` is the UUID PostHog finds the source map by. Any other
 * event the SDK makes is dropped.
 */
export function scrubCrashReport<
  Event extends { event: string; properties?: Record<string, unknown> },
>(event: Event): Event | null {
  if (event.event !== "$exception") {
    return null;
  }
  const exceptions = event.properties?.$exception_list;
  if (!Array.isArray(exceptions)) {
    return event;
  }
  return {
    ...event,
    properties: {
      ...event.properties,
      $exception_list: exceptions.map((exception: unknown) => {
        if (
          exception === null ||
          typeof exception !== "object" ||
          !("value" in exception) ||
          typeof exception.value !== "string"
        ) {
          return exception;
        }
        let message = exception.value;
        for (const [pattern, replacement] of REDACTIONS) {
          message = message.replace(pattern, replacement);
        }
        return { ...exception, value: message };
      }),
    },
  };
}
