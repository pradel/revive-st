import {
  describe,
  expect,
  it,
  vi,
  beforeEach,
  afterEach,
} from "vite-plus/test";

import {
  TelnetClient,
  TelnetConnectionError,
  TelnetCommandError,
  type SocketModuleLike,
  type TcpSocketLike,
} from "./telnet.ts";

class MockTcpSocket implements TcpSocketLike {
  write = vi.fn();
  destroy = vi.fn();
  onHandlers: Record<string, ((...args: unknown[]) => void)[]> = {};

  on(event: string, handler: (...args: unknown[]) => void) {
    if (!this.onHandlers[event]) {
      this.onHandlers[event] = [];
    }
    this.onHandlers[event].push(handler);
    return this;
  }

  off(event: string, handler: (...args: unknown[]) => void) {
    if (this.onHandlers[event]) {
      this.onHandlers[event] = this.onHandlers[event].filter(
        (handlerItem) => handlerItem !== handler,
      );
    }
    return this;
  }

  trigger(event: string, ...args: unknown[]) {
    const handlers = this.onHandlers[event] || [];
    for (const handler of handlers) {
      handler(...args);
    }
  }
}

class MockSocketModule implements SocketModuleLike {
  mockSocket: MockTcpSocket | null = null;
  createConnection = vi.fn(
    (
      _options: { host: string; port: number },
      connectionListener?: () => void,
    ) => {
      this.mockSocket = new MockTcpSocket();
      if (connectionListener) {
        // Trigger callback on next tick to simulate async connection completion
        setTimeout(connectionListener, 0);
      }
      return this.mockSocket;
    },
  );
}

describe("TelnetClient", () => {
  let mockSocketModule: MockSocketModule;
  let client: TelnetClient;

  beforeEach(() => {
    vi.useFakeTimers();
    mockSocketModule = new MockSocketModule();
    client = new TelnetClient({
      host: "192.168.1.10",
      port: 17000,
      socket: mockSocketModule,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  /** Connects with no greeting from the speaker. */
  async function connectQuietly() {
    const connectPromise = client.connect();
    await vi.advanceTimersByTimeAsync(1500);
    const result = await connectPromise;
    expect(result.isOk()).toBe(true);
    return mockSocketModule.mockSocket!;
  }

  describe("connect", () => {
    it("should resolve with Ok(undefined) on successful connection", async () => {
      await connectQuietly();
      expect(mockSocketModule.createConnection).toHaveBeenCalledWith(
        { host: "192.168.1.10", port: 17000 },
        expect.any(Function),
      );
    });

    it("should resolve with Err(TelnetConnectionError) when socket triggers an error", async () => {
      const connectPromise = client.connect();

      // Wait a microtask so mockSocket is instantiated
      await Promise.resolve();
      expect(mockSocketModule.mockSocket).not.toBeNull();

      mockSocketModule.mockSocket?.trigger(
        "error",
        new Error("Connection refused"),
      );

      const result = await connectPromise;
      expect(result.isOk()).toBe(false);
      if (!result.isOk()) {
        expect(result.error).toBeInstanceOf(TelnetConnectionError);
        expect(result.error.message).toBe("Connection refused");
      }
    });

    it("should resolve with Err(TelnetConnectionError) when socket triggers a timeout", async () => {
      const connectPromise = client.connect();

      await Promise.resolve();
      mockSocketModule.mockSocket?.trigger("timeout");

      const result = await connectPromise;
      expect(result.isOk()).toBe(false);
      if (!result.isOk()) {
        expect(result.error).toBeInstanceOf(TelnetConnectionError);
        expect(result.error.message).toBe("Telnet connection timed out");
      }
    });

    it("does not take the greeting for the first command's reply", async () => {
      const connectPromise = client.connect();
      await vi.advanceTimersByTimeAsync(0);
      const socket = mockSocketModule.mockSocket!;
      socket.trigger("data", "Welcome to the TAP console\r\n-> ");
      await vi.advanceTimersByTimeAsync(300);
      expect((await connectPromise).isOk()).toBe(true);

      const cmdPromise = client.executeCommand("sys ver");
      socket.trigger("data", "OK\r\n");
      await vi.advanceTimersByTimeAsync(600);

      const result = await cmdPromise;
      expect(result.isOk() && result.value).toBe("OK\r\n");
    });
  });

  describe("executeCommand", () => {
    it("should return Err(TelnetCommandError) when client is not connected", async () => {
      const result = await client.executeCommand("sys reboot");
      expect(result.isOk()).toBe(false);
      if (!result.isOk()) {
        expect(result.error).toBeInstanceOf(TelnetCommandError);
        expect(result.error.reason).toBe("notConnected");
      }
    });

    it("resolves with the reply once the speaker goes quiet", async () => {
      const socket = await connectQuietly();

      const cmdPromise = client.executeCommand("sys info");
      expect(socket.write).toHaveBeenCalledWith("sys info\r\n");

      // Chunks closer together than the quiet period belong to one reply.
      socket.trigger("data", "SoundTouch 10\r\n");
      await vi.advanceTimersByTimeAsync(500);
      socket.trigger("data", "OK\r\n");
      await vi.advanceTimersByTimeAsync(599);
      let settled = false;
      void cmdPromise.then(() => {
        settled = true;
      });
      await vi.advanceTimersByTimeAsync(0);
      expect(settled).toBe(false);
      await vi.advanceTimersByTimeAsync(1);

      const result = await cmdPromise;
      expect(result.isOk() && result.value).toBe("SoundTouch 10\r\nOK\r\n");
    });

    it("waits for a slow first byte instead of returning an empty reply", async () => {
      const socket = await connectQuietly();

      const cmdPromise = client.executeCommand(
        "getpdo CurrentSystemConfiguration",
      );
      await vi.advanceTimersByTimeAsync(2500);
      socket.trigger("data", "margeServerUrl {\r\n");
      await vi.advanceTimersByTimeAsync(600);

      const result = await cmdPromise;
      expect(result.isOk() && result.value).toBe("margeServerUrl {\r\n");
    });

    it("fails with noReply when nothing comes back before the timeout", async () => {
      await connectQuietly();

      const cmdPromise = client.executeCommand("sys info", { timeoutMs: 2000 });
      await vi.advanceTimersByTimeAsync(2000);

      const result = await cmdPromise;
      expect(!result.isOk() && result.error.reason).toBe("noReply");
    });

    it("fails with closed, keeping the partial reply, when the speaker hangs up", async () => {
      const socket = await connectQuietly();

      const cmdPromise = client.executeCommand("sys reboot");
      socket.trigger("data", "Rebooting");
      socket.trigger("close", false);

      const result = await cmdPromise;
      expect(result.isOk()).toBe(false);
      if (!result.isOk()) {
        expect(result.error.reason).toBe("closed");
        expect(result.error.reply).toBe("Rebooting");
      }
      expect(client.isConnected).toBe(false);
    });

    it("should return Err(TelnetCommandError) if socket encounters an error during execution", async () => {
      const socket = await connectQuietly();

      const cmdPromise = client.executeCommand("sys info");
      socket.trigger("error", new Error("Socket write failed"));

      const result = await cmdPromise;
      expect(result.isOk()).toBe(false);
      if (!result.isOk()) {
        expect(result.error).toBeInstanceOf(TelnetCommandError);
        expect(result.error.reason).toBe("transport");
        expect(result.error.message).toBe("Socket write failed");
      }
    });

    it("refuses a second command while one is running", async () => {
      await connectQuietly();

      const first = client.executeCommand("sys info", { timeoutMs: 100 });
      const second = await client.executeCommand("sys ver");
      expect(!second.isOk() && second.error.reason).toBe("busy");
      await vi.advanceTimersByTimeAsync(100);
      await first;
    });
  });

  describe("disconnect", () => {
    it("should destroy the socket if connected", async () => {
      const socket = await connectQuietly();
      client.disconnect();

      expect(socket.destroy).toHaveBeenCalled();

      // Subsequent commands should fail since client is disconnected
      const result = await client.executeCommand("sys info");
      expect(!result.isOk() && result.error.reason).toBe("notConnected");
    });

    it("should do nothing if not connected", () => {
      expect(() => {
        client.disconnect();
      }).not.toThrow();
    });
  });
});
