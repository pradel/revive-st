import {
  MenuView,
  type MenuAction,
  type MenuComponentRef,
} from "@expo/ui/community/menu";
import { useState } from "react";
import { Platform, View, type ViewStyle } from "react-native";

import { haptics } from "@/lib/haptics";

import type { ContextMenuAction, ContextMenuProps } from "./ContextMenu.types";

export type {
  ContextMenuAction,
  ContextMenuConfig,
  ContextMenuProps,
} from "./ContextMenu.types";

function toMenuAction(action: ContextMenuAction): MenuAction {
  return {
    id: action.id,
    title: action.title,
    image: action.icon,
    attributes: {
      destructive: action.destructive,
      disabled: action.disabled,
    },
    state:
      action.checked === undefined ? undefined : action.checked ? "on" : "off",
    subactions: action.actions?.map(toMenuAction),
  };
}

/**
 * Long-press menu: a Material dropdown on Android. `ContextMenu.ios.tsx`
 * shows the system context menu instead.
 *
 * The trigger stays plain React Native: the dropdown hangs off an empty
 * anchor pinned under the trigger's leading edge, because hosting the
 * trigger itself inside Compose lays its text out unconstrained.
 */
export function ContextMenu({
  actions,
  onAction,
  children,
  fill = false,
}: ContextMenuProps) {
  // Held in state, not a ref: `openMenu` is handed to the trigger at render.
  const [menu, setMenu] = useState<MenuComponentRef | null>(null);
  const openMenu =
    Platform.OS === "android"
      ? () => {
          haptics.longPress();
          menu?.show();
        }
      : undefined;

  return (
    <View style={fill ? $fill : undefined}>
      {children(openMenu)}
      <MenuView
        ref={setMenu}
        style={$anchor}
        actions={actions.map(toMenuAction)}
        onPressAction={({ nativeEvent }) => {
          onAction(nativeEvent.event);
        }}
      >
        <View style={$anchorSize} />
      </MenuView>
    </View>
  );
}

const $fill: ViewStyle = {
  flex: 1,
};

const $anchor: ViewStyle = {
  position: "absolute",
  left: 0,
  bottom: 0,
};

// A 1pt anchor never composes, so the dropdown wouldn't open.
const $anchorSize: ViewStyle = {
  width: 8,
  height: 8,
};
