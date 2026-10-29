import { Err, Ok, type Result } from "better-result";

/** The Revive ST server run for everyone. */
export const DEFAULT_SERVER_URL = "https://api.revivest.app";

const INVALID = "Enter an address like https://revive.example.com";
const NOT_ORIGIN = "Enter only the server's address, without a path";
const CREDENTIALS = "Remove the user name and password from the address";
const PORT = "The port must be a number from 1 to 65535";
const LOOPBACK =
  "Speakers can't reach localhost; use the server's address on your network";

const DEFAULT_PORTS: Record<string, string> = { http: "80", https: "443" };

const HOSTNAME =
  /^(?=.{1,253}$)[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*$/;

/** A dotted-quad IPv4 address's octets; no leading zeros (read as octal). */
function ipv4Octets(host: string): number[] | undefined {
  const parts = host.split(".");
  if (
    parts.length !== 4 ||
    !parts.every((part) => /^(?:0|[1-9][0-9]{0,2})$/.test(part))
  ) {
    return undefined;
  }
  const octets = parts.map(Number);
  return octets.every((octet) => octet <= 255) ? octets : undefined;
}

/** An IPv6 address's eight groups; no zone id or embedded IPv4. */
function ipv6Groups(address: string): number[] | undefined {
  if (!/^[0-9a-f:]+$/.test(address)) {
    return undefined;
  }
  const halves = address.split("::");
  if (halves.length > 2) {
    return undefined;
  }
  const [head = [], tail = []] = halves.map((half) =>
    half === "" ? [] : half.split(":"),
  );
  const groups = [...head, ...tail];
  if (!groups.every((group) => /^[0-9a-f]{1,4}$/.test(group))) {
    return undefined;
  }
  const missing = 8 - groups.length;
  if (halves.length === 1 ? missing !== 0 : missing < 1) {
    return undefined;
  }
  return [
    ...head.map((group) => Number.parseInt(group, 16)),
    ...Array.from({ length: halves.length === 1 ? 0 : missing }, () => 0),
    ...tail.map((group) => Number.parseInt(group, 16)),
  ];
}

/**
 * Parses the address of a Revive ST server into its origin,
 * `scheme://host[:port]`: lowercase, no trailing slash, no default port.
 * Only `http`/`https`, a hostname, an IPv4 or a bracketed IPv6 address and a
 * port are accepted. The origin ends up in telnet commands on the speaker,
 * so anything else (paths, credentials, whitespace, shell characters) is
 * refused, and so is loopback, which the speakers can't reach. Returns the
 * problem otherwise.
 */
export function parseServerUrl(input: string): Result<string, string> {
  const schemeMatch = /^(https?):\/\//i.exec(input);
  if (!schemeMatch) {
    return new Err("Start the address with http:// or https://");
  }
  const scheme = schemeMatch[1].toLowerCase();
  const rest = input.slice(schemeMatch[0].length);
  const authorityEnd = rest.search(/[/?#]/);
  const authority = authorityEnd === -1 ? rest : rest.slice(0, authorityEnd);
  const tail = authorityEnd === -1 ? "" : rest.slice(authorityEnd);
  if (tail !== "" && tail !== "/") {
    return new Err(NOT_ORIGIN);
  }
  if (authority.includes("@")) {
    return new Err(CREDENTIALS);
  }

  const hostPort = /^(\[[^\]]*\]|[^:]*)(?::(.*))?$/.exec(authority);
  if (!hostPort) {
    return new Err(INVALID);
  }
  const host = hostPort[1].toLowerCase();
  const port = hostPort[2];

  if (host.startsWith("[")) {
    const groups = ipv6Groups(host.slice(1, -1));
    if (!groups) {
      return new Err(INVALID);
    }
    const zeroPrefix = (length: number) =>
      groups.slice(0, length).every((group) => group === 0);
    // `::1`, or `::ffff:127.x.y.z`
    if (
      (zeroPrefix(7) && groups[7] === 1) ||
      (zeroPrefix(5) &&
        groups[5] === 0xff_ff &&
        groups[6] >= 0x7f_00 &&
        groups[6] <= 0x7f_ff)
    ) {
      return new Err(LOOPBACK);
    }
  } else {
    if (!HOSTNAME.test(host)) {
      return new Err(INVALID);
    }
    // A numeric last label makes it an IP address (`2130706433`, `1.2.3`
    // and `0x7f.1` are 127.0.0.1 to some parsers): only dotted quads.
    if (/(?:^|\.)[0-9]+$/.test(host)) {
      const octets = ipv4Octets(host);
      if (!octets) {
        return new Err(INVALID);
      }
      if (octets[0] === 127) {
        return new Err(LOOPBACK);
      }
    } else if (host === "localhost" || host.endsWith(".localhost")) {
      return new Err(LOOPBACK);
    }
  }

  if (port !== undefined) {
    if (!/^[1-9][0-9]{0,4}$/.test(port) || Number(port) > 65_535) {
      return new Err(PORT);
    }
  }
  const portSuffix =
    port === undefined || port === DEFAULT_PORTS[scheme] ? "" : `:${port}`;
  return new Ok(`${scheme}://${host}${portSuffix}`);
}

/**
 * Whether `url` is already a server origin `parseServerUrl` accepts as is.
 * Checked again right before it goes into a telnet command.
 */
export function isSafeServerUrl(url: string): boolean {
  const result = parseServerUrl(url);
  return result.isOk() && result.value === url;
}

/** The host (and port) of a server origin, for display. */
export const serverHost = (url: string) => url.replace(/^https?:\/\//, "");
