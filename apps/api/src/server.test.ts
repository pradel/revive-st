import { describe, expect, it } from "vite-plus/test";

import app from "./server";

describe("API server routes", () => {
  it("GET /streaming/sourceproviders returns the provider list", async () => {
    const res = await app.request("/streaming/sourceproviders");
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe(
      "application/vnd.bose.streaming-v1.2+xml",
    );
    const text = await res.text();
    expect(text).toContain("<sourceProviders>");
    expect(text).toContain("LOCAL_INTERNET_RADIO");
  });

  it("GET /streaming/account/:accountId/full returns the full account with sources", async () => {
    const res = await app.request("/streaming/account/test-account/full");
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe(
      "application/vnd.bose.streaming-v1.2+xml",
    );
    const text = await res.text();
    expect(text).toContain("<accountFull>");
    expect(text).toContain('<account id="test-account">');
    expect(text).toContain("<devices/>");
    expect(text).toContain("<presets/>");
    expect(text).toContain("<recents/>");
    expect(text).toContain("<sourceSettings/>");
  });

  it("POST /streaming/support/power_on returns a silent 200", async () => {
    const res = await app.request("/streaming/support/power_on", {
      method: "POST",
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe(
      "application/vnd.bose.streaming-v1.2+xml",
    );
    const text = await res.text();
    expect(text).toBe("");
  });

  it("GET /streaming/account/:accountId/device/:deviceId/presets returns empty presets", async () => {
    const res = await app.request(
      "/streaming/account/test-account/device/dev-1/presets",
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe(
      "application/vnd.bose.streaming-v1.2+xml",
    );
    const text = await res.text();
    expect(text).toContain("<presets/>");
  });

  it("GET /streaming/software/update/account/:accountId returns empty software update", async () => {
    const res = await app.request(
      "/streaming/software/update/account/test-account",
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe(
      "application/vnd.bose.streaming-v1.2+xml",
    );
    const text = await res.text();
    expect(text).toContain("<software_update/>");
  });

  it("POST /streaming/account/:accountId/device/:deviceId/recent returns a silent 201", async () => {
    const res = await app.request(
      "/streaming/account/test-account/device/dev-1/recent",
      { method: "POST" },
    );
    expect(res.status).toBe(201);
    const text = await res.text();
    expect(text).toBe("");
  });

  describe("POST /api/stream-url", () => {
    it("fails if url or accountId is missing", async () => {
      const res = await app.request("/api/stream-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: "http://example.com" }),
      });
      const data = await (res.json() as Promise<{
        success: boolean;
        error?: string;
      }>);
      expect(data.success).toBe(false);
      expect(data.error).toBe(
        'Please provide "url" and "accountId" in the JSON body.',
      );
    });

    it("succeeds if url and accountId are provided", async () => {
      const res = await app.request("/api/stream-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountId: "test-account",
          url: "http://example.com/stream.mp3",
        }),
      });
      const data = await (res.json() as Promise<{
        success: boolean;
        accountId?: string;
        url?: string;
      }>);
      expect(data.success).toBe(true);
      expect(data.accountId).toBe("test-account");
      expect(data.url).toBe("http://example.com/stream.mp3");
    });
  });
});
