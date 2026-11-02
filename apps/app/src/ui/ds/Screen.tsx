import { createContext, use, useState, type ReactNode } from "react";
import {
  Platform,
  ScrollView,
  StyleSheet,
  View,
  type ScrollViewProps,
  type ViewStyle,
} from "react-native";
import { SafeAreaView, type Edge } from "react-native-safe-area-context";

export interface ScreenProps {
  children: ReactNode;
  /**
   * Pinned at the bottom, above the bottom inset (e.g. `MiniPlayer`). In a
   * tab on iOS it floats over the content, which scrolls under it in a
   * `ScreenScrollView`.
   */
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

const FooterInset = createContext(0);

/**
 * A scroll view whose end scrolls clear of the screen's floating footer
 * (iOS tabs). Also a `FlatList`'s `renderScrollComponent`.
 */
export function ScreenScrollView(props: ScrollViewProps) {
  const footerInset = use(FooterInset);
  return (
    <ScrollView
      {...props}
      contentInset={{ ...props.contentInset, bottom: footerInset }}
      scrollIndicatorInsets={{
        ...props.scrollIndicatorInsets,
        bottom: footerInset,
      }}
    />
  );
}

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
  const [footerHeight, setFooterHeight] = useState(0);
  const floatingFooter = footer && inTabs && Platform.OS === "ios";
  return (
    <FooterInset value={floatingFooter ? footerHeight : 0}>
      <View style={$fill}>
        {backdrop ? (
          <View style={StyleSheet.absoluteFill}>{backdrop}</View>
        ) : null}
        <SafeAreaView style={$fill} edges={edges[presentation]}>
          <View style={$fill}>{children}</View>
          {footer && !floatingFooter ? (
            inTabs ? (
              footer
            ) : (
              <SafeAreaView edges={["bottom"]}>{footer}</SafeAreaView>
            )
          ) : null}
        </SafeAreaView>
        {floatingFooter ? (
          <SafeAreaView
            edges={["bottom"]}
            style={$floatingFooter}
            pointerEvents="box-none"
          >
            <View
              onLayout={(event) => {
                setFooterHeight(event.nativeEvent.layout.height);
              }}
            >
              {footer}
            </View>
          </SafeAreaView>
        ) : null}
      </View>
    </FooterInset>
  );
}

const $fill: ViewStyle = {
  flex: 1,
};

const $floatingFooter: ViewStyle = {
  position: "absolute",
  left: 0,
  right: 0,
  bottom: 0,
};
