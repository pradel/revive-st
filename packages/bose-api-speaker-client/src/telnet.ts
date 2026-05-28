import { Err, Ok, type Result, TaggedError } from "better-result";

export class TelnetConnectionError extends TaggedError(
  "TelnetConnectionError",
)<{
  host: string;
  message: string;
  cause?: unknown;
}>() {}

export class TelnetCommandError extends TaggedError("TelnetCommandError")<{
  command: string;
  message: string;
  cause?: unknown;
}>() {}

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
    this.connectTimeoutMs = options.connectTimeoutMs ?? 10000;
  }

  get isConnected(): boolean {
    return this.client !== null;
  }

  async connect(): Promise<Result<void, TelnetConnectionError>> {
    if (this.client) {
      return new Ok(undefined);
    }

    return new Promise((resolve) => {
      let resolved = false;

      const connection = this.socket.createConnection(
        { host: this.host, port: this.port },
        () => {
          cleanup();
          // Register a fallback no-op error handler to prevent unhandled node crashes when socket is idle
          connection.on("error", () => {
            // Silent fallback to prevent unhandled crashes
          });
          this.client = connection;
          resolved = true;
          resolve(new Ok(undefined));
        },
      );

      const errorHandler = (error: unknown) => {
        cleanup();
        connection.destroy();
        resolved = true;
        resolve(
          new Err(
            new TelnetConnectionError({
              host: this.host,
              message: error instanceof Error ? error.message : String(error),
              cause: error,
            }),
          ),
        );
      };

      const timeoutHandler = () => {
        cleanup();
        connection.destroy();
        resolved = true;
        resolve(
          new Err(
            new TelnetConnectionError({
              host: this.host,
              message: "Telnet connection timed out",
            }),
          ),
        );
      };

      connection.on("error", errorHandler);
      connection.on("timeout", timeoutHandler);

      const timer = setTimeout(() => {
        if (!resolved) {
          cleanup();
          connection.destroy();
          resolve(
            new Err(
              new TelnetConnectionError({
                host: this.host,
                message: `Connection timed out after ${this.connectTimeoutMs}ms`,
              }),
            ),
          );
        }
      }, this.connectTimeoutMs);

      const cleanup = () => {
        clearTimeout(timer);
        connection.off("error", errorHandler);
        connection.off("timeout", timeoutHandler);
      };
    });
  }

  async executeCommand(
    command: string,
    waitMs = 500,
  ): Promise<Result<string, TelnetCommandError>> {
    if (!this.client) {
      return new Err(
        new TelnetCommandError({
          command,
          message: "Client not connected",
        }),
      );
    }

    if (this.isExecuting) {
      return new Err(
        new TelnetCommandError({
          command,
          message: "Another command is currently executing",
        }),
      );
    }

    this.isExecuting = true;

    return new Promise((resolve) => {
      let response = "";

      const dataHandler = (data: unknown) => {
        const chunk = String(data);
        response += chunk;
      };

      const errorHandler = (error: unknown) => {
        cleanup();
        resolve(
          new Err(
            new TelnetCommandError({
              command,
              message: error instanceof Error ? error.message : String(error),
              cause: error,
            }),
          ),
        );
      };

      this.client?.on("data", dataHandler);
      this.client?.on("error", errorHandler);

      const timer = setTimeout(() => {
        cleanup();
        resolve(new Ok(response));
      }, waitMs);

      const cleanup = () => {
        this.isExecuting = false;
        clearTimeout(timer);
        this.client?.off("data", dataHandler);
        this.client?.off("error", errorHandler);
      };

      this.client?.write(`${command}\r\n`);
    });
  }

  disconnect() {
    if (this.client) {
      this.client.destroy();
      this.client = null;
    }
  }
}
