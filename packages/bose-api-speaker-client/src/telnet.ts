import { Err, Ok, type Result, TaggedError } from "better-result";

export class TelnetConnectionError extends TaggedError(
  "TelnetConnectionError",
)<{
  host: string;
  message: string;
  cause?: unknown;
}> {}

/**
 * Why a command failed:
 * - `notConnected` / `busy`: nothing was sent.
 * - `noReply`: sent, but nothing came back before the timeout.
 * - `closed`: the speaker closed the connection (e.g. `sys reboot`); `reply`
 *   holds what arrived before.
 * - `transport`: a socket error.
 */
export type TelnetCommandFailure =
  | "notConnected"
  | "busy"
  | "noReply"
  | "closed"
  | "transport";

export class TelnetCommandError extends TaggedError("TelnetCommandError")<{
  command: string;
  reason: TelnetCommandFailure;
  message: string;
  /** What the speaker sent before the failure. */
  reply?: string;
  cause?: unknown;
}> {}

export interface TcpSocketLike {
  write: (data: string) => void;
  destroy: () => void;
  on: (event: string, listener: (...args: unknown[]) => void) => unknown;
  off: (event: string, listener: (...args: unknown[]) => void) => unknown;
}

export interface SocketModuleLike {
  createConnection: (
    options: { host: string; port: number },
    connectionListener?: () => void,
  ) => TcpSocketLike;
}

export interface TelnetClientOptions {
  host: string;
  port?: number;
  socket: SocketModuleLike;
  connectTimeoutMs?: number;
}

export interface TelnetCommandOptions {
  /** The reply is complete once the speaker has been silent this long after its first byte. */
  quietMs?: number;
  /** Give up after this long; whatever arrived by then is the reply. */
  timeoutMs?: number;
}

/**
 * Firmware 27.0.6 sometimes takes over 2 s to accept a connection or answer
 * a command (repos/Bose-SoundTouch pkg/telnet).
 */
const DEFAULT_CONNECT_TIMEOUT_MS = 5000;
const DEFAULT_QUIET_MS = 600;
const DEFAULT_REPLY_TIMEOUT_MS = 7000;
/** The console may greet a new connection; it's read and dropped so it isn't taken for the first reply. */
const BANNER_QUIET_MS = 300;
const BANNER_TIMEOUT_MS = 1500;

/**
 * The SoundTouch TAP console (port 17000): plain TCP, one command at a time,
 * each followed by CRLF. A reply is whatever the speaker sends until it goes
 * quiet; replies are not interpreted here.
 */
export class TelnetClient {
  private client: TcpSocketLike | null = null;
  private isExecuting = false;
  private readonly host: string;
  private readonly port: number;
  private readonly socket: SocketModuleLike;
  private readonly connectTimeoutMs: number;

  constructor(options: TelnetClientOptions) {
    this.host = options.host;
    this.port = options.port ?? 17000;
    this.socket = options.socket;
    this.connectTimeoutMs =
      options.connectTimeoutMs ?? DEFAULT_CONNECT_TIMEOUT_MS;
  }

  get isConnected(): boolean {
    return this.client !== null;
  }

  /** Connects, then reads and drops any greeting. */
  async connect(): Promise<Result<void, TelnetConnectionError>> {
    if (this.client) {
      return new Ok(undefined);
    }

    const opened = await this.open();
    if (opened.isErr()) {
      return opened;
    }
    await this.exchange("<banner>", undefined, {
      quietMs: BANNER_QUIET_MS,
      timeoutMs: BANNER_TIMEOUT_MS,
    });
    return new Ok(undefined);
  }

  private async open(): Promise<Result<void, TelnetConnectionError>> {
    return new Promise((resolve) => {
      let settled = false;

      const fail = (message: string, cause?: unknown) => {
        if (settled) {
          return;
        }
        settled = true;
        cleanup();
        connection.destroy();
        resolve(
          new Err(
            new TelnetConnectionError({
              host: this.host,
              message,
              ...(cause === undefined ? {} : { cause }),
            }),
          ),
        );
      };

      const connection = this.socket.createConnection(
        { host: this.host, port: this.port },
        () => {
          if (settled) {
            return;
          }
          settled = true;
          cleanup();
          // Idle sockets may still emit errors; an unhandled one would crash.
          connection.on("error", () => undefined);
          connection.on("close", () => {
            if (this.client === connection) {
              this.client = null;
            }
          });
          this.client = connection;
          resolve(new Ok(undefined));
        },
      );

      const errorHandler = (error: unknown) => {
        fail(error instanceof Error ? error.message : String(error), error);
      };
      const timeoutHandler = () => {
        fail("Telnet connection timed out");
      };

      connection.on("error", errorHandler);
      connection.on("timeout", timeoutHandler);

      const timer = setTimeout(() => {
        fail(`Connection timed out after ${this.connectTimeoutMs}ms`);
      }, this.connectTimeoutMs);

      const cleanup = () => {
        clearTimeout(timer);
        connection.off("error", errorHandler);
        connection.off("timeout", timeoutHandler);
      };
    });
  }

  /**
   * Sends `command` and resolves with the speaker's reply once it goes quiet.
   * `Err` when nothing was sent, nothing came back, or the connection failed.
   */
  async executeCommand(
    command: string,
    options: TelnetCommandOptions = {},
  ): Promise<Result<string, TelnetCommandError>> {
    if (!this.client) {
      return new Err(
        new TelnetCommandError({
          command,
          reason: "notConnected",
          message: "Client not connected",
        }),
      );
    }
    if (this.isExecuting) {
      return new Err(
        new TelnetCommandError({
          command,
          reason: "busy",
          message: "Another command is currently executing",
        }),
      );
    }
    return this.exchange(command, `${command}\r\n`, options);
  }

  /** Writes `line` (if any) and collects the reply. */
  private async exchange(
    command: string,
    line: string | undefined,
    options: TelnetCommandOptions,
  ): Promise<Result<string, TelnetCommandError>> {
    const client = this.client;
    if (!client) {
      return new Err(
        new TelnetCommandError({
          command,
          reason: "notConnected",
          message: "Client not connected",
        }),
      );
    }
    const quietMs = options.quietMs ?? DEFAULT_QUIET_MS;
    const timeoutMs = options.timeoutMs ?? DEFAULT_REPLY_TIMEOUT_MS;
    this.isExecuting = true;

    return new Promise((resolve) => {
      let reply = "";
      let quietTimer: ReturnType<typeof setTimeout> | undefined;

      const finish = (result: Result<string, TelnetCommandError>) => {
        cleanup();
        resolve(result);
      };
      const failure = (
        reason: TelnetCommandFailure,
        message: string,
        cause?: unknown,
      ) =>
        new Err<string, TelnetCommandError>(
          new TelnetCommandError({
            command,
            reason,
            message,
            ...(reply === "" ? {} : { reply }),
            ...(cause === undefined ? {} : { cause }),
          }),
        );

      const dataHandler = (data: unknown) => {
        reply += String(data);
        clearTimeout(quietTimer);
        quietTimer = setTimeout(() => {
          finish(new Ok(reply));
        }, quietMs);
      };
      const errorHandler = (error: unknown) => {
        finish(
          failure(
            "transport",
            error instanceof Error ? error.message : String(error),
            error,
          ),
        );
      };
      const closeHandler = () => {
        if (this.client === client) {
          this.client = null;
        }
        finish(failure("closed", "Connection closed by the speaker"));
      };

      const overall = setTimeout(() => {
        finish(
          reply === ""
            ? failure("noReply", `No reply within ${timeoutMs}ms`)
            : new Ok(reply),
        );
      }, timeoutMs);

      const cleanup = () => {
        this.isExecuting = false;
        clearTimeout(quietTimer);
        clearTimeout(overall);
        client.off("data", dataHandler);
        client.off("error", errorHandler);
        client.off("close", closeHandler);
      };

      client.on("data", dataHandler);
      client.on("error", errorHandler);
      client.on("close", closeHandler);
      if (line !== undefined) {
        client.write(line);
      }
    });
  }

  disconnect() {
    if (this.client) {
      const client = this.client;
      this.client = null;
      client.destroy();
    }
  }
}
