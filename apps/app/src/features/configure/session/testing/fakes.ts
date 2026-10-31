import { Result } from "better-result";
import type { Preset } from "bose-api-speaker-client";

import { AbortedError } from "../../../onboarding/session/async";
import type { DiscoveredService } from "../../../onboarding/session/ports";
import {
  MemoryLog,
  type SchedulingClock,
} from "../../../onboarding/session/testing/fakes";
import type { SpeakerAccount } from "../../../speakers/lib/account-id";
import { SERVER_URL_FIELDS, type ServerUrls } from "../console";
import {
  type ConfigureDeps,
  type ConsoleConnection,
  type ConsoleFailure,
  type ConsolePort,
  type LastContact,
  PortFailure,
  type ServerPort,
  type SpeakerInfo,
  type SpeakerPort,
} from "../ports";

export const BOSE_URLS: ServerUrls = {
  bmxRegistryUrl: "https://content.api.bose.io/bmx/registry/v1/services",
  statsServerUrl: "https://events.api.bosecm.com",
  margeServerUrl: "https://streaming.bose.com",
  swUpdateUrl: "https://worldwide.bose.com/updates/soundtouch",
};

export interface FakeSpeakerConfig {
  deviceID: string;
  name: string;
  host: string;
  /** Addresses it starts with. Default `BOSE_URLS`. */
  urls?: ServerUrls;
  /** Default "" (unpaired). */
  margeAccountUUID?: string;
  presets?: Preset[];
  /** Nothing listens on port 17000. */
  consoleClosed?: boolean;
  /** Commands starting with this are answered "Command not found". */
  refuses?: string;
  /** `sys configuration` answers OK but changes nothing. */
  ignoresSysConfiguration?: boolean;
  /** `envswitch boseurls set` answers but saves nothing: the restart restores the old addresses. */
  forgetsAtRestart?: boolean;
  /** `POST /setMargeAccount` fails (firmware without it); the console pairing still works. */
  noHttpPairing?: boolean;
  /** Keeps answering this long after `sys reboot`. Default 1 s. */
  shutdownDelayMs?: number;
  /** Down this long while restarting. Default 40 s. */
  restartMs?: number;
  /** Comes back on this address. */
  hostAfterRestart?: string;
  /** Calls the server while starting when it uses it. Default true. */
  contactsServer?: boolean;
  /** Announces itself over mDNS while up. Default true. */
  announces?: boolean;
}

export interface FakeServerConfig {
  origin: string;
  /** The server predates the contact endpoint. */
  noContactEndpoint?: boolean;
  /** Refuses to store presets. */
  rejectsPresets?: boolean;
}

export interface FakeWorldConfig {
  speaker: FakeSpeakerConfig;
  server: FakeServerConfig;
  /** The household's other speakers. */
  otherSpeakers?: SpeakerAccount[];
  /** Account the server mints for a new household. */
  mintedAccountId?: string;
}

/** What happened, in order, with the world's time. */
export interface WorldEvent {
  at: number;
  kind:
    | "presetsSaved"
    | "command"
    | "restartCommand"
    | "down"
    | "up"
    | "contact"
    | "accountMinted";
  detail?: string;
}

const block = (field: string, value: string) =>
  `${field} {\r\n  text: "${value}"\r\n}\r\n`;

/** A speaker, the server and the network between them, driven by `clock`. */
export class FakeConfigureWorld {
  readonly config: FakeWorldConfig;
  readonly clock: SchedulingClock;
  readonly log = new MemoryLog();
  readonly events: WorldEvent[] = [];

  host: string;
  up = true;
  /** The addresses the speaker runs with. */
  running: ServerUrls;
  /** What `envswitch boseurls set` saved; restored at restart. */
  saved: ServerUrls;
  margeAccountUUID: string;
  /** Account set over the console; applies at restart. */
  pendingAccount: string | undefined;
  restarts = 0;
  /** Server side: presets per `account/device`. */
  readonly storedPresets = new Map<string, Preset[]>();
  /** Server side: last request per device. */
  readonly contacts = new Map<string, number>();
  readonly #listeners = new Set<() => void>();
  readonly #openConnections = new Set<FakeConsoleConnection>();

  constructor(config: FakeWorldConfig, clock: SchedulingClock) {
    this.config = config;
    this.clock = clock;
    this.host = config.speaker.host;
    this.running = { ...(config.speaker.urls ?? BOSE_URLS) };
    this.saved = { ...this.running };
    this.margeAccountUUID = config.speaker.margeAccountUUID ?? "";
  }

  get openConsoles(): number {
    return this.#openConnections.size;
  }

  record(kind: WorldEvent["kind"], detail?: string): void {
    this.events.push({
      at: this.clock.now(),
      kind,
      ...(detail === undefined ? {} : { detail }),
    });
  }

  firstEvent(kind: WorldEvent["kind"]): WorldEvent | undefined {
    return this.events.find((event) => event.kind === kind);
  }

  onChange(listener: () => void): () => void {
    this.#listeners.add(listener);
    return () => {
      this.#listeners.delete(listener);
    };
  }

  #changed(): void {
    for (const listener of [...this.#listeners]) {
      listener();
    }
  }

  /** The speaker makes a request to the server (e.g. `power_on`). */
  contactServer(): void {
    this.contacts.set(this.config.speaker.deviceID, this.clock.now());
    this.record("contact");
  }

  info(): SpeakerInfo {
    return {
      deviceID: this.config.speaker.deviceID,
      name: this.config.speaker.name,
      margeURL: this.running.margeServerUrl,
      margeAccountUUID: this.margeAccountUUID,
    };
  }

  /** The console's answer to `command`; `closed` for `sys reboot`. */
  runCommand(command: string): Result<string, ConsoleFailure> {
    const speaker = this.config.speaker;
    this.record(
      command === "sys reboot" ? "restartCommand" : "command",
      command,
    );
    if (speaker.refuses !== undefined && command.startsWith(speaker.refuses)) {
      return Result.ok("Command not found\r\n-> ");
    }
    const words = command.split(" ");
    if (words[0] === "sys" && words[1] === "configuration") {
      const field = words[2] as keyof ServerUrls;
      if (
        SERVER_URL_FIELDS.includes(field) &&
        !speaker.ignoresSysConfiguration
      ) {
        this.running[field] = words[3] ?? "";
      }
      return Result.ok("OK\r\n-> ");
    }
    if (words[0] === "envswitch" && words[1] === "boseurls") {
      this.running.margeServerUrl = words[3] ?? "";
      this.running.swUpdateUrl = words[4] ?? "";
      if (!speaker.forgetsAtRestart) {
        this.saved = { ...this.running };
      }
      return Result.ok(
        `Setting Bose Server URLs to ${words[3]} and ${words[4]} ->`,
      );
    }
    if (words[0] === "envswitch" && words[1] === "accountid") {
      this.pendingAccount = words[3];
      return Result.ok("-> ");
    }
    if (command === "getpdo CurrentSystemConfiguration") {
      return Result.ok(
        SERVER_URL_FIELDS.map((field) =>
          block(field, this.running[field]),
        ).join(""),
      );
    }
    if (command === "sys reboot") {
      this.#restart();
      return Result.err({
        reason: "closed",
        message: "Connection closed by the speaker",
      });
    }
    return Result.ok("Command not found\r\n-> ");
  }

  #restart(): void {
    const speaker = this.config.speaker;
    this.restarts++;
    this.clock.schedule(speaker.shutdownDelayMs ?? 1000, () => {
      this.up = false;
      for (const connection of [...this.#openConnections]) {
        connection.dropped();
      }
      this.record("down");
      this.#changed();
      this.clock.schedule(speaker.restartMs ?? 40_000, () => {
        this.running = { ...this.saved };
        if (this.pendingAccount !== undefined) {
          this.margeAccountUUID = this.pendingAccount;
        }
        this.host = speaker.hostAfterRestart ?? this.host;
        this.up = true;
        this.record("up");
        if (
          (speaker.contactsServer ?? true) &&
          this.running.margeServerUrl === this.config.server.origin
        ) {
          this.contactServer();
        }
        this.#changed();
      });
    });
  }

  connectionOpened(connection: FakeConsoleConnection): void {
    this.#openConnections.add(connection);
  }

  connectionClosed(connection: FakeConsoleConnection): void {
    this.#openConnections.delete(connection);
  }

  deps(): ConfigureDeps {
    return {
      speaker: new FakeSpeakerPort(this),
      console: new FakeConsolePort(this),
      server: new FakeServerPort(this),
      discovery: {
        browse: (signal) => browse(this, signal),
      },
      clock: this.clock,
      log: this.log,
    };
  }
}

/** Settles after `ms` of the world's time, like a request on the network. */
async function delay(
  world: FakeConfigureWorld,
  ms: number,
  signal: AbortSignal,
): Promise<void> {
  await world.clock.sleep(ms, signal);
}

class FakeSpeakerPort implements SpeakerPort {
  readonly #world: FakeConfigureWorld;

  constructor(world: FakeConfigureWorld) {
    this.#world = world;
  }

  #reachable(host: string): boolean {
    return this.#world.up && host === this.#world.host;
  }

  /** A request to a speaker that is down hangs until the caller's timeout. */
  async #answer<Value>(
    host: string,
    signal: AbortSignal,
    reply: () => Result<Value, PortFailure>,
  ): Promise<Result<Value, PortFailure>> {
    await delay(this.#world, 50, signal);
    if (!this.#reachable(host)) {
      await new Promise<never>((_resolve, reject) => {
        signal.addEventListener("abort", () => {
          reject(new AbortedError());
        });
      });
    }
    return reply();
  }

  async info(host: string, signal: AbortSignal) {
    return this.#answer(host, signal, () => Result.ok(this.#world.info()));
  }

  async presets(host: string, signal: AbortSignal) {
    return this.#answer(host, signal, () =>
      Result.ok(this.#world.config.speaker.presets ?? []),
    );
  }

  async setMargeAccount(host: string, accountId: string, signal: AbortSignal) {
    return this.#answer(host, signal, (): Result<void, PortFailure> => {
      if (this.#world.config.speaker.noHttpPairing) {
        return Result.err(new PortFailure({ message: "HTTP 404" }));
      }
      this.#world.margeAccountUUID = accountId;
      return Result.ok(undefined);
    });
  }

  async sourcesUpdated(host: string, _deviceID: string, signal: AbortSignal) {
    return this.#answer(host, signal, (): Result<void, PortFailure> => {
      if (
        this.#world.running.margeServerUrl === this.#world.config.server.origin
      ) {
        // Fetches the sources from the server it now uses.
        this.#world.contactServer();
      }
      return Result.ok(undefined);
    });
  }
}

class FakeConsoleConnection implements ConsoleConnection {
  readonly #world: FakeConfigureWorld;
  #open = true;

  constructor(world: FakeConfigureWorld) {
    this.#world = world;
    world.connectionOpened(this);
  }

  dropped(): void {
    this.#open = false;
    this.#world.connectionClosed(this);
  }

  async run(command: string): Promise<Result<string, ConsoleFailure>> {
    if (!this.#open) {
      return Result.err({
        reason: "notConnected",
        message: "Client not connected",
      });
    }
    await this.#world.clock.sleep(600, new AbortController().signal);
    if (!this.#open) {
      return Result.err({
        reason: "closed",
        message: "Connection closed by the speaker",
      });
    }
    const reply = this.#world.runCommand(command);
    if (reply.isErr() && reply.error.reason === "closed") {
      this.dropped();
    }
    return reply;
  }

  close(): void {
    if (this.#open) {
      this.dropped();
    }
  }
}

class FakeConsolePort implements ConsolePort {
  readonly #world: FakeConfigureWorld;

  constructor(world: FakeConfigureWorld) {
    this.#world = world;
  }

  async open(host: string): Promise<Result<ConsoleConnection, PortFailure>> {
    const world = this.#world;
    await world.clock.sleep(200, new AbortController().signal);
    if (
      !world.up ||
      host !== world.host ||
      world.config.speaker.consoleClosed
    ) {
      return Result.err(new PortFailure({ message: "Connection refused" }));
    }
    return Result.ok(new FakeConsoleConnection(world));
  }
}

class FakeServerPort implements ServerPort {
  readonly #world: FakeConfigureWorld;

  constructor(world: FakeConfigureWorld) {
    this.#world = world;
  }

  origin(): string {
    return this.#world.config.server.origin;
  }

  async householdAccount(
    speaker: SpeakerAccount,
  ): Promise<Result<string, PortFailure>> {
    await delay(this.#world, 100, new AbortController().signal);
    if (speaker.margeAccountUUID) {
      return Result.ok(speaker.margeAccountUUID);
    }
    const minted =
      this.#world.config.mintedAccountId ??
      "4f0c6d1e-7c1a-4b8e-9f3a-2d5b6c7e8f90";
    this.#world.record("accountMinted", minted);
    return Result.ok(minted);
  }

  async savePresets(
    accountId: string,
    deviceID: string,
    presets: Preset[],
    signal: AbortSignal,
  ): Promise<Result<void, PortFailure>> {
    await delay(this.#world, 100, signal);
    if (this.#world.config.server.rejectsPresets) {
      return Result.err(new PortFailure({ message: "HTTP 500" }));
    }
    this.#world.storedPresets.set(`${accountId}/${deviceID}`, presets);
    this.#world.record("presetsSaved");
    return Result.ok(undefined);
  }

  async lastContact(
    deviceID: string,
    signal: AbortSignal,
  ): Promise<Result<LastContact, PortFailure>> {
    await delay(this.#world, 100, signal);
    if (this.#world.config.server.noContactEndpoint) {
      return Result.ok({ supported: false });
    }
    return Result.ok({
      supported: true,
      at: this.#world.contacts.get(deviceID) ?? null,
    });
  }
}

/** Yields the speaker's mDNS service whenever it's up, and again after each change. */
async function* browse(
  world: FakeConfigureWorld,
  signal: AbortSignal,
): AsyncGenerator<DiscoveredService> {
  for (;;) {
    if (signal.aborted) {
      return;
    }
    if (world.up && (world.config.speaker.announces ?? true)) {
      yield {
        host: world.host,
        port: 8090,
        mac: world.config.speaker.deviceID,
      };
    }
    await new Promise<void>((resolve) => {
      const stop = world.onChange(() => {
        stop();
        resolve();
      });
      signal.addEventListener("abort", () => {
        stop();
        resolve();
      });
    });
  }
}
