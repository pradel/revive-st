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

  it("POST /streaming/support/power_on returns a status OK XML response", async () => {
    const xmlPayload = `<?xml version="1.0" encoding="UTF-8" ?><device-data><device id="EC1127C25A50"><serialnumber>55307133203739342000010</serialnumber></device></device-data>`;
    const res = await app.request("/streaming/support/power_on", {
      method: "POST",
      headers: { "Content-Type": "application/vnd.bose.streaming-v1.2+xml" },
      body: xmlPayload,
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe(
      "application/vnd.bose.streaming-v1.2+xml",
    );
    const text = await res.text();
    expect(text).toContain('standalone="yes"');
    expect(text).toContain("<status>OK</status>");
  });

  it("POST /streaming/account/:accountId/device/ registers the device and returns status OK", async () => {
    const xmlPayload = `<?xml version="1.0" encoding="UTF-8" ?><device deviceid="EC1127C25A50"><name>Bose SoundTouch 10</name><macaddress>EC1127C25A50</macaddress></device>`;

    // Test with trailing slash
    const resWithSlash = await app.request(
      "/streaming/account/revivest-user/device/",
      {
        method: "POST",
        headers: { "Content-Type": "application/vnd.bose.streaming-v1.2+xml" },
        body: xmlPayload,
      },
    );
    expect(resWithSlash.status).toBe(200);
    expect(resWithSlash.headers.get("Content-Type")).toBe(
      "application/vnd.bose.streaming-v1.2+xml",
    );
    const textSlash = await resWithSlash.text();
    expect(textSlash).toContain('standalone="yes"');
    expect(textSlash).toContain("<status>OK</status>");

    // Test without trailing slash
    const resWithoutSlash = await app.request(
      "/streaming/account/revivest-user/device",
      {
        method: "POST",
        headers: { "Content-Type": "application/vnd.bose.streaming-v1.2+xml" },
        body: xmlPayload,
      },
    );
    expect(resWithoutSlash.status).toBe(200);
    expect(resWithoutSlash.headers.get("Content-Type")).toBe(
      "application/vnd.bose.streaming-v1.2+xml",
    );
    const textNoSlash = await resWithoutSlash.text();
    expect(textNoSlash).toContain('standalone="yes"');
    expect(textNoSlash).toContain("<status>OK</status>");
  });

  it("GET /v2/registry.json returns the BMX services registry", async () => {
    const res = await app.request("http://api.revivest.app/v2/registry.json");
    expect(res.status).toBe(200);
    interface BmxRegistryResponse {
      bmx_services: {
        id: { name: string; value: number };
        baseUrl: string;
      }[];
    }
    const json = (await res.json()) as BmxRegistryResponse;
    expect(json.bmx_services).toBeDefined();
    expect(json.bmx_services.length).toBe(1);
    expect(json.bmx_services[0].id.name).toBe("LOCAL_INTERNET_RADIO");
    expect(json.bmx_services[0].id.value).toBe(11);
    expect(json.bmx_services[0].baseUrl).toBe(
      "http://api.revivest.app/core02/svc-bmx-adapter-orion/prod/orion",
    );
  });

  it("GET /core02/svc-bmx-adapter-orion/prod/orion/station returns a valid BmxPlaybackResponse", async () => {
    const payload = {
      streamUrl: "http://stream.example.com",
      name: "Test Stream",
      imageUrl: "http://image.example.com/art.png",
    };
    const data = btoa(JSON.stringify(payload));

    const res = await app.request(
      `/core02/svc-bmx-adapter-orion/prod/orion/station?data=${data}`,
    );
    expect(res.status).toBe(200);

    interface BmxPlaybackResponse {
      name: string;
      imageUrl: string;
      streamType: string;
      audio: {
        streamUrl: string;
        streams: { streamUrl: string }[];
      };
    }
    const json = (await res.json()) as BmxPlaybackResponse;
    expect(json.name).toBe("Test Stream");
    expect(json.imageUrl).toBe("http://image.example.com/art.png");
    expect(json.streamType).toBe("liveRadio");
    expect(json.audio).toBeDefined();
    expect(json.audio.streamUrl).toBe("http://stream.example.com");
    expect(json.audio.streams[0].streamUrl).toBe("http://stream.example.com");
  });

  it("GET /core02/svc-bmx-adapter-orion/prod/orion/station returns 400 for missing data", async () => {
    const res = await app.request(
      `/core02/svc-bmx-adapter-orion/prod/orion/station`,
    );
    expect(res.status).toBe(400);
    expect(await res.text()).toBe("Missing data parameter");
  });

  it("GET /core02/svc-bmx-adapter-orion/prod/orion/station returns 400 for invalid data", async () => {
    const res = await app.request(
      `/core02/svc-bmx-adapter-orion/prod/orion/station?data=invalid-base64`,
    );
    expect(res.status).toBe(400);
    expect(await res.text()).toBe("Invalid data parameter");
  });
});
