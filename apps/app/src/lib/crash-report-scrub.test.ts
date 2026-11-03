import { describe, expect, it } from "vite-plus/test";

import { scrubCrashReport } from "./crash-report-scrub";

const ACCOUNT = "6f1c2a3b-4d5e-4f60-8a1b-2c3d4e5f6a7b";
// The id PostHog matches a stack frame to its uploaded source map by.
const CHUNK_ID = "0b9e1f6a-3c2d-4e5f-8a7b-6c5d4e3f2a1b";

const exception = (
  value: string,
  properties: Record<string, unknown> = {},
) => ({
  event: "$exception",
  properties: {
    $exception_list: [
      {
        type: "Error",
        value,
        stacktrace: {
          frames: [{ filename: "main.jsbundle", chunk_id: CHUNK_ID }],
        },
      },
    ],
    ...properties,
  },
});

describe("scrubCrashReport", () => {
  it("removes household account ids, device ids and addresses from errors", () => {
    const scrubbed = scrubCrashReport(
      exception(
        `GET http://192.168.1.31:8090/info failed for A81B6A6D8C2F (a8:1b:6a:6d:8c:2f), account ${ACCOUNT}`,
      ),
    );
    expect(scrubbed?.properties.$exception_list[0]?.value).toBe(
      "GET http://<ip>:8090/info failed for <device> (<device>), account <account>",
    );
  });

  it("keeps stack frames' source map ids and the SDK's own ids", () => {
    const scrubbed = scrubCrashReport(
      exception("boom", { $session_id: ACCOUNT, $app_version: "0.0.4" }),
    );
    expect(scrubbed?.properties).toMatchObject({
      $exception_list: [{ stacktrace: { frames: [{ chunk_id: CHUNK_ID }] } }],
      $session_id: ACCOUNT,
      $app_version: "0.0.4",
    });
  });

  it("drops anything but errors", () => {
    expect(
      scrubCrashReport({ event: "Application Opened", properties: {} }),
    ).toBeNull();
    expect(scrubCrashReport({ event: "$screen" })).toBeNull();
  });
});
