import type { KeyState, KeyValue } from "./common.ts";

export interface KeyPressRequest {
  key: KeyValue;
  state: KeyState;
  sender: string;
}
