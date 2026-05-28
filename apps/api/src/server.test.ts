import { describe, expect, it } from "vite-plus/test";

import app from "./server";

describe("API server routes", () => {
  it("GET /streaming/sourceproviders returns the provider list", async () => {
    const res = await app.request("/streaming/sourceproviders");
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe(
      "application/vnd.bose.streaming-v1.2+xml",
    );
    expect(res.headers.get("ETag")).toBe("1");
    const text = await res.text();
    expect(text).toContain('standalone="yes"');
    expect(text).toContain("<sourceProviders>");
    expect(text).toContain('<sourceprovider id="10003">');
  });

  it("GET /streaming/account/:accountId/full returns the full account with sources", async () => {
    const res = await app.request("/streaming/account/test-account/full");
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe(
      "application/vnd.bose.streaming-v1.2+xml",
    );
    const text = await res.text();
    expect(text).toContain('standalone="yes"');
    expect(text).toContain('<account id="test-account">');
    expect(text).toContain("<accountStatus>OK</accountStatus>");
    expect(text).toContain("<mode>global</mode>");
    expect(text).toContain("<preferredLanguage>en</preferredLanguage>");
    expect(text).toContain("<devices/>");
    expect(text).toContain("<sourceSettings/>");
  });

  it("GET /streaming/account/:accountId/device/:deviceId/presets returns empty presets", async () => {
    const res = await app.request(
      "/streaming/account/test-account/device/dev-1/presets",
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe(
      "application/vnd.bose.streaming-v1.2+xml",
    );
    expect(res.headers.get("ETag")).toBe("1");
    const text = await res.text();
    expect(text).toContain('standalone="yes"');
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
    expect(text).toContain('standalone="yes"');
    expect(text).toContain("<softwareUpdateLocation></softwareUpdateLocation>");
  });

  it("POST /streaming/account/:accountId/device/:deviceId/recent returns a stubbed XML response", async () => {
    const res = await app.request(
      "/streaming/account/test-account/device/dev-1/recent",
      { method: "POST" },
    );
    expect(res.status).toBe(201);
    expect(res.headers.get("Content-Type")).toBe(
      "application/vnd.bose.streaming-v1.2+xml",
    );
    expect(res.headers.get("Location")).toBe(
      "http://localhost:8000/account/test-account/device/dev-1/recent/1",
    );
    const text = await res.text();
    expect(text).toContain('standalone="yes"');
    expect(text).toContain('<recent id="1">');
  });
});
