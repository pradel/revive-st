import Code from "@expo/material-symbols/code.xml";
import Dns from "@expo/material-symbols/dns.xml";
import Forum from "@expo/material-symbols/forum.xml";
import Language from "@expo/material-symbols/language.xml";
import Refresh from "@expo/material-symbols/refresh.xml";
import Speaker from "@expo/material-symbols/speaker.xml";
import Terminal from "@expo/material-symbols/terminal.xml";
import type { IconName } from "@expo/ui";

export type FormIcon = Extract<IconName, { ios: unknown }>;

/** Row icons for forms: SF Symbol on iOS, Material Symbol drawable on Android. */
export const formIcons = {
  code: { ios: "chevron.left.forwardslash.chevron.right", android: Code },
  feedback: { ios: "bubble.left.and.bubble.right", android: Forum },
  refresh: { ios: "arrow.clockwise", android: Refresh },
  server: { ios: "server.rack", android: Dns },
  speaker: { ios: "hifispeaker.fill", android: Speaker },
  terminal: { ios: "terminal", android: Terminal },
  website: { ios: "globe", android: Language },
} as const satisfies Record<string, FormIcon>;
