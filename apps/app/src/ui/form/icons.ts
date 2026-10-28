import Code from "@expo/material-symbols/code.xml";
import Language from "@expo/material-symbols/language.xml";
import Refresh from "@expo/material-symbols/refresh.xml";
import Speaker from "@expo/material-symbols/speaker.xml";
import Terminal from "@expo/material-symbols/terminal.xml";
import type { IconName } from "@expo/ui";

export type FormIcon = Extract<IconName, { ios: unknown }>;

/** Row icons for forms: SF Symbol on iOS, Material Symbol drawable on Android. */
export const formIcons = {
  code: { ios: "chevron.left.forwardslash.chevron.right", android: Code },
  refresh: { ios: "arrow.clockwise", android: Refresh },
  speaker: { ios: "hifispeaker.fill", android: Speaker },
  terminal: { ios: "terminal", android: Terminal },
  website: { ios: "globe", android: Language },
} as const satisfies Record<string, FormIcon>;
