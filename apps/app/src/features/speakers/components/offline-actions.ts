import { nativeIcons } from "@/ui/nativeIcons";

import { speakerRegistry } from "../registry/store";

/** Something to do with a speaker that didn't answer. */
export interface OfflineSpeakerAction {
  id: "retry" | "forget";
  title: string;
  icon: (typeof nativeIcons)[keyof typeof nativeIcons];
  destructive?: boolean;
  run: (deviceID: string) => void;
}

/** What Home's long-press menu and Settings offer for an offline speaker. */
export const OFFLINE_SPEAKER_ACTIONS: readonly OfflineSpeakerAction[] = [
  {
    id: "retry",
    title: "Try again",
    icon: nativeIcons.refresh,
    run: (deviceID) => {
      speakerRegistry.retry(deviceID);
    },
  },
  {
    id: "forget",
    title: "Forget speaker",
    icon: nativeIcons.delete,
    destructive: true,
    run: (deviceID) => {
      speakerRegistry.forget(deviceID);
    },
  },
];
