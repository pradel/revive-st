import type { ReactNode } from "react";
import { StyleSheet, View, type ViewStyle } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { color } from "@/ui/tokens";

import { LargeTitleHeader } from "./LargeTitleHeader";

export interface ScreenProps {
  children: ReactNode;
  /** Renders a `LargeTitleHeader` above the content. */
  title?: string;
  /** Trailing header actions; only used with `title`. */
  actions?: ReactNode;
  /** Pinned below the content and above the bottom inset (e.g. `MiniPlayer`). */
  footer?: ReactNode;
  /** Full-bleed layer drawn behind the safe area (e.g. blurred artwork). */
  backdrop?: ReactNode;
  /**
   * `sheet`: the screen is presented as a sheet that already starts below the
   * status bar, so only the bottom (gesture bar) inset applies.
   */
  presentation?: "screen" | "sheet";
}

/**
 * Screen root: keeps content clear of the status bar (or, for sheets, of the
 * gesture bar) and lays out header → content → footer on the `bg` color.
 */
export function Screen({
  children,
  title,
  actions,
  footer,
  backdrop,
  presentation = "screen",
}: ScreenProps) {
  return (
    <View style={$root}>
      {backdrop ? (
        <View style={StyleSheet.absoluteFill}>{backdrop}</View>
      ) : null}
      <SafeAreaView
        style={$safeArea}
        edges={presentation === "sheet" ? ["bottom"] : ["top"]}
      >
        {title ? <LargeTitleHeader title={title} actions={actions} /> : null}
        <View style={$content}>{children}</View>
        {footer ? (
          <SafeAreaView edges={["bottom"]}>{footer}</SafeAreaView>
        ) : null}
      </SafeAreaView>
    </View>
  );
}

const $root: ViewStyle = {
  flex: 1,
  backgroundColor: color.bg,
};

const $safeArea: ViewStyle = {
  flex: 1,
};

const $content: ViewStyle = {
  flex: 1,
};
