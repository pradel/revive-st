import { afterEach, describe, expect, it, vi } from "vite-plus/test";

import { identifyServer } from "./server-profiles";

const OUR_SERVER = "http://192.168.1.20:3000";
const HOST = "192.168.1.30";
const BOSE = "https://streaming.bose.com";

/** Answers each fetched URL with its JSON body; everything else refuses the connection. */
function network(answers: Record<string, unknown>) {
  const fetched: string[] = [];
  vi.stubGlobal("fetch", async (url: string) => {
    fetched.push(url);
    return url in answers
      ? Promise.resolve(Response.json(answers[url]))
      : Promise.reject(new TypeError("Network request failed"));
  });
  return fetched;
}

const identify = async (margeURL: string) =>
  identifyServer({ host: HOST, margeURL, ourServer: OUR_SERVER });

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("identifyServer", () => {
  it.each([
    ["our server", OUR_SERVER],
    ["the Revive ST server run for everyone", "https://api.revivest.app"],
  ])("knows %s without asking the network", async (_label, margeURL) => {
    const fetched = network({});
    expect((await identify(margeURL)).kind).toBe("revive");
    expect(fetched).toEqual([]);
  });

  it("sets a speaker on our server up again without a warning", async () => {
    network({});
    expect((await identify(OUR_SERVER)).setup).toBe("setUp");
  });

  it("finds another Revive ST server by the name it answers at /, and warns before leaving it", async () => {
    network({
      "http://192.168.1.50:3000/": {
        name: "Revive ST API",
        version: "0.3.0",
        docs: "/docs",
        openapi: "/openapi.json",
      },
    });
    expect(await identify("http://192.168.1.50:3000")).toEqual({
      kind: "revive",
      name: "Revive ST",
      setup: "warn",
    });
  });

  it("knows soundcork by its /marge path, as one to warn about", async () => {
    const fetched = network({});
    expect(await identify("http://192.168.1.10:8000/marge/")).toEqual({
      kind: "soundcork",
      name: "soundcork",
      setup: "warn",
    });
    expect(fetched).toEqual([]);
  });

  it.each([8888, 17_008])(
    "finds STR behind Bose's address by its agent on port %i, and blocks setup",
    async (port) => {
      network({
        [`http://${HOST}:${port}/api/agent/version`]: { version: "v1.0.20" },
      });
      expect(await identify(BOSE)).toEqual({
        kind: "streborn",
        name: "STR",
        setup: "blocked",
      });
    },
  );

  it("reads a stock speaker as Bose's when no STR agent answers", async () => {
    // The Bose service some models run on 17008 answers, but not as STR.
    network({ [`http://${HOST}:17008/api/agent/version`]: { status: "ok" } });
    expect(await identify(BOSE)).toEqual({
      kind: "bose",
      name: "Bose",
      setup: "setUp",
    });
  });

  it("finds AfterTouch by its health report", async () => {
    network({
      "http://192.168.1.10:8000/health": {
        status: "up",
        timestamp: "2026-11-01T10:00:00Z",
        version: "1.4.0",
      },
    });
    expect((await identify("http://192.168.1.10:8000")).kind).toBe(
      "aftertouch",
    );
  });

  it("names a server no profile knows by its address", async () => {
    network({
      "https://radio.example:8443/": { name: "Radio Example" },
      "https://radio.example:8443/health": { ok: true },
    });
    expect(await identify("https://radio.example:8443")).toEqual({
      kind: "unknown",
      name: "radio.example:8443",
      setup: "warn",
    });
  });

  it("doesn't take a host that merely starts with ours for ours", async () => {
    network({});
    expect((await identify("https://api.revivest.app.example.com")).kind).toBe(
      "unknown",
    );
  });

  it("reads an unparsable address as an unknown server", async () => {
    network({});
    expect((await identify("")).kind).toBe("unknown");
  });
});
