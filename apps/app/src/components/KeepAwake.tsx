import { useKeepAwake } from "expo-keep-awake";

/** Keeps the screen on while mounted; render it only while work is running. */
export function KeepAwake() {
  useKeepAwake();
  return null;
}
