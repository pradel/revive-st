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

  describe("connect", () => {
    it("should resolve with Ok(undefined) on successful connection", async () => {
      const connectPromise = client.connect();

      // Trigger the setTimeout for connectionListener
      vi.advanceTimersByTime(0);

      const result = await connectPromise;
      expect(result.isOk()).toBe(true);
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
  });

  describe("executeCommand", () => {
    it("should return Err(TelnetCommandError) when client is not connected", async () => {
      const result = await client.executeCommand("sys reboot");
      expect(result.isOk()).toBe(false);
      if (!result.isOk()) {
        expect(result.error).toBeInstanceOf(TelnetCommandError);
        expect(result.error.message).toBe("Client not connected");
      }
    });

    it("should write command and collect data responses", async () => {
      // First, connect
      const connectPromise = client.connect();
      vi.advanceTimersByTime(0);
      await connectPromise;

      const cmdPromise = client.executeCommand("sys info", 100);

      await Promise.resolve();
      expect(mockSocketModule.mockSocket?.write).toHaveBeenCalledWith(
        "sys info\r\n",
      );

      // Simulate receiving data in chunks
      mockSocketModule.mockSocket?.trigger("data", "SoundTouch 10\r\n");
      mockSocketModule.mockSocket?.trigger("data", "OK\r\n");

      // Advance timers past command wait timeout (100ms)
      vi.advanceTimersByTime(100);

      const result = await cmdPromise;
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value).toBe("SoundTouch 10\r\nOK\r\n");
      }

      // Verify data and error listeners are cleaned up
      expect(mockSocketModule.mockSocket?.onHandlers.data).toHaveLength(0);
      expect(mockSocketModule.mockSocket?.onHandlers.error).toHaveLength(1);
    });

    it("should return Err(TelnetCommandError) if socket encounters an error during execution", async () => {
      const connectPromise = client.connect();
      vi.advanceTimersByTime(0);
      await connectPromise;

      const cmdPromise = client.executeCommand("sys info", 100);

      await Promise.resolve();
      mockSocketModule.mockSocket?.trigger(
        "error",
        new Error("Socket write failed"),
      );

      const result = await cmdPromise;
      expect(result.isOk()).toBe(false);
      if (!result.isOk()) {
        expect(result.error).toBeInstanceOf(TelnetCommandError);
        expect(result.error.message).toBe("Socket write failed");
      }

      // Verify cleanup occurred
      expect(mockSocketModule.mockSocket?.onHandlers.data).toHaveLength(0);
      expect(mockSocketModule.mockSocket?.onHandlers.error).toHaveLength(1);
    });
  });

  describe("disconnect", () => {
    it("should destroy the socket if connected", async () => {
      const connectPromise = client.connect();
      vi.advanceTimersByTime(0);
      await connectPromise;

      const socket = mockSocketModule.mockSocket;
      client.disconnect();

      expect(socket?.destroy).toHaveBeenCalled();

      // Subsequent commands should fail since client is disconnected
      const result = await client.executeCommand("sys info");
      expect(result.isOk()).toBe(false);
      if (!result.isOk()) {
        expect(result.error.message).toBe("Client not connected");
      }
    });

    it("should do nothing if not connected", () => {
      expect(() => {
        client.disconnect();
      }).not.toThrow();
    });
  });
});
