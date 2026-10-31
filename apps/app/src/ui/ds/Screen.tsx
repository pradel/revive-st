import type { ReactNode } from "react";
import { Platform, StyleSheet, View, type ViewStyle } from "react-native";
import { SafeAreaView, type Edge } from "react-native-safe-area-context";

export interface ScreenProps {
  children: ReactNode;
  /** Pinned below the content and above the bottom inset (e.g. `MiniPlayer`). */
  footer?: ReactNode;
  /** Full-bleed layer drawn behind the safe area (e.g. blurred artwork). */
  backdrop?: ReactNode;
  /**
   * - `stack`: below a native stack header, which already clears the status
   *   bar. Title and actions belong to the header (`Stack.Title`,
   *   `Stack.Toolbar`).
   * - `fullscreen`: headerless; content is kept clear of the status bar.
   * - `sheet`: presented as a sheet that already starts below the status bar,
   *   so only the bottom (gesture bar) inset applies.
   */
  presentation?: "stack" | "fullscreen" | "sheet";
  /**
   * The screen is a tab. On Android the tab bar below it already clears the
   * gesture bar, so the footer sits right on the tab bar instead of above a
   * second inset. iOS reports the tab bar in the safe area, so it keeps it.
   */
  inTabs?: boolean;
}

const edges: Record<NonNullable<ScreenProps["presentation"]>, Edge[]> = {
  stack: [],
  fullscreen: ["top"],
  sheet: ["bottom"],
};

/**
 * Screen root: lays out content → footer, keeping clear of the system bars
 * that no native header covers. The `bg` color comes from the stack's
 * `contentStyle`: a background here would make the root a real native view,
 * which hides the screen's scroll view from iOS and stops the large title
 * from collapsing.
 */
export function Screen({
  children,
  footer,
  backdrop,
  presentation = "stack",
  inTabs = false,
}: ScreenProps) {
  return (
    <View style={$fill}>
      {backdrop ? (
        <View style={StyleSheet.absoluteFill}>{backdrop}</View>
      ) : null}
      <SafeAreaView style={$fill} edges={edges[presentation]}>
        <View style={$fill}>{children}</View>
        {footer ? (
          inTabs && Platform.OS === "android" ? (
            footer
          ) : (
            <SafeAreaView edges={["bottom"]}>{footer}</SafeAreaView>
          )
        ) : null}
      </SafeAreaView>
    </View>
  );
}

const $fill: ViewStyle = {
  flex: 1,
};
