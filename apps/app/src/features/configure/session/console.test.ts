import { describe, expect, it } from "vite-plus/test";

import {
  differingUrls,
  isRefusal,
  parseConfiguration,
  serverUrlsFor,
  writeUrlCommands,
} from "./console";

const ours = serverUrlsFor("https://api.revivest.app");

describe("writeUrlCommands", () => {
  it("saves the configuration only after every address is set", () => {
    const commands = writeUrlCommands(ours);

    expect(commands.at(-1)).toBe(
      "envswitch boseurls set https://api.revivest.app https://api.revivest.app/updates/soundtouch",
    );
    expect(commands.slice(0, -1)).toEqual([
      "sys configuration bmxRegistryUrl https://api.revivest.app/v2/registry.json",
      "sys configuration statsServerUrl https://api.revivest.app",
      "sys configuration margeServerUrl https://api.revivest.app",
      "sys configuration swUpdateUrl https://api.revivest.app/updates/soundtouch",
    ]);
  });
});

describe("parseConfiguration", () => {
  it("reads firmware 27 blocks and ignores the prompt", () => {
    const reply = [
      "margeServerUrl {",
      '  text: "https://api.revivest.app"',
      "}",
      "isZeroconfEnabled {",
      "  value: true",
      "}",
      "-> ",
    ].join("\r\n");

    expect(parseConfiguration(reply)).toEqual({
      margeServerUrl: "https://api.revivest.app",
    });
  });

  it("reads flat key=value lines", () => {
    expect(
      parseConfiguration(
        "swUpdateUrl=https://x.example/updates\nnot a key = 1",
      ),
    ).toEqual({ swUpdateUrl: "https://x.example/updates" });
  });
});

describe("differingUrls", () => {
  it("ignores case and trailing slashes", () => {
    const configuration = {
      bmxRegistryUrl: "https://API.revivest.app/v2/registry.json",
      statsServerUrl: "https://api.revivest.app/",
      margeServerUrl: "https://api.revivest.app",
      swUpdateUrl: "https://api.revivest.app/updates/soundtouch",
    };

    expect(differingUrls(configuration, ours)).toEqual([]);
  });

  it("counts a missing field as different", () => {
    expect(
      differingUrls({ margeServerUrl: "https://api.revivest.app" }, ours),
    ).toEqual(["bmxRegistryUrl", "statsServerUrl", "swUpdateUrl"]);
  });

  it("can't tell when the reply names none of the fields", () => {
    expect(differingUrls({ somethingElse: "1" }, ours)).toBeUndefined();
  });
});

describe("isRefusal", () => {
  it.each([
    "sh: envswitch: command not found",
    "Unknown command",
    "Invalid Command Option",
    "Not implemented",
  ])("treats %j as a refusal", (reply) => {
    expect(isRefusal(reply)).toBe(true);
  });

  it.each(["OK\r\n-> ", "Setting Bose Server URLs to a and b ->"])(
    "accepts %j",
    (reply) => {
      expect(isRefusal(reply)).toBe(false);
    },
  );
});
