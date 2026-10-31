/**
 * Commands for the speaker's TAP console (port 17000) and how to read their
 * replies. Behaviour from repos/Bose-SoundTouch
 * (docs/content/docs/analysis/TELNET-COMMAND-REFERENCE.md) and
 * docs/speaker-setup.md.
 */

/** The four server addresses the speaker keeps in its system configuration. */
export interface ServerUrls {
  bmxRegistryUrl: string;
  statsServerUrl: string;
  margeServerUrl: string;
  swUpdateUrl: string;
}

export const SERVER_URL_FIELDS = [
  "bmxRegistryUrl",
  "statsServerUrl",
  "margeServerUrl",
  "swUpdateUrl",
] as const satisfies readonly (keyof ServerUrls)[];

/** The addresses that point a speaker at the Revive ST server at `origin`. */
export function serverUrlsFor(origin: string): ServerUrls {
  return {
    bmxRegistryUrl: `${origin}/v2/registry.json`,
    statsServerUrl: origin,
    margeServerUrl: origin,
    swUpdateUrl: `${origin}/updates/soundtouch`,
  };
}

/**
 * The commands that write `urls`. `envswitch boseurls set` saves the whole
 * running configuration, so it must come after every `sys configuration`
 * write: a value set after it is lost at the next restart.
 */
export function writeUrlCommands(urls: ServerUrls): string[] {
  return [
    ...SERVER_URL_FIELDS.map(
      (field) => `sys configuration ${field} ${urls[field]}`,
    ),
    `envswitch boseurls set ${urls.margeServerUrl} ${urls.swUpdateUrl}`,
  ];
}

export const READ_CONFIGURATION = "getpdo CurrentSystemConfiguration";
export const REBOOT = "sys reboot";
export const pairCommand = (accountId: string) =>
  `envswitch accountid set ${accountId}`;

const REFUSALS = [
  "command not found",
  "unknown command",
  "not implemented",
  "invalid command",
];

/**
 * Whether the console refused the command. Accepted commands answer `OK`
 * (`sys configuration`) or echo what they set (`envswitch`); the effect is
 * checked by reading the configuration back, not from these replies.
 */
export function isRefusal(reply: string): boolean {
  const lower = reply.toLowerCase();
  return REFUSALS.some((refusal) => lower.includes(refusal));
}

const IDENTIFIER = /^[A-Za-z0-9_]+$/;

/**
 * Fields of a `getpdo CurrentSystemConfiguration` reply. Firmware 27 answers
 * in blocks (`margeServerUrl {` / `text: "https://…"` / `}`); flat
 * `key=value` lines are accepted too.
 */
export function parseConfiguration(reply: string): Record<string, string> {
  const fields: Record<string, string> = {};
  let current: string | undefined;
  for (const line of reply.split(/\r?\n/).map((raw) => raw.trim())) {
    const equals = line.indexOf("=");
    if (line.endsWith("{")) {
      const head = line.slice(0, -1).trim();
      current = IDENTIFIER.test(head) ? head : undefined;
    } else if (line === "}") {
      current = undefined;
    } else if (current !== undefined && line.startsWith("text:")) {
      fields[current] = line.slice("text:".length).trim().replace(/^"|"$/g, "");
    } else if (equals > 0) {
      const key = line.slice(0, equals).trim();
      if (IDENTIFIER.test(key)) {
        fields[key] = line.slice(equals + 1).trim();
      }
    }
  }
  return fields;
}

const normaliseUrl = (url: string) =>
  url.trim().replace(/\/+$/, "").toLowerCase();

/**
 * The fields of `expected` the configuration read back from the speaker
 * holds another value for. A field missing from `configuration` counts as
 * different. `undefined` when the reply names none of them: a firmware that
 * reports its configuration another way can't be checked.
 */
export function differingUrls(
  configuration: Record<string, string>,
  expected: ServerUrls,
): (keyof ServerUrls)[] | undefined {
  if (!SERVER_URL_FIELDS.some((field) => field in configuration)) {
    return undefined;
  }
  return SERVER_URL_FIELDS.filter((field) => {
    const actual = configuration[field];
    return (
      actual === undefined ||
      normaliseUrl(actual) !== normaliseUrl(expected[field])
    );
  });
}
