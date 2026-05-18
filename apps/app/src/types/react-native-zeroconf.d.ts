declare module "react-native-zeroconf" {
  interface ZeroconfService {
    name: string;
    host: string;
    port: number;
    txt?: Record<string, string>;
  }

  type ZeroconfEvent = "resolved" | "error" | "found" | "remove";

  class Zeroconf {
    constructor();
    scan(type: string, protocol: string, domain: string): void;
    stop(): void;
    on(event: "resolved", callback: (service: ZeroconfService) => void): void;
    on(event: "error", callback: (error: Error) => void): void;
    on(event: "found", callback: (name: string) => void): void;
    on(event: "remove", callback: (name: string) => void): void;
    removeDeviceListeners(): void;
    removeListeners(): void;
  }

  export default Zeroconf;
}
